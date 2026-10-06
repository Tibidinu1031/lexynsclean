// Fills the editable regions of the root index.html from assets/site-content.json.
// Run after editing the content file by hand: `npm run render`. The editor does the
// same thing on publish, so the root page is always complete for GitHub Pages.
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { validateContent } from '../content-schema.js';
import { renderHomepage } from '../content-renderer.js';

const root = fileURLToPath(new URL('../', import.meta.url));
export async function renderRoot() {
 const file = path.join(root, 'index.html');
 const content = validateContent(JSON.parse(await readFile(path.join(root, 'assets/site-content.json'), 'utf8')));
 const before = await readFile(file, 'utf8');
 const after = renderHomepage(before, content);
 if (after !== before) await writeFile(file, after);
 return after !== before;
}
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
 const changed = await renderRoot();
 console.log(changed ? 'index.html actualizat din assets/site-content.json.' : 'index.html era deja la zi.');
}
