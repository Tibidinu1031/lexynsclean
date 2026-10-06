# Lexyns Clean

Site pentru **Lexyns Clean**, firmă de curățenie din Sibiu (LEXYNS FIRSTLEX S.R.L.). HTML, CSS și JavaScript, fără framework. `index.html` este în rădăcină și este deja complet, deci repository-ul poate fi publicat direct pe GitHub Pages. Editorul pentru client (`/admin`) are aceeași arhitectură ca la RED TATTOO: Cloudflare Pages, o bază D1 pentru sesiuni și publicare printr-un singur commit în GitHub.

## Ideea paginii

Ecranul este un geam. O racletă fixă stă aproape de marginea de jos: sub ea geamul e încă prăfuit, deasupra e curat, iar fiecare rând al paginii iese curat când trece prin ea. Mânerul racletei este meniul (Servicii, Cum lucrăm, Fișa, Sună). Pe calculator, cursorul șterge dâre prin praf, care se aburesc la loc. La final geamul se aburește, racleta face o singură trecere și apare luna din logo, cu „Curat lună.”.

- **Prima secțiune**: panorama reală a Pieței Mari și a Turnului Sfatului, separată în două planuri (cer și oraș, cu transparență reală). Titlul stă între ele, iar orașul urcă peste el la derulare.
- **Servicii**: cele opt servicii de pe pagina de Facebook, fiecare cu fotografia lui; pe calculator fotografia lipită se schimbă printr-o ștergere de racletă.
- **Fișa de evaluare**: vizitatorul bifează serviciile și completează câteva date; fișa devine un mesaj gata de trimis prin SMS (sau WhatsApp, dacă se adaugă un link) ori de copiat.
- **Contact**: ambele telefoane (0754 679 238 principal, 0740 548 753), programul nonstop, adresa și harta Google Maps cu pinul firmei.

## Date folosite și surse

| Informație | Sursa |
|---|---|
| Nume, adresă (Strada Andrei Șaguna, Sibiu), telefon 0754 679 238, program nonstop, pin 45.7927612, 24.14557 | Profilul Google Business (cid 15161992237390910415, place ID `ChIJv4D-SHZnTEcRz1PqtJs3atI`) |
| Telefon 0740 548 753, lista de servicii, evaluarea gratuită la fața locului, perne eco cu ridicare de la domiciliu | Pagina de Facebook Lexyns CLEAN sibiu și fluturașii publicați acolo |
| LEXYNS FIRSTLEX S.R.L., CUI 48139640, J32/910/2023 | Registrul comerțului (listafirme.ro, termene.ro) |

Nu sunt afișate prețuri, ani de experiență, număr de clienți sau recenzii inventate. Cele două recenzii Google au doar stele, fără text, așa că site-ul oferă doar linkul „Lasă-ne o recenzie pe Google”.

## Fotografii

Firma nu are fotografii proprii de lucru. Fotografiile sunt de pe Unsplash (licența Unsplash permite folosirea comercială gratuită), gradate ca un singur set, iar pe site scrie că sunt ilustrative. Autori: Zoltan Kochan (panorama Sibiului), Joshua Bowers, everdrop GmbH, Jean-Luc Benazet, wei, Raj Rana, Ashwini Chaudhary, Michael Kahn, Liz Vo. Linkurile exacte sunt în subsolul site-ului și în `content-renderer.js`. Originalele sunt în `assets-source/` (ignorat de Git).

Când clientul are fotografii reale, le poate pune din editor; fotografiile vechi nefolosite se șterg automat din repository la publicare.

Emblema (semiluna cu stele) este o reinterpretare vectorială a logo-ului de pe Facebook, în aceleași culori. Dacă clientul are logo-ul original în format vectorial sau PNG mare, înlocuiește `assets/brand/luna.svg`.

## Structură

- `index.html`: pagina, cu regiunile editabile marcate `<!--cms:...-->`; este randată și complet funcțională.
- `styles.css`, `app.js`: designul și comportamentul (geamul, racleta, planurile din prima secțiune, fișa, finalul).
- `scrollcraft.css`, `scrollcraft.js`: motorul de derulare scroll-craft, nemodificat.
- `assets/site-content.json`: tot conținutul editabil.
- `content-schema.js`, `content-renderer.js`: validarea și generarea HTML, comune pentru editor, publicare și build.
- `admin.html`, `admin.css`, `admin.js`, `media-prepare.js`: editorul clientului (inclusiv conversie HEIC de pe iPhone).
- `cloudflare/worker.js`: autentificarea (sesiuni D1, limitare la 10 încercări în 15 minute, cookie HttpOnly).
- `cloudflare/editor-api.js`: citirea conținutului și publicarea într-un singur commit (conținut + `index.html` re-randat + fotografii noi).
- `cloudflare/schema.sql`, `cloudflare/_headers`, `cloudflare/_routes.json`, `wrangler.jsonc`: configurația Cloudflare.
- `scripts/`: `build.mjs`, `render.mjs`, `serve.mjs`, `admin-password.mjs`, `build-media.mjs`.
- `tests/`: validare, randare, publicare cu GitHub simulat, autentificare.

## Lucru local

Node.js 20 sau mai nou.

```sh
npm install
npm test
npm run dev:static
```

`npm run dev:static` pornește doar site-ul pe http://127.0.0.1:5173. Pentru site plus editor (Worker și D1 local):

```sh
npm run admin:password
npm run db:init
npm run dev
```

`npm run admin:password` generează o parolă puternică și scrie `.dev.vars` și `.qa/admin-access.txt` (ambele ignorate de Git). Editorul local funcționează complet, cu excepția publicării, care are nevoie de token-ul GitHub.

Dacă modifici manual `assets/site-content.json`, rulează `npm run render` ca să actualizezi `index.html`.

## 1. GitHub și GitHub Pages

```sh
git add .
git commit -m "Site Lexyns Clean"
git branch -M main
git remote add origin https://github.com/UTILIZATOR/REPOSITORY.git
git push -u origin main
```

În repository: **Settings → Pages → Build and deployment → Deploy from a branch → main → / (root)**. `index.html` și `.nojekyll` sunt deja în rădăcină, toate căile sunt relative, deci site-ul merge și la `https://UTILIZATOR.github.io/REPOSITORY/`. Există și un workflow manual (`.github/workflows/pages.yml`) dacă preferi publicarea prin GitHub Actions.

GitHub Pages servește doar site-ul. Editorul `/admin` are nevoie de Cloudflare (pasul 2). Pentru că editorul re-randează `index.html` la fiecare publicare, GitHub Pages rămâne la zi chiar și după ce clientul modifică site-ul.

## 2. Cloudflare Pages și editorul (în contul clientului)

1. `npx wrangler login` cu contul Cloudflare al clientului.
2. `npx wrangler d1 create lexyns-clean` și copiază `database_id` în `wrangler.jsonc`.
3. `npx wrangler d1 execute LEXYNS_DB --remote --file=cloudflare/schema.sql`.
4. În `wrangler.jsonc` completează `GITHUB_REPOSITORY` (de exemplu `lexynsclean/site`). Fă commit și push.
5. În Cloudflare: **Workers & Pages → Create → Pages → Connect to Git**, alege repository-ul, branch `main`, framework „None”, build command `npm run build`, output `dist`.
6. **Settings → Variables and Secrets → Production**:
   - `ADMIN_PASSWORD_HASH` (Secret): valoarea din `.qa/admin-access.txt` după `npm run admin:password`. Parola o dai clientului separat.
   - `GITHUB_TOKEN` (Secret): un fine-grained personal access token creat **din contul GitHub al clientului**: Settings → Developer settings → Personal access tokens → Fine-grained tokens; Repository access: doar repository-ul site-ului; Repository permissions: **Contents: Read and write**. Nimic altceva.
7. Redeploy. Intră la `https://DOMENIU/admin`, publică o modificare de probă și verifică noul commit în GitHub și actualizarea site-ului.

Când tokenul expiră, se înlocuiește doar secretul `GITHUB_TOKEN`. Tokenul este al clientului, deci editarea continuă și după încheierea colaborării.

**Domeniu propriu**: după ce site-ul are domeniu, actualizează `og:image` din `index.html` cu adresa completă (de exemplu `https://lexynsclean.ro/assets/photos/og-lexyns.jpg`), pentru previzualizarea frumoasă a linkului pe Facebook și WhatsApp.

## Securitate

- Parola nu există în cod: în Cloudflare stă doar hash-ul PBKDF2-SHA256 (100.000 iterații).
- Sesiuni de 12 ore, revocate la ieșire, cookie HttpOnly, SameSite=Strict, Secure.
- Scrierea cere sesiune validă și aceeași origine. Fotografiile primesc o semnătură HMAC la încărcare și sunt verificate la publicare.
- Publicarea nu folosește force push și refuză o versiune depășită; reîncercarea aceleiași publicări nu creează commit dublu.
- Textul introdus în editor este afișat fără executarea HTML. Cratimele lungi lipite din alte surse sunt înlocuite automat.

## Schimbarea parolei

`npm run admin:password` (sau `npm run admin:password -- "parola-aleasa"`), apoi înlocuiește secretul `ADMIN_PASSWORD_HASH` în Cloudflare și rulează `npx wrangler d1 execute LEXYNS_DB --remote --command "DELETE FROM sessions"` ca să închizi sesiunile vechi.

## Verificare

```sh
npm run check
npm test
npm run build
```

Site-ul a fost verificat cu Chrome pe 1440×900, 390×844, 360×640 și cu „reducere a mișcării”: fără erori în consolă, fără derulare moartă, contrast de cel puțin 4,5:1 pe randarea reală, focus vizibil la navigarea din tastatură, fișa, meniul de pe telefon și editorul (autentificare, ciornă, previzualizare, ieșire). Publicarea reală în GitHub se testează după configurarea pasului 2.

Fonturi: Archivo (SIL Open Font License, `licenses/ARCHIVO-OFL.txt`), găzduit local, fără Google Fonts. Site-ul nu folosește analytics sau cookie-uri proprii; harta este încărcată de Google Maps.
