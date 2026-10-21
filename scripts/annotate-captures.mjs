// Rebuild numbered highlights from unmodified computer-use captures.
import { createRequire } from 'node:module';
import { readFile, mkdir } from 'node:fs/promises';
const require = createRequire(import.meta.url);
const sharp = createRequire(require.resolve('astro/package.json'))('sharp');
const root = new URL('../', import.meta.url);
const captures = JSON.parse(await readFile(new URL('src/data/wiki-captures.json', root), 'utf8'));
await mkdir(new URL('public/wiki-images/', root), { recursive: true });
for (const [id, item] of Object.entries(captures)) {
  const [left, top, width, height] = item.crop;
  const pad = 32;
  const base = await sharp(new URL(`src/assets/captures/wiki/raw/${item.source}`, root).pathname)
    .extract({ left, top, width, height }).extend({ top: pad, bottom: pad, left: pad, right: pad, background: '#e9e9eb' }).png().toBuffer();
  const boxes = item.marks.map(({box}, i) => {
    const [x, y, w, h] = box;
    const bx = x + pad, by = y + pad;
    return `<rect x="${bx}" y="${by}" width="${w}" height="${h}" rx="5" fill="none" stroke="#ea7b24" stroke-width="5"/><rect x="${bx-20}" y="${by-20}" width="42" height="42" rx="7" fill="#142636" stroke="#f6ad53" stroke-width="3"/><text x="${bx+1}" y="${by+10}" text-anchor="middle" font-family="Arial,sans-serif" font-weight="700" font-size="30" fill="#ffffff">${i+1}</text>`;
  }).join('');
  const overlay = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width+pad*2}" height="${height+pad*2}">${boxes}</svg>`);
  await sharp(base).composite([{input:overlay}]).webp({lossless:true}).toFile(new URL(`public/wiki-images/${id}.webp`, root).pathname);
  console.log(`${id}: ${width+pad*2} × ${height+pad*2}`);
}
