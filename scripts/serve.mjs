// Local preview of the static site, without the editor API: `npm run dev:static`.
// index.html is rendered from assets/site-content.json on every request.
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { validateContent } from '../content-schema.js';
import { renderHomepage } from '../content-renderer.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const port = Number(process.env.PORT || 5173);
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
const allowed = /^(?:index\.html|admin\.html|[a-z-]+\.(?:css|js)|assets\/.+)$/;
createServer(async (req, res) => {
 try {
  const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  let relative = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
  if (relative === 'admin') relative = 'admin.html';
  if (!allowed.test(relative)) { res.writeHead(404); return res.end('Not found'); }
  const file = path.resolve(root, relative.startsWith('assets/vendor/') ? 'dist/' + relative : relative);
  if (!file.startsWith(root) || !(await stat(file)).isFile()) { res.writeHead(404); return res.end('Not found'); }
  res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
  if (relative === 'index.html') {
   const content = validateContent(JSON.parse(await readFile(path.join(root, 'assets/site-content.json'), 'utf8')));
   return res.end(renderHomepage(await readFile(file, 'utf8'), content));
  }
  res.end(await readFile(file));
 } catch { res.writeHead(404); res.end('Not found'); }
}).listen(port, '127.0.0.1', () => console.log('Local: http://127.0.0.1:' + port));
