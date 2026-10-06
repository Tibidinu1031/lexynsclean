// Builds dist/ for Cloudflare Pages: the rendered page, the editor, the Worker and only the files the site uses.
import { mkdir, copyFile, readFile, readdir, rm, writeFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { validateContent, mediaPaths } from '../content-schema.js';
import { renderHomepage } from '../content-renderer.js';
import { buildMedia } from './build-media.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const output = path.resolve(root, 'dist');
// The build owns only this exact child directory.
if (path.dirname(output) !== path.resolve(root) || path.basename(output) !== 'dist') throw new Error('Invalid output directory');
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });

const content = validateContent(JSON.parse(await readFile(path.join(root, 'assets/site-content.json'), 'utf8')));
const files = ['styles.css', 'scrollcraft.css', 'scrollcraft.js', 'app.js', 'admin.html', 'admin.css', 'admin.js', 'content-schema.js', 'content-renderer.js', 'media-prepare.js', '.nojekyll', 'assets/site-content.json'];
for (const dir of ['assets/fonts', 'assets/brand', 'assets/photos']) for (const name of await readdir(path.join(root, dir))) files.push(dir + '/' + name);
for (const media of mediaPaths(content)) if (media.startsWith('assets/uploads/')) files.push(media);
for (const file of new Set(files)) {
 const source = path.resolve(root, file), destination = path.resolve(output, file);
 if (!source.startsWith(path.resolve(root) + path.sep) || !destination.startsWith(output + path.sep)) throw new Error('Asset path outside project: ' + file);
 if ((await stat(source)).size > 25 * 1024 * 1024) throw new Error('Asset exceeds the Cloudflare Pages file limit: ' + file);
 await mkdir(path.dirname(destination), { recursive: true });
 await copyFile(source, destination);
}
await writeFile(path.join(output, 'index.html'), renderHomepage(await readFile(path.join(root, 'index.html'), 'utf8'), content));

const worker = (await readFile(path.join(root, 'cloudflare/worker.js'), 'utf8')).replace("'./editor-api.js'", "'./cloudflare/editor-api.js'");
await writeFile(path.join(output, '_worker.js'), worker);
await mkdir(path.join(output, 'cloudflare'), { recursive: true });
await copyFile(path.join(root, 'cloudflare/editor-api.js'), path.join(output, 'cloudflare/editor-api.js'));
await copyFile(path.join(root, 'cloudflare/_routes.json'), path.join(output, '_routes.json'));
await copyFile(path.join(root, 'cloudflare/_headers'), path.join(output, '_headers'));
await buildMedia(output);
console.log('Build: dist/ gata (' + files.length + ' fișiere, plus Worker și conversia HEIC pentru editor).');
