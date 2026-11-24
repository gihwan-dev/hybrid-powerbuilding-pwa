import { existsSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { chromium } from 'playwright';

function findCachedChromiumExecutable() {
  const cacheDir = join(homedir(), 'Library', 'Caches', 'ms-playwright');
  if (!existsSync(cacheDir)) return undefined;

  const entries = readdirSync(cacheDir)
    .filter((name) => name.startsWith('chromium_headless_shell-') || name.startsWith('chromium-'))
    .sort((a, b) => {
      const revA = Number.parseInt(a.split('-').pop() ?? '0', 10);
      const revB = Number.parseInt(b.split('-').pop() ?? '0', 10);
      return revB - revA;
    });

  for (const entry of entries) {
    const candidates = [
      join(cacheDir, entry, 'chrome-headless-shell-mac-arm64', 'chrome-headless-shell'),
      join(cacheDir, entry, 'chrome-headless-shell-mac-x64', 'chrome-headless-shell'),
      join(cacheDir, entry, 'chrome-mac-arm64', 'Google Chrome for Testing.app', 'Contents', 'MacOS', 'Google Chrome for Testing'),
      join(cacheDir, entry, 'chrome-mac', 'Chromium.app', 'Contents', 'MacOS', 'Chromium'),
    ];
    for (const candidate of candidates) {
      if (existsSync(candidate)) return candidate;
    }
  }

  return undefined;
}

export async function launchHeadlessChromium() {
  const defaultPath = chromium.executablePath();
  if (defaultPath && existsSync(defaultPath)) {
    return chromium.launch({ headless: true });
  }

  const cachedPath = findCachedChromiumExecutable();
  if (cachedPath) {
    return chromium.launch({ headless: true, executablePath: cachedPath });
  }

  return chromium.launch({ headless: true });
}
