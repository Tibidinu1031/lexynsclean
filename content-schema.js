// Shared by the editor, the API and the build. Only these fields and local image paths are editable.
export class ContentError extends Error {}

const fail = message => { throw new ContentError(message); };
function text(value, limit = 2000) {
 if (typeof value !== 'string' || value.length > limit) fail('Un text este prea lung sau nu este valid.');
 return value;
}
function object(value) { if (!value || typeof value !== 'object' || Array.isArray(value)) fail('Datele paginii nu sunt valide.'); return value; }
function array(value, limit) { if (!Array.isArray(value) || value.length > limit) fail('Sunt prea multe elemente într-o secțiune.'); return value; }
function id(value) { if (typeof value !== 'string' || !/^[a-zA-Z0-9_-]{1,80}$/.test(value)) fail('Un element nu are un identificator valid.'); return value; }
function link(value, limit = 1000) {
 text(value, limit); if (!value) return '';
 try { const u = new URL(value); if (u.protocol !== 'https:' || u.username || u.password) fail('Folosește un link HTTPS valid.'); }
 catch (error) { if (error instanceof ContentError) throw error; fail('Folosește un link HTTPS valid.'); }
 return value;
}
export const IMAGE_PATH = /^assets\/(?:photos\/[a-z0-9-]+|uploads\/[a-f0-9]{64})\.(?:jpe?g|png|webp)$/i;
function image(value) {
 object(value); const src = text(value.src, 200);
 if (!IMAGE_PATH.test(src)) fail('Fotografia nu este validă. Încarc-o folosind editorul.');
 const width = Number(value.width), height = Number(value.height);
 if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || width > 10000 || height > 10000) fail('Dimensiunile unei fotografii nu sunt valide.');
 const position = value.position === undefined ? '50% 50%' : text(value.position, 20);
 if (!/^\d{1,3}% \d{1,3}%$/.test(position)) fail('Încadrarea unei fotografii nu este validă.');
 return { src, alt: text(value.alt, 300), width, height, position };
}
function phone(value, required = false) {
 text(value, 80);
 if (!value) { if (required) fail('Telefonul principal este obligatoriu.'); return ''; }
 if (!/^\+?[0-9 ().]+$/.test(value)) fail('Telefonul trebuie să conțină un număr valid.');
 const digits = value.replace(/\D/g, '');
 if (digits.length < 6 || digits.length > 15) fail('Telefonul trebuie să conțină între 6 și 15 cifre.');
 return value;
}
function email(value) { text(value, 254); if (value && !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(value)) fail('Adresa de email nu este validă.'); return value; }
export function mapEmbed(value) {
 text(value, 6000);
 const trimmed = value.trim();
 const source = trimmed.startsWith('<iframe') ? trimmed.match(/\bsrc\s*=\s*["']([^"']+)["']/i)?.[1]?.replaceAll('&amp;', '&') : trimmed;
 if (source === undefined) fail('Copiază linkul sau codul de încorporare din Google Maps.');
 const valid = link(source, 4000); if (!valid) return '';
 const url = new URL(valid);
 if (!/^(?:www\.)?google\.(?:com|ro)$/.test(url.hostname) || !/^\/maps(?:\/|$)/.test(url.pathname) || (!url.pathname.startsWith('/maps/embed') && url.searchParams.get('output') !== 'embed')) fail('Pentru harta afișată folosește opțiunea Google Maps → Trimite → Încorporează o hartă.');
 return valid;
}
// Romanian typography: the client may paste text from elsewhere; long dashes are
// replaced so the site never shows them.
const tidy = value => value.replace(/(\d)\s*[\u2013\u2014]\s*(\d)/g, '$1-$2').replace(/\s*[\u2013\u2014]\s*/g, ', ');
const line = (value, limit) => tidy(text(value, limit));

export const DEFAULT_CONTENT = {
 version: 1,
 publicationId: '',
 hero: {
  title: 'Facem curat în Sibiu,\nla orice oră.',
  lead: 'Case, birouri, scări de bloc și spații după renovare. Venim gratuit la evaluare, apoi stabilim prețul.',
  secondaryLabel: 'Alege serviciile',
  image: null
 },
 services: { title: 'Ce curățăm', intro: '', note: '', items: [] },
 process: { title: 'Cum lucrăm', intro: '', steps: [] },
 night: { pause: '', title: '', text: '' },
 contact: {
  title: 'Spune-ne ce e de curățat.', intro: '',
  phone: '0754 679 238', phoneSecondary: '', whatsappUrl: '', email: '',
  address: 'Strada Andrei Șaguna, Sibiu', hours: 'Nonstop, 7 zile din 7',
  mapsUrl: '', directionsUrl: '', reviewUrl: '', mapEmbedUrl: '',
  facebookUrl: '', instagramUrl: '', tiktokUrl: '',
  company: '', companyDetails: ''
 }
};

export function validateContent(value) {
 object(value); if (value.version !== 1) fail('Versiunea paginii nu este acceptată.');
 const h = object(value.hero), s = object(value.services), p = object(value.process), n = object(value.night), c = object(value.contact);
 const content = {
  version: 1,
  publicationId: text(value.publicationId || '', 80),
  hero: {
   title: line(h.title, 160), lead: line(h.lead, 400), secondaryLabel: line(h.secondaryLabel, 60),
   image: h.image === null || h.image === undefined ? null : image(h.image)
  },
  services: {
   title: line(s.title, 120), intro: line(s.intro, 600), note: line(s.note, 200),
   items: array(s.items, 16).map(v => {
    object(v);
    return { id: id(v.id), title: line(v.title, 120), text: line(v.text, 800), detail: line(v.detail, 200), image: v.image === null || v.image === undefined ? null : image(v.image) };
   })
  },
  process: {
   title: line(p.title, 120), intro: line(p.intro, 400),
   steps: array(p.steps, 8).map(v => { object(v); return { id: id(v.id), title: line(v.title, 120), text: line(v.text, 500) }; })
  },
  night: { pause: line(n.pause, 200), title: line(n.title, 80), text: line(n.text, 300) },
  contact: {
   title: line(c.title, 160), intro: line(c.intro, 500),
   phone: phone(c.phone, true), phoneSecondary: phone(c.phoneSecondary || ''),
   whatsappUrl: link(c.whatsappUrl || ''), email: email(c.email || ''),
   address: line(c.address, 300), hours: line(c.hours, 200),
   mapsUrl: link(c.mapsUrl || ''), directionsUrl: link(c.directionsUrl || ''), reviewUrl: link(c.reviewUrl || ''),
   mapEmbedUrl: mapEmbed(c.mapEmbedUrl || ''),
   facebookUrl: link(c.facebookUrl || ''), instagramUrl: link(c.instagramUrl || ''), tiktokUrl: link(c.tiktokUrl || ''),
   company: line(c.company || '', 160), companyDetails: line(c.companyDetails || '', 200)
  }
 };
 if (!content.services.items.length) fail('Adaugă cel puțin un serviciu.');
 for (const list of [content.services.items, content.process.steps]) if (new Set(list.map(v => v.id)).size !== list.length) fail('Două elemente au același identificator.');
 return content;
}

export function imagePaths(content) {
 return [...new Set([...(content.hero.image ? [content.hero.image] : []), ...content.services.items.map(v => v.image).filter(Boolean)].map(v => v.src))];
}
export const mediaPaths = imagePaths;
