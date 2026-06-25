import { chromium } from 'playwright';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const outPath = join(root, 'public', 'presentation', 'qasqyr-gameplay-recording.webm');
const imageFiles = [
  'qasqyr-generated-vista.png',
  'qasqyr-generated-dialogue.png',
  'qasqyr-generated-rescue.png',
  'qasqyr-generated-combat.png',
];

const slides = [
  {
    title: 'QASQYR 3D',
    subtitle: 'Тяжелый мир, созданный для выживания',
    image: 0,
    startScale: 1.03,
    endScale: 1.16,
    panX: -34,
    panY: 8,
  },
  {
    title: 'Диалог с путниками',
    subtitle: 'Слушай людей, выбирай ответы и находи путь к крепости',
    image: 1,
    startScale: 1.08,
    endScale: 1.2,
    panX: 26,
    panY: -8,
  },
  {
    title: 'Спаси ИИ-напарника',
    subtitle: 'Союзник помогает в бою и ведет по опасной степи',
    image: 2,
    startScale: 1.05,
    endScale: 1.18,
    panX: -24,
    panY: -4,
  },
  {
    title: 'Выживи после спасения',
    subtitle: 'Сражайся, собирай ресурсы и держись до рассвета',
    image: 3,
    startScale: 1.06,
    endScale: 1.19,
    panX: 18,
    panY: 10,
  },
];

const images = imageFiles.map((name) => {
  const file = readFileSync(join(root, 'public', 'presentation', name));
  return `data:image/png;base64,${file.toString('base64')}`;
});

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const chunks = [];
await page.exposeFunction('saveTrailerChunk', (base64) => {
  chunks.push(Buffer.from(base64, 'base64'));
});
await page.setContent(`<!doctype html>
<html>
  <body style="margin:0;background:#050706;overflow:hidden">
    <canvas id="c" width="1280" height="720"></canvas>
    <script>
      const canvas = document.getElementById('c');
      const ctx = canvas.getContext('2d');
      const W = canvas.width;
      const H = canvas.height;
      const imageSrcs = ${JSON.stringify(images)};
      const slides = ${JSON.stringify(slides)};
      const duration = 42000;
      const slideDuration = duration / slides.length;
      const fade = 1000;
      const imgs = [];

      function load(src) {
        return new Promise((resolve, reject) => {
          const img = new Image();
          img.onload = () => resolve(img);
          img.onerror = reject;
          img.src = src;
        });
      }

      function ease(t) {
        return t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      }

      function coverImage(img, scale, ox, oy) {
        const cover = Math.max(W / img.width, H / img.height) * scale;
        const dw = img.width * cover;
        const dh = img.height * cover;
        ctx.drawImage(img, (W - dw) / 2 + ox, (H - dh) / 2 + oy, dw, dh);
      }

      function drawText(slide, localT) {
        const alpha = Math.min(1, localT / 0.18, (1 - localT) / 0.16);
        ctx.save();
        ctx.globalAlpha = Math.max(0, alpha);
        const panelW = 710;
        const x = 48;
        const y = H - 188;
        const grd = ctx.createLinearGradient(x, y, x + panelW, y);
        grd.addColorStop(0, 'rgba(5,7,6,.82)');
        grd.addColorStop(1, 'rgba(5,7,6,.08)');
        ctx.fillStyle = grd;
        ctx.fillRect(0, y - 26, panelW + 80, 174);
        ctx.fillStyle = '#70d6ff';
        ctx.font = '900 20px Arial, sans-serif';
        ctx.letterSpacing = '3px';
        ctx.fillText('QASQYR 3D', x, y);
        ctx.fillStyle = '#fff4df';
        ctx.font = '900 54px Arial, sans-serif';
        ctx.fillText(slide.title, x, y + 64);
        ctx.fillStyle = '#ffdca0';
        ctx.font = '700 25px Arial, sans-serif';
        ctx.fillText(slide.subtitle, x, y + 106);
        ctx.restore();
      }

      function drawFrame(ms) {
        const t = Math.min(ms, duration - 1);
        const index = Math.min(slides.length - 1, Math.floor(t / slideDuration));
        const slide = slides[index];
        const localMs = t - index * slideDuration;
        const localT = localMs / slideDuration;
        const e = ease(localT);
        const img = imgs[slide.image];
        ctx.clearRect(0, 0, W, H);
        coverImage(
          img,
          slide.startScale + (slide.endScale - slide.startScale) * e,
          slide.panX * e,
          slide.panY * e,
        );

        const vignette = ctx.createRadialGradient(W / 2, H / 2, 120, W / 2, H / 2, 760);
        vignette.addColorStop(0, 'rgba(0,0,0,0)');
        vignette.addColorStop(1, 'rgba(0,0,0,.58)');
        ctx.fillStyle = vignette;
        ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = 'rgba(255,184,84,.08)';
        ctx.fillRect(0, 0, W, H);

        drawText(slide, localT);
        if (localMs < fade && index > 0) {
          ctx.fillStyle = 'rgba(0,0,0,' + (1 - localMs / fade) + ')';
          ctx.fillRect(0, 0, W, H);
        }
        if (slideDuration - localMs < fade) {
          ctx.fillStyle = 'rgba(0,0,0,' + (1 - (slideDuration - localMs) / fade) + ')';
          ctx.fillRect(0, 0, W, H);
        }
      }

      window.renderTrailer = async () => {
        imgs.push(...await Promise.all(imageSrcs.map(load)));
        const stream = canvas.captureStream(30);
        const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp8') ? 'video/webm;codecs=vp8' : 'video/webm';
        const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 4200000 });
        recorder.ondataavailable = (event) => {
          if (!event.data.size) return;
          const reader = new FileReader();
          reader.onloadend = () => {
            const base64 = String(reader.result).split(',')[1] || '';
            window.saveTrailerChunk(base64);
          };
          reader.readAsDataURL(event.data);
        };
        const done = new Promise((resolve) => recorder.onstop = resolve);
        recorder.start(250);
        const start = performance.now();
        await new Promise((resolve) => {
          function tick(now) {
            const elapsed = now - start;
            drawFrame(elapsed);
            if (elapsed < duration) requestAnimationFrame(tick);
            else resolve();
          }
          requestAnimationFrame(tick);
        });
        recorder.stop();
        await done;
        await new Promise((resolve) => setTimeout(resolve, 500));
        return true;
      };
    </script>
  </body>
</html>`);

await page.evaluate(() => window.renderTrailer());
const output = Buffer.concat(chunks);
writeFileSync(outPath, output);
await browser.close();
console.log(`Wrote ${outPath} (${output.length} bytes)`);
