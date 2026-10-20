// Reuse the existing game artwork; no changes to web/PWA icons.
import sharp from 'sharp';
import { writeFile } from 'node:fs/promises';
for (const [density, scale] of Object.entries({ mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 })) {
  const directory = `android/app/src/main/res/mipmap-${density}`;
  for (const name of ['ic_launcher', 'ic_launcher_round']) {
    await sharp('public/pwa-maskable-512x512.png').resize(Math.round(48 * scale), Math.round(48 * scale)).toFile(`${directory}/${name}.png`);
  }
  const size = Math.round(108 * scale), artwork = Math.round(size * .66), pad = Math.floor((size - artwork) / 2);
  await sharp('public/icon.svg').resize(artwork, artwork).extend({ top: pad, bottom: size - artwork - pad, left: pad, right: size - artwork - pad, background: { r: 0, g: 0, b: 0, alpha: 0 } }).toFile(`${directory}/ic_launcher_foreground.png`);
}
await writeFile('android/app/src/main/res/values/ic_launcher_background.xml', '<?xml version="1.0" encoding="utf-8"?>\n<resources><color name="ic_launcher_background">#050508</color></resources>\n');
