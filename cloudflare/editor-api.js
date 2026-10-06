import { validateContent, mediaPaths, ContentError } from '../content-schema.js';
import { renderHomepage } from '../content-renderer.js';
// Publishes the editor's content as one Git commit: site-content.json, the re-rendered
// root index.html (so GitHub Pages stays complete) and any new photos. Never forces.
const API = 'https://api.github.com';
const enc = new TextEncoder();
const hex = bytes => [...new Uint8Array(bytes)].map(n => n.toString(16).padStart(2, '0')).join('');
const hash = async value => hex(await crypto.subtle.digest('SHA-256', value));
const utf8Base64 = text => { const bytes = enc.encode(text); let binary = ''; for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.slice(i, i + 8192)); return btoa(binary); };
const decodeText = encoded => new TextDecoder().decode(Uint8Array.from(atob(encoded.replace(/\s/g, '')), v => v.charCodeAt(0)));
const UPLOAD_LIMIT = 3 * 1024 * 1024;

export async function editorApi(request, env, helpers) {
 const { requireAdmin, ApiError, json, readLimited } = helpers;
 const url = new URL(request.url), route = url.pathname.slice('/api/editor'.length);
 await requireAdmin(request, env);
 if (!['GET', 'HEAD'].includes(request.method) && request.headers.get('Origin') !== url.origin) throw new ApiError(403, 'Cererea trebuie trimisă din panoul de administrare.');
 const repo = env.GITHUB_REPOSITORY || '';
 const branch = env.GITHUB_BRANCH || 'main';
 if (!/^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/.test(repo) || !/^[-a-zA-Z0-9_/.]+$/.test(branch)) throw new ApiError(503, 'Publicarea nu este încă configurată. Administratorul tehnic trebuie să seteze repository-ul GitHub.');
 if (!env.GITHUB_TOKEN) throw new ApiError(503, 'Publicarea nu este încă activată. Administratorul tehnic trebuie să conecteze contul de publicare.');
 async function github(path, method = 'GET', body) {
  const response = await fetch(API + '/repos/' + repo + path, { method, headers: { Authorization: 'Bearer ' + env.GITHUB_TOKEN, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'Lexyns-Clean-Editor', 'Content-Type': 'application/json' }, body: body instanceof ReadableStream ? body : body ? JSON.stringify(body) : undefined });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
   const conflict = response.status === 409 || response.status === 422;
   const error = new ApiError(conflict ? 409 : 502, conflict ? 'Site-ul a fost modificat între timp. Apasă „Reîncarcă ultima salvare” înainte să publici din nou.' : 'Publicarea nu a reușit. Modificările tale sunt păstrate; reîncearcă sau verifică accesul contului de publicare.');
   error.githubStatus = response.status; throw error;
  }
  return data;
 }
 const receiptBytes = upload => enc.encode(JSON.stringify([repo, upload.path, upload.sha, upload.size]));
 const receiptKey = () => crypto.subtle.importKey('raw', enc.encode(env.GITHUB_TOKEN), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);

 if (route === '/uploads' && request.method === 'POST') {
  if (Number(request.headers.get('Content-Length')) > UPLOAD_LIMIT) throw new ApiError(413, 'Fotografia pregătită este prea mare. Alege alta.');
  const bytes = await readLimited(request, UPLOAD_LIMIT);
  if (!bytes.length) throw new ApiError(400, 'Alege o fotografie.');
  const ascii = (a, b) => String.fromCharCode(...bytes.slice(a, b)); let extension, type;
  if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) { extension = 'jpg'; type = 'image/jpeg'; }
  else if ([137, 80, 78, 71, 13, 10, 26, 10].every((v, i) => bytes[i] === v)) { extension = 'png'; type = 'image/png'; }
  else if (ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') { extension = 'webp'; type = 'image/webp'; }
  else throw new ApiError(415, 'Fotografia nu a fost convertită corect. Alege-o din nou din panou.');
  const path = 'assets/uploads/' + await hash(bytes) + '.' + extension;
  // Stream base64 to GitHub instead of holding several whole-file strings in memory.
  let offset = 0; const chunk = 3 * 16384;
  const body = new ReadableStream({ start(controller) { controller.enqueue(enc.encode('{"encoding":"base64","content":"')); }, pull(controller) { if (offset < bytes.length) { const end = Math.min(offset + chunk, bytes.length); controller.enqueue(enc.encode(btoa(String.fromCharCode(...bytes.subarray(offset, end))))); offset = end; } else { controller.enqueue(enc.encode('"}')); controller.close(); } } });
  const blob = await github('/git/blobs', 'POST', body);
  if (!/^[a-f0-9]{40}$/.test(blob.sha || '')) throw new ApiError(502, 'Fotografia nu a putut fi pregătită pentru publicare.');
  const upload = { path, sha: blob.sha, size: bytes.length, type };
  return json({ upload: { ...upload, receipt: hex(await crypto.subtle.sign('HMAC', await receiptKey(), receiptBytes(upload))) } });
 }

 const readHead = () => github('/git/ref/heads/' + branch.split('/').map(encodeURIComponent).join('/'));
 async function readFile(path, revision) {
  try { const file = await github('/contents/' + path + '?ref=' + encodeURIComponent(revision)); return decodeText(file.content); }
  catch (error) {
   if (error.githubStatus !== 404) throw error;
   const response = await env.ASSETS.fetch(new Request(url.origin + '/' + path));
   if (!response.ok) throw new ApiError(503, 'Conținutul inițial al paginii nu este disponibil.');
   return response.text();
  }
 }
 const readContent = async revision => validateContent(JSON.parse(await readFile('assets/site-content.json', revision)));

 if (route === '/content' && request.method === 'GET') {
  const head = await readHead(); return json({ content: await readContent(head.object.sha), revision: head.object.sha });
 }

 if (route === '/publish' && request.method === 'POST') {
  if (!request.headers.get('Content-Type')?.startsWith('application/json')) throw new ApiError(415, 'Datele trimise nu sunt valide.');
  let body; try { body = JSON.parse(new TextDecoder().decode(await readLimited(request, 1024 * 1024))); } catch (error) { if (error.status) throw error; throw new ApiError(400, 'Datele trimise nu sunt valide.'); }
  if (!/^[a-f0-9-]{36}$/.test(body.requestId || '') || !/^[a-f0-9]{40}$/.test(body.revision || '')) throw new ApiError(400, 'Reîncarcă pagina înainte să publici.');
  let content; try { content = validateContent(body.content); } catch (error) { if (error instanceof ContentError) throw new ApiError(400, error.message); throw error; }
  content.publicationId = body.requestId;
  const serialized = JSON.stringify(content, null, 2) + '\n';
  const contentHash = await hash(enc.encode(serialized));
  const previous = await env.LEXYNS_DB.prepare('SELECT revision, content_hash FROM editor_publications WHERE request_id = ?').bind(body.requestId).first();
  if (previous) { if (previous.content_hash !== contentHash) throw new ApiError(409, 'Reîncearcă publicarea cu modificările actuale.'); return json({ revision: previous.revision, publicationId: body.requestId, saved: true }); }
  const head = await readHead(); if (head.object.sha !== body.revision) throw new ApiError(409, 'Site-ul a fost modificat între timp. Apasă „Reîncarcă ultima salvare” înainte să publici din nou.');
  const original = await readContent(body.revision);
  const allowedExisting = new Set(mediaPaths(original)), referenced = new Set(mediaPaths(content));
  if (!Array.isArray(body.images) || body.images.length > 64) throw new ApiError(400, 'Datele fotografiilor nu sunt valide.');
  const supplied = new Map();
  for (const upload of body.images) {
   if (!upload || !/^assets\/uploads\/[a-f0-9]{64}\.(?:jpg|png|webp)$/.test(upload.path || '') || !referenced.has(upload.path) || supplied.has(upload.path) || !/^[a-f0-9]{40}$/.test(upload.sha || '') || !/^[a-f0-9]{64}$/.test(upload.receipt || '') || !Number.isInteger(upload.size) || upload.size <= 0 || upload.size > UPLOAD_LIMIT) throw new ApiError(400, 'O fotografie pregătită nu este validă. Alege-o din nou.');
   const signature = Uint8Array.from(upload.receipt.match(/../g), v => parseInt(v, 16));
   if (!await crypto.subtle.verify('HMAC', await receiptKey(), signature, receiptBytes(upload))) throw new ApiError(400, 'Fotografia pregătită nu poate fi verificată. Alege-o din nou.');
   supplied.set(upload.path, upload);
  }
  for (const path of referenced) if (!allowedExisting.has(path) && !supplied.has(path) && !path.startsWith('assets/photos/')) throw new ApiError(400, 'O fotografie nouă nu a fost încărcată. Alege-o din nou.');
  for (const path of referenced) if (path.startsWith('assets/photos/') && !allowedExisting.has(path)) {
   // A shipped photo that was removed earlier can be chosen again only if it still exists.
   const response = await env.ASSETS.fetch(new Request(url.origin + '/' + path, { method: 'HEAD' }));
   if (!response.ok) throw new ApiError(400, 'O fotografie din site nu mai există. Alege alta.');
  }
  const template = await readFile('index.html', body.revision);
  let page; try { page = renderHomepage(template, content); } catch { throw new ApiError(503, 'Pagina principală din repository nu are structura așteptată de editor.'); }
  const parent = await github('/git/commits/' + body.revision);
  const tree = [];
  for (const upload of supplied.values()) tree.push({ path: upload.path, mode: '100644', type: 'blob', sha: upload.sha });
  const contentBlob = await github('/git/blobs', 'POST', { content: utf8Base64(serialized), encoding: 'base64' });
  tree.push({ path: 'assets/site-content.json', mode: '100644', type: 'blob', sha: contentBlob.sha });
  if (page !== template) { const pageBlob = await github('/git/blobs', 'POST', { content: utf8Base64(page), encoding: 'base64' }); tree.push({ path: 'index.html', mode: '100644', type: 'blob', sha: pageBlob.sha }); }
  for (const path of allowedExisting) if (path.startsWith('assets/uploads/') && !referenced.has(path)) tree.push({ path, mode: '100644', type: 'blob', sha: null });
  const newTree = await github('/git/trees', 'POST', { base_tree: parent.tree.sha, tree });
  const commit = await github('/git/commits', 'POST', { message: 'Actualizare site din editorul Lexyns Clean', tree: newTree.sha, parents: [body.revision] });
  await github('/git/refs/heads/' + branch.split('/').map(encodeURIComponent).join('/'), 'PATCH', { sha: commit.sha, force: false });
  await env.LEXYNS_DB.prepare('INSERT INTO editor_publications(request_id,revision,content_hash,created_at) VALUES(?,?,?,?)').bind(body.requestId, commit.sha, contentHash, Date.now()).run();
  return json({ saved: true, revision: commit.sha, publicationId: body.requestId });
 }
 throw new ApiError(404, 'Pagina cerută nu există.');
}
