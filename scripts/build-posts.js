#!/usr/bin/env node
/**
 * build-posts.js
 * Fetches posts from gorpello/blog-posts, renders markdown → HTML, writes blog/{slug}.html
 *
 * Usage:
 *   node scripts/build-posts.js
 *
 * Optional env vars:
 *   GITHUB_TOKEN — raise GitHub API rate limit from 60 to 5000 req/hour
 *
 * Expected gorpello/blog-posts repo structure:
 *   posts/index.json     → [{slug, title, date, category, excerpt, image?, readingTime?}]
 *   posts/{slug}.md      → markdown content (frontmatter optional, stripped if present)
 */

const https = require('https');
const fs    = require('fs');
const path  = require('path');

const REPO_RAW   = 'https://raw.githubusercontent.com/gorpello/blog-posts/main';
const BLOG_DIR   = path.join(__dirname, '..', 'blog');
const SITE_ROOT  = 'https://gianlucaorpello.com';
const GITHUB_API = 'https://api.github.com';
const TOKEN      = process.env.GITHUB_TOKEN || '';

// Category → brand color
const CAT_COLOR = {
  'swift':    '#0077ff',
  'swiftui':  '#0077ff',
  'ios':      '#0077ff',
  'tca':      '#0077ff',
  'startup':  '#30d158',
  'legaltech':'#bf5af2',
  'teaching': '#ff9f0a',
  'apple':    '#6e6e73',
};

// Category → cover gradient
const CAT_GRADIENT = {
  'swift':    'linear-gradient(135deg,#0077ff 0%,#0050b8 100%)',
  'swiftui':  'linear-gradient(135deg,#0077ff 0%,#0050b8 100%)',
  'ios':      'linear-gradient(135deg,#0077ff 0%,#0050b8 100%)',
  'tca':      'linear-gradient(135deg,#0077ff 0%,#0050b8 100%)',
  'startup':  'linear-gradient(135deg,#30d158 0%,#1a8a35 100%)',
  'legaltech':'linear-gradient(135deg,#bf5af2 0%,#8e3fbe 100%)',
  'teaching': 'linear-gradient(135deg,#ff9f0a 0%,#c97800 100%)',
  'apple':    'linear-gradient(135deg,#636366 0%,#3a3a3c 100%)',
};
const DEFAULT_GRADIENT = 'linear-gradient(135deg,#3a3a3c 0%,#1c1c1e 100%)';

function catKey(cat) {
  return (cat || '').toLowerCase().split(/[\s·\-]+/)[0];
}

// ── HTTP helpers ──────────────────────────────────────────────────────────────

function fetchText(url) {
  return new Promise((resolve, reject) => {
    https.get(url, res => {
      let data = '';
      res.on('data', c => { data += c; });
      res.on('end', () => {
        if (res.statusCode >= 400) reject(new Error(`HTTP ${res.statusCode}: ${url}`));
        else resolve(data);
      });
    }).on('error', reject);
  });
}

function fetchJSON(url) {
  return fetchText(url).then(JSON.parse);
}

function postGitHubMarkdown(markdown) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ text: markdown, mode: 'markdown' });
    const headers = {
      'Content-Type':  'application/json',
      'Content-Length': Buffer.byteLength(body),
      'User-Agent':    'gianlucaorpello-blog-builder/1.0',
      'Accept':        'application/vnd.github+json',
    };
    if (TOKEN) headers['Authorization'] = `Bearer ${TOKEN}`;

    const req = https.request(
      { hostname: 'api.github.com', path: '/markdown', method: 'POST', headers },
      res => {
        let data = '';
        res.on('data', c => { data += c; });
        res.on('end', () => {
          if (res.statusCode >= 400) reject(new Error(`GitHub Markdown API: ${res.statusCode}`));
          else resolve(data);
        });
      }
    );
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// ── Utilities ─────────────────────────────────────────────────────────────────

function stripFrontmatter(md) {
  if (!md.startsWith('---')) return md;
  const end = md.indexOf('\n---', 3);
  if (end === -1) return md;
  return md.slice(end + 4).trimStart();
}

function fmtDate(iso) {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

function esc(str) {
  return String(str || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function countWords(text) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function readingTime(markdown) {
  const words = countWords(markdown.replace(/```[\s\S]*?```/g, ''));
  return Math.max(1, Math.round(words / 200));
}

function slugFromUrl(url) {
  return (url || '').replace(/.*\//, '').replace(/\.html?$/, '');
}

// ── HTML template ─────────────────────────────────────────────────────────────

function coverHTML(post) {
  if (post.image) {
    return `<div class="post-hero">
  <img class="post-hero-img" src="${esc(post.image)}" alt="${esc(post.title)}">
</div>`;
  }
  const grad = CAT_GRADIENT[catKey(post.category)] || DEFAULT_GRADIENT;
  return `<div class="post-hero">
  <div class="post-hero-gradient" style="background:${grad};"></div>
</div>`;
}

function postHTML(post, contentHTML) {
  const slug      = post.slug;
  const catColor  = CAT_COLOR[catKey(post.category)] || '#6e6e73';
  const mins      = post.readingTime || readingTime(post._rawMarkdown || '');
  const dateISO   = post.date;
  const dateFmt   = fmtDate(dateISO);
  const canonical = `${SITE_ROOT}/blog/${slug}.html`;

  const ogImage = post.image
    ? esc(post.image)
    : `${SITE_ROOT}/images/og-image.jpg`;

  const schemaJSON = JSON.stringify({
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "TechArticle",
        "@id": `${canonical}#article`,
        "url": canonical,
        "headline": post.title,
        "description": post.excerpt,
        "datePublished": dateISO,
        "dateModified": dateISO,
        "image": post.image || `${SITE_ROOT}/images/og-image.jpg`,
        "inLanguage": "en",
        "author": {
          "@type": "Person",
          "@id": `${SITE_ROOT}/#person`,
          "name": "Gianluca Orpello"
        },
        "publisher": {
          "@type": "Person",
          "@id": `${SITE_ROOT}/#person`,
          "name": "Gianluca Orpello"
        },
        "isPartOf": { "@id": `${SITE_ROOT}/blog/#blog` }
      },
      {
        "@type": "BreadcrumbList",
        "itemListElement": [
          { "@type": "ListItem", "position": 1, "name": "Home",  "item": `${SITE_ROOT}/` },
          { "@type": "ListItem", "position": 2, "name": "Blog",  "item": `${SITE_ROOT}/blog/` },
          { "@type": "ListItem", "position": 3, "name": post.title, "item": canonical }
        ]
      }
    ]
  }, null, 2);

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<!-- Google tag (gtag.js) -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-987E4LE2NQ"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'G-987E4LE2NQ');
</script>
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="color-scheme" content="light dark">
<link rel="icon" type="image/svg+xml" href="/images/favicon.svg">
<link rel="icon" type="image/png" sizes="32x32" href="/images/favicon-32.png">
<link rel="apple-touch-icon" sizes="180x180" href="/images/apple-touch-icon.png">
<title>${esc(post.title)} — Gianluca Orpello</title>
<meta name="description" content="${esc(post.excerpt)}">
<link rel="canonical" href="${canonical}">
<meta property="og:type"        content="article">
<meta property="og:title"       content="${esc(post.title)}">
<meta property="og:description" content="${esc(post.excerpt)}">
<meta property="og:url"         content="${canonical}">
<meta property="og:image"       content="${ogImage}">
<meta property="article:published_time" content="${dateISO}">
<meta property="article:author" content="Gianluca Orpello">
<meta property="article:section" content="${esc(post.category)}">
<meta name="twitter:card"        content="summary_large_image">
<meta name="twitter:title"       content="${esc(post.title)}">
<meta name="twitter:description" content="${esc(post.excerpt)}">
<meta name="twitter:image"       content="${ogImage}">
<script>
  (function(){
    document.documentElement.classList.add('js-ready');
    var t = localStorage.getItem('theme');
    if (!t) t = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', t);
  })();
</script>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,400;0,14..32,500;0,14..32,600;0,14..32,700;0,14..32,800;1,14..32,400;1,14..32,600&family=Inter+Tight:wght@700;800&display=swap">
<link rel="stylesheet" href="../css/main.css">
<script type="application/ld+json">
${schemaJSON}
</script>
</head>
<body>

<div class="reading-progress" id="reading-progress"></div>
<div class="custom-cursor"></div>

<nav id="nav">
  <a href="../" class="nav-logo cursor-hover">Gianluca Orpello</a>
  <div class="nav-right">
    <div class="nav-links">
      <a href="../#about"          class="cursor-hover">About</a>
      <a href="../#experience"     class="cursor-hover">Experience</a>
      <a href="../#certifications" class="cursor-hover">Certifications</a>
      <a href="../blog/"           class="cursor-hover nav-active">Blog</a>
      <a href="../#contact"        class="cursor-hover">Contact</a>
    </div>
    <button class="theme-toggle cursor-hover" id="themeToggle" aria-label="Toggle theme"></button>
    <button class="burger cursor-hover" id="burger" aria-label="Menu">
      <span></span><span></span><span></span>
    </button>
  </div>
</nav>

<div class="mob-overlay" id="mob">
  <a href="../#about"          class="mob-link cursor-hover">About<span>→</span></a>
  <a href="../#experience"     class="mob-link cursor-hover">Experience<span>→</span></a>
  <a href="../#certifications" class="mob-link cursor-hover">Certifications<span>→</span></a>
  <a href="../blog/"           class="mob-link cursor-hover">Blog<span>→</span></a>
  <a href="../#contact"        class="mob-link cursor-hover">Contact<span>→</span></a>
</div>

<header class="post-header" id="main-content">
  <div class="post-meta-row">
    <span class="post-cat" style="background:${catColor};">${esc(post.category)}</span>
    <span class="post-meta-divider"></span>
    <time class="post-date" datetime="${dateISO}">${dateFmt}</time>
    <span class="post-meta-divider"></span>
    <span class="post-read-time">${mins} min read</span>
  </div>
  <h1 class="post-title">${esc(post.title)}</h1>
  <p class="post-excerpt">${esc(post.excerpt)}</p>
  <div class="post-byline">
    <img class="post-byline-avatar" src="/images/gianluca-orpello.jpg" alt="Gianluca Orpello" width="40" height="40">
    <div class="post-byline-info">
      <span class="post-byline-name">Gianluca Orpello</span>
      <span class="post-byline-role">iOS Engineer · Co-Founder</span>
    </div>
  </div>
</header>

${coverHTML(post)}

<article class="post-body">
${contentHTML}
</article>

<div class="post-author-bio">
  <img class="post-author-bio-avatar" src="/images/gianluca-orpello.jpg" alt="Gianluca Orpello" width="64" height="64">
  <div class="post-author-bio-content">
    <span class="post-author-bio-name">Gianluca Orpello</span>
    <p class="post-author-bio-text">iOS Engineer &amp; Apple Certified Trainer with 8+ years of Swift. Co-founder at Unicorn Donkeys, one exit. Writing about Swift, SwiftUI, TCA, and startup building.</p>
    <div class="post-author-bio-links">
      <a href="https://www.linkedin.com/in/gianlucaorpello/" target="_blank" rel="noopener">LinkedIn</a>
      <a href="https://github.com/gorpello" target="_blank" rel="noopener">GitHub</a>
    </div>
  </div>
</div>

<nav class="post-nav">
  <a class="post-nav-link cursor-hover" href="../blog/">← All posts</a>
  <a class="post-nav-link cursor-hover" href="../#contact">Get in touch →</a>
</nav>

<footer>
  <div class="footer-inner">
    <div class="footer-brand">
      <a href="../" class="footer-brand-logo cursor-hover">Gianluca Orpello</a>
      <p class="footer-brand-tagline">iOS Engineer &amp; Co-Founder.<br>8 years of Swift, one exit.</p>
      <p class="footer-brand-loc">Naples, Italy · EU citizen</p>
    </div>
    <div>
      <p class="footer-col-title">Pages</p>
      <ul class="footer-links">
        <li><a href="../#about"          class="cursor-hover">About</a></li>
        <li><a href="../#experience"     class="cursor-hover">Experience</a></li>
        <li><a href="../#certifications" class="cursor-hover">Certifications</a></li>
        <li><a href="../blog/"           class="cursor-hover">Blog</a></li>
        <li><a href="../#contact"        class="cursor-hover">Contact</a></li>
      </ul>
    </div>
    <div>
      <p class="footer-col-title">Connect</p>
      <ul class="footer-links">
        <li><a href="mailto:g.orpello@gmail.com" class="cursor-hover"><span class="fl-icon">✉</span>g.orpello@gmail.com</a></li>
        <li><a href="https://www.linkedin.com/in/gianlucaorpello/" target="_blank" rel="noopener" class="cursor-hover"><span class="fl-icon">in</span>LinkedIn</a></li>
        <li><a href="https://github.com/gorpello" target="_blank" rel="noopener" class="cursor-hover"><span class="fl-icon">⌥</span>GitHub</a></li>
        <li><a href="../Gianluca_Orpello_CV.pdf" download class="cursor-hover"><span class="fl-icon">↓</span>Download CV</a></li>
      </ul>
    </div>
  </div>
  <div class="footer-bottom">
    <span>© 2026 Gianluca Orpello</span>
    <span>Crafted with care · Naples, Italy</span>
  </div>
</footer>

<script src="../js/main.js"></script>
</body>
</html>`;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('Fetching posts index…');
  let posts;
  try {
    posts = await fetchJSON(`${REPO_RAW}/posts/index.json`);
  } catch (err) {
    console.error('Failed to fetch posts/index.json:', err.message);
    process.exit(1);
  }

  if (!Array.isArray(posts) || posts.length === 0) {
    console.warn('No posts in index. Nothing to build.');
    process.exit(0);
  }

  console.log(`Found ${posts.length} post(s).`);

  let built = 0;
  let failed = 0;

  for (const post of posts) {
    // Resolve slug
    const slug = post.slug || slugFromUrl(post.url);
    if (!slug) {
      console.warn('  ⚠ Post has no slug or url, skipping:', post.title);
      failed++;
      continue;
    }

    post.slug = slug;

    // Fetch markdown
    let rawMd;
    try {
      rawMd = await fetchText(`${REPO_RAW}/posts/${slug}.md`);
    } catch (err) {
      console.warn(`  ✗ Could not fetch posts/${slug}.md:`, err.message);
      failed++;
      continue;
    }

    // Strip frontmatter, store raw for word-count
    const mdContent = stripFrontmatter(rawMd);
    post._rawMarkdown = mdContent;

    // Render markdown → HTML via GitHub API
    let contentHTML;
    try {
      contentHTML = await postGitHubMarkdown(mdContent);
    } catch (err) {
      console.warn(`  ✗ Markdown render failed for ${slug}:`, err.message);
      failed++;
      continue;
    }

    // Generate and write HTML
    const html     = postHTML(post, contentHTML);
    const outPath  = path.join(BLOG_DIR, `${slug}.html`);
    fs.writeFileSync(outPath, html, 'utf8');

    const mins = post.readingTime || readingTime(mdContent);
    console.log(`  ✓ ${slug}.html  (${mins} min read)`);
    built++;
  }

  console.log(`\nDone. Built: ${built}  Failed: ${failed}`);
  if (built > 0) {
    console.log('\nNext: run  node scripts/update-sitemap.js  to update sitemap.xml');
  }
}

main().catch(err => {
  console.error('Fatal:', err.message);
  process.exit(1);
});
