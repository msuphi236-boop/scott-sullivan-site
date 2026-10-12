// Builds the static website into dist/ from the files in content/.
//   npm run build     -> dist/ (the real site, what Netlify publishes)
//   npm run preview   -> preview/index.html (one self-contained file, for a quick look)
// If the "sharp" package is installed (Netlify installs it automatically), large
// photographs are resized into fast-loading web versions. Without it, originals are used.
import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.dirname(new URL(import.meta.url).pathname);
const PREVIEW = process.argv.includes('--preview');
const OUT = path.join(ROOT, PREVIEW ? 'preview' : 'dist');
let sharp = null;
if (!PREVIEW) { try { sharp = (await import('sharp')).default; } catch { /* optional */ } }

const readJSON = async (f) => JSON.parse(await fs.readFile(path.join(ROOT, 'content', f), 'utf8'));
const site = await readJSON('site.json');
const about = await readJSON('about.json');
const contact = await readJSON('contact.json');
const { artworks = [] } = await readJSON('artworks.json');
const SITE_URL = (site.url || '').replace(/\/$/, '');
const YEAR = new Date().getFullYear();

// ---------- helpers ----------
const esc = (s = '') => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const slugify = (s) => String(s).normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase()
  .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'work';

// Very small Markdown subset: paragraphs, *italic*, **bold**, [links](url)
const md = (s = '') => String(s).trim().split(/\n\s*\n/).filter(Boolean).map((p) => '<p>' + esc(p.trim())
  .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  .replace(/\*(.+?)\*/g, '<em>$1</em>')
  .replace(/\[(.+?)\]\((https?:\/\/[^\s)]+|mailto:[^\s)]+)\)/g, '<a href="$2">$1</a>')
  .replace(/\n/g, '<br>') + '</p>').join('\n');

// Read pixel dimensions from an image file without any dependencies.
function imageSize(buf, ext) {
  try {
    if (ext === '.svg') {
      const t = buf.toString('utf8', 0, 2000);
      const vb = t.match(/viewBox="[\d.\s-]*?([\d.]+)[\s,]+([\d.]+)"/);
      const w = t.match(/\swidth="([\d.]+)"/), h = t.match(/\sheight="([\d.]+)"/);
      if (w && h) return [Math.round(+w[1]), Math.round(+h[1])];
      if (vb) return [Math.round(+vb[1]), Math.round(+vb[2])];
    }
    if (buf[0] === 0x89 && buf.toString('ascii', 1, 4) === 'PNG') return [buf.readUInt32BE(16), buf.readUInt32BE(20)];
    if (buf.toString('ascii', 0, 3) === 'GIF') return [buf.readUInt16LE(6), buf.readUInt16LE(8)];
    if (buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') {
      const kind = buf.toString('ascii', 12, 16);
      if (kind === 'VP8 ') return [buf.readUInt16LE(26) & 0x3fff, buf.readUInt16LE(28) & 0x3fff];
      if (kind === 'VP8L') { const b = buf.readUInt32LE(21); return [(b & 0x3fff) + 1, ((b >> 14) & 0x3fff) + 1]; }
      if (kind === 'VP8X') return [1 + buf.readUIntLE(24, 3), 1 + buf.readUIntLE(27, 3)];
    }
    if (buf[0] === 0xff && buf[1] === 0xd8) {
      let i = 2;
      while (i < buf.length) {
        if (buf[i] !== 0xff) { i++; continue; }
        const m = buf[i + 1];
        if (m >= 0xc0 && m <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(m)) return [buf.readUInt16BE(i + 7), buf.readUInt16BE(i + 5)];
        i += 2 + buf.readUInt16BE(i + 2);
      }
    }
  } catch { /* fall through */ }
  return [1200, 1500];
}

const WIDTHS = [640, 1280, 2048];
async function processImage(src) {
  const file = path.join(ROOT, 'public', decodeURI(src));
  const ext = path.extname(file).toLowerCase();
  let buf;
  try { buf = await fs.readFile(file); } catch { console.warn('  ! missing image:', src); return { src, width: 1200, height: 1500 }; }
  let [width, height] = imageSize(buf, ext);

  if (PREVIEW) {
    if (process.env.PREVIEW_IMAGES) { try { buf = await fs.readFile(path.join(process.env.PREVIEW_IMAGES, path.basename(file))); } catch { /* use original */ } }
    const uri = ext === '.svg'
      ? 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(buf.toString('utf8'))
      : `data:image/${ext === '.jpg' ? 'jpeg' : ext.slice(1)};base64,` + buf.toString('base64');
    return { src: uri, width, height };
  }
  if (!sharp || ext === '.svg' || ext === '.gif') return { src, width, height };

  const meta = await sharp(buf).metadata();
  if (meta.orientation >= 5) [width, height] = [meta.height, meta.width];
  else [width, height] = [meta.width, meta.height];
  const base = path.basename(file, ext).replace(/[^\w-]+/g, '-');
  const sizes = WIDTHS.filter((w) => w < width).concat(Math.min(width, 2560));
  const set = [];
  for (const w of [...new Set(sizes)]) {
    const rel = `/images/r/${base}-${w}.webp`;
    const out = path.join(OUT, rel);
    await fs.mkdir(path.dirname(out), { recursive: true });
    await sharp(buf).rotate().resize({ width: w }).webp({ quality: 84 }).toFile(out);
    set.push(`${rel} ${w}w`);
  }
  const fallback = set[Math.min(1, set.length - 1)].split(' ')[0];
  return { src: fallback, srcset: set.join(', '), width, height };
}

const img = (im, alt, { sizes, eager = false, priority = false } = {}) =>
  `<img src="${esc(im.src)}"${im.srcset ? ` srcset="${esc(im.srcset)}" sizes="${sizes}"` : ''} width="${im.width}" height="${im.height}" alt="${esc(alt)}" ${eager ? 'loading="eager"' : 'loading="lazy"'} decoding="async"${priority ? ' fetchpriority="high"' : ''}>`;

// ---------- data ----------
const used = new Set();
// Clear output before image processing so generated WebP files survive.
if (!PREVIEW) await fs.rm(OUT, { recursive: true, force: true });

const works = [];
for (const a of artworks) {
  if (a.published === false || !a.image) continue;
  let slug = slugify(a.title || 'untitled'), n = 2;
  while (used.has(slug)) slug = `${slugify(a.title || 'untitled')}-${n++}`;
  used.add(slug);
  works.push({ ...a, slug, im: await processImage(a.image) });
}
const portrait = about.portrait ? await processImage(about.portrait) : null;

const titleLine = (w) => [w.title ? `<i>${esc(w.title)}</i>` : '<i>Untitled</i>', w.year && esc(w.year)].filter(Boolean).join(', ');
const altText = (w) => [w.title || 'Untitled', w.year, w.medium].filter(Boolean).join(', ') + ' — painting by ' + site.name;

// Links differ between the real site (folders) and the one-file preview (#anchors)
const link = (p) => {
  if (!PREVIEW) return p;
  if (p === '/' || p.startsWith('/#')) return '#work';
  if (p.startsWith('/work/')) return '#w-' + p.split('/')[2];
  return '#' + p.replace(/\//g, '');
};

// ---------- page parts ----------
const header = (current) => `<a class="skip" href="#main">Skip to content</a>
<header class="site-header">
  <a class="name" href="${link('/')}">${esc(site.name)}</a>
  <nav aria-label="Main"><ul class="nav">
    ${[['/', 'Work'], ['/about/', 'About'], ['/contact/', 'Contact']].map(([h, t]) =>
      `<li><a href="${link(h)}" data-nav="${t.toLowerCase()}"${current === t.toLowerCase() ? ' aria-current="page"' : ''}>${t}</a></li>`).join('')}
  </ul></nav>
</header>`;
const footer = `<footer class="site-footer">© ${YEAR} ${esc(site.name)}</footer>`;

const workGrid = () => `<h1 class="visually-hidden">Work</h1>
<ul class="grid">
${works.map((w, i) => `  <li class="tile" id="${w.slug}"><a href="${link(`/work/${w.slug}/`)}">
    <span class="frame">${img(w.im, altText(w), { sizes: '(min-width: 640px) 45vw, 100vw', eager: i < 3, priority: i === 0 })}</span>
    <span class="cap">${titleLine(w)}</span></a></li>`).join('\n')}
</ul>`;

const workIndex = () => `<section class="slideshow" aria-label="Selected paintings">
  <h1 class="visually-hidden">Work</h1>
  ${works.map((w,i)=>`<figure class="slide" ${i?'hidden':''}>
    <a class="piece-img" href="${link('/work/'+w.slug+'/')}">${img(w.im,altText(w),{sizes:'80vw',eager:i===0,priority:i===0})}</a>
    <figcaption class="cap">${titleLine(w)}</figcaption>
  </figure>`).join('')}
  <nav class="slider-controls pager" aria-label="Browse paintings">
    <button type="button" data-step="-1">Previous</button>
    <span class="count" aria-live="polite">1 / ${works.length}</span>
    <button type="button" data-step="1">Next</button>
    <a href="/all/">View all</a>
  </nav>
</section><div class="mobile-gallery">${workGrid()}</div>`;

const piece = (w, i) => {
  const prev = works[(i - 1 + works.length) % works.length];
  const next = works[(i + 1) % works.length];
  const lines = [w.medium, w.dimensions, w.availability].filter(Boolean).map((t) => `<p>${esc(t)}</p>`).join('');
  return `<article class="piece">
  <a class="piece-img" href="${link(`/work/${next.slug}/`)}" aria-label="Next work: ${esc(next.title || 'Untitled')}">
    ${img(w.im, altText(w), { sizes: '(min-width: 640px) 80vw, 100vw', eager: true, priority: true })}
  </a>
  <div class="piece-foot">
    <div class="meta">
      <h1>${titleLine(w)}</h1>${lines}
      ${w.description ? `<div class="note">${md(w.description)}</div>` : ''}
    </div>
    <nav class="pager" aria-label="Browse work">
      <a rel="prev" href="${link(`/work/${prev.slug}/`)}">Previous</a>
      <span class="count">${i + 1} / ${works.length}</span>
      <a rel="next" href="${link(`/work/${next.slug}/`)}">Next</a>
      <a data-index href="${link(`/all/#${w.slug}`)}">Index</a>
    </nav>
  </div>
</article>`;
};

const aboutPage = () => `<div class="about">
  ${portrait ? `<figure>${img(portrait, `Portrait of ${site.name}`, { sizes: '(min-width: 760px) 40vw, 100vw', eager: true })}${about.portrait_caption ? `<figcaption>${esc(about.portrait_caption)}</figcaption>` : ''}</figure>` : '<div></div>'}
  <div class="bio"><h1>About</h1>${md(about.bio)}
  ${(about.cv || []).filter((s) => s.heading && (s.entries || []).length).map((s) => `<section class="cv"><h2>${esc(s.heading)}</h2><dl>${s.entries.map((e) => `<div><dt>${esc(e.year || '')}</dt><dd>${e.link ? `<a href="${esc(e.link)}" rel="noopener">${esc(e.text || '')}</a>` : esc(e.text || '')}</dd></div>`).join('')}</dl></section>`).join('')}
  </div>
</div>`;

const ig = (contact.instagram || '').replace(/^@/, '').replace(/^https?:\/\/(www\.)?instagram\.com\//, '').replace(/\/$/, '');
const contactPage = () => `<h1 class="visually-hidden">Contact</h1>
<dl class="contact">
  ${contact.email ? `<div><dt>Email</dt><dd><a href="mailto:${esc(contact.email)}">${esc(contact.email)}</a></dd></div>` : ''}
  ${contact.phone ? `<div><dt>Phone</dt><dd><a href="tel:+1${esc(String(contact.phone).replace(/\D/g, '').replace(/^1(?=\d{10}$)/, ''))}">${esc(contact.phone)}</a></dd></div>` : ''}
  ${ig ? `<div><dt>Instagram</dt><dd><a href="https://www.instagram.com/${esc(ig)}/" rel="me noopener">@${esc(ig)}</a></dd></div>` : ''}
  ${contact.location ? `<div><dt>Studio</dt><dd>${esc(contact.location)}</dd></div>` : ''}
</dl>`;

// ---------- full HTML document (real site) ----------
const FONTS = '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Hanken+Grotesk:ital,wght@0,400;0,500;1,400&display=swap">';
const doc = ({ title, description, pathname, current, body, image, jsonld }) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${SITE_URL}${pathname}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="${esc(site.name)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${SITE_URL}${pathname}">
${image ? `<meta property="og:image" content="${SITE_URL}${esc(image)}"><meta name="twitter:card" content="summary_large_image">` : ''}
${FONTS}
<link rel="stylesheet" href="/assets/styles.css?v=mobile-grid-2">
${jsonld ? `<script type="application/ld+json">${JSON.stringify(jsonld)}</script>` : ''}
</head>
<body>
${header(current === 'piece' ? 'work' : current)}
<main id="main">
${body}
</main>
${footer}
${(current === 'piece' || current === 'work') ? '<script src="/assets/site.js?v=preview-height-2" defer></script>' : ''}
</body>
</html>
`;

async function write(rel, content) {
  const f = path.join(OUT, rel);
  await fs.mkdir(path.dirname(f), { recursive: true });
  await fs.writeFile(f, content);
}

async function copyDir(from, to) {
  await fs.mkdir(to, { recursive: true });
  for (const e of await fs.readdir(from, { withFileTypes: true })) {
    const a = path.join(from, e.name), b = path.join(to, e.name);
    if (e.isDirectory()) await copyDir(a, b); else await fs.copyFile(a, b);
  }
}

// ---------- build ----------
if (PREVIEW) {
  await fs.mkdir(OUT, { recursive: true });
  const css = await fs.readFile(path.join(ROOT, 'src', 'styles.css'), 'utf8');
  const titles = { work: `${site.name}`, about: `About — ${site.name}`, contact: `Contact — ${site.name}` };
  works.forEach((w) => { titles['w-' + w.slug] = `${w.title || 'Untitled'} — ${site.name}`; });
  const sections = [
    `<section data-route="work">${workIndex()}</section>`,
    ...works.map((w, i) => `<section data-route="w-${w.slug}" hidden>${piece(w, i)}</section>`),
    `<section data-route="about" hidden>${aboutPage()}</section>`,
    `<section data-route="contact" hidden>${contactPage()}</section>`,
  ].join('\n');
  const router = `<script>
(function(){
  var titles=${JSON.stringify(titles)}, last=null;
  function show(){
    var r=location.hash.slice(1)||'work'; if(!titles[r]) return;
    document.querySelectorAll('[data-route]').forEach(function(s){ s.hidden = s.getAttribute('data-route')!==r; });
    var nav = r==='about'||r==='contact' ? r : 'work';
    document.querySelectorAll('[data-nav]').forEach(function(a){ if(a.getAttribute('data-nav')===nav) a.setAttribute('aria-current','page'); else a.removeAttribute('aria-current'); });
    document.title = titles[r];
    if(r==='work' && last){ var t=document.getElementById(last.slice(2)); if(t) t.scrollIntoView({block:'center'}); }
    else window.scrollTo(0,0);
    last = r.indexOf('w-')===0 ? r : last;
  }
  window.addEventListener('hashchange', show); show();
  function cur(){ return document.querySelector('[data-route]:not([hidden])'); }
  document.addEventListener('keydown', function(e){
    var s=cur(); if(!s || s.getAttribute('data-route').indexOf('w-')!==0 || e.metaKey||e.ctrlKey||e.altKey) return;
    var a = e.key==='ArrowRight' ? s.querySelector('a[rel=next]') : e.key==='ArrowLeft' ? s.querySelector('a[rel=prev]') : e.key==='Escape' ? s.querySelector('a[data-index]') : null;
    if(a){ e.preventDefault(); location.hash = a.getAttribute('href'); }
  });
  var x0=null,y0=null;
  document.addEventListener('touchstart',function(e){ if(e.touches.length===1){x0=e.touches[0].clientX;y0=e.touches[0].clientY;} },{passive:true});
  document.addEventListener('touchend',function(e){ if(x0===null) return; var s=cur(); var dx=e.changedTouches[0].clientX-x0, dy=e.changedTouches[0].clientY-y0; x0=null;
    if(!s || s.getAttribute('data-route').indexOf('w-')!==0) return;
    if(Math.abs(dx)>60 && Math.abs(dx)>Math.abs(dy)*1.5){ var a=s.querySelector(dx<0?'a[rel=next]':'a[rel=prev]'); if(a) location.hash=a.getAttribute('href'); } },{passive:true});
})();
</script>`;
  const page = `<title>Scott Sullivan Portfolio</title>
${FONTS}
<style>
${css}
</style>
${header('work')}
<main id="main">
${sections}
</main>
${footer}
${router}
`;
  await write('index.html', page);
  console.log('Preview written to preview/index.html');
} else {
  await copyDir(path.join(ROOT, 'public'), OUT);
  await copyDir(path.join(ROOT, 'src'), path.join(OUT, 'assets'));

  const ogFirst = works[0]?.im.src;
  await write('index.html', doc({
    title: site.name, description: site.description, pathname: '/', current: 'work', body: workIndex(), image: ogFirst,
    jsonld: { '@context': 'https://schema.org', '@type': 'Person', name: site.name, url: SITE_URL, jobTitle: 'Painter',
      sameAs: ig ? [`https://www.instagram.com/${ig}/`] : [] },
  }));
  await write('all/index.html', doc({
    title: 'All work — ' + site.name, description: site.description,
    pathname: '/all/', current: 'all', body: workGrid(), image: ogFirst,
  }));
  for (const [i, w] of works.entries()) {
    await write(`work/${w.slug}/index.html`, doc({
      title: `${w.title || 'Untitled'}${w.year ? ', ' + w.year : ''} — ${site.name}`,
      description: [w.title, w.year, w.medium, w.dimensions].filter(Boolean).join(', ') + `. Painting by ${site.name}.`,
      pathname: `/work/${w.slug}/`, current: 'piece', body: piece(w, i), image: w.im.src,
      jsonld: { '@context': 'https://schema.org', '@type': 'VisualArtwork', name: w.title, dateCreated: w.year || undefined,
        artMedium: w.medium || undefined, size: w.dimensions || undefined, image: SITE_URL + w.im.src,
        creator: { '@type': 'Person', name: site.name } },
    }));
  }
  await write('about/index.html', doc({ title: `About — ${site.name}`, description: site.description, pathname: '/about/', current: 'about', body: aboutPage(), image: portrait?.src }));
  await write('contact/index.html', doc({ title: `Contact — ${site.name}`, description: `Contact ${site.name}.`, pathname: '/contact/', current: 'contact', body: contactPage() }));
  await write('404.html', doc({ title: `Not found — ${site.name}`, description: site.description, pathname: '/404', current: '', body: `<p>This page doesn’t exist. <a href="/" style="border-bottom:1px solid var(--rule)">Return to the work</a>.</p>` }));
  const urls = ['/', '/about/', '/contact/', ...works.map((w) => `/work/${w.slug}/`)];
  await write('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `  <url><loc>${SITE_URL}${u}</loc></url>`).join('\n')}\n</urlset>\n`);
  await write('robots.txt', `User-agent: *\nDisallow: /admin/\nSitemap: ${SITE_URL}/sitemap.xml\n`);
  console.log(`Built ${works.length} works into dist/${sharp ? ' (images resized)' : ' (original images; install sharp to resize)'}`);
}
