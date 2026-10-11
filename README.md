# Scott Sullivan — website

A quiet, fast portfolio site with a built-in editor at **/admin** for adding and arranging paintings. No coding needed after the one-time setup below.

## What's here

| Folder / file | What it is |
|---|---|
| `content/artworks.json` | The list of paintings, in display order (edited through /admin) |
| `content/about.json`, `contact.json`, `site.json` | About text and portrait, contact details, site name and address |
| `public/images/uploads/` | Uploaded images (placeholders for now) |
| `public/admin/` | The editor |
| `src/` | Design (`styles.css`) and arrow-key / swipe navigation (`site.js`) |
| `build.mjs` | Turns the content into the finished website |

Everything marked "Placeholder" — the 12 grey-toned images, the portrait, the email address `hello@scottsullivanart.com` and the Instagram name `your-handle` — is meant to be replaced. The biography is a first draft written only from the facts provided; Scott should edit it in his own words.

---

## One-time setup (about 30 minutes)

### 1. Register the domain
Check **scottsullivanart.com** first, then **scottsullivan.art**, at any registrar (Namecheap, Porkbun, Cloudflare, or Netlify itself). If you end up with the `.art` address, change it in `content/site.json` and `public/admin/config.yml` (`site_url`).

### 2. Put the project on GitHub
1. Create a free account at github.com.
2. Create a new repository named `scott-sullivan-site` (private is fine).
3. Upload all files from this folder (on the repository page: **Add file → Upload files**, drag the folder contents in, **Commit**). Leave out `node_modules`, `dist`, `preview` if present.
4. Open `public/admin/config.yml` on GitHub, click the pencil, and replace `YOUR-GITHUB-USERNAME` with your GitHub username. Commit.

### 3. Publish on Netlify
1. Create a free account at netlify.com and sign in with GitHub.
2. **Add new site → Import an existing project → GitHub** → choose `scott-sullivan-site`.
3. Netlify reads the settings automatically (build `npm run build`, publish `dist`). Click **Deploy**.
4. In **Domain management**, add your domain and follow Netlify's instructions (or buy the domain there). HTTPS is turned on automatically.

### 4. Turn on the editor login
1. On GitHub: **Settings → Developer settings → OAuth Apps → New OAuth App**.
   - Homepage URL: `https://scottsullivanart.com`
   - Authorization callback URL: `https://api.netlify.com/auth/done`
   - Create it, then generate a **client secret**.
2. In Netlify: **Site configuration → Access & security → OAuth → Install provider → GitHub**, and paste the client ID and secret.

That's it. Visit `https://scottsullivanart.com/admin` and log in with GitHub.

---

## Everyday use: adding and editing paintings

Go to **yoursite.com/admin** → **Paintings → All paintings**.

- **Add a painting:** click **Add painting**. Upload the image, fill in title, year, medium, dimensions, and anything else you want (all optional except title and image). New paintings appear first.
- **Reorder:** drag a painting up or down by its handle. The website shows them in this order.
- **Edit:** click a painting to open it.
- **Hide without deleting:** switch off **Show on website**.
- **Remove:** open it and click the delete (trash) icon.
- Click **Publish → Publish now**. The live site updates in about a minute.

**About** and **Contact** are under **Pages**.

### Preparing images
- Photograph or scan straight-on, in even daylight, and crop exactly to the edge of the painting.
- Save as JPG, 2500–4000 pixels on the long side. Larger files are fine; the site automatically creates smaller, fast-loading versions for phones and laptops.
- Name files simply, e.g. `holly-springs-2026.jpg`.

### Good to know
- Each painting's web address comes from its title (`/work/holly-springs/`). Changing a title changes the address.
- Visitors can use ← and → keys (or swipe on a phone) to move between paintings, and Esc to return to all work.

---

## For whoever maintains the code

```bash
npm install            # installs sharp for image resizing (optional locally)
npm run build          # builds dist/
npm run serve          # view dist/ at http://localhost:3000
npm run cms            # in a second terminal: edit content locally at http://localhost:3000/admin
npm run preview        # one-file preview at preview/index.html
```

Plain Node, no framework, no client-side rendering: every page is static HTML with width/height set on images (no layout shift), lazy loading below the fold, responsive `srcset` WebP images, per-page titles and descriptions, Open Graph tags, schema.org data, `sitemap.xml` and `robots.txt`. The editor is [Decap CMS](https://decapcms.org), which commits changes to the GitHub repository; Netlify rebuilds on each commit. Vercel also works (build `npm run build`, output `dist`), but the editor login steps above are Netlify-specific.
