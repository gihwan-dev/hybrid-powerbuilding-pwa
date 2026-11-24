import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { launchHeadlessChromium } from './launch-browser.mjs';

const ROOT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const RES_DIR = resolve(ROOT_DIR, 'android/app/src/main/res');

const DENSITIES = [
  { folder: 'mipmap-mdpi', launcher: 48, foreground: 108 },
  { folder: 'mipmap-hdpi', launcher: 72, foreground: 162 },
  { folder: 'mipmap-xhdpi', launcher: 96, foreground: 216 },
  { folder: 'mipmap-xxhdpi', launcher: 144, foreground: 324 },
  { folder: 'mipmap-xxxhdpi', launcher: 192, foreground: 432 },
];

function buildBarbellGroupMarkup(scale) {
  return `<g transform="translate(256 256) scale(${scale}) translate(-256 -256)">
    <rect x="72" y="240" width="368" height="32" rx="16" fill="#FFFFFF" />
    <rect x="88" y="184" width="42" height="144" rx="16" fill="#FFFFFF" />
    <rect x="148" y="144" width="50" height="224" rx="18" fill="#FFFFFF" />
    <rect x="314" y="144" width="50" height="224" rx="18" fill="#FFFFFF" />
    <rect x="382" y="184" width="42" height="144" rx="16" fill="#FFFFFF" />
  </g>`;
}

function buildHtml({ size, mode }) {
  let backgroundMarkup = '';
  let scale = 0.84;

  if (mode === 'squircle') {
    backgroundMarkup = '<rect width="512" height="512" rx="120" fill="#1B64DA" />';
  } else if (mode === 'circle') {
    backgroundMarkup = '<circle cx="256" cy="256" r="248" fill="#1B64DA" />';
    scale = 0.78;
  } else if (mode === 'foreground') {
    // 108dp adaptive icon layer where inner 66dp circle (61%) is safe zone
    scale = 0.62;
  }

  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:transparent;width:${size}px;height:${size}px;overflow:hidden;">
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512" fill="none">
      ${backgroundMarkup}
      ${buildBarbellGroupMarkup(scale)}
    </svg>
  </body>
</html>`;
}

async function main() {
  const browser = await launchHeadlessChromium();
  try {
    const context = await browser.newContext({ deviceScaleFactor: 1 });
    const page = await context.newPage();

    for (const density of DENSITIES) {
      const targetDir = resolve(RES_DIR, density.folder);
      await mkdir(targetDir, { recursive: true });

      const tasks = [
        { filename: 'ic_launcher.png', size: density.launcher, mode: 'squircle' },
        { filename: 'ic_launcher_round.png', size: density.launcher, mode: 'circle' },
        { filename: 'ic_launcher_foreground.png', size: density.foreground, mode: 'foreground' },
      ];

      for (const task of tasks) {
        await page.setViewportSize({ width: task.size, height: task.size });
        await page.setContent(buildHtml({ size: task.size, mode: task.mode }));
        await page.screenshot({
          path: resolve(targetDir, task.filename),
          omitBackground: true,
        });
      }
      console.log(`Generated Android icons for ${density.folder}`);
    }

    const valuesDir = resolve(RES_DIR, 'values');
    await mkdir(valuesDir, { recursive: true });
    await writeFile(
      resolve(valuesDir, 'ic_launcher_background.xml'),
      `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="ic_launcher_background">#1B64DA</color>
</resources>
`,
      'utf8',
    );
  } finally {
    await browser.close();
  }
}

await main();
