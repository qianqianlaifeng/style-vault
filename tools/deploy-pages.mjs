/**
 * BAIRIMENG-FG · 通过 GitHub REST API 部署到 GitHub Pages（无 git CLI 环境下）
 * 用法: node tools/deploy-pages.mjs [repoName]
 */
import { readFileSync, readdirSync, statSync, existsSync, writeFileSync } from 'node:fs';
import { resolve, dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const REPO = process.argv[2] || 'style-vault';
const API = 'https://api.github.com';

/* ---------- 读取凭据 ---------- */
function getToken() {
  const f = join(homedir(), '.git-credentials');
  if (!existsSync(f)) throw new Error('未找到 ~/.git-credentials');
  for (const line of readFileSync(f, 'utf8').split(/\r?\n/)) {
    if (!line.includes('github.com')) continue;
    const m = line.match(/^(?:https?:\/\/)?([^:@/]+):([^@]+)@(.+)$/);
    if (m) return { user: m[1], token: m[2] };
  }
  throw new Error('凭据中没有 github.com 条目');
}
const { user, token } = getToken();
const H = {
  Authorization: `Basic ${Buffer.from(`${user}:${token}`).toString('base64')}`,
  Accept: 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28',
  'User-Agent': 'bairimeng-fg-deploy',
  'Content-Type': 'application/json',
};

async function api(path, method = 'GET', body) {
  const res = await fetch(API + path, {
    method,
    headers: H,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data = null;
  try { data = JSON.parse(text); } catch { data = text; }
  if (!res.ok) {
    const msg = data && data.message ? data.message : text.slice(0, 300);
    throw new Error(`${method} ${path} → ${res.status} ${msg}`);
  }
  return data;
}

/* ---------- 收集要发布的文件 ---------- */
const INCLUDE_TOP = new Set(['index.html', 'README.md', '.nojekyll']);
const INCLUDE_DIRS = new Set(['assets']);
const INCLUDE_TOOLS = new Set([
  'fetch-styles.mjs', 'compress.mjs', 'build-styles.mjs', 'deploy-pages.mjs', 'serve.mjs', 'gen-thumbs.mjs',
]);

function walk(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, acc);
    else acc.push(full);
  }
  return acc;
}

const files = [];
for (const f of readdirSync(ROOT)) {
  const full = join(ROOT, f);
  if (statSync(full).isDirectory()) {
    if (INCLUDE_DIRS.has(f)) files.push(...walk(full));
    else if (f === 'tools') {
      for (const t of readdirSync(full)) if (INCLUDE_TOOLS.has(t)) files.push(join(full, t));
    }
  } else if (INCLUDE_TOP.has(f)) {
    files.push(full);
  }
}
// .nojekyll
if (!existsSync(join(ROOT, '.nojekyll'))) writeFileSync(join(ROOT, '.nojekyll'), '');

const entries = files.map((f) => ({
  path: relative(ROOT, f).split(sep).join('/'),
  full: f,
  size: statSync(f).size,
}));
console.log(`待发布 ${entries.length} 个文件，共 ${(entries.reduce((s, e) => s + e.size, 0) / 1048576).toFixed(1)}MB`);

/* ---------- 确保仓库存在 ---------- */
const me = await api('/user');
const owner = me.login;
let repoInfo;
try {
  repoInfo = await api(`/repos/${owner}/${REPO}`);
  console.log(`仓库已存在：${repoInfo.html_url}（可见性 ${repoInfo.private ? 'private' : 'public'}）`);
} catch (e) {
  if (!/404/.test(e.message)) throw e;
  repoInfo = await api('/user/repos', 'POST', {
    name: REPO,
    description: 'BAIRIMENG-FG · AI 视频风格库：一图一画风，抽卡找灵感，剧本自动匹配画风',
    private: false,
    auto_init: true,
    has_issues: false,
    has_wiki: false,
  });
  console.log(`已创建仓库：${repoInfo.html_url}`);
}

/* ---------- 上传 blob ---------- */
let uploaded = 0, reused = 0;
const tree = [];
const CONCURRENCY = 12;

async function pushBlob(e) {
  const buf = readFileSync(e.full);
  const res = await api(`/repos/${owner}/${REPO}/git/blobs`, 'POST', {
    content: buf.toString('base64'),
    encoding: 'base64',
  });
  tree.push({ path: e.path, mode: '100644', type: 'blob', sha: res.sha });
  uploaded++;
}

let idx = 0;
async function worker() {
  while (idx < entries.length) {
    const i = idx++;
    const e = entries[i];
    try {
      await pushBlob(e);
    } catch (err) {
      console.log(`  ! ${e.path} → ${err.message}`);
    }
    if (uploaded % 120 === 0) console.log(`  blobs ${uploaded}/${entries.length}`);
  }
}
await Promise.all(Array.from({ length: CONCURRENCY }, worker));
console.log(`blob 上传完成：${uploaded} / ${entries.length}`);

/* ---------- 写入 tree / commit ---------- */
const treeRes = await api(`/repos/${owner}/${REPO}/git/trees`, 'POST', { tree });
console.log(`tree 创建完成：${treeRes.sha}`);

let ref = null;
try { ref = await api(`/repos/${owner}/${REPO}/git/ref/heads/main`); } catch { /* 新仓库可能没有 */ }

let commitSha;
try {
  const commit = await api(`/repos/${owner}/${REPO}/git/commits`, 'POST', {
    message: 'feat: BAIRIMENG-FG AI 视频风格库（185 套画风 / 抽卡 / 剧本匹配）',
    tree: treeRes.sha,
    parents: ref ? [ref.object.sha] : [],
  });
  commitSha = commit.sha;
  await api(`/repos/${owner}/${REPO}/git/refs/heads/main`, 'PATCH', { sha: commitSha, force: false });
  console.log(`commit: ${commitSha}`);
} catch (e) {
  if (/422/.test(e.message) && /no changes/i.test(e.message)) {
    commitSha = ref.object.sha;
    console.log('内容无变化，复用现有 commit');
  } else throw e;
}

/* ---------- 开启 Pages ---------- */
try {
  const pages = await api(`/repos/${owner}/${REPO}/pages`, 'PUT', {
    source: { branch: 'main', path: '/' },
  });
  console.log(`Pages 已启用：${pages.html_url || pages.url}`);
} catch (e) {
  console.log(`Pages 配置返回：${e.message}（继续尝试 legacy build）`);
  try {
    const b = await api(`/repos/${owner}/${REPO}/pages/build`, 'POST', {});
    console.log('legacy build 已触发', b);
  } catch (e2) { console.log('legacy build 也失败：' + e2.message); }
}

console.log(`\n仓库：${repoInfo.html_url}`);
console.log(`预计访问地址：https://${owner}.github.io/${REPO}/`);
