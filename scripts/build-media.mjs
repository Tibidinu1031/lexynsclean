// Bundles the HEIC/HEIF decoder used by the editor, loaded only when an iPhone photo is chosen.
import { mkdir, writeFile, copyFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export async function buildMedia(output) {
 const vendor = path.join(output, 'assets/vendor');
 await mkdir(vendor, { recursive: true });
 let esbuild;
 try { esbuild = await import('esbuild'); } catch { console.warn('Media: esbuild lipsește (rulează npm install); conversia HEIC din editor nu va fi disponibilă.'); return; }
 const root = fileURLToPath(new URL('../', import.meta.url));
 await esbuild.build({ stdin: { contents: "export {heicTo} from 'heic-to';", resolveDir: root, sourcefile: 'heic-entry.js' }, outfile: path.join(vendor, 'heic.js'), bundle: true, format: 'esm', platform: 'browser', minify: true, legalComments: 'eof' });
 for (const candidate of ['LICENSE', 'LICENSE.txt', 'LICENSE.md']) {
  try { await copyFile(path.join(root, 'node_modules/heic-to', candidate), path.join(vendor, 'HEIC-LICENSE.txt')); break; } catch (error) { if (error.code !== 'ENOENT') throw error; }
 }
 await writeFile(path.join(vendor, 'NOTICE.txt'), 'heic-to (LGPL-3.0, https://github.com/hoppergee/heic-to), built on libheif (https://github.com/strukturag/libheif). Used only by the site editor to convert iPhone photos.\n');
 console.log('Media: decodorul HEIC pentru editor este inclus.');
}
