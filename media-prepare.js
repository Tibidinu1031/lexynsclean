// Convert photos locally; only normalized, web-compatible files are published.
const MIB = 1024 * 1024;
const MAX_EDGE = 1800;
const hex = bytes => [...new Uint8Array(bytes)].map(n => n.toString(16).padStart(2, '0')).join('');

async function record(blob, extension) {
 const bytes = new Uint8Array(await blob.arrayBuffer()), digest = hex(await crypto.subtle.digest('SHA-256', bytes));
 let binary = ''; for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
 return { path: 'assets/uploads/' + digest + '.' + extension, type: blob.type, base64: btoa(binary) };
}

// Identify the file by its first bytes, not by its name: phones often send HEIC as .jpg.
async function decodeImage(file) {
 let blob = file;
 const bytes = new Uint8Array(await file.slice(0, 32).arrayBuffer()), ascii = String.fromCharCode(...bytes);
 if (bytes[0] === 255 && bytes[1] === 216) blob = new Blob([file], { type: 'image/jpeg' });
 else if (bytes[0] === 137 && ascii.slice(1, 4) === 'PNG') blob = new Blob([file], { type: 'image/png' });
 else if (/^GIF8/.test(ascii)) blob = new Blob([file], { type: 'image/gif' });
 else if (ascii.slice(0, 4) === 'RIFF' && ascii.slice(8, 12) === 'WEBP') blob = new Blob([file], { type: 'image/webp' });
 else if (ascii.slice(4, 8) === 'ftyp' && /heic|heix|hevc|hevx|mif1|msf1/.test(ascii)) {
  const { heicTo } = await import('./assets/vendor/heic.js');
  blob = await heicTo({ blob: file, type: 'image/jpeg', quality: 0.94 });
 }
 const url = URL.createObjectURL(blob), image = new Image();
 try { image.src = url; await image.decode(); return image; } finally { URL.revokeObjectURL(url); }
}

export async function preparePhoto(file, onProgress = () => {}) {
 if (!file || !file.size) throw Error('Fișierul ales este gol.');
 onProgress('Se convertește și se optimizează fotografia…');
 let image;
 try { image = await decodeImage(file); }
 catch { throw Error('Fotografia nu poate fi citită. Sunt acceptate JPEG/JPG, PNG, WebP, GIF, AVIF, BMP și HEIC/HEIF (iPhone). Pentru alt format, exportă fotografia ca JPEG.'); }
 let width = image.naturalWidth, height = image.naturalHeight, quality = 0.86, blob;
 for (let attempt = 0; attempt < 8; attempt++) {
  const scale = Math.min(1, MAX_EDGE / Math.max(width, height));
  width = Math.max(1, Math.round(width * scale)); height = Math.max(1, Math.round(height * scale));
  const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext('2d'); if (!ctx) throw Error('Browserul nu poate pregăti fotografia.');
  ctx.drawImage(image, 0, 0, width, height);
  blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/webp', quality));
  if (blob && blob.size <= 2 * MIB) break;
  width = Math.round(width * 0.8); height = Math.round(height * 0.8); quality = Math.max(0.55, quality - 0.06);
 }
 if (!blob || blob.size > 2 * MIB) throw Error('Fotografia nu a putut fi optimizată. Încearcă din nou sau exportă-o ca JPEG.');
 const extension = blob.type === 'image/webp' ? 'webp' : blob.type === 'image/png' ? 'png' : 'jpg', upload = await record(blob, extension);
 return { upload, photo: { src: upload.path, alt: '', width, height, position: '50% 50%' } };
}
