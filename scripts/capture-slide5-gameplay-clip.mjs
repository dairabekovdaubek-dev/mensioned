import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const videoDir = path.join(root, 'tmp', 'slide5-gameplay-video');
const outFile = path.join(root, 'tmp', 'slide5-gameplay-capture.webm');

await fs.mkdir(videoDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 960, height: 540 },
  recordVideo: {
    dir: videoDir,
    size: { width: 960, height: 540 },
  },
});

const page = await context.newPage();
await page.goto('http://127.0.0.1:5174/mobile?record=slide5-gameplay', { waitUntil: 'networkidle' });
await page.waitForTimeout(900);

const playButton = page.locator('button').filter({ hasText: 'Играть' }).last();
if (await playButton.count()) {
  await playButton.click();
  await page.waitForTimeout(350);
}

const startButton = page.locator('button').filter({ hasText: 'Понятно, начать' }).last();
if (await startButton.count()) {
  await startButton.click();
  await page.waitForTimeout(1200);
}

const canvas = page.locator('canvas').first();
await canvas.waitFor({ timeout: 12000 });
await canvas.click({ position: { x: 480, y: 270 } });

await page.keyboard.down('w');
await page.waitForTimeout(1600);
await page.keyboard.down('d');
await page.waitForTimeout(1200);
await page.keyboard.up('d');
await page.mouse.move(590, 260);
await page.mouse.click(590, 260);
await page.waitForTimeout(900);
await page.keyboard.down('Shift');
await page.waitForTimeout(1300);
await page.keyboard.up('Shift');
await page.keyboard.down('a');
await page.waitForTimeout(1100);
await page.keyboard.up('a');
await page.mouse.click(540, 290);
await page.waitForTimeout(1400);
await page.keyboard.up('w');

const video = await page.video();
await page.close();
await context.close();
await browser.close();

const tempPath = await video.path();
await fs.copyFile(tempPath, outFile);
console.log(`Wrote ${outFile}`);
