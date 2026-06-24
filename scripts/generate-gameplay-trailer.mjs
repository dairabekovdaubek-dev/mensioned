import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const baseUrl = 'http://127.0.0.1:5174';
const videoDir = path.join(root, 'tmp', 'playwright-videos');
const outFile = path.join(root, 'public', 'presentation', 'qasqyr-gameplay-recording.webm');
const durationMs = 28_000;

async function waitForServer(url, timeoutMs = 20_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) return true;
    } catch {
      // Vite is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  return false;
}

async function ensureServer() {
  if (await waitForServer(`${baseUrl}/presentation/qasqyr-menu-3d.png`, 1_000)) return null;

  const server = spawn('npm.cmd', ['run', 'dev', '--', '--host', '127.0.0.1', '--port', '5174'], {
    cwd: root,
    windowsHide: true,
    stdio: 'ignore',
  });

  if (!(await waitForServer(`${baseUrl}/presentation/qasqyr-menu-3d.png`))) {
    server.kill();
    throw new Error('Vite server did not start on http://127.0.0.1:5174');
  }

  return server;
}

function trailerHtml() {
  const shots = [
    `${baseUrl}/presentation/qasqyr-menu-3d.png`,
    `${baseUrl}/presentation/qasqyr-gameplay-3d.png`,
    `${baseUrl}/presentation/qasqyr-skins-3d.png`,
  ];
  const gameplay = `${baseUrl}/presentation/qasqyr-gameplay-recording.webm`;

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <style>
      * { box-sizing: border-box; }
      html, body {
        margin: 0;
        width: 100%;
        height: 100%;
        overflow: hidden;
        background: #060807;
        font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        color: #f8f4ea;
      }
      .stage {
        position: relative;
        width: 1280px;
        height: 720px;
        overflow: hidden;
        background: #060807;
        isolation: isolate;
      }
      .shot {
        position: absolute;
        inset: -42px;
        background-position: center;
        background-size: cover;
        opacity: 0;
        transform: scale(1.08);
        filter: saturate(1.08) contrast(1.06);
        animation: shot-cycle 28s linear forwards;
      }
      .shot:nth-child(1) { background-image: url("${shots[0]}"); animation-delay: 0s; }
      .shot:nth-child(2) { background-image: url("${shots[1]}"); animation-delay: 12s; }
      .shot:nth-child(3) { background-image: url("${shots[2]}"); animation-delay: 27s; }
      .shade {
        position: absolute;
        inset: 0;
        background:
          radial-gradient(circle at 70% 25%, rgba(255, 211, 123, .24), transparent 22%),
          linear-gradient(90deg, rgba(6, 8, 7, .92), rgba(6, 8, 7, .36) 45%, rgba(6, 8, 7, .72)),
          linear-gradient(180deg, rgba(6, 8, 7, .2), rgba(6, 8, 7, .82));
        z-index: 2;
      }
      .particles {
        position: absolute;
        inset: 0;
        z-index: 3;
        opacity: .5;
        background-image:
          radial-gradient(circle, rgba(255, 211, 123, .75) 0 1px, transparent 2px),
          radial-gradient(circle, rgba(112, 214, 255, .52) 0 1px, transparent 2px);
        background-size: 90px 90px, 150px 150px;
        animation: drift 18s linear infinite;
      }
      .gameplay {
        position: absolute;
        right: 70px;
        bottom: 74px;
        width: 620px;
        height: 348px;
        border-radius: 8px;
        overflow: hidden;
        z-index: 6;
        border: 1px solid rgba(255,255,255,.28);
        box-shadow: 0 30px 90px rgba(0,0,0,.58), 0 0 0 1px rgba(255,211,123,.18);
        transform: perspective(900px) rotateY(-5deg) rotateX(2deg);
        animation: gameplay-reveal 28s ease-in-out forwards;
      }
      .gameplay video {
        width: 100%;
        height: 100%;
        display: block;
        object-fit: cover;
        filter: saturate(1.16) contrast(1.08);
      }
      .scanline {
        position: absolute;
        inset: 0;
        z-index: 7;
        pointer-events: none;
        background:
          linear-gradient(180deg, transparent 0 92%, rgba(255,255,255,.08) 93% 94%, transparent 95%),
          linear-gradient(90deg, transparent, rgba(112,214,255,.18), transparent);
        background-size: 100% 8px, 220px 100%;
        mix-blend-mode: screen;
        opacity: .38;
        animation: scan 5s linear infinite;
      }
      .copy {
        position: absolute;
        left: 76px;
        top: 76px;
        width: 560px;
        z-index: 8;
        display: grid;
        gap: 18px;
      }
      .kicker {
        margin: 0;
        color: #70d6ff;
        font-size: 20px;
        line-height: 1;
        font-weight: 950;
        letter-spacing: 4px;
        text-transform: uppercase;
      }
      h1 {
        margin: 0;
        color: #fff8e7;
        font-size: 94px;
        line-height: .86;
        letter-spacing: 0;
        text-shadow: 0 12px 40px rgba(0,0,0,.48);
      }
      .line {
        margin: 0;
        max-width: 520px;
        color: #ded7c8;
        font-size: 31px;
        line-height: 1.12;
        font-weight: 850;
      }
      .beat {
        position: absolute;
        left: 76px;
        bottom: 78px;
        z-index: 8;
        display: flex;
        gap: 10px;
      }
      .beat span,
      .hud span {
        padding: 11px 13px;
        border-radius: 8px;
        border: 1px solid rgba(255,255,255,.2);
        background: rgba(8,12,10,.72);
        color: #f8f4ea;
        font-size: 15px;
        font-weight: 900;
      }
      .hud {
        position: absolute;
        right: 92px;
        top: 82px;
        z-index: 9;
        display: flex;
        gap: 10px;
        animation: hud-pop 28s linear forwards;
      }
      .title-card,
      .end-card {
        position: absolute;
        inset: 0;
        z-index: 12;
        display: grid;
        place-items: center;
        text-align: center;
        background: radial-gradient(circle at 50% 42%, rgba(255,211,123,.16), rgba(6,8,7,.88) 56%, #060807);
        pointer-events: none;
      }
      .title-card {
        animation: intro-card 28s linear forwards;
      }
      .end-card {
        opacity: 0;
        animation: end-card 28s linear forwards;
      }
      .title-card div,
      .end-card div {
        display: grid;
        gap: 14px;
        justify-items: center;
      }
      .title-card b,
      .end-card b {
        font-size: 104px;
        line-height: .86;
        letter-spacing: 0;
      }
      .title-card span,
      .end-card span {
        color: #70d6ff;
        font-size: 23px;
        font-weight: 950;
        letter-spacing: 3px;
        text-transform: uppercase;
      }
      @keyframes shot-cycle {
        0% { opacity: 0; transform: scale(1.13) translateX(0); }
        5%, 28% { opacity: 1; }
        34%, 100% { opacity: 0; transform: scale(1.02) translateX(-22px); }
      }
      @keyframes drift {
        from { background-position: 0 0, 0 0; }
        to { background-position: 360px -240px, -300px 240px; }
      }
      @keyframes scan {
        from { background-position: 0 0, -220px 0; }
        to { background-position: 0 80px, 220px 0; }
      }
      @keyframes gameplay-reveal {
        0%, 12% { opacity: 0; transform: perspective(900px) rotateY(-5deg) rotateX(2deg) translateX(80px) scale(.96); }
        18%, 88% { opacity: 1; transform: perspective(900px) rotateY(-5deg) rotateX(2deg) translateX(0) scale(1); }
        100% { opacity: .22; transform: perspective(900px) rotateY(-5deg) rotateX(2deg) translateX(0) scale(1.02); }
      }
      @keyframes hud-pop {
        0%, 15% { opacity: 0; transform: translateY(-18px); }
        20%, 90% { opacity: 1; transform: translateY(0); }
        100% { opacity: 0; transform: translateY(-12px); }
      }
      @keyframes intro-card {
        0%, 9% { opacity: 1; transform: scale(1); }
        13%, 100% { opacity: 0; transform: scale(1.05); }
      }
      @keyframes end-card {
        0%, 84% { opacity: 0; transform: scale(1.04); }
        90%, 100% { opacity: 1; transform: scale(1); }
      }
    </style>
  </head>
  <body>
    <main class="stage">
      <div class="shot"></div>
      <div class="shot"></div>
      <div class="shot"></div>
      <div class="shade"></div>
      <div class="particles"></div>
      <section class="copy">
        <p class="kicker">моя survival-игра</p>
        <h1>QASQYR 3D</h1>
        <p class="line">Исследуй опасный мир, выбирай режим, открывай скины и выживай вместе с AI-напарником.</p>
      </section>
      <div class="gameplay">
        <video src="${gameplay}" autoplay muted loop playsinline></video>
        <div class="scanline"></div>
      </div>
      <div class="hud">
        <span>Здоровье 100</span>
        <span>AI-напарник рядом</span>
        <span>3D-карта</span>
      </div>
      <div class="beat">
        <span>сражения</span>
        <span>исследование</span>
        <span>скины</span>
        <span>мобильная версия</span>
      </div>
      <div class="title-card">
        <div>
          <span>проект nFactorial Teens</span>
          <b>QASQYR 3D</b>
        </div>
      </div>
      <div class="end-card">
        <div>
          <span>сканируй QR и играй</span>
          <b>Выживи ночью</b>
        </div>
      </div>
    </main>
  </body>
</html>`;
}

await fs.mkdir(videoDir, { recursive: true });
await fs.mkdir(path.dirname(outFile), { recursive: true });

let server;
try {
  server = await ensureServer();
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    recordVideo: {
      dir: videoDir,
      size: { width: 1280, height: 720 },
    },
  });

  const page = await context.newPage();
  await page.setContent(trailerHtml(), { waitUntil: 'domcontentloaded' });
  await page.locator('video').waitFor({ timeout: 10_000 });
  await page.locator('video').evaluate((video) => video.play());
  await page.waitForTimeout(durationMs);

  const video = await page.video();
  await page.close();
  await context.close();
  await browser.close();

  const tempPath = await video.path();
  await fs.copyFile(tempPath, outFile);
  console.log(outFile);
} finally {
  if (server) server.kill();
}
