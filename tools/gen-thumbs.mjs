/**
 * StyleVault · 参考图批量生成 / 下载脚本
 * 用法: node tools/gen-thumbs.mjs [--batch 5] [--only id1,id2]
 * 幂等: 已存在的缩略图会跳过, 可中断后继续
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const OUT = resolve(ROOT, 'assets/thumbs');
const LOG = resolve(ROOT, 'tools/gen-log.txt');
mkdirSync(OUT, { recursive: true });

const argv = process.argv.slice(2);
const getArg = (k, d) => {
  const i = argv.indexOf(k);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : d;
};
const BATCH = parseInt(getArg('--batch', '5'), 10);
const ONLY = (getArg('--only', '') || '').split(',').filter(Boolean);

const log = (...a) => {
  const line = a.join(' ');
  console.log(line);
  try { appendFileSync(LOG, line + '\n'); } catch {}
};
import { appendFileSync } from 'node:fs';

// ---- 载入风格数据 ----
globalThis.window = {};
eval(readFileSync(resolve(ROOT, 'assets/data/styles.js'), 'utf8'));
const LIB = globalThis.window.STYLE_LIBRARY;

const SUBJECT = 'a young East Asian protagonist, expressive eyes, detailed natural skin, full upper body visible';
const SHOT = 'medium shot, subject centered, shallow depth of field';

function buildPrompt(s) {
  const en = s.promptEn
    .replace(/\{scene\}/g, SHOT)
    .replace(/\{character\}/g, SUBJECT)
    .replace(/\{shot\}/g, '9:16 vertical cinematic keyframe');
  return (
    `Style reference keyframe for an AI video style library. ${en}. ` +
    `Color palette: ${s.palette.join(', ')}. ` +
    `Lighting: ${s.lighting}. ` +
    `Material texture: ${s.material}. ` +
    `Highly detailed, production quality, film still, no text, no watermark, no logo, no border.`
  );
}

// ---- CLI 调用 ----
function mcode(args, json = false) {
  const out = execFileSync('cmd.exe', ['/c', 'mcode-tools', ...args], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    windowsHide: true,
  });
  if (!json) return out;
  const start = out.indexOf('{');
  return JSON.parse(out.slice(start));
}

async function download(url, dest) {
  const res = await fetch(url, { headers: { 'User-Agent': 'mcode' } });
  if (!res.ok) throw new Error(`download http ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  writeFileSync(dest, buf);
  return buf.length;
}

const targets = LIB.filter((s) => (ONLY.length ? ONLY.includes(s.id) : true));
const todo = targets.filter((s) => !existsSync(resolve(OUT, `${s.id}.jpg`)));
log(`[$(new Date().toISOString())] 待生成 ${todo.length} / ${targets.length} 张 (已有 ${targets.length - todo.length} 张跳过)`);

for (let i = 0; i < todo.length; i += BATCH) {
  const chunk = todo.slice(i, i + BATCH);
  const requests = chunk.map((s) => ({
    prompt: buildPrompt(s),
    aspect_ratio: '2:3',
    area: '1K',
    output_format: 'jpeg',
    output_file: `${s.id}.jpg`,
  }));
  log(`--- 批次 ${Math.floor(i / BATCH) + 1}/${Math.ceil(todo.length / BATCH)} : ${chunk.map((s) => s.id).join(', ')}`);
  let result;
  try {
    result = mcode(['connector', 'call', 'connector__matrix__generate_image', '--args', JSON.stringify({ requests })]);
  } catch (e) {
    log('  ! 生成调用失败: ' + String(e.stdout || e.message).slice(0, 500));
    continue;
  }
  const items = result?.success_items || result?.data?.success_items || [];
  if (!items.length) {
    log('  ! 无成功结果: ' + JSON.stringify(result).slice(0, 500));
    continue;
  }
  for (let k = 0; k < items.length; k++) {
    const it = items[k];
    const s = chunk[k];
    const nodeId = it.node_id;
    if (!nodeId) { log(`  ! ${s.id} 无 node_id`); continue; }
    try {
      const asset = mcode(['get_asset_url', nodeId]);
      const url = asset.download_url || asset?.data?.download_url;
      const size = await download(url, resolve(OUT, `${s.id}.jpg`));
      log(`  ✓ ${s.id}.jpg  ${(size / 1024).toFixed(0)}KB`);
    } catch (e) {
      log(`  ! ${s.id} 下载失败: ${String(e.message).slice(0, 200)}`);
    }
  }
}
log('[done]');
