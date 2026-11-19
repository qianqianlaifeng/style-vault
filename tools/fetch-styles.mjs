/**
 * BAIRIMENG-FG · 从 oiioii.tv 风格库拉取全量数据 + 下载参考图
 * 用法: node tools/fetch-styles.mjs
 */
import { writeFileSync, mkdirSync, existsSync, statSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const API = 'https://api.oiioii.tv';
const THUMBS = resolve(ROOT, 'assets/thumbs');
const REF_DIR = resolve(ROOT, 'assets/refs');
mkdirSync(THUMBS, { recursive: true });
mkdirSync(REF_DIR, { recursive: true });

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36';

async function api(path, body = {}) {
  const res = await fetch(API + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'User-Agent': UA, Referer: 'https://www.oiioii.tv/' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${path} http ${res.status}`);
  const j = await res.json();
  if (j.code !== 'SUCCESS') throw new Error(`${path} -> ${j.code} ${j.message || ''}`);
  return j.data;
}

const items = [];
let page = 1, totalPages = 1, total = 0;
do {
  const d = await api('/knowledge/style_assets', { page, limit: 20 });
  total = d.total; totalPages = d.total_pages;
  items.push(...d.items);
  console.log(`page ${page}/${totalPages} 累计 ${items.length}/${total}`);
  page++;
  if (page > 60) break;
} while (page <= totalPages);

writeFileSync(resolve(ROOT, 'tools/style_assets_all.json'), JSON.stringify({ total, items }, null, 1));
console.log(`\n共 ${items.length} 个风格，已保存 tools/style_assets_all.json`);

// ---- 下载图片 ----
const REF_KEYS = ['girl_url', 'boy_url', 'pet_url', 'indoor_url', 'outdoor_url'];
async function download(url, dest) {
  if (!url) return 0;
  if (existsSync(dest) && statSync(dest).size > 1024) return statSync(dest).size;
  const res = await fetch(url, { headers: { 'User-Agent': UA, Referer: 'https://www.oiioii.tv/' } });
  if (!res.ok) { console.log(`  ! http ${res.status} ${url}`); return 0; }
  const buf = Buffer.from(await res.arrayBuffer());
  writeFileSync(dest, buf);
  return buf.length;
}

let bytes = 0;
for (const it of items) {
  const m = it.meta || {};
  const id = it.id;
  const main = await download(m.url, resolve(THUMBS, `${id}.jpg`));
  bytes += main;
  for (const k of REF_KEYS) {
    const b = await download(m[k], resolve(REF_DIR, `${id}_${k.replace('_url', '')}.jpg`));
    bytes += b;
  }
  const av = await download(m.creator_avatar_url, resolve(REF_DIR, `${id}_avatar.jpg`));
  bytes += av;
  console.log(`✓ ${m.name_cn || m.name}  (${id})  main=${(main / 1024).toFixed(0)}KB  total=${(bytes / 1024 / 1024).toFixed(1)}MB`);
}
console.log(`\n图片下载完成，共 ${(bytes / 1024 / 1024).toFixed(1)} MB`);
