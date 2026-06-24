import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const videoDir = path.join(root, 'tmp', 'playwright-videos');
const outFile = path.join(root, 'public', 'presentation', 'qasqyr-gameplay-recording.webm');

await fs.mkdir(videoDir, { recursive: true });
await fs.mkdir(path.dirname(outFile), { recursive: true });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1280, height: 720 },
  recordVideo: {
    dir: videoDir,
    size: { width: 1280, height: 720 },
  },
});

const page = await context.newPage();
await page.goto('http://127.0.0.1:5174/mobile', { waitUntil: 'networkidle' });
await page.waitForTimeout(1200);

const buttons = page.locator('button');
await buttons.last().click();
await page.waitForTimeout(700);
await buttons.last().click();
await page.waitForTimeout(3000);

const canvas = page.locator('canvas').first();
await canvas.waitFor({ timeout: 10000 });
await canvas.click({ position: { x: 640, y: 360 } });
await page.keyboard.down('w');
await page.waitForTimeout(1800);
await page.keyboard.down('d');
await page.waitForTimeout(1300);
await page.keyboard.up('d');
await page.keyboard.down('a');
await page.waitForTimeout(1200);
await page.keyboard.up('a');
await page.keyboard.down('Shift');
await page.waitForTimeout(1200);
await page.keyboard.up('Shift');
await page.keyboard.up('w');
await page.mouse.move(760, 340);
await page.waitForTimeout(900);
await page.mouse.click(760, 340);
await page.waitForTimeout(2400);

const video = await page.video();
await page.close();
await context.close();
await browser.close();

const tempPath = await video.path();
await fs.copyFile(tempPath, outFile);
console.log(outFile);
