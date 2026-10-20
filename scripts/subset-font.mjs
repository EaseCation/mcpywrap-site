// 按站点实际用字生成 Fusion Pixel 子集字体。
// 扫描 src/ 下所有源码与文档，收集字符，加上 ASCII 可见字符，输出到 public/fonts/。
// 用法：pnpm font（新增文案后重新运行）
import { readFile, writeFile, readdir, mkdir, cp } from 'node:fs/promises';
import { join, extname } from 'node:path';
import subsetFont from 'subset-font';

const ROOT = new URL('..', import.meta.url).pathname;
const SRC_DIRS = ['src'];
const EXTS = new Set(['.astro', '.ts', '.tsx', '.js', '.mjs', '.md', '.mdx', '.css', '.json']);
const FONTS = [
  ['fusion-pixel-12px-proportional-zh_hans.ttf.woff2', 'fusion-pixel-proportional.woff2'],
  ['fusion-pixel-12px-monospaced-zh_hans.ttf.woff2', 'fusion-pixel-mono.woff2'],
];

async function walk(dir, out = []) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) await walk(p, out);
    else if (EXTS.has(extname(entry.name))) out.push(p);
  }
  return out;
}

const chars = new Set();
for (let c = 0x20; c < 0x7f; c++) chars.add(String.fromCharCode(c));
// 常用中文标点与符号
for (const c of '，。、；：？！“”‘’（）《》【】—…·「」→←↔↑↓✓×') chars.add(c);

for (const dir of SRC_DIRS) {
  for (const file of await walk(join(ROOT, dir))) {
    for (const c of await readFile(file, 'utf8')) {
      if (c.codePointAt(0) > 0x7f) chars.add(c);
    }
  }
}

const text = [...chars].join('');
const outDir = join(ROOT, 'public/fonts');
await mkdir(outDir, { recursive: true });

for (const [src, dest] of FONTS) {
  const input = await readFile(join(ROOT, 'fonts-src', src));
  const output = await subsetFont(input, text, { targetFormat: 'woff2' });
  await writeFile(join(outDir, dest), output);
  console.log(`${dest}: ${(output.length / 1024).toFixed(1)} KB`);
}

// 随字体分发授权文件（SIL OFL 1.1 要求）
await cp(join(ROOT, 'fonts-src/OFL.txt'), join(outDir, 'OFL.txt'));
await cp(join(ROOT, 'fonts-src/LICENSES'), join(outDir, 'LICENSES'), { recursive: true });
console.log(`${chars.size} 个字符`);
