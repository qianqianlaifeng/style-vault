/**
 * StyleVault · 图片压缩（ffmpeg）—— 主图 420px / 参考图 300px
 * 用法: node tools/compress.mjs
 */
import { readdirSync, statSync, renameSync, unlinkSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const FF = 'ffmpeg';

function compress(file, width, q) {
  const tmp = file + '.tmp.jpg';
  try {
    execFileSync(FF, [
      '-y', '-loglevel', 'error', '-i', file,
      '-vf', `scale='min(${width},iw)':-2`,
      '-q:v', String(q), '-frames:v', '1', tmp,
    ], { stdio: 'pipe' });
  } catch (e) {
    console.log('  ! ffmpeg failed', file);
    return 0;
  }
  if (!existsSync(tmp)) return 0;
  const before = statSync(file).size, after = statSync(tmp).size;
  if (after >= before) { unlinkSync(tmp); return before; }
  unlinkSync(file); renameSync(tmp, file);
  return after;
}

const jobs = [];
const thumbsDir = join(ROOT, 'assets/thumbs');
const refsDir = join(ROOT, 'assets/refs');
for (const f of readdirSync(thumbsDir)) if (f.endsWith('.jpg')) jobs.push([join(thumbsDir, f), 420, 6]);
for (const f of readdirSync(refsDir)) {
  if (!f.endsWith('.jpg')) continue;
  if (f.endsWith('_avatar.jpg')) { unlinkSync(join(refsDir, f)); continue; } // 头像用文字代替
  jobs.push([join(refsDir, f), 300, 8]);
}

let before = 0, after = 0;
for (let i = 0; i < jobs.length; i++) {
  const [file, w, q] = jobs[i];
  const b = statSync(file).size;
  const a = compress(file, w, q);
  before += b; after += a;
  if (i % 120 === 0) console.log(`  ${i}/${jobs.length}  当前 ${(after / 1048576).toFixed(1)}MB`);
}
console.log(`\n压缩完成：${(before / 1048576).toFixed(1)}MB → ${(after / 1048576).toFixed(1)}MB (${jobs.length} 张)`);
