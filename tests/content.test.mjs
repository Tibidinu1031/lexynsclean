import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validateContent, mediaPaths, mapEmbed } from '../content-schema.js';
import { renderHomepage, phoneHref } from '../content-renderer.js';

const root = new URL('../', import.meta.url);
const shipped = JSON.parse(await readFile(new URL('assets/site-content.json', root), 'utf8'));
const template = await readFile(new URL('index.html', root), 'utf8');

test('the shipped content is valid and every photo exists', async () => {
 const content = validateContent(shipped);
 assert.equal(content.services.items.length, 8);
 for (const path of mediaPaths(content)) await readFile(new URL(path, root));
});

test('rendering is idempotent and keeps every editable region', () => {
 const content = validateContent(shipped);
 const once = renderHomepage(template, content), twice = renderHomepage(once, content);
 assert.equal(once, twice);
 for (const name of ['hero', 'services', 'process', 'pause', 'luna', 'close', 'foot', 'blade-call', 'menu-call', 'data', 'jsonld']) assert.ok(once.includes('<!--cms:' + name + '-->') && once.includes('<!--/cms:' + name + '-->'), name);
});

test('the root index.html is already rendered for GitHub Pages', () => {
 assert.equal(renderHomepage(template, validateContent(shipped)).replace(/data-year>\d{4}/, ''), template.replace(/data-year>\d{4}/, ''));
});

test('no long dashes reach the page, even when pasted by the client', async () => {
 const content = validateContent(structuredClone(shipped));
 const edited = structuredClone(content);
 edited.hero.lead = 'Curățenie \u2014 rapid \u2013 atent, între 8\u201318.';
 const html = renderHomepage(template, validateContent(edited));
 assert.ok(!/[\u2013\u2014]/.test(html));
 assert.match(html, /Curățenie, rapid, atent, între 8-18\./);
 for (const file of ['index.html', 'styles.css', 'app.js', 'admin.html', 'admin.css', 'admin.js', 'content-schema.js', 'content-renderer.js', 'media-prepare.js', 'cloudflare/worker.js', 'cloudflare/editor-api.js', 'assets/site-content.json', 'scrollcraft.js', 'scrollcraft.css']) {
  const text = await readFile(new URL(file, root), 'utf8');
  const visible = text;
  assert.ok(!/[\u2013\u2014]/.test(visible), file);
 }
});

test('text is escaped and phone links use the Romanian prefix', () => {
 const content = validateContent(structuredClone(shipped));
 content.services.items[0].title = '<img src=x onerror=alert(1)>';
 const html = renderHomepage(template, content);
 assert.ok(!html.includes('<img src=x'));
 assert.equal(phoneHref('0754 679 238'), 'tel:+40754679238');
 assert.equal(phoneHref('+40 740 548 753'), 'tel:+40740548753');
});

test('validation refuses unsafe links, foreign images and broken phones', () => {
 const bad = (mutate, pattern) => { const c = structuredClone(shipped); mutate(c); assert.throws(() => validateContent(c), pattern); };
 bad(c => { c.contact.facebookUrl = 'javascript:alert(1)'; }, /HTTPS/);
 bad(c => { c.services.items[0].image.src = 'https://evil.example/x.jpg'; }, /Fotografia/);
 bad(c => { c.contact.phone = 'sună-mă'; }, /Telefonul/);
 bad(c => { c.services.items = []; }, /cel puțin un serviciu/);
 bad(c => { c.services.items[1].id = c.services.items[0].id; }, /identificator/);
 assert.match(mapEmbed('<iframe src="https://www.google.com/maps/embed?pb=!1m18" width="600"></iframe>'), /^https:\/\/www\.google\.com\/maps\/embed/);
 assert.throws(() => mapEmbed('https://example.com/maps?output=embed'), /Google Maps/);
});

test('a custom hero photo replaces the layered Sibiu scene', () => {
 const content = validateContent(structuredClone(shipped));
 content.hero.image = { src: 'assets/uploads/' + 'a'.repeat(64) + '.webp', alt: 'Echipa la lucru', width: 1600, height: 1000, position: '50% 50%' };
 const html = renderHomepage(template, content);
 assert.match(html, /class="hero hero--custom"/);
 assert.ok(!html.includes('hero-city.webp'));
});
