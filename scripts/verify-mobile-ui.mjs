import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { launchHeadlessChromium } from './launch-browser.mjs';

const ROOT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SCREENSHOT_DIR =
  '/Users/choegihwan/.t3/userdata/providers/antigravity/ac0a3dfd6dddb20962cecff6ee5fe65e19d3923be20e52c5ab52ff877f7e4c32/antigravity-acp/brain/35715b25-8656-4e92-8f0a-757f73443d09/screenshots';
const PREVIEW_PORT = 4173;
const BASE_URL = `http://127.0.0.1:${PREVIEW_PORT}/`;

const VIEWPORTS = [
  { name: '360x800', width: 360, height: 800, capture: false },
  { name: '390x844', width: 390, height: 844, capture: false },
  { name: '412x960', width: 412, height: 960, capture: true },
  { name: '361x399', width: 361, height: 399, capture: true },
];

async function waitForServer(url, timeoutMs = 15000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // Server not ready yet
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`Preview server did not start within ${timeoutMs}ms`);
}

async function assertNoHorizontalOverflow(page, label, viewportName) {
  const metrics = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
  }));
  if (metrics.scrollWidth > metrics.innerWidth) {
    throw new Error(
      `[${viewportName}] Horizontal overflow on ${label}: scrollWidth=${metrics.scrollWidth} > innerWidth=${metrics.innerWidth}`,
    );
  }
}

async function main() {
  await mkdir(SCREENSHOT_DIR, { recursive: true });

  const server = spawn(
    'npx',
    ['vite', 'preview', '--port', String(PREVIEW_PORT), '--strictPort', '--host', '127.0.0.1'],
    {
      cwd: ROOT_DIR,
      stdio: 'pipe',
    },
  );

  let serverLogs = '';
  server.stdout.on('data', (chunk) => {
    serverLogs += chunk.toString();
  });
  server.stderr.on('data', (chunk) => {
    serverLogs += chunk.toString();
  });

  try {
    await waitForServer(BASE_URL);
    const browser = await launchHeadlessChromium();

    try {
      // Verify PWA manifest, service worker bundle, and generated icons
      const checkCtx = await browser.newContext({ viewport: { width: 412, height: 960 } });
      const checkPage = await checkCtx.newPage();
      const manifestResp = await checkPage.request.get(`${BASE_URL}manifest.webmanifest`);
      if (manifestResp.status() !== 200) {
        throw new Error(`Expected manifest.webmanifest HTTP 200, got ${manifestResp.status()}`);
      }
      const manifest = await manifestResp.json();
      if (!Array.isArray(manifest.icons) || manifest.icons.length < 3) {
        throw new Error(`Expected >= 3 manifest icons, got ${JSON.stringify(manifest.icons)}`);
      }
      for (const icon of manifest.icons) {
        const iconResp = await checkPage.request.get(new URL(icon.src, BASE_URL).toString());
        if (iconResp.status() !== 200) {
          throw new Error(`Manifest icon ${icon.src} returned HTTP ${iconResp.status()}`);
        }
      }
      const swResp = await checkPage.request.get(`${BASE_URL}sw.js`);
      if (swResp.status() !== 200) {
        throw new Error(`Expected sw.js HTTP 200, got ${swResp.status()}`);
      }
      await checkCtx.close();

      for (const vp of VIEWPORTS) {
        const context = await browser.newContext({
          viewport: { width: vp.width, height: vp.height },
          deviceScaleFactor: 2,
          isMobile: true,
          hasTouch: true,
        });
        const page = await context.newPage();

        const consoleErrors = [];
        const pageErrors = [];
        page.on('console', (msg) => {
          if (msg.type() === 'error') {
            consoleErrors.push(msg.text());
          }
        });
        page.on('pageerror', (err) => {
          pageErrors.push(err.message);
        });

        await page.goto(BASE_URL, { waitUntil: 'networkidle' });
        await page.waitForSelector('main');
        await assertNoHorizontalOverflow(page, 'TodayView initial', vp.name);

        const swSupport = await page.evaluate(() => 'serviceWorker' in navigator);
        if (!swSupport) {
          throw new Error(`[${vp.name}] navigator.serviceWorker missing`);
        }

        if (vp.capture && vp.name === '412x960') {
          await page.screenshot({
            path: resolve(SCREENSHOT_DIR, 'today-412x960.png'),
          });
        }
        if (vp.capture && vp.name === '361x399') {
          await page.screenshot({
            path: resolve(SCREENSHOT_DIR, 'cover-today-361x399.png'),
          });
        }

        // Switch day strip pills to verify Mon (F45), Thu (Rest), and Fri (Weight)
        const thuButton = page.getByRole('button', { name: /목요일/ });
        await thuButton.click();
        await assertNoHorizontalOverflow(page, 'TodayView Thu Rest', vp.name);

        const monButton = page.getByRole('button', { name: /월요일/ });
        await monButton.click();
        await assertNoHorizontalOverflow(page, 'TodayView Mon F45', vp.name);

        const friButton = page.getByRole('button', { name: /금요일/ });
        await friButton.click();
        await assertNoHorizontalOverflow(page, 'TodayView Fri Weight', vp.name);

        // Start Weight Session (handles either "오늘 운동 시작하기" or "금요일 하체 A 당겨서 시작하기")
        const startButton = page.getByRole('button', {
          name: /오늘 운동 시작하기|당겨서 시작하기/,
        });
        await startButton.click();
        await page.waitForSelector('[aria-label$="진행 화면"]');
        await assertNoHorizontalOverflow(page, 'Workout SetCard', vp.name);

        if (vp.capture && vp.name === '412x960') {
          await page.screenshot({
            path: resolve(SCREENSHOT_DIR, 'workout-set-412x960.png'),
          });
        }
        if (vp.capture && vp.name === '361x399') {
          await page.screenshot({
            path: resolve(SCREENSHOT_DIR, 'cover-workout-361x399.png'),
          });
        }

        // Open NumericPadSheet and close it cleanly
        const weightPadButton = page.getByRole('button', { name: /직접 입력 열기/ }).first();
        await weightPadButton.click();
        await page.waitForSelector('button:has-text("적용하기")');
        await assertNoHorizontalOverflow(page, 'NumericPadSheet', vp.name);
        await page.getByRole('button', { name: '적용하기' }).click();

        // Complete set -> RirSheet
        await page.getByRole('button', { name: '세트 완료' }).click();
        const rirDialog = page.getByRole('dialog', {
          name: '방금 세트 여유가 몇 회였나요?',
        });
        await rirDialog.waitFor({ state: 'visible' });
        await page.waitForTimeout(320);
        await assertNoHorizontalOverflow(page, 'RirSheet', vp.name);

        if (vp.capture && vp.name === '412x960') {
          await page.screenshot({
            path: resolve(SCREENSHOT_DIR, 'rir-sheet-412x960.png'),
          });
        }

        // Select RIR 2 -> RestTimerOverlay
        await rirDialog.getByRole('button', { name: /RIR 2/ }).click();
        const restRegion = page.getByRole('region', { name: '휴식 타이머' });
        await restRegion.waitFor({ state: 'visible' });
        await assertNoHorizontalOverflow(page, 'RestTimerOverlay', vp.name);

        if (vp.capture && vp.name === '412x960') {
          await page.screenshot({
            path: resolve(SCREENSHOT_DIR, 'rest-timer-412x960.png'),
          });
        }

        // Skip rest and pause back to TodayView
        await page.getByRole('button', { name: '휴식 건너뛰기' }).click();
        await page.getByRole('button', { name: '잠시 멈추기' }).click();
        await page.waitForSelector('nav[aria-label="주요 메뉴"]');

        // Tab 2: Dashboard
        await page
          .getByRole('navigation', { name: '주요 메뉴' })
          .getByRole('button', { name: '대시보드' })
          .click();
        await page.getByRole('heading', { name: '대시보드' }).waitFor({ state: 'visible' });
        await page.getByRole('button', { name: '12주' }).click();
        await assertNoHorizontalOverflow(page, 'DashboardView', vp.name);

        if (vp.capture && vp.name === '412x960') {
          await page.screenshot({
            path: resolve(SCREENSHOT_DIR, 'dashboard-412x960.png'),
            fullPage: true,
          });
        }

        // Tab 3: Coach
        await page
          .getByRole('navigation', { name: '주요 메뉴' })
          .getByRole('button', { name: '코치' })
          .click();
        await page.getByRole('heading', { name: 'AI 코치' }).waitFor({ state: 'visible' });
        await page.getByRole('button', { name: 'F45 피로도 관리' }).click();
        await page.getByRole('button', { name: /프롬프트 미리보기/ }).click();
        await assertNoHorizontalOverflow(page, 'CoachView', vp.name);

        if (vp.capture && vp.name === '412x960') {
          await page.screenshot({
            path: resolve(SCREENSHOT_DIR, 'coach-412x960.png'),
            fullPage: true,
          });
        }

        // SettingsDrawer
        await page.getByRole('button', { name: '설정 열기' }).click();
        const settingsDialog = page.getByRole('dialog', {
          name: '설정 및 데이터 관리',
        });
        await settingsDialog.waitFor({ state: 'visible' });
        await page.waitForTimeout(320);
        await assertNoHorizontalOverflow(page, 'SettingsDrawer', vp.name);

        if (vp.capture && vp.name === '412x960') {
          await page.screenshot({
            path: resolve(SCREENSHOT_DIR, 'settings-412x960.png'),
          });
        }

        await settingsDialog.getByRole('button', { name: '닫기' }).click();

        if (consoleErrors.length > 0 || pageErrors.length > 0) {
          throw new Error(
            `[${vp.name}] Runtime errors: consoleErrors=${JSON.stringify(consoleErrors)}, pageErrors=${JSON.stringify(pageErrors)}`,
          );
        }

        console.log(`PASS [${vp.name}] — 0 overflows, 0 console/page errors`);
        await context.close();
      }
    } finally {
      await browser.close();
    }
  } finally {
    server.kill('SIGTERM');
    if (serverLogs && server.exitCode && server.exitCode !== 0) {
      console.error(serverLogs);
    }
  }
}

await main();
