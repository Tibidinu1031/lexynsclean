import { editorApi } from './editor-api.js';
// Cloudflare Pages advanced mode: static files are served by ASSETS; only /api/* runs here.
const encoder = new TextEncoder();
const SESSION_SECONDS = 12 * 60 * 60;
const COOKIE = 'lexyns_admin';
export class ApiError extends Error { constructor(status, message) { super(message); this.status = status; } }
const hex = bytes => [...new Uint8Array(bytes)].map(n => n.toString(16).padStart(2, '0')).join('');
const digest = async text => hex(await crypto.subtle.digest('SHA-256', encoder.encode(text)));
export const json = (data, status = 200, headers = {}) => Response.json(data, { status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...headers } });
function cookie(request, value, maxAge = SESSION_SECONDS) {
 const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : '';
 return `${COOKIE}=${value}; Path=/api; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${secure}`;
}
async function session(request, env) {
 const token = request.headers.get('Cookie')?.split(';').map(p => p.trim()).find(p => p.startsWith(COOKIE + '='))?.slice(COOKIE.length + 1);
 if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
 const tokenHash = await digest(token);
 const row = await env.LEXYNS_DB.prepare('SELECT expires_at FROM sessions WHERE token_hash = ? AND expires_at > ?').bind(tokenHash, Date.now()).first();
 return row ? tokenHash : null;
}
export async function requireAdmin(request, env) { if (!await session(request, env)) throw new ApiError(401, 'Autentifică-te pentru a edita site-ul.'); }
async function bodyJson(request) {
 if (!request.headers.get('Content-Type')?.startsWith('application/json')) throw new ApiError(415, 'Formatul cererii nu este valid.');
 const text = await request.text(); if (text.length > 4000) throw new ApiError(413, 'Cererea este prea mare.');
 try { const body = JSON.parse(text); if (!body || typeof body !== 'object' || Array.isArray(body)) throw Error(); return body; } catch { throw new ApiError(400, 'Datele trimise nu sunt valide.'); }
}
export async function verifyPassword(password, stored) {
 if (typeof password !== 'string' || password.length > 256) return false;
 const [salt, expected] = String(stored).split(':');
 if (!/^[a-f0-9]{32}$/.test(salt || '') || !/^[a-f0-9]{64}$/.test(expected || '')) throw new ApiError(503, 'Autentificarea nu este configurată.');
 const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']);
 const actual = hex(await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: encoder.encode(salt), iterations: 100000, hash: 'SHA-256' }, key, 256));
 let difference = 0; for (let i = 0; i < actual.length; i++) difference |= actual.charCodeAt(i) ^ expected.charCodeAt(i);
 return difference === 0;
}
export async function readLimited(request, limit) {
 const chunks = []; let size = 0;
 if (!request.body) throw new ApiError(400, 'Alege un fișier.');
 const reader = request.body.getReader();
 while (true) { const { value, done } = await reader.read(); if (done) break; size += value.byteLength; if (size > limit) { await reader.cancel(); throw new ApiError(413, 'Fișierul pregătit depășește limita găzduirii.'); } chunks.push(value); }
 const bytes = new Uint8Array(size); let offset = 0; for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; } return bytes;
}
async function auth(request, env) {
 const url = new URL(request.url), route = url.pathname.slice('/api/auth'.length);
 if (!env.LEXYNS_DB) throw new ApiError(503, 'Panoul nu este încă activat pe găzduire.');
 if (!['GET', 'HEAD'].includes(request.method) && request.headers.get('Origin') !== url.origin) throw new ApiError(403, 'Cererea trebuie trimisă din panoul de administrare.');
 if (route === '/session' && request.method === 'GET') return json({ admin: !!await session(request, env), name: 'Lexyns Clean', username: env.ADMIN_USERNAME || 'admin' });
 if (route === '/login' && request.method === 'POST') {
  if (!env.ADMIN_PASSWORD_HASH) throw new ApiError(503, 'Contul admin nu este încă activat pe găzduire.');
  const body = await bodyJson(request), now = Date.now();
  const ip = await digest(request.headers.get('CF-Connecting-IP') || 'local');
  await env.LEXYNS_DB.prepare('DELETE FROM login_attempts WHERE window_start < ?').bind(now - 15 * 60 * 1000).run();
  await env.LEXYNS_DB.prepare('INSERT INTO login_attempts(ip_hash, attempts, window_start) VALUES(?,1,?) ON CONFLICT(ip_hash) DO UPDATE SET attempts = attempts + 1').bind(ip, now).run();
  const attempts = await env.LEXYNS_DB.prepare('SELECT attempts FROM login_attempts WHERE ip_hash = ?').bind(ip).first();
  if (attempts.attempts > 10) throw new ApiError(429, 'Prea multe încercări. Reîncearcă peste 15 minute.');
  const valid = await verifyPassword(body.password, env.ADMIN_PASSWORD_HASH);
  if (!valid || body.username !== (env.ADMIN_USERNAME || 'admin')) throw new ApiError(401, 'Utilizator sau parolă incorectă.');
  const token = hex(crypto.getRandomValues(new Uint8Array(32)));
  await env.LEXYNS_DB.batch([
   env.LEXYNS_DB.prepare('DELETE FROM login_attempts WHERE ip_hash = ?').bind(ip),
   env.LEXYNS_DB.prepare('DELETE FROM sessions WHERE expires_at <= ?').bind(now),
   env.LEXYNS_DB.prepare('INSERT INTO sessions(token_hash, expires_at) VALUES(?,?)').bind(await digest(token), now + SESSION_SECONDS * 1000)
  ]);
  return json({ admin: true, name: 'Lexyns Clean', username: env.ADMIN_USERNAME || 'admin' }, 200, { 'Set-Cookie': cookie(request, token) });
 }
 if (route === '/logout' && request.method === 'POST') {
  const token = await session(request, env); if (token) await env.LEXYNS_DB.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(token).run();
  return json({ admin: false }, 200, { 'Set-Cookie': cookie(request, '', 0) });
 }
 throw new ApiError(404, 'Pagina cerută nu există.');
}
export default {
 async fetch(request, env, ctx) {
  const pathname = new URL(request.url).pathname;
  if (!pathname.startsWith('/api/auth/') && !pathname.startsWith('/api/editor/')) return env.ASSETS.fetch(request);
  try {
   if (pathname.startsWith('/api/editor/')) { if (!env.LEXYNS_DB) throw new ApiError(503, 'Panoul nu este încă activat pe găzduire.'); return await editorApi(request, env, { requireAdmin, ApiError, json, readLimited }); }
   return await auth(request, env);
  } catch (error) {
   if (!error.status) console.error('Editor API error:', error.message);
   return json({ error: error.status ? error.message : 'Nu am putut salva modificarea. Reîncearcă.' }, error.status || 500);
  }
 }
};
