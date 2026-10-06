/* Lexyns Clean: page behaviour.
   The pane: the viewport is a window. A fixed squeegee blade parks near the bottom;
   below it the glass is unwiped, above it clean. Everything else on the page scrolls
   up behind it and comes out clean. At night the pane fogs, the blade makes one full
   stroke, lifts off, and the page holds clean. The scrollcraft engine is untouched;
   this file drives its own state from scroll and pointer. */
(() => {
 'use strict';
 const doc = document.documentElement;
 const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
 const fine = matchMedia('(hover: hover) and (pointer: fine)');
 const coarse = matchMedia('(pointer: coarse)');
 const $ = (s, r = document) => r.querySelector(s);
 const $$ = (s, r = document) => [...r.querySelectorAll(s)];
 const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
 const lerp = (a, b, t) => a + (b - a) * t;
 const easeInOut = t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
 const smooth = t => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };

 // Without motion there is no stroke to watch, so the peak pins only briefly and the
 // line fades in across it instead of waiting for a wipe.
 if (reduce) { const peak = document.getElementById('luna'); if (peak) { peak.setAttribute('data-sc-span', '1.3'); peak.querySelector('[data-sc-cue]')?.setAttribute('data-sc-cue', '0 0.9 0.85 0'); } }
 if (window.ScrollCraft) window.ScrollCraft.mount(document.body);

 let site = { services: [] };
 try { site = JSON.parse($('#site-data').textContent); } catch (e) { /* the page still works without it */ }

 for (const el of $$('[data-year]')) el.textContent = String(new Date().getFullYear());

 // ---------------------------------------------------------------- geometry
 const blade = $('#blade');
 const hazeCanvas = $('.pane__haze');
 const fogCanvas = $('.pane__fog');
 const glint = $('.pane__glint');
 const pane = $('.pane');
 const hero = $('.hero');
 const luna = $('#luna');
 const probe = document.createElement('div');
 probe.style.cssText = 'position:fixed;left:0;top:0;width:0;height:var(--blade-rest);visibility:hidden;pointer-events:none';
 document.body.append(probe);

 let vw = innerWidth, vh = innerHeight, restY = 0, handleH = 52, lunaTop = 0, lunaH = 0, heroH = 0, nightTop = Infinity;
 function measure() {
  vw = innerWidth; vh = innerHeight;
  restY = probe.getBoundingClientRect().height || vh * 0.86;
  handleH = parseFloat(getComputedStyle(doc).getPropertyValue('--handle-h')) || 52;
  if (luna) { const r = luna.getBoundingClientRect(); lunaTop = r.top + scrollY; lunaH = r.height; }
  if (hero) heroH = hero.offsetHeight;
  const pause = $('#liniste'); if (pause) nightTop = pause.getBoundingClientRect().top + scrollY;
 }

 // ---------------------------------------------------------------- glass textures
 // Seeded so the dirt is the same dirt on every visit.
 const rng = seed => () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
 const SCALE_HAZE = 0.75, SCALE_FOG = 0.5;
 let dustTex = null, maskCanvas = null;

 function paintDust(ctx, W, H, s) {
  const r = rng(11);
  ctx.clearRect(0, 0, W, H);
  const film = ctx.createLinearGradient(0, 0, 0, H);
  film.addColorStop(0, 'rgba(234,238,230,0.22)');
  film.addColorStop(1, 'rgba(226,231,222,0.36)');
  ctx.fillStyle = film; ctx.fillRect(0, 0, W, H);
  const yb = () => H * (0.15 + 0.85 * Math.sqrt(r()));
  for (let i = 0; i < 26; i++) {
   const x = r() * W, y = r() * H, rad = (60 + r() * 240) * s;
   const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
   g.addColorStop(0, `rgba(246,248,243,${0.06 + r() * 0.08})`); g.addColorStop(1, 'rgba(246,248,243,0)');
   ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, rad, 0, Math.PI * 2); ctx.fill();
  }
  ctx.lineCap = 'round';
  for (let i = 0; i < 11; i++) {
   const cx = r() * W, cy = yb(), R = (70 + r() * 220) * s, a0 = r() * Math.PI * 2;
   ctx.strokeStyle = `rgba(255,255,255,${0.03 + r() * 0.05})`; ctx.lineWidth = (12 + r() * 34) * s;
   ctx.beginPath(); ctx.arc(cx, cy, R, a0, a0 + 0.9 + r() * 2.2); ctx.stroke();
  }
  for (let i = 0; i < 170; i++) {
   const x = r() * W, y = yb(), rad = (1.4 + r() * 6) * s;
   ctx.fillStyle = 'rgba(206,211,200,0.10)'; ctx.beginPath(); ctx.arc(x, y, rad, 0, Math.PI * 2); ctx.fill();
   ctx.strokeStyle = `rgba(255,255,255,${0.16 + r() * 0.22})`; ctx.lineWidth = 0.9 * s; ctx.stroke();
  }
  const specks = Math.round(W * H / 620);
  for (let i = 0; i < specks; i++) {
   const x = r() * W, y = yb(), rad = (0.35 + r() * r() * 1.6) * s;
   ctx.fillStyle = r() < 0.78 ? `rgba(54,50,42,${0.10 + r() * 0.34})` : `rgba(255,255,255,${0.3 + r() * 0.4})`;
   ctx.beginPath(); ctx.arc(x, y, rad, 0, Math.PI * 2); ctx.fill();
  }
  ctx.lineWidth = 0.7 * s;
  for (let i = 0; i < 30; i++) {
   const x = r() * W, y = yb(), a = r() * Math.PI * 2, l = (8 + r() * 26) * s;
   ctx.strokeStyle = `rgba(62,58,50,${0.14 + r() * 0.16})`;
   ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + Math.cos(a + 1) * l * 0.6, y + Math.sin(a + 1) * l * 0.6, x + Math.cos(a) * l, y + Math.sin(a) * l); ctx.stroke();
  }
  for (let i = 0; i < 12; i++) {
   const x = r() * W, y0 = r() * H, len = (40 + r() * 170) * s;
   const g = ctx.createLinearGradient(0, y0, 0, y0 + len);
   g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(255,255,255,0.09)');
   ctx.strokeStyle = g; ctx.lineWidth = (1.6 + r() * 2.6) * s;
   ctx.beginPath(); ctx.moveTo(x, y0); ctx.lineTo(x + (r() - 0.5) * 6 * s, y0 + len); ctx.stroke();
  }
  // fine grain, so the film never reads as a flat overlay
  const tile = document.createElement('canvas'); tile.width = tile.height = 96;
  const tctx = tile.getContext('2d'); const img = tctx.createImageData(96, 96);
  for (let i = 0; i < img.data.length; i += 4) { const v = 120 + r() * 135; img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = r() * 22; }
  tctx.putImageData(img, 0, 0);
  ctx.fillStyle = ctx.createPattern(tile, 'repeat'); ctx.fillRect(0, 0, W, H);
 }

 function paintFog(ctx, W, H, s) {
  const r = rng(29);
  ctx.clearRect(0, 0, W, H);
  const base = ctx.createLinearGradient(0, 0, 0, H);
  base.addColorStop(0, 'rgba(176,196,190,0.50)');
  base.addColorStop(1, 'rgba(164,186,180,0.64)');
  ctx.fillStyle = base; ctx.fillRect(0, 0, W, H);
  for (let i = 0; i < 34; i++) {
   const x = r() * W, y = r() * H, rad = (80 + r() * 260) * s;
   const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
   g.addColorStop(0, `rgba(214,226,222,${0.05 + r() * 0.1})`); g.addColorStop(1, 'rgba(214,226,222,0)');
   ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, rad, 0, Math.PI * 2); ctx.fill();
  }
  // condensation: each drop is clearer than the fog around it, lit on its upper
  // left and rimmed with light along the bottom where it bends the glass
  const drop = (x, y, rad, strength) => {
   ctx.globalCompositeOperation = 'destination-out';
   const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
   g.addColorStop(0, `rgba(0,0,0,${0.16 + strength * 0.22})`); g.addColorStop(0.75, `rgba(0,0,0,${0.1 + strength * 0.14})`); g.addColorStop(1, 'rgba(0,0,0,0)');
   ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, rad, 0, Math.PI * 2); ctx.fill();
   ctx.globalCompositeOperation = 'source-over';
   if (rad > 2.2) {
    ctx.strokeStyle = `rgba(236,244,240,${0.1 + strength * 0.18})`; ctx.lineWidth = Math.max(0.5, rad * 0.16);
    ctx.beginPath(); ctx.arc(x, y + rad * 0.05, rad * 0.8, Math.PI * 0.2, Math.PI * 0.8); ctx.stroke();
   }
   ctx.fillStyle = `rgba(255,255,255,${0.22 + strength * 0.38})`; ctx.beginPath(); ctx.arc(x - rad * 0.32, y - rad * 0.34, Math.max(0.45, rad * 0.18), 0, Math.PI * 2); ctx.fill();
  };
  const n = Math.round(W * H / 300);
  for (let i = 0; i < n; i++) drop(r() * W, r() * H, (0.6 + r() * r() * 2.2) * s * 2, r() * 0.6);
  for (let i = 0; i < 26; i++) drop(r() * W, r() * H, (2.6 + r() * 3.6) * s * 2, 0.3 + r() * 0.5);
  ctx.globalCompositeOperation = 'source-over';
 }

 let texW = 0;
 function buildTextures() {
  if (!hazeCanvas || !fogCanvas) return;
  const w = Math.max(1, Math.round(vw * SCALE_HAZE)), h = Math.max(1, Math.round(vh * SCALE_HAZE));
  hazeCanvas.width = w; hazeCanvas.height = h;
  dustTex = document.createElement('canvas'); dustTex.width = w; dustTex.height = h;
  paintDust(dustTex.getContext('2d'), w, h, SCALE_HAZE);
  hazeCanvas.getContext('2d').drawImage(dustTex, 0, 0);
  maskCanvas = document.createElement('canvas'); maskCanvas.width = w; maskCanvas.height = h;
  const fw = Math.max(1, Math.round(vw * SCALE_FOG)), fh = Math.max(1, Math.round(vh * SCALE_FOG));
  fogCanvas.width = fw; fogCanvas.height = fh;
  paintFog(fogCanvas.getContext('2d'), fw, fh, SCALE_FOG);
  texW = vw;
 }

 // ---------------------------------------------------------------- pointer wiping
 // On a mouse, the cursor smears a clean streak through the dust under the blade;
 // the glass slowly fogs back over it.
 let wiping = false, lastWipe = 0, lastX = null, lastY = null;
 function wipeAt(cx, cy) {
  if (!maskCanvas) return;
  const s = SCALE_HAZE, m = maskCanvas.getContext('2d');
  const x = cx * s, y = cy * s, rad = 30 * s;
  m.globalCompositeOperation = 'source-over';
  const g = m.createRadialGradient(x, y, 0, x, y, rad);
  g.addColorStop(0, 'rgba(0,0,0,0.85)'); g.addColorStop(0.6, 'rgba(0,0,0,0.5)'); g.addColorStop(1, 'rgba(0,0,0,0)');
  if (lastX !== null) {
   m.strokeStyle = 'rgba(0,0,0,0.45)'; m.lineWidth = rad * 1.3; m.lineCap = 'round';
   m.beginPath(); m.moveTo(lastX * s, lastY * s); m.lineTo(x, y); m.stroke();
  }
  m.fillStyle = g; m.beginPath(); m.arc(x, y, rad, 0, Math.PI * 2); m.fill();
  lastX = cx; lastY = cy; lastWipe = performance.now();
  if (!wiping) { wiping = true; requestAnimationFrame(healLoop); }
 }
 function healLoop() {
  if (!maskCanvas || !dustTex) { wiping = false; return; }
  const s = SCALE_HAZE, W = hazeCanvas.width, H = hazeCanvas.height;
  const y0 = Math.max(0, Math.floor((state.bladeY + 6) * s));
  const m = maskCanvas.getContext('2d');
  m.globalCompositeOperation = 'destination-out';
  m.fillStyle = 'rgba(0,0,0,0.028)'; m.fillRect(0, 0, W, H);
  const c = hazeCanvas.getContext('2d');
  c.globalCompositeOperation = 'source-over';
  c.clearRect(0, y0, W, H - y0); c.drawImage(dustTex, 0, y0, W, H - y0, 0, y0, W, H - y0);
  c.globalCompositeOperation = 'destination-out'; c.drawImage(maskCanvas, 0, y0, W, H - y0, 0, y0, W, H - y0);
  c.globalCompositeOperation = 'source-over';
  if (performance.now() - lastWipe < 3200) requestAnimationFrame(healLoop);
  else { m.clearRect(0, 0, W, H); c.clearRect(0, 0, W, H); c.drawImage(dustTex, 0, 0); wiping = false; }
 }

 // ---------------------------------------------------------------- hero planes
 const sky = hero && $('.hero__sky', hero), city = hero && $('.hero__city', hero), copy = hero && $('.hero__copy', hero);
 let pX = 0, pY = 0, tX = 0, tY = 0, pointerLoop = false;
 function heroFrame(y) {
  if (!hero || reduce || y > heroH * 1.15) return;
  if (sky) sky.style.transform = `translate3d(${(pX * 9).toFixed(2)}px,${(y * 0.55 + pY * 7).toFixed(2)}px,0)`;
  if (copy) copy.style.transform = `translate3d(0,${(y * 0.3).toFixed(2)}px,0)`;
  if (city) city.style.transform = `translate3d(${(-pX * 4).toFixed(2)}px,${(-pY * 3).toFixed(2)}px,0)`;
 }
 function pointerTick() {
  pX += (tX - pX) * 0.06; pY += (tY - pY) * 0.06;
  heroFrame(scrollY);
  if (Math.abs(tX - pX) + Math.abs(tY - pY) > 0.002) requestAnimationFrame(pointerTick); else pointerLoop = false;
 }

 // ---------------------------------------------------------------- blade state
 const state = { bladeY: -1, fog: -1, dim: 1, off: null, clean: null, wet: 0 };
 const drops = [];
 if (blade) {
  const edge = $('.blade__edge', blade); const r = rng(5);
  for (let i = 0; i < 9; i++) {
   const d = document.createElement('span'); d.className = 'blade__drop';
   d.style.left = (4 + r() * 92).toFixed(2) + '%'; d.style.transform = `scale(${(0.6 + r() * 0.7).toFixed(2)})`;
   edge.append(d); drops.push(d);
  }
 }
 let dropped = false, glinted = false, prevScroll = scrollY, wet = 0;
 function setBlade(y, fog, off) {
  y = Math.round(y * 2) / 2;
  if (y !== state.bladeY) { doc.style.setProperty('--blade-y', y + 'px'); state.bladeY = y; }
  fog = Math.round(fog * 100) / 100;
  const dim = scrollY + y > nightTop ? 0.5 : 1;
  if (fog !== state.fog || dim !== state.dim) { doc.style.setProperty('--fog', String(fog)); if (hazeCanvas) hazeCanvas.style.opacity = String((1 - fog) * dim); state.fog = fog; state.dim = dim; doc.classList.toggle('is-fogging', fog > 0); }
  if (off !== state.off) {
   blade.classList.toggle('is-off', off);
   const handle = $('.blade__handle', blade);
   if (off) handle.setAttribute('inert', ''); else handle.removeAttribute('inert');
   state.off = off;
  }
 }

 function peakFrame(y) {
  // Before the peak: parked. During: lift, hold, one stroke, off. After: gone.
  const travel = Math.max(lunaH - vh, 1);
  const p = clamp((y - lunaTop) / travel, 0, 1);
  if (reduce) {
   const off = y > lunaTop - vh * 0.5;
   setBlade(restY, 0, off);
   if (luna && off !== state.clean) { luna.classList.toggle('is-clean', off); state.clean = off; }
   return;
  }
  if (y < lunaTop) { setBlade(restY, 0, false); verify(false); markClean(false); resetDrops(); return; }
  if (y > lunaTop + travel) { setBlade(vh + 60, 0, true); verify(false); markClean(true); return; }
  let by, fog, off = false;
  if (p < 0.18) { const t = easeInOut(p / 0.18); by = lerp(restY, -4, t); fog = smooth(p / 0.14); }
  else if (p < 0.22) { by = -4; fog = 1; }
  else if (p < 0.8) { const t = easeInOut((p - 0.22) / 0.58); by = lerp(-4, vh + 6, t); fog = 1; }
  else { by = vh + 60; fog = 1; off = true; }
  setBlade(by, fog, off);
  verify(p >= 0.8);
  markClean(p > 0.62);
  if (p >= 0.74 && !dropped) { dropped = true; drops.forEach((d, i) => setTimeout(() => d.classList.add('is-falling'), i * 45)); }
  if (p < 0.7) resetDrops();
  if (p >= 0.8 && !glinted) { glinted = true; glint.classList.remove('is-on'); void glint.offsetWidth; glint.classList.add('is-on'); }
  if (p < 0.6) glinted = false;
 }
 // The harness cannot see this fixed layer; publish what actually paints (scroll-craft verify.md).
 function verify(hold) {
  if (!pane) return;
  pane.setAttribute('data-sc-verify-state', Math.round(state.bladeY / 4) + '|' + state.fog + '|' + (state.off ? 1 : 0));
  if (hold) pane.setAttribute('data-sc-verify-hold', 'true'); else pane.removeAttribute('data-sc-verify-hold');
 }
 function resetDrops() { if (!dropped) return; dropped = false; drops.forEach(d => d.classList.remove('is-falling')); }
 function markClean(on) { if (luna && on !== state.clean) { luna.classList.toggle('is-clean', on); state.clean = on; } }

 function frame() {
  ticking = false;
  const y = scrollY;
  heroFrame(y);
  if (blade) peakFrame(y);
  // a faster hand pushes more water along the lip
  const v = Math.abs(y - prevScroll); prevScroll = y;
  wet += (clamp(v / 60, 0, 1) - wet) * 0.2;
  if (blade) blade.style.setProperty('--wet', wet.toFixed(2));
 }
 let ticking = false;
 function request() { if (!ticking) { ticking = true; requestAnimationFrame(frame); } }

 // ---------------------------------------------------------------- services
 const frameEl = $('.services__frame');
 const shots = frameEl ? new Map($$('.frame__shot', frameEl).map(el => [el.dataset.shot, el])) : new Map();
 const edgeEl = frameEl && $('.frame__edge', frameEl);
 const order = $$('.service').map(el => el.dataset.service);
 let activeShot = order.find(id => shots.has(id)) || null, pending = null, wantShot = null;
 // Warm every frame photo before the section arrives, so no wipe reveals an empty frame.
 if (frameEl && 'IntersectionObserver' in window) {
  const warm = new IntersectionObserver(entries => { if (entries.some(e => e.isIntersecting)) { $$('img', frameEl).forEach(img => { img.loading = 'eager'; }); warm.disconnect(); } }, { rootMargin: '150% 0px' });
  warm.observe(frameEl);
 }
 function showShot(id) {
  const next = shots.get(id);
  if (!next || id === activeShot) return;
  const img = next.querySelector('img');
  if (img && !img.complete) { img.loading = 'eager'; img.decode().catch(() => {}).then(() => { if (wantShot === id) showShot(id); }); wantShot = id; return; }
  const prev = shots.get(activeShot);
  const down = order.indexOf(id) > order.indexOf(activeShot);
  if (pending) pending();
  if (reduce) { prev?.classList.remove('is-active'); next.classList.add('is-active'); activeShot = id; return; }
  prev?.classList.remove('is-active'); prev?.classList.add('is-under');
  next.style.transition = 'none';
  next.style.clipPath = down ? 'inset(100% 0 0 0)' : 'inset(0 0 100% 0)';
  void next.offsetWidth;
  next.style.transition = '';
  next.classList.add('is-entering');
  next.style.clipPath = 'inset(0 0 0 0)';
  if (edgeEl) { edgeEl.classList.remove('is-running', 'down'); void edgeEl.offsetWidth; edgeEl.classList.add('is-running'); if (!down) edgeEl.classList.add('down'); }
  activeShot = id;
  let done = false;
  const finish = () => {
   if (done) return; done = true; pending = null;
   next.classList.remove('is-entering'); next.classList.add('is-active'); next.style.clipPath = '';
   prev?.classList.remove('is-under');
  };
  pending = finish;
  next.addEventListener('transitionend', finish, { once: true });
  setTimeout(finish, 900);
 }
 if ('IntersectionObserver' in window) {
  const pick = new IntersectionObserver(entries => {
   for (const e of entries) if (e.isIntersecting) showShot(e.target.dataset.service);
  }, { rootMargin: '-40% 0px -52% 0px' });
  $$('.service').forEach(el => pick.observe(el));
  const wipeIn = new IntersectionObserver(entries => {
   for (const e of entries) if (e.isIntersecting) { e.target.classList.add('is-wiped'); wipeIn.unobserve(e.target); }
  }, { rootMargin: '0px 0px -18% 0px', threshold: 0.15 });
  $$('.service__media').forEach(el => wipeIn.observe(el));
 } else {
  $$('.service__media').forEach(el => el.classList.add('is-wiped'));
 }

 // ---------------------------------------------------------------- the fișă
 const form = $('#fisa-form');
 const preview = $('#fisa-preview');
 const counter = $('.blade__count');
 const fisaLink = $('.blade__fisa');
 const STORE = 'lexyns-fisa-v1';
 const selected = new Set();
 const titles = new Map((site.services || []).map(v => [v.id, v.title]));
 function load() {
  try {
   const saved = JSON.parse(localStorage.getItem(STORE) || 'null');
   if (!saved) return;
   (saved.services || []).filter(id => titles.has(id)).forEach(id => selected.add(id));
   if (form) for (const k of ['tip', 'mp', 'zona', 'cand', 'detalii']) if (saved[k] && form.elements[k]) form.elements[k].value = saved[k];
  } catch (e) { /* storage blocked: start empty */ }
 }
 function save() {
  try {
   const v = { services: [...selected] };
   if (form) for (const k of ['tip', 'mp', 'zona', 'cand', 'detalii']) v[k] = form.elements[k]?.value || '';
   localStorage.setItem(STORE, JSON.stringify(v));
  } catch (e) { /* not essential */ }
 }
 function message() {
  const out = ['Bună ziua! Aș dori o evaluare gratuită.'];
  const list = order.filter(id => selected.has(id)).map(id => titles.get(id)).filter(Boolean);
  if (list.length) out.push('Servicii: ' + list.join(', ') + '.');
  if (form) {
   const f = form.elements, t = s => s.trim();
   if (t(f.tip.value)) out.push('Spațiu: ' + t(f.tip.value).toLowerCase() + '.');
   if (t(f.mp.value)) out.push('Suprafață aproximativă: ' + t(f.mp.value) + ' mp.');
   if (t(f.zona.value)) out.push('Zona: ' + t(f.zona.value) + '.');
   if (t(f.cand.value)) out.push('Când: ' + t(f.cand.value) + '.');
   if (t(f.detalii.value)) out.push('Detalii: ' + t(f.detalii.value));
  }
  return out.join('\n');
 }
 const smsLink = $('#fisa-sms'), waLink = $('#fisa-wa'), status = $('#fisa-status');
 function paint(bump) {
  const n = selected.size;
  if (counter) {
   counter.textContent = String(n);
   counter.classList.toggle('has-items', n > 0);
   if (bump && !reduce) { counter.classList.remove('bump'); void counter.offsetWidth; counter.classList.add('bump'); setTimeout(() => counter.classList.remove('bump'), 220); }
  }
  if (fisaLink) fisaLink.setAttribute('aria-label', 'Fișa de evaluare, servicii alese: ' + n);
  for (const b of $$('[data-add]')) {
   const on = selected.has(b.dataset.add);
   b.setAttribute('aria-pressed', String(on));
   const label = $('.add__label', b); if (label) label.textContent = on ? 'În fișă' : 'Pune în fișă';
  }
  if (form) for (const c of form.querySelectorAll('input[name="servicii"]')) c.checked = selected.has(c.value);
  const text = message();
  if (preview) preview.textContent = text;
  if (smsLink) smsLink.href = 'sms:' + (site.sms || '') + '?&body=' + encodeURIComponent(text);
  if (waLink && site.whatsappUrl) waLink.href = site.whatsappUrl + (site.whatsappUrl.includes('?') ? '&' : '?') + 'text=' + encodeURIComponent(text);
 }
 load();
 document.addEventListener('click', e => {
  const b = e.target.closest('[data-add]'); if (!b) return;
  const id = b.dataset.add;
  if (selected.has(id)) selected.delete(id); else selected.add(id);
  save(); paint(true);
 });
 if (form) {
  form.addEventListener('submit', e => e.preventDefault());
  form.addEventListener('change', e => {
   if (e.target.name === 'servicii') { if (e.target.checked) selected.add(e.target.value); else selected.delete(e.target.value); paint(true); }
   save(); paint(false);
  });
  // Checkboxes fire 'input' before 'change'; their selection is handled in 'change' only.
  form.addEventListener('input', e => { if (e.target.name === 'servicii') return; save(); paint(false); });
  // SMS is a phone thing. On a desktop the copy button leads.
  if (!coarse.matches && smsLink) { smsLink.classList.remove('btn--accent'); smsLink.classList.add('btn--ghost'); const copyBtn = $('#fisa-copy'); copyBtn?.classList.remove('btn--ghost'); copyBtn?.classList.add('btn--accent'); smsLink.parentElement.prepend(copyBtn); }
  $('#fisa-copy')?.addEventListener('click', async () => {
   const text = message();
   let ok = false;
   try { await navigator.clipboard.writeText(text); ok = true; }
   catch (e) {
    const t = document.createElement('textarea'); t.value = text; t.setAttribute('readonly', ''); t.style.cssText = 'position:fixed;opacity:0';
    document.body.append(t); t.select(); try { ok = document.execCommand('copy'); } catch (err) { ok = false; } t.remove();
   }
   if (status) status.textContent = ok ? 'Mesajul este copiat. Îl poți lipi într-un SMS, pe WhatsApp sau pe Facebook.' : 'Nu am putut copia automat. Selectează textul mesajului și copiază-l.';
  });
 }
 paint(false);

 // ---------------------------------------------------------------- navigation
 const links = $$('[data-nav]', blade || document);
 if ('IntersectionObserver' in window && links.length) {
  const io = new IntersectionObserver(entries => {
   for (const e of entries) if (e.isIntersecting) for (const a of links) a.setAttribute('aria-current', String(a.dataset.nav === e.target.id));
  }, { rootMargin: '-45% 0px -45% 0px' });
  ['acasa', 'servicii', 'cum-lucram', 'fisa'].forEach(id => { const el = document.getElementById(id); if (el) io.observe(el); });
 }
 const menuBtn = $('.blade__menu'), sheet = $('#menu-sheet');
 function closeMenu(focusBack) { if (!sheet || sheet.hidden) return; sheet.hidden = true; menuBtn.setAttribute('aria-expanded', 'false'); if (focusBack) menuBtn.focus(); }
 if (menuBtn && sheet) {
  menuBtn.addEventListener('click', () => { const open = sheet.hidden; sheet.hidden = !open; menuBtn.setAttribute('aria-expanded', String(open)); if (open) sheet.querySelector('a')?.focus(); });
  sheet.addEventListener('click', e => { if (e.target.closest('a')) closeMenu(false); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeMenu(true); });
  document.addEventListener('pointerdown', e => { if (!sheet.hidden && !sheet.contains(e.target) && !menuBtn.contains(e.target)) closeMenu(false); });
 }

 // Keyboard focus must never land behind the blade or in the unwiped strip. A pointer
 // must not be moved mid-click, so for pointer focus only a text field is brought up,
 // and only after the click has finished.
 let pointerAt = 0;
 addEventListener('pointerdown', () => { pointerAt = performance.now(); }, { capture: true, passive: true });
 const bringUp = el => {
  if (!el?.getBoundingClientRect || state.off || (blade && blade.contains(el)) || (sheet && sheet.contains(el))) return;
  const r = el.getBoundingClientRect(), limit = state.bladeY - handleH - 16;
  if (r.bottom > limit && r.height < limit) scrollBy({ top: r.bottom - limit + 24, behavior: 'instant' });
 };
 document.addEventListener('focusin', e => {
  const el = e.target;
  if (performance.now() - pointerAt > 600) { bringUp(el); return; }
  if (el.matches?.('input[type="text"], input[type="number"], textarea, select')) addEventListener('pointerup', () => setTimeout(() => { if (document.activeElement === el) bringUp(el); }, 60), { once: true });
 });

 // ---------------------------------------------------------------- wiring
 measure();
 buildTextures();
 frame();
 addEventListener('scroll', request, { passive: true });
 let rz;
 addEventListener('resize', () => {
  clearTimeout(rz);
  rz = setTimeout(() => {
   const widthChanged = innerWidth !== texW;
   measure();
   if (widthChanged) buildTextures();
   state.bladeY = -1; frame();
  }, 120);
 }, { passive: true });
 // The engine sets the pinned peak's height after layout and again after fonts load.
 addEventListener('load', () => { measure(); frame(); });
 if (document.fonts?.ready) document.fonts.ready.then(() => { measure(); frame(); });
 if (!reduce) {
  addEventListener('pointermove', e => {
   if (e.pointerType !== 'mouse' || !fine.matches) return;
   if (hero && scrollY < heroH) {
    tX = e.clientX / vw - 0.5; tY = e.clientY / vh - 0.5;
    if (!pointerLoop) { pointerLoop = true; requestAnimationFrame(pointerTick); }
   }
   if (!state.off && state.fog < 0.05 && e.clientY > state.bladeY + 12) wipeAt(e.clientX, e.clientY); else { lastX = null; lastY = null; }
  }, { passive: true });
 }
})();
