// Renders the editable regions of index.html from assets/site-content.json.
// Regions are delimited by <!--cms:name--> ... <!--/cms:name--> so rendering is idempotent:
// the same function fills the root index.html, the build output and the editor preview.

export const esc = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
const lines = value => esc(value).replaceAll('\n', '<br>');
export const phoneHref = value => { const compact = value.replace(/[^+0-9]/g, ''); return 'tel:' + (compact.startsWith('+') ? compact : compact.startsWith('0') ? '+40' + compact.slice(1) : compact); };
const smsNumber = value => phoneHref(value).slice(4);

const icon = {
 phone: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 4h3.2l1.6 4-2 1.3a10.5 10.5 0 0 0 6.9 6.9l1.3-2 4 1.6V19a1.6 1.6 0 0 1-1.7 1.6A16.3 16.3 0 0 1 3.4 5.7 1.6 1.6 0 0 1 5 4Z"/></svg>',
 plus: '<svg class="off" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
 check: '<svg class="on" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>',
 pin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M19 10c0 5.5-7 11-7 11s-7-5.5-7-11a7 7 0 1 1 14 0Z"/><circle cx="12" cy="10" r="2.4"/></svg>',
 route: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 19h5a3 3 0 0 0 3-3V8a3 3 0 0 1 3-3h5"/><path d="m17 2 3 3-3 3"/></svg>',
 sms: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round" aria-hidden="true"><path d="M4 5h16v11H9l-5 4Z"/></svg>',
 copy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round" aria-hidden="true"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/></svg>',
 wa: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 3a9 9 0 0 0-7.8 13.5L3 21l4.6-1.2A9 9 0 1 0 12 3Zm0 16.3a7.3 7.3 0 0 1-3.7-1l-.3-.2-2.7.7.7-2.6-.2-.3A7.3 7.3 0 1 1 12 19.3Zm4-5.4c-.2-.1-1.3-.7-1.5-.7s-.4-.1-.5.1-.6.7-.7.9-.3.2-.5.1a6 6 0 0 1-1.8-1.1 6.6 6.6 0 0 1-1.2-1.5c-.1-.2 0-.3.1-.4l.4-.4.2-.4v-.4l-.7-1.6c-.2-.4-.4-.4-.5-.4h-.4a.8.8 0 0 0-.6.3 2.5 2.5 0 0 0-.8 1.9 4.4 4.4 0 0 0 .9 2.3 10 10 0 0 0 3.8 3.4c1.4.6 2 .6 2.7.5a2.3 2.3 0 0 0 1.5-1.1 1.9 1.9 0 0 0 .1-1.1c0-.1-.2-.2-.4-.3Z"/></svg>',
 fb: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M14 21v-8h3l.5-4H14V7c0-1 .3-1.6 1.7-1.6H18V2.2A26 26 0 0 0 15 2c-3 0-5 1.8-5 5v2H7v4h3v8z"/></svg>'
};

export const MOON_SVG = '<svg viewBox="0 0 400 400" aria-hidden="true" focusable="false"><defs><linearGradient id="luna-g" x1="60" y1="350" x2="340" y2="70" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#18917a"/><stop offset=".5" stop-color="#5fd3a8"/><stop offset="1" stop-color="#dcf184"/></linearGradient><radialGradient id="luna-s" cx="35%" cy="70%" r="70%"><stop offset="0" stop-color="#fff" stop-opacity=".22"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient><mask id="luna-m"><rect width="400" height="400" fill="#fff"/><circle cx="250" cy="158" r="126" fill="#000"/></mask></defs><g mask="url(#luna-m)"><circle cx="186" cy="218" r="150" fill="url(#luna-g)"/><circle cx="186" cy="218" r="150" fill="url(#luna-s)"/></g><path class="spark spark--a" d="M300 40c5.6 28.8 15 38.2 43.8 43.8-28.8 5.6-38.2 15-43.8 43.8-5.6-28.8-15-38.2-43.8-43.8C285 78.2 294.4 68.8 300 40Z" fill="#dcf184"/><path class="spark spark--b" d="M360 150c2.6 13 6.8 17.2 19.8 19.8-13 2.6-17.2 6.8-19.8 19.8-2.6-13-6.8-17.2-19.8-19.8 13-2.6 17.2-6.8 19.8-19.8Z" fill="#a5ebcb"/></svg>';

const ORN = '<div class="orn" aria-hidden="true"></div>';
const DIVIDER = '<div class="divider" aria-hidden="true"><span></span><svg viewBox="0 0 84 18" focusable="false"><g fill="currentColor"><circle cx="3" cy="9" r="1.3"/><circle cx="13" cy="9" r="1.7"/><circle cx="24" cy="9" r="1.1"/><circle cx="60" cy="9" r="1.1"/><circle cx="71" cy="9" r="1.7"/><circle cx="81" cy="9" r="1.3"/></g><path class="spark" d="M42 1c.9 4.6 2.4 6.1 7 8-4.6 1.9-6.1 3.4-7 8-.9-4.6-2.4-6.1-7-8 4.6-1.9 6.1-3.4 7-8Z"/></svg><span></span></div>';

// Photographers of the shipped, illustrative photos (Unsplash License).
const CREDITS = {
 'assets/photos/racleta-1600.webp': ['Joshua Bowers', 'https://unsplash.com/photos/jr9wXKcwjt0'],
 'assets/photos/intretinere-1600.webp': ['everdrop GmbH', 'https://unsplash.com/photos/SqOMDOQb3ws'],
 'assets/photos/dupa-constructor-1600.webp': ['Jean-Luc Benazet', 'https://unsplash.com/photos/oOvzE2L-n1A'],
 'assets/photos/scari-bloc-1600.webp': ['wei', 'https://unsplash.com/photos/mL7LbMrrJnY'],
 'assets/photos/birouri-1600.webp': ['Raj Rana', 'https://unsplash.com/photos/zCQsBI7ZltQ'],
 'assets/photos/hoteliera-1600.webp': ['Ashwini Chaudhary', 'https://unsplash.com/photos/Iu6parQAO-U'],
 'assets/photos/spatii-verzi-1600.webp': ['Michael Kahn', 'https://unsplash.com/photos/xWAsrLw_1hk'],
 'assets/photos/perne-1600.webp': ['Liz Vo', 'https://unsplash.com/photos/pl3sj3DigxM']
};
const HERO_CREDIT = ['Zoltan Kochan', 'https://unsplash.com/photos/lFq5hJicmdQ'];

function region(html, name, inner) {
 const pattern = new RegExp('<!--cms:' + name + '-->[\\s\\S]*?<!--/cms:' + name + '-->');
 if (!pattern.test(html)) throw new Error('Template region missing: ' + name);
 return html.replace(pattern, () => '<!--cms:' + name + '-->' + inner + '<!--/cms:' + name + '-->');
}

export function renderHomepage(source, content, { imageUrl = path => path } = {}) {
 const h = content.hero, s = content.services, p = content.process, n = content.night, c = content.contact;
 const tel = phoneHref(c.phone);
 const picture = (photo, { sizes = '100vw', lazy = true, attrs = '' } = {}) => {
  const url = imageUrl(photo.src);
  const shipped = photo.src.match(/^(assets\/photos\/[a-z0-9-]+)-1600\.webp$/) && url === photo.src;
  const srcset = shipped ? ` srcset="${esc(photo.src.replace('-1600.webp', '-900.webp'))} 900w, ${esc(photo.src)} 1600w" sizes="${sizes}"` : '';
  return `<img src="${esc(url)}"${srcset} width="${photo.width}" height="${photo.height}" alt="${esc(photo.alt)}"${lazy ? ' loading="lazy"' : ''} decoding="async" style="object-position:${esc(photo.position || '50% 50%')}"${attrs}>`;
 };
 let html = source;

 // ---- hero
 const scene = h.image
  ? `<div class="hero__scene"><div class="hero__plane hero__sky" data-depth="sky">${picture(h.image, { lazy: false, attrs: ' fetchpriority="high"' })}</div></div><div class="hero__veil" aria-hidden="true"></div>`
  : `<div class="hero__scene"><div class="hero__plane hero__sky" data-depth="sky"><picture><source media="(max-width: 760px)" srcset="assets/photos/hero-sky-m.webp"><img src="assets/photos/hero-sky.webp" width="2600" height="1950" alt="" fetchpriority="high" decoding="async"></picture></div><div class="hero__plane hero__city" data-depth="city"><picture><source media="(max-width: 760px)" srcset="assets/photos/hero-city-m.webp"><img src="assets/photos/hero-city.webp" width="2600" height="1950" alt="Piața Mare din Sibiu și Turnul Sfatului, văzute de sus, sub un cer înnorat." fetchpriority="high" decoding="async"></picture></div></div>`;
 html = region(html, 'hero', `<section class="hero${h.image ? ' hero--custom' : ''}" id="acasa" aria-labelledby="hero-title">${scene}<div class="hero__copy wrap" data-depth="copy"><h1 class="display" id="hero-title">${lines(h.title)}</h1>${h.lead ? `<p class="hero__lead">${lines(h.lead)}</p>` : ''}<div class="hero__actions"><a class="btn" href="${esc(tel)}">${icon.phone}<span>Sună: ${esc(c.phone)}</span></a>${h.secondaryLabel ? `<a class="btn btn--ghost" href="#servicii">${esc(h.secondaryLabel)}</a>` : ''}</div></div></section>`);

 // ---- services
 const shots = s.items.map((v, i) => v.image ? `<figure class="frame__shot${i === 0 ? ' is-active' : ''}" data-shot="${esc(v.id)}">${picture({ ...v.image, alt: '' }, { sizes: '50vw' })}</figure>` : '').join('');
 const items = s.items.map(v => `<li class="service" id="serviciu-${esc(v.id)}" data-service="${esc(v.id)}">${v.image ? `<figure class="service__media">${picture(v.image, { sizes: '(min-width: 1000px) 1px, 100vw' })}</figure>` : ''}<h3>${esc(v.title)}</h3>${v.text ? `<p class="service__text">${lines(v.text)}</p>` : ''}${v.detail ? `<p class="service__detail">${esc(v.detail)}</p>` : ''}<button type="button" class="add" data-add="${esc(v.id)}" aria-pressed="false" aria-label="Pune în fișă: ${esc(v.title)}">${icon.plus}${icon.check}<span class="add__label">Pune în fișă</span></button></li>`).join('');
 html = region(html, 'services', `<section class="services" id="servicii" aria-labelledby="servicii-title">${ORN}<div class="wrap">${DIVIDER}<header class="services__head"><h2 class="display" id="servicii-title">${esc(s.title)}</h2>${s.intro ? `<p class="services__intro">${lines(s.intro)}</p>` : ''}</header><div class="services__body"><div class="services__frame" aria-hidden="true">${shots}<span class="frame__edge"></span></div><ol class="services__list">${items}</ol></div>${s.note ? `<p class="services__note">${esc(s.note)}</p>` : ''}</div></section>`);

 // ---- process
 html = region(html, 'process', `<section class="process" id="cum-lucram" aria-labelledby="proces-title">${ORN}<div class="wrap">${DIVIDER}</div><div class="wrap process__grid"><div class="process__head" data-sc-in><h2 class="display" id="proces-title">${esc(p.title)}</h2>${p.intro ? `<p class="process__intro">${lines(p.intro)}</p>` : ''}</div><ol class="steps" data-sc-in data-sc-stagger="70">${p.steps.map(v => `<li class="step"><h3>${esc(v.title)}</h3>${v.text ? `<p>${lines(v.text)}</p>` : ''}</li>`).join('')}</ol></div></section>`);

 // ---- night: the authored silence, then the peak
 html = region(html, 'pause', `<section class="pause night" id="liniste" aria-label="Pauză"><div class="wrap"><p class="pause__line">${esc(n.pause)}</p></div></section>`);
 html = region(html, 'luna', `<section class="luna night" id="luna" data-sc-act="pin" data-sc-span="2.8" ${n.title ? 'aria-labelledby="luna-title"' : 'aria-label="Final"'}><div data-sc-stage class="luna__stage"><div class="luna__sky" aria-hidden="true"></div><div class="luna__stars" aria-hidden="true"></div><div class="luna__moon" aria-hidden="true">${MOON_SVG}</div>${n.title || n.text ? `<div class="luna__copy" data-sc-cue="0.48 1 0.06 0">${n.title ? `<h2 class="display" id="luna-title">${esc(n.title)}</h2>` : ''}${n.text ? `<p class="luna__text">${lines(n.text)}</p>` : ''}</div>` : ''}</div></section>`);

 // ---- close: the fișă and the ways to reach Lexyns
 const chips = s.items.map(v => `<label class="chip"><input type="checkbox" name="servicii" value="${esc(v.id)}" data-title="${esc(v.title)}"><span>${esc(v.title)}</span></label>`).join('');
 const types = ['Apartament', 'Casă sau vilă', 'Birou', 'Spațiu comercial', 'Scară de bloc', 'Hotel sau pensiune', 'Curte sau grădină', 'Altceva'];
 const embed = c.mapEmbedUrl || (c.address ? 'https://www.google.com/maps?q=' + encodeURIComponent(c.address) + '&output=embed&hl=ro' : '');
 const facts = [['Program', c.hours], ['Adresa', c.address]].filter(([, v]) => v).map(([k, v]) => `<div><dt class="reach__label">${k}</dt><dd>${lines(v)}</dd></div>`).join('') + (c.email ? `<div><dt class="reach__label">Email</dt><dd><a href="mailto:${esc(c.email)}">${esc(c.email)}</a></dd></div>` : '');
 const socials = [['Facebook', c.facebookUrl, icon.fb], ['Instagram', c.instagramUrl, ''], ['TikTok', c.tiktokUrl, '']].filter(([, url]) => url).map(([name, url, svg]) => `<a class="btn btn--ghost" href="${esc(url)}" target="_blank" rel="noopener noreferrer">${svg}<span>${name}</span><span class="sr-only">, se deschide într-o filă nouă</span></a>`).join('');
 html = region(html, 'close', `<section class="close night" id="fisa" aria-labelledby="fisa-title">${ORN}<div class="wrap">${DIVIDER}<header class="close__head" data-sc-in><h2 class="display" id="fisa-title">${esc(c.title)}</h2>${c.intro ? `<p class="close__intro">${lines(c.intro)}</p>` : ''}</header><div class="close__grid"><form class="fisa" id="fisa-form" aria-labelledby="fisa-form-title" autocomplete="on"><div class="fisa__title"><h3 id="fisa-form-title">Fișa de evaluare</h3><span>Evaluarea este gratuită</span></div><fieldset><legend>Ce e de curățat</legend><div class="chips">${chips}</div></fieldset><div class="fisa__row"><div><label for="fisa-tip">Tipul spațiului</label><select id="fisa-tip" name="tip"><option value="">Alege</option>${types.map(t => `<option>${t}</option>`).join('')}</select></div><div><label for="fisa-mp">Suprafața aproximativă (mp)</label><input type="number" id="fisa-mp" name="mp" min="1" max="100000" inputmode="numeric" placeholder="de exemplu 60"></div></div><div class="fisa__row"><div><label for="fisa-zona">Zona sau cartierul</label><input type="text" id="fisa-zona" name="zona" maxlength="80" placeholder="de exemplu Hipodrom"></div><div><label for="fisa-cand">Când ți-ar fi bine</label><input type="text" id="fisa-cand" name="cand" maxlength="80" placeholder="de exemplu sâmbătă dimineață"></div></div><div><label for="fisa-detalii">Alte detalii</label><textarea id="fisa-detalii" name="detalii" maxlength="600" rows="3" placeholder="Etaj, acces, animale de companie, orice ne ajută."></textarea></div><span class="fisa__preview-label" id="fisa-preview-label">Mesajul tău</span><p class="fisa__preview" id="fisa-preview" aria-labelledby="fisa-preview-label" aria-live="polite">Bună ziua! Aș dori o evaluare gratuită.</p><div class="fisa__actions"><a class="btn btn--accent" id="fisa-sms" href="sms:${esc(smsNumber(c.phone))}">${icon.sms}<span>Trimite prin SMS</span></a>${c.whatsappUrl ? `<a class="btn" id="fisa-wa" href="${esc(c.whatsappUrl)}" target="_blank" rel="noopener noreferrer">${icon.wa}<span>Trimite pe WhatsApp</span></a>` : ''}<button type="button" class="btn btn--ghost" id="fisa-copy">${icon.copy}<span>Copiază mesajul</span></button></div><p class="fisa__status" id="fisa-status" role="status"></p></form><aside class="reach" aria-label="Date de contact"><div class="reach__phones"><span class="reach__label">Telefon</span><a class="reach__phone" href="${esc(tel)}">${esc(c.phone)}</a>${c.phoneSecondary ? `<a class="reach__phone reach__phone--2" href="${esc(phoneHref(c.phoneSecondary))}">${esc(c.phoneSecondary)}</a>` : ''}</div><dl class="reach__facts">${facts}</dl>${embed ? `<div class="map"><iframe title="LEXYNS CLEAN SIBIU pe Google Maps, ${esc(c.address.replaceAll('\n', ', '))}" src="${esc(embed)}" loading="lazy" referrerpolicy="no-referrer-when-downgrade" allowfullscreen></iframe><div class="map__bar">${c.directionsUrl ? `<a href="${esc(c.directionsUrl)}" target="_blank" rel="noopener noreferrer">${icon.route}<span>Indicații</span><span class="sr-only">, în Google Maps, într-o filă nouă</span></a>` : ''}${c.mapsUrl ? `<a href="${esc(c.mapsUrl)}" target="_blank" rel="noopener noreferrer">${icon.pin}<span>Deschide în Google Maps</span><span class="sr-only">, într-o filă nouă</span></a>` : ''}</div></div>` : ''}${socials ? `<div class="reach__social">${socials}</div>` : ''}</aside></div></div></section>`);

 // ---- footer
 const used = [...new Set([...(h.image ? [] : ['hero']), ...s.items.map(v => v.image?.src).filter(src => CREDITS[src])])];
 const credits = used.map(k => k === 'hero' ? HERO_CREDIT : CREDITS[k]).map(([name, url]) => `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(name)}</a>`).join(', ');
 const year = new Date().getFullYear();
 html = region(html, 'foot', `<footer class="foot"><div class="wrap"><div class="foot__row"><a class="foot__brand" href="#acasa"><img src="assets/brand/luna.svg" width="30" height="30" alt=""><span>Lexyns Clean</span></a><ul class="foot__links">${c.facebookUrl ? `<li><a href="${esc(c.facebookUrl)}" target="_blank" rel="noopener noreferrer">Facebook</a></li>` : ''}${c.reviewUrl ? `<li><a href="${esc(c.reviewUrl)}" target="_blank" rel="noopener noreferrer">Lasă-ne o recenzie pe Google</a></li>` : ''}<li><a href="https://anpc.ro/" target="_blank" rel="noopener noreferrer">ANPC</a></li><li><a href="#acasa">Înapoi sus</a></li></ul></div><p class="foot__legal">© <span data-year>${year}</span> Lexyns Clean, Sibiu.${[c.company, c.companyDetails].filter(Boolean).map(v => ' ' + esc(v) + (/[.!?]$/.test(v) ? '' : '.')).join('')}<br>Fotografiile de pe site sunt ilustrative${credits ? ', de pe Unsplash: ' + credits : ''}. Harta este afișată de Google Maps.</p></div></footer>`);

 // ---- chrome and data that depend on the phone and the services
 html = region(html, 'blade-call', `<a class="blade__call" href="${esc(tel)}" aria-label="Sună la ${esc(c.phone)}">${icon.phone}<span>Sună</span></a>`);
 html = region(html, 'menu-call', `<a href="${esc(tel)}"><span>Sună: ${esc(c.phone)}</span>${icon.phone}</a>`);
 const data = { phone: c.phone, sms: smsNumber(c.phone), whatsappUrl: c.whatsappUrl, services: s.items.map(v => ({ id: v.id, title: v.title })) };
 html = region(html, 'data', `<script type="application/json" id="site-data">${JSON.stringify(data).replaceAll('<', '\\u003c')}</script>`);
 const ld = {
  '@context': 'https://schema.org', '@type': 'LocalBusiness', name: 'Lexyns Clean', legalName: c.company || undefined,
  description: 'Firmă de curățenie în Sibiu: curățenie generală și de întreținere, după constructor, scări de bloc, birouri, hoteluri, spații verzi și perne eco.',
  telephone: phoneHref(c.phone).slice(4), image: 'assets/photos/og-lexyns.jpg',
  address: { '@type': 'PostalAddress', streetAddress: c.address.split(',')[0].trim(), addressLocality: 'Sibiu', addressCountry: 'RO' },
  geo: { '@type': 'GeoCoordinates', latitude: 45.7927612, longitude: 24.14557 },
  openingHoursSpecification: { '@type': 'OpeningHoursSpecification', dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'], opens: '00:00', closes: '23:59' },
  sameAs: [c.facebookUrl, c.instagramUrl, c.tiktokUrl].filter(Boolean),
  hasMap: c.mapsUrl || undefined
 };
 html = region(html, 'jsonld', `<script type="application/ld+json">${JSON.stringify(ld).replaceAll('<', '\\u003c')}</script>`);
 return html;
}
