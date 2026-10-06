// Generates the admin password hash for Cloudflare (PBKDF2-SHA256, 100.000 iterations, salt:hash).
//   npm run admin:password            generates a strong random password
//   npm run admin:password -- "parola" hashes a password you choose (minimum 12 characters)
// Writes .dev.vars (local Wrangler) and .qa/admin-access.txt. Both are ignored by Git.
import { webcrypto as crypto } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const hex = bytes => [...new Uint8Array(bytes)].map(n => n.toString(16).padStart(2, '0')).join('');
const alphabet = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
let password = process.argv[2];
if (password !== undefined && password.length < 12) { console.error('Parola trebuie să aibă cel puțin 12 caractere.'); process.exit(1); }
if (!password) { const random = crypto.getRandomValues(new Uint8Array(20)); password = [...random].map(n => alphabet[n % alphabet.length]).join('').replace(/(.{5})(?=.)/g, '$1-'); }
const salt = hex(crypto.getRandomValues(new Uint8Array(16)));
const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
const hash = hex(await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: new TextEncoder().encode(salt), iterations: 100000, hash: 'SHA-256' }, key, 256));
const secret = salt + ':' + hash;
await writeFile(path.join(root, '.dev.vars'), `ADMIN_PASSWORD_HASH=${secret}\n# GITHUB_TOKEN=pune-aici-tokenul-doar-pentru-teste-locale\n`);
await mkdir(path.join(root, '.qa'), { recursive: true });
await writeFile(path.join(root, '.qa/admin-access.txt'), `Editor Lexyns Clean\nUtilizator: admin\nParolă: ${password}\n\nSecretul Cloudflare ADMIN_PASSWORD_HASH (Settings > Variables and Secrets, tip Secret):\n${secret}\n`);
console.log('Gata. Parola și secretul sunt în .qa/admin-access.txt; .dev.vars este actualizat pentru testele locale.');
