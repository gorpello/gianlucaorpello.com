#!/usr/bin/env node
/**
 * update-sitemap.js
 * Fetches the blog posts index from GitHub and regenerates sitemap.xml.
 * Run after publishing a new blog post: node scripts/update-sitemap.js
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const POSTS_INDEX_URL = 'https://raw.githubusercontent.com/gorpello/blog-posts/main/posts/index.json';
const SITEMAP_PATH = path.join(__dirname, '..', 'sitemap.xml');
const SITE_ROOT = 'https://gianlucaorpello.com';

// Non-blog pages that are always in the sitemap regardless of posts index.
const STATIC_URLS = [
  { loc: `${SITE_ROOT}/`,       changefreq: 'monthly', priority: '1.0' },
  { loc: `${SITE_ROOT}/blog/`,  changefreq: 'weekly',  priority: '0.9' },
];

function today() {
  return new Date().toISOString().slice(0, 10);
}

function fetchJSON(url) {
  return new Promise((resolve, reject) => {
    https.get(url, res => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error('Failed to parse JSON: ' + e.message)); }
      });
    }).on('error', reject);
  });
}

function buildSitemap(urls) {
  const entries = urls.map(u => `  <url>
    <loc>${u.loc}</loc>
    <lastmod>${u.lastmod || today()}</lastmod>
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries}
</urlset>\n`;
}

async function main() {
  let postUrls = [];

  try {
    const posts = await fetchJSON(POSTS_INDEX_URL);
    if (Array.isArray(posts)) {
      postUrls = posts.map(p => ({
        loc: p.url.startsWith('http') ? p.url : `${SITE_ROOT}${p.url}`,
        lastmod: p.date || today(),
        changefreq: 'monthly',
        priority: '0.8',
      }));
      console.log(`Fetched ${postUrls.length} post(s) from index.`);
    }
  } catch (err) {
    console.warn('Could not fetch posts index:', err.message);
    console.warn('Sitemap will only include static URLs.');
  }

  if (postUrls.length === 0) {
    console.warn('No posts returned from index — sitemap not modified to avoid data loss.');
    console.warn('Populate posts/index.json in gorpello/blog-posts, then re-run this script.');
    process.exit(0);
  }

  const allUrls = [
    ...STATIC_URLS.map(u => ({ ...u, lastmod: today() })),
    ...postUrls,
  ];

  const xml = buildSitemap(allUrls);
  fs.writeFileSync(SITEMAP_PATH, xml, 'utf8');
  console.log(`sitemap.xml updated with ${allUrls.length} URL(s).`);
  console.log(`Written to: ${SITEMAP_PATH}`);
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
