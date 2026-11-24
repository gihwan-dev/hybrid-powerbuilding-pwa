import { mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { launchHeadlessChromium } from './launch-browser.mjs';

const ROOT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC_DIR = resolve(ROOT_DIR, 'public');

function buildSvgMarkup({ size, roundedRadius, scale }) {
  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:transparent;width:${size}px;height:${size}px;overflow:hidden;">
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512" fill="none">
      <rect width="512" height="512" rx="${roundedRadius}" fill="#1B64DA" />
      <g transform="translate(256 256) scale(${scale}) translate(-256 -256)">
        <rect x="72" y="240" width="368" height="32" rx="16" fill="#FFFFFF" />
        <rect x="88" y="184" width="42" height="144" rx="16" fill="#FFFFFF" />
        <rect x="148" y="144" width="50" height="224" rx="18" fill="#FFFFFF" />
        <rect x="314" y="144" width="50" height="224" rx="18" fill="#FFFFFF" />
        <rect x="382" y="184" width="42" height="144" rx="16" fill="#FFFFFF" />
      </g>
    </svg>
  </body>
</html>`;
}

async function main() {
  await mkdir(PUBLIC_DIR, { recursive: true });
  const browser = await launchHeadlessChromium();

  const specs = [
    {
      filename: 'pwa-192x192.png',
      size: 192,
      roundedRadius: 128,
      scale: 0.86,
      omitBackground: true,
    },
    {
      filename: 'pwa-512x512.png',
      size: 512,
      roundedRadius: 128,
      scale: 0.86,
      omitBackground: true,
    },
    {
      filename: 'maskable-icon-512x512.png',
      size: 512,
      roundedRadius: 0,
      scale: 0.72,
      omitBackground: false,
    },
    {
      filename: 'apple-touch-icon-180x180.png',
      size: 180,
      roundedRadius: 0,
      scale: 0.8,
      omitBackground: false,
    },
  ];

  try {
    const context = await browser.newContext({
      deviceScaleFactor: 1,
    });
    const page = await context.newPage();

    for (const spec of specs) {
      await page.setViewportSize({ width: spec.size, height: spec.size });
      await page.setContent(buildSvgMarkup(spec));
      const outPath = resolve(PUBLIC_DIR, spec.filename);
      await page.screenshot({
        path: outPath,
        omitBackground: spec.omitBackground,
      });
      console.log(`Generated ${outPath}`);
    }
  } finally {
    await browser.close();
  }
}

await main();
