import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { editorApi } from '../cloudflare/editor-api.js';
import { validateContent } from '../content-schema.js';
import worker, { ApiError, json, verifyPassword } from '../cloudflare/worker.js';

const root = new URL('../', import.meta.url);
const shipped = JSON.parse(await readFile(new URL('assets/site-content.json', root), 'utf8'));
const template = await readFile(new URL('index.html', root), 'utf8');
const revision = 'a'.repeat(40), nextRevision = 'c'.repeat(40), requestId = '11111111-1111-4111-8111-111111111111';
const TOKEN = 'mock-token';
const enc = new TextEncoder();
const hex = b => [...new Uint8Array(b)].map(n => n.toString(16).padStart(2, '0')).join('');

async function receipt(upload) {
 const key = await crypto.subtle.importKey('raw', enc.encode(TOKEN), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
 return hex(await crypto.subtle.sign('HMAC', key, enc.encode(JSON.stringify(['client/lexyns', upload.path, upload.sha, upload.size]))));
}
function mockGithub(calls, files) {
 return async (url, options = {}) => {
  const endpoint = new URL(url).pathname.replace('/repos/client/lexyns', '');
  const body = options.body ? JSON.parse(options.body) : undefined; calls.push({ endpoint, method: options.method, body });
  if (endpoint === '/git/ref/heads/main') return Response.json({ object: { sha: revision } });
  if (endpoint.startsWith('/contents/')) { const name = endpoint.slice('/contents/'.length); return Response.json({ content: Buffer.from(files[name]).toString('base64') }); }
  if (endpoint === '/git/commits/' + revision) return Response.json({ tree: { sha: 'b'.repeat(40) } });
  if (endpoint === '/git/blobs') return Response.json({ sha: String(calls.length).padStart(40, '0') });
  if (endpoint === '/git/trees') return Response.json({ sha: 'd'.repeat(40) });
  if (endpoint === '/git/commits') return Response.json({ sha: nextRevision });
  if (endpoint === '/git/refs/heads/main') return Response.json({ object: { sha: nextRevision } });
  throw Error('Unexpected endpoint ' + endpoint);
 };
}
async function publish(content, images, original = shipped) {
 const calls = [], originalFetch = globalThis.fetch;
 globalThis.fetch = mockGithub(calls, { 'assets/site-content.json': JSON.stringify(original), 'index.html': template });
 const env = { GITHUB_TOKEN: TOKEN, GITHUB_REPOSITORY: 'client/lexyns', GITHUB_BRANCH: 'main', LEXYNS_DB: { prepare() { return { bind() { return this; }, async first() { return null; }, async run() { return { success: true }; } }; } }, ASSETS: { fetch: async () => new Response('ok') } };
 try {
  const request = new Request('https://lexyns.example/api/editor/publish', { method: 'POST', headers: { Origin: 'https://lexyns.example', 'Content-Type': 'application/json' }, body: JSON.stringify({ content, images, revision, requestId }) });
  const response = await editorApi(request, env, { ApiError, json, requireAdmin: async () => {}, readLimited: async r => new Uint8Array(await r.arrayBuffer()) });
  return { result: await response.json(), calls };
 } finally { globalThis.fetch = originalFetch; }
}

test('publishing commits the content, the re-rendered index.html and the new photo in one commit, without force', async () => {
 const content = validateContent(structuredClone(shipped));
 const path = 'assets/uploads/' + 'e'.repeat(64) + '.webp';
 content.services.items[0].image = { src: path, alt: 'Fotografie nouă', width: 1600, height: 1200, position: '50% 50%' };
 content.hero.title = 'Curățenie în Sibiu,\nzi și noapte.';
 const upload = { path, sha: 'f'.repeat(40), size: 1234, type: 'image/webp' };
 const { result, calls } = await publish(content, [{ ...upload, receipt: await receipt(upload) }]);
 assert.equal(result.revision, nextRevision);
 const tree = calls.find(c => c.endpoint === '/git/trees').body.tree;
 assert.ok(tree.some(e => e.path === path && e.sha === upload.sha));
 assert.ok(tree.some(e => e.path === 'assets/site-content.json'));
 const page = tree.find(e => e.path === 'index.html');
 assert.ok(page, 'index.html is re-rendered');
 const blobs = calls.filter(c => c.endpoint === '/git/blobs').map(c => Buffer.from(c.body.content, 'base64').toString('utf8'));
 assert.ok(blobs.some(text => text.includes('zi și noapte.')));
 assert.deepEqual(calls.find(c => c.method === 'PATCH').body, { sha: nextRevision, force: false });
});

test('a new photo cannot be published without its signed upload', async () => {
 const content = validateContent(structuredClone(shipped));
 content.services.items[0].image = { src: 'assets/uploads/' + 'e'.repeat(64) + '.webp', alt: '', width: 10, height: 10, position: '50% 50%' };
 await assert.rejects(() => publish(content, []), e => e.status === 400 && /nu a fost încărcată/.test(e.message));
 const forged = { path: content.services.items[0].image.src, sha: 'f'.repeat(40), size: 10, receipt: '0'.repeat(64) };
 await assert.rejects(() => publish(content, [forged]), e => e.status === 400 && /verificată/.test(e.message));
});

test('photos that are no longer used are removed from the repository', async () => {
 const old = 'assets/uploads/' + '1'.repeat(64) + '.webp';
 const original = structuredClone(shipped); original.services.items[0].image = { src: old, alt: '', width: 10, height: 10, position: '50% 50%' };
 const content = validateContent(structuredClone(shipped));
 const { calls } = await publish(content, [], original);
 const tree = calls.find(c => c.endpoint === '/git/trees').body.tree;
 assert.ok(tree.some(e => e.path === old && e.sha === null));
});

test('the admin password check accepts the right password only', async () => {
 const salt = '0123456789abcdef0123456789abcdef';
 const key = await crypto.subtle.importKey('raw', enc.encode('parola-de-test-lunga'), 'PBKDF2', false, ['deriveBits']);
 const hash = hex(await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: enc.encode(salt), iterations: 100000, hash: 'SHA-256' }, key, 256));
 assert.equal(await verifyPassword('parola-de-test-lunga', salt + ':' + hash), true);
 assert.equal(await verifyPassword('alta-parola', salt + ':' + hash), false);
});

test('the editor API refuses requests without a session and from another origin', async () => {
 const env = { LEXYNS_DB: { prepare() { return { bind() { return this; }, async first() { return null; }, async run() { return {}; } }; } }, ASSETS: { fetch: async () => new Response('page') } };
 const denied = await worker.fetch(new Request('https://lexyns.example/api/editor/content'), env);
 assert.equal(denied.status, 401);
 const cross = await worker.fetch(new Request('https://lexyns.example/api/auth/login', { method: 'POST', headers: { Origin: 'https://evil.example', 'Content-Type': 'application/json' }, body: '{}' }), env);
 assert.equal(cross.status, 403);
 const page = await worker.fetch(new Request('https://lexyns.example/'), env);
 assert.equal(await page.text(), 'page');
});
