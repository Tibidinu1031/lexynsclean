import { validateContent, mediaPaths } from './content-schema.js';
import { renderHomepage } from './content-renderer.js';
import { preparePhoto } from './media-prepare.js';

const $ = s => document.querySelector(s);
let publishedContent, publishedRevision, draftGeneration = 0;
let content, revision, section = 'hero', uploads = new Map(), imageCache = new Map(), draftSaved = true, dirty = false, busy = false, connected = false, saveTimer, deploymentTimer, requestId = crypto.randomUUID();
const status = (text, tone = 'error', target = '#editor-status') => { $(target).textContent = text; $(target).dataset.tone = tone; };
function element(tag, text, className) { const node = document.createElement(tag); if (text !== undefined) node.textContent = text; if (className) node.className = className; return node; }
async function api(path, options = {}) {
 const response = await fetch(path, { credentials: 'same-origin', cache: 'no-store', ...options });
 const data = await response.json().catch(() => ({ error: 'Panoul trebuie activat pe găzduire (Cloudflare Pages).' }));
 if (!response.ok || data.error) { if (response.status === 401 && !path.endsWith('/login')) showAuth(); throw new Error(data.error || 'Cererea nu a putut fi finalizată.'); }
 return data;
}
const json = body => ({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

// Drafts live in IndexedDB in this browser only, photos included.
const database = new Promise((resolve, reject) => { const request = indexedDB.open('lexyns-editor', 1); request.onupgradeneeded = () => request.result.createObjectStore('drafts'); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
async function draftStorage(action, value) {
 const db = await database;
 return new Promise((resolve, reject) => {
  const transaction = db.transaction('drafts', action === 'get' ? 'readonly' : 'readwrite');
  const store = transaction.objectStore('drafts');
  const request = action === 'get' ? store.get('current') : action === 'put' ? store.put(value, 'current') : store.delete('current');
  transaction.oncomplete = () => resolve(request.result); transaction.onerror = () => reject(transaction.error);
 });
}
function pruneMedia() { if (!content) return; const paths = new Set(mediaPaths(content)); for (const store of [uploads, imageCache]) for (const path of store.keys()) if (!paths.has(path)) store.delete(path); }
function markDirty() {
 pruneMedia();
 clearInterval(deploymentTimer); dirty = true; draftSaved = false; requestId = crypto.randomUUID();
 const generation = ++draftGeneration;
 $('#publish-content').disabled = !connected || busy; $('#draft-status').textContent = 'Se salvează ciorna…';
 clearTimeout(saveTimer);
 saveTimer = setTimeout(async () => {
  if (generation !== draftGeneration || !dirty) return;
  try {
   await draftStorage('put', { content, revision, uploads: [...uploads], requestId });
   if (generation !== draftGeneration || !dirty) return;
   draftSaved = true; $('#draft-status').textContent = 'Ciornă salvată în acest browser. Modificările nu sunt încă publicate.';
  } catch { if (generation === draftGeneration && dirty) $('#draft-status').textContent = 'Modificări nepublicate. Păstrează pagina deschisă până publici.'; }
 }, 450);
}
function rememberPublished(value, version) { publishedContent = structuredClone(value); publishedRevision = version; }
async function publicContent() {
 const response = await fetch('assets/site-content.json?t=' + Date.now(), { cache: 'no-store' });
 if (!response.ok) throw new Error('Versiunea publicată nu a putut fi încărcată.');
 return validateContent(await response.json());
}
async function reloadPublishedContent() {
 if (busy) return;
 clearTimeout(saveTimer); clearInterval(deploymentTimer); ++draftGeneration;
 setBusy(true); status('Se reîncarcă versiunea publicată…', 'info');
 try {
  let clean, version, canPublish = false, message = 'Versiunea publicată a fost reîncărcată. Modificările nepublicate au fost eliminate.';
  try { const data = await api('/api/editor/content'); clean = validateContent(data.content); version = data.revision; canPublish = true; }
  catch {
   try { clean = await publicContent(); message = 'Versiunea publică a fost reîncărcată și ciorna eliminată. Conectarea pentru publicare trebuie verificată.'; }
   catch {
    if (!publishedContent) throw new Error('Reîncărcarea nu a reușit. Ciorna ta a fost păstrată. Încearcă din nou.');
    clean = structuredClone(publishedContent); version = publishedRevision;
    message = 'Câmpurile au fost resetate la ultima versiune încărcată. Reconectează-te pentru a verifica ultima versiune online.';
   }
  }
  await draftStorage('delete');
  rememberPublished(clean, version); content = structuredClone(clean); revision = version;
  connected = canPublish; uploads.clear(); dirty = false; draftSaved = true; requestId = crypto.randomUUID();
  pruneMedia(); renderFields(); $('#site-preview').srcdoc = '';
  $('#draft-status').textContent = 'Nu există modificări nepublicate. Alege secțiunea pe care vrei să o modifici.';
  status(message, 'info');
 } catch (error) { status(error.message || 'Reîncărcarea nu a reușit. Ciorna ta a fost păstrată.'); if (dirty) markDirty(); }
 finally { setBusy(false); }
}
function setBusy(value) {
 busy = value;
 $('#editor-fields').querySelectorAll('input,textarea,button,select').forEach(n => n.disabled = value || n.dataset.limitDisabled === 'true');
 $('.section-nav').querySelectorAll('button').forEach(n => n.disabled = value);
 $('#publish-content').disabled = value || !dirty || !connected; $('#reload-content').disabled = value; $('#editor-logout').disabled = value;
}

// ---- field builders
const LIMITS = { title: 160, lead: 400, secondaryLabel: 60, intro: 600, note: 200, text: 800, detail: 200, pause: 200, alt: 300, phone: 80, phoneSecondary: 80, email: 254, address: 300, hours: 200, company: 160, companyDetails: 200 };
function field(parent, label, obj, key, multiline = false, options = {}) {
 const wrap = element('div'); const uid = 'field-' + crypto.randomUUID();
 const lbl = element('label', label); lbl.htmlFor = uid;
 const input = element(multiline ? 'textarea' : 'input'); input.id = uid; input.value = obj[key] ?? '';
 if (options.type && !multiline) input.type = options.type;
 input.maxLength = options.maxLength || (/Url$/.test(key) ? 1000 : LIMITS[key] || 2000);
 if (multiline) input.rows = options.rows || 3;
 input.addEventListener('input', () => { obj[key] = input.value; markDirty(); });
 wrap.append(lbl, input);
 if (options.help) { const help = element('p', options.help, 'field-help'); help.id = uid + '-help'; input.setAttribute('aria-describedby', help.id); wrap.append(help); }
 if (options.placeholder) input.placeholder = options.placeholder;
 parent.append(wrap); return input;
}
function button(parent, label, handler, className) { const node = element('button', label, className); node.type = 'button'; node.addEventListener('click', handler); parent.append(node); return node; }
function remove(list, index, min = 0) { if (list.length <= min) { status('Secțiunea trebuie să păstreze cel puțin ' + min + (min === 1 ? ' element.' : ' elemente.')); return; } if (!confirm('Elimini acest element? Modificarea va apărea pe site după publicare.')) return; list.splice(index, 1); markDirty(); renderFields(); }
function order(list, index, direction) { const next = index + direction; if (next < 0 || next >= list.length) return; [list[index], list[next]] = [list[next], list[index]]; markDirty(); renderFields(); }
function orderButtons(parent, list, index) {
 const up = button(parent, '↑ Mută mai sus', () => order(list, index, -1)); up.disabled = index === 0; up.dataset.limitDisabled = String(index === 0);
 const down = button(parent, '↓ Mută mai jos', () => order(list, index, 1)); down.disabled = index === list.length - 1; down.dataset.limitDisabled = String(index === list.length - 1);
}
function imageUrl(path) { const upload = uploads.get(path) || imageCache.get(path); return upload ? 'data:' + upload.type + ';base64,' + upload.base64 : path; }
async function prepareImage(file) { const { photo, upload } = await preparePhoto(file, text => status(text, 'info')); uploads.set(upload.path, upload); return photo; }
function pickImage(onChoose) {
 const input = element('input'); input.type = 'file'; input.accept = 'image/*,.heic,.heif'; input.className = 'image-input';
 input.addEventListener('change', async () => {
  const file = input.files[0]; if (!file) { input.remove(); return; }
  setBusy(true); status('Se pregătește fotografia…', 'info');
  try { const photo = await prepareImage(file); onChoose(photo); markDirty(); renderFields(); status('Fotografia este adăugată în ciornă. Publică modificările când ești gata.', 'info'); }
  catch (error) { status(error.message); } finally { setBusy(false); input.remove(); }
 });
 document.body.append(input); input.click();
}
const POSITIONS = [['50% 50%', 'Centru'], ['50% 25%', 'Partea de sus'], ['50% 75%', 'Partea de jos'], ['30% 50%', 'Stânga'], ['70% 50%', 'Dreapta']];
function positionField(parent, photo) {
 const wrap = element('div'); const uid = 'pos-' + crypto.randomUUID();
 const lbl = element('label', 'Încadrarea fotografiei'); lbl.htmlFor = uid;
 const select = element('select'); select.id = uid;
 const options = POSITIONS.some(([v]) => v === photo.position) ? POSITIONS : [[photo.position, 'Încadrarea actuală'], ...POSITIONS];
 for (const [value, label] of options) { const o = element('option', label); o.value = value; o.selected = value === photo.position; select.append(o); }
 select.addEventListener('change', () => { photo.position = select.value; markDirty(); });
 wrap.append(lbl, select); parent.append(wrap);
}
function imageCard(parent, photo, onReplace, onRemove, removeLabel = 'Șterge fotografia') {
 const card = element('div', undefined, 'image-card');
 const image = element('img'); image.src = imageUrl(photo.src); image.alt = photo.alt || 'Fotografie'; card.append(image);
 const actions = element('div', undefined, 'card-actions');
 button(actions, 'Schimbă fotografia', () => pickImage(p => onReplace({ ...p, alt: photo.alt, position: photo.position || '50% 50%' })));
 if (onRemove) button(actions, removeLabel, onRemove, 'danger');
 card.append(actions);
 field(card, 'Descrierea fotografiei (pentru cititoare de ecran)', photo, 'alt');
 positionField(card, photo);
 parent.append(card); return card;
}

function renderFields() {
 const root = $('#editor-fields'); root.replaceChildren(); if (!content) return;
 const panel = element('section', undefined, 'editor-panel');
 const titles = { hero: 'Prima secțiune', services: 'Servicii', process: 'Cum lucrăm', night: 'Finalul paginii', contact: 'Contact · Date și hartă' };
 panel.append(element('h2', titles[section]));
 panel.append(element('p', 'Scrie direct în câmpuri. Pentru un rând nou în titlu apasă Enter.', 'panel-intro'));
 if (section === 'hero') {
  const h = content.hero;
  field(panel, 'Titlul mare', h, 'title', true, { rows: 2, help: 'Maxim două rânduri scurte arată cel mai bine.' });
  field(panel, 'Textul de sub titlu', h, 'lead', true);
  field(panel, 'Textul butonului care duce la servicii', h, 'secondaryLabel', false, { help: 'Butonul de apel folosește automat telefonul principal din Contact.' });
  root.append(panel);
  const photo = element('section', undefined, 'editor-panel'); photo.append(element('h2', 'Fotografia de fundal'));
  photo.append(element('p', 'Implicit, prima secțiune folosește panorama Sibiului, separată în straturi pentru efectul de adâncime. Poți pune o fotografie proprie în locul ei; titlul primește automat un fundal discret ca să rămână lizibil.', 'field-help'));
  const grid = element('div', undefined, 'image-grid');
  if (h.image) imageCard(grid, h.image, p => { h.image = p; }, () => { if (!confirm('Revii la panorama Sibiului?')) return; h.image = null; markDirty(); renderFields(); }, 'Revino la panorama Sibiului');
  else button(grid, '+ Pune o fotografie proprie', () => pickImage(p => { h.image = { ...p, alt: 'Fotografie Lexyns Clean' }; }), 'add-button');
  photo.append(grid); root.append(photo);
 } else if (section === 'services') {
  const s = content.services;
  field(panel, 'Titlul secțiunii', s, 'title'); field(panel, 'Introducere', s, 'intro', true); field(panel, 'Mențiunea de sub listă', s, 'note', false, { help: 'De exemplu: Fotografiile de pe site sunt ilustrative.' });
  root.append(panel);
  const list = element('section', undefined, 'editor-panel'); list.append(element('h2', 'Serviciile · ' + s.items.length));
  list.append(element('p', 'Fiecare serviciu apare pe site cu fotografia lui și poate fi adăugat de vizitatori în fișa de evaluare.', 'field-help'));
  s.items.forEach((item, i) => {
   const box = element('div', undefined, 'item-edit');
   const head = element('div', undefined, 'item-head'); head.append(element('h3', item.title || 'Serviciu nou'));
   const actions = element('div', undefined, 'card-actions'); orderButtons(actions, s.items, i); button(actions, 'Șterge serviciul', () => remove(s.items, i, 1), 'danger'); head.append(actions); box.append(head);
   field(box, 'Numele serviciului', item, 'title'); field(box, 'Descriere', item, 'text', true); field(box, 'Detaliu scurt (opțional)', item, 'detail', false, { help: 'Apare sub descriere, cu verde. De exemplu: Pentru asociații de proprietari.' });
   if (item.image) imageCard(box, item.image, p => { item.image = p; }, () => { if (!confirm('Elimini fotografia acestui serviciu?')) return; item.image = null; markDirty(); renderFields(); });
   else button(box, '+ Adaugă fotografie', () => pickImage(p => { item.image = { ...p, alt: item.title }; }), 'add-button');
   list.append(box);
  });
  button(list, '+ Adaugă serviciu', () => { if (s.items.length >= 16) { status('Poți avea maxim 16 servicii.'); return; } s.items.push({ id: 'serviciu-' + crypto.randomUUID().slice(0, 8), title: 'Serviciu nou', text: '', detail: '', image: null }); markDirty(); renderFields(); }, 'add-button');
  root.append(list);
 } else if (section === 'process') {
  const p = content.process;
  field(panel, 'Titlul secțiunii', p, 'title'); field(panel, 'Introducere', p, 'intro', true); root.append(panel);
  const steps = element('section', undefined, 'editor-panel'); steps.append(element('h2', 'Pașii'));
  p.steps.forEach((step, i) => {
   const box = element('div', undefined, 'item-edit');
   const head = element('div', undefined, 'item-head'); head.append(element('h3', 'Pasul ' + (i + 1)));
   const actions = element('div', undefined, 'card-actions'); orderButtons(actions, p.steps, i); button(actions, 'Șterge pasul', () => remove(p.steps, i), 'danger'); head.append(actions); box.append(head);
   field(box, 'Titlu', step, 'title'); field(box, 'Text', step, 'text', true); steps.append(box);
  });
  button(steps, '+ Adaugă pas', () => { if (p.steps.length >= 8) { status('Poți avea maxim 8 pași.'); return; } p.steps.push({ id: 'pas-' + crypto.randomUUID().slice(0, 8), title: 'Pas nou', text: '' }); markDirty(); renderFields(); }, 'add-button');
  root.append(steps);
 } else if (section === 'night') {
  const n = content.night;
  panel.append(element('p', 'Finalul paginii: geamul se aburește, racleta face o singură trecere și apare luna din logo. Titlul și textul sunt opționale; lasă-le goale ca să rămână doar luna.', 'field-help'));
  field(panel, 'Rândul scurt dinaintea finalului', n, 'pause'); field(panel, 'Titlul final (opțional)', n, 'title'); field(panel, 'Textul de sub titlu (opțional)', n, 'text', true);
  root.append(panel);
 } else {
  const c = content.contact;
  field(panel, 'Titlul secțiunii', c, 'title'); field(panel, 'Introducere', c, 'intro', true);
  const grid = element('div', undefined, 'field-grid');
  field(grid, 'Telefon principal', c, 'phone', false, { type: 'tel', help: 'Folosit de butoanele Sună și de mesajul SMS din fișă.' });
  field(grid, 'Al doilea telefon (opțional)', c, 'phoneSecondary', false, { type: 'tel' });
  field(grid, 'Email (opțional)', c, 'email', false, { type: 'email', help: 'Lasă gol dacă nu vrei să afișezi o adresă de email.' });
  field(grid, 'Link WhatsApp (opțional)', c, 'whatsappUrl', false, { type: 'url', placeholder: 'https://wa.me/40754679238', help: 'Dacă îl completezi, fișa primește butonul „Trimite pe WhatsApp”.' });
  field(grid, 'Adresa', c, 'address', true, { rows: 2 }); field(grid, 'Program', c, 'hours', true, { rows: 2 });
  panel.append(grid); root.append(panel);
  const maps = element('section', undefined, 'editor-panel'); maps.append(element('h2', 'Google Maps'));
  field(maps, 'Harta afișată pe site', c, 'mapEmbedUrl', true, { maxLength: 6000, help: 'În Google Maps: Trimite → Încorporează o hartă → Copiază HTML. Lipește aici tot codul copiat; panoul extrage automat linkul.' });
  field(maps, 'Link către pin (butonul „Deschide în Google Maps”)', c, 'mapsUrl', false, { type: 'url' });
  field(maps, 'Link pentru indicații', c, 'directionsUrl', false, { type: 'url' });
  field(maps, 'Link pentru recenzii Google', c, 'reviewUrl', false, { type: 'url', help: 'Apare în subsol ca „Lasă-ne o recenzie pe Google”.' });
  root.append(maps);
  const social = element('section', undefined, 'editor-panel'); social.append(element('h2', 'Rețele sociale și date firmă'));
  social.append(element('p', 'Un link gol ascunde rețeaua respectivă de pe site.', 'field-help'));
  field(social, 'Facebook', c, 'facebookUrl', false, { type: 'url' }); field(social, 'Instagram (opțional)', c, 'instagramUrl', false, { type: 'url' }); field(social, 'TikTok (opțional)', c, 'tiktokUrl', false, { type: 'url' });
  field(social, 'Numele firmei', c, 'company'); field(social, 'CUI și Registrul Comerțului', c, 'companyDetails');
  root.append(social);
 }
}

function showAuth() { $('#editor-auth').hidden = false; $('#editor-workspace').hidden = true; $('#editor-logout').hidden = true; }
async function restoreDraft() {
 const stored = await draftStorage('get').catch(() => null);
 if (!stored) return false;
 try { content = validateContent(stored.content); } catch { await draftStorage('delete').catch(() => {}); return false; }
 revision = stored.revision; uploads = new Map(stored.uploads); requestId = stored.requestId || crypto.randomUUID(); dirty = true;
 return true;
}
async function loadContent() {
 setBusy(true); status('Se încarcă pagina…', 'info');
 try {
  const data = await api('/api/editor/content');
  content = validateContent(data.content); revision = data.revision; rememberPublished(content, revision);
  connected = true; draftSaved = true; dirty = false; uploads = new Map();
  if (await restoreDraft()) status('Ciorna ta a fost restaurată. Poți continua editarea.', 'info'); else status('', 'info');
  $('#draft-status').textContent = dirty ? 'Ciornă restaurată. Modificările nu sunt încă publicate.' : 'Alege secțiunea pe care vrei să o modifici.';
  renderFields();
 } catch (error) {
  status(error.message);
  if (!content) { try { content = await publicContent(); rememberPublished(content, undefined); renderFields(); } catch {} }
  if (await restoreDraft()) { renderFields(); $('#draft-status').textContent = 'Ciornă restaurată. Conectarea pentru publicare trebuie verificată.'; }
  connected = false;
 } finally { setBusy(false); }
}
async function showWorkspace() { $('#editor-auth').hidden = true; $('#editor-workspace').hidden = false; $('#editor-logout').hidden = false; await loadContent(); }
$('#editor-login').addEventListener('submit', async event => {
 event.preventDefault(); const submit = event.target.querySelector('button'); submit.disabled = true; status('', 'info', '#auth-status');
 try { await api('/api/auth/login', json({ username: $('#editor-user').value.trim(), password: $('#editor-password').value })); await showWorkspace(); }
 catch (error) { status(error.message, 'error', '#auth-status'); }
 finally { $('#editor-password').value = ''; submit.disabled = false; }
});
$('#editor-logout').addEventListener('click', async () => {
 if (dirty) { clearTimeout(saveTimer); await draftStorage('put', { content, revision, uploads: [...uploads], requestId }).catch(() => {}); }
 try { await api('/api/auth/logout', { method: 'POST' }); showAuth(); } catch (error) { status(error.message); }
});
$('.section-nav').querySelectorAll('button').forEach(node => node.addEventListener('click', () => {
 section = node.dataset.section;
 $('.section-nav').querySelectorAll('button').forEach(n => n.setAttribute('aria-pressed', String(n === node)));
 renderFields();
}));
$('#reload-content').addEventListener('click', () => { if (dirty && !confirm('Renunți la ciornă și reîncarci ultima salvare?')) return; reloadPublishedContent(); });
$('#open-preview').addEventListener('click', async () => {
 if (!content) return;
 try {
  const template = await (await fetch('index.html', { cache: 'no-store' })).text();
  const html = renderHomepage(template, validateContent(content), { imageUrl });
  const base = '<base href="' + new URL('.', location.href).href + '">';
  $('#site-preview').srcdoc = html.replace('<head>', '<head>' + base);
  $('#preview-dialog').showModal();
 } catch (error) { status(error.message); }
});
$('#close-preview').addEventListener('click', () => $('#preview-dialog').close());
for (const mode of ['desktop', 'mobile']) $('#preview-' + mode).addEventListener('click', () => {
 $('#site-preview').classList.toggle('mobile', mode === 'mobile');
 for (const other of ['desktop', 'mobile']) $('#preview-' + other).setAttribute('aria-pressed', String(other === mode));
});
$('#publish-content').addEventListener('click', async () => {
 if (!dirty || busy || !connected) return;
 let clean; try { clean = validateContent(content); } catch (error) { status(error.message); return; }
 if (!confirm('Publici modificările pe site?')) return;
 setBusy(true); clearTimeout(saveTimer); ++draftGeneration; status('Se publică modificările. Păstrează pagina deschisă…', 'info');
 try {
  const paths = new Set(mediaPaths(clean)); const pending = [...uploads.values()].filter(v => paths.has(v.path)); const images = [];
  for (let i = 0; i < pending.length; i++) {
   status('Se trimite fotografia ' + (i + 1) + ' din ' + pending.length + '…', 'info');
   const upload = pending[i]; const bytes = Uint8Array.from(atob(upload.base64), v => v.charCodeAt(0));
   const staged = await api('/api/editor/uploads', { method: 'POST', headers: { 'Content-Type': upload.type }, body: bytes });
   if (staged.upload.path !== upload.path) throw Error('Fotografia transmisă nu corespunde ciornei. Alege-o din nou.');
   images.push(staged.upload);
  }
  status('Se salvează modificările în site…', 'info');
  const data = await api('/api/editor/publish', json({ content: clean, revision, images, requestId }));
  revision = data.revision; content = clean; content.publicationId = data.publicationId; rememberPublished(content, revision);
  imageCache = new Map([...imageCache, ...uploads]); uploads.clear(); dirty = false; draftSaved = true;
  await draftStorage('delete').catch(() => {});
  $('#draft-status').textContent = 'Modificările au fost salvate.'; status('Modificările sunt salvate. Site-ul este în curs de actualizare.', 'info'); renderFields();
  // A Git commit is not a deployment: confirm the new content on the live site separately.
  const publication = data.publicationId, generation = draftGeneration; let attempts = 0; clearInterval(deploymentTimer);
  deploymentTimer = setInterval(async () => {
   attempts++;
   try { const current = await (await fetch('assets/site-content.json?t=' + Date.now(), { cache: 'no-store' })).json(); if (generation !== draftGeneration) return; if (current.publicationId === publication) { status('Modificările sunt acum publicate pe site.', 'success'); clearInterval(deploymentTimer); return; } } catch {}
   if (generation === draftGeneration && attempts >= 30) { status('Modificările sunt salvate. Actualizarea site-ului nu a fost încă confirmată; verifică site-ul peste câteva minute.', 'info'); clearInterval(deploymentTimer); }
  }, 5000);
 } catch (error) { status(error.message); await draftStorage('put', { content, revision, uploads: [...uploads], requestId }).catch(() => {}); }
 finally { setBusy(false); }
});
window.addEventListener('beforeunload', event => { if (dirty && (busy || !draftSaved)) { event.preventDefault(); event.returnValue = ''; } });
(async () => { try { const session = await api('/api/auth/session'); if (session.admin) await showWorkspace(); } catch {} })();
