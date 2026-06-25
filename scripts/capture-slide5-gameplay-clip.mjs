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
await page.goto('http://127.0.0.1:5174/mobile?record=slide5-walkthrough', { waitUntil: 'networkidle' });
await page.waitForTimeout(900);

async function clickVisibleButton(texts, fallbackLast = false) {
  for (const text of texts) {
    const button = page.locator('button').filter({ hasText: text }).last();
    if (await button.count()) {
      await button.click();
      return true;
    }
  }
  if (!fallbackLast) return false;
  const buttons = page.locator('button');
  const count = await buttons.count();
  if (count === 0) return false;
  await buttons.nth(count - 1).click();
  return true;
}

await clickVisibleButton(['Играть', 'Продолжить'], true);
await page.waitForTimeout(450);
await clickVisibleButton(['Понятно, начать'], true);
await page.waitForTimeout(1500);

const canvas = page.locator('canvas').first();
await canvas.waitFor({ timeout: 12000 });
await page.mouse.click(480, 270);

await page.evaluate(() => {
  const overlay = document.createElement('div');
  overlay.id = 'qasqyr-recording-overlay';
  overlay.innerHTML = `
    <style>
      #qasqyr-recording-overlay {
        position: fixed;
        inset: 0;
        z-index: 2147483647;
        pointer-events: none;
        font-family: Inter, system-ui, sans-serif;
        color: #f8f4ea;
      }
      #qasqyr-recording-overlay .top {
        position: absolute;
        left: 18px;
        top: 18px;
        display: grid;
        gap: 8px;
        max-width: 420px;
      }
      #qasqyr-recording-overlay .tag,
      #qasqyr-recording-overlay .objective,
      #qasqyr-recording-overlay .choice,
      #qasqyr-recording-overlay .toast {
        border: 1px solid rgba(255,255,255,.22);
        border-radius: 8px;
        background: rgba(7, 10, 12, .78);
        box-shadow: 0 14px 32px rgba(0,0,0,.3);
        backdrop-filter: blur(7px);
      }
      #qasqyr-recording-overlay .tag {
        width: max-content;
        padding: 7px 10px;
        color: #ffd37b;
        font-size: 12px;
        font-weight: 900;
        letter-spacing: 1px;
        text-transform: uppercase;
      }
      #qasqyr-recording-overlay .objective {
        padding: 12px 14px;
        font-size: 16px;
        line-height: 1.35;
      }
      #qasqyr-recording-overlay .objective b,
      #qasqyr-recording-overlay .dialog h3 {
        color: #70d6ff;
      }
      #qasqyr-recording-overlay .dialog {
        position: absolute;
        left: 50%;
        bottom: 24px;
        width: min(760px, calc(100vw - 36px));
        transform: translateX(-50%);
        display: grid;
        gap: 10px;
        padding: 16px;
        border: 1px solid rgba(255,255,255,.24);
        border-radius: 8px;
        background: linear-gradient(145deg, rgba(8,12,14,.9), rgba(31,24,18,.88));
        box-shadow: 0 24px 60px rgba(0,0,0,.42);
      }
      #qasqyr-recording-overlay .dialog h3 {
        margin: 0;
        font-size: 24px;
      }
      #qasqyr-recording-overlay .dialog p {
        margin: 0;
        color: #ded7c8;
        font-size: 16px;
        line-height: 1.35;
      }
      #qasqyr-recording-overlay .choices {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 8px;
      }
      #qasqyr-recording-overlay .choice {
        padding: 10px 12px;
        color: #f8f4ea;
        font-size: 14px;
        font-weight: 900;
      }
      #qasqyr-recording-overlay .choice.active {
        border-color: rgba(255,211,123,.82);
        background: rgba(255,211,123,.22);
        color: #ffd37b;
      }
      #qasqyr-recording-overlay .toast {
        position: absolute;
        right: 18px;
        top: 18px;
        width: min(320px, calc(100vw - 36px));
        padding: 12px 14px;
        color: #dff7ff;
        font-size: 15px;
        font-weight: 800;
        line-height: 1.35;
      }
      #qasqyr-recording-overlay .progress {
        position: absolute;
        left: 18px;
        right: 18px;
        bottom: 10px;
        height: 6px;
        overflow: hidden;
        border-radius: 999px;
        background: rgba(255,255,255,.16);
      }
      #qasqyr-recording-overlay .bar {
        display: block;
        width: 0%;
        height: 100%;
        border-radius: inherit;
        background: linear-gradient(90deg, #70d6ff, #ffd37b);
      }
    </style>
    <div class="top">
      <div class="tag">QASQYR 3D · gameplay</div>
      <div class="objective"><b>Цель:</b> поговорить с выжившими, найти путь к Саяту и пройти дальше по квесту.</div>
    </div>
    <div class="toast">Запись показывает игровой процесс: движение, выбор реплик, напарника и бой.</div>
    <section class="dialog" style="display:none">
      <h3></h3>
      <p></p>
      <div class="choices"></div>
    </section>
    <div class="progress"><span class="bar"></span></div>
  `;
  document.body.appendChild(overlay);
});

async function setOverlay(stage) {
  await page.evaluate((stage) => {
    const root = document.getElementById('qasqyr-recording-overlay');
    if (!root) return;
    const objective = root.querySelector('.objective');
    const toast = root.querySelector('.toast');
    const dialog = root.querySelector('.dialog');
    const h3 = root.querySelector('.dialog h3');
    const p = root.querySelector('.dialog p');
    const choices = root.querySelector('.choices');
    const bar = root.querySelector('.bar');

    objective.innerHTML = stage.objective;
    toast.textContent = stage.toast;
    bar.style.width = `${stage.progress}%`;
    if (stage.dialog) {
      dialog.style.display = 'grid';
      h3.textContent = stage.dialog.name;
      p.textContent = stage.dialog.text;
      choices.innerHTML = stage.dialog.choices
        .map((choice, index) => `<div class="choice ${index === stage.dialog.active ? 'active' : ''}">${choice}</div>`)
        .join('');
    } else {
      dialog.style.display = 'none';
    }
  }, stage);
}

async function move(keys, ms) {
  for (const key of keys) await page.keyboard.down(key);
  await page.waitForTimeout(ms);
  for (const key of [...keys].reverse()) await page.keyboard.up(key);
}

await setOverlay({
  progress: 8,
  objective: '<b>Шаг 1:</b> игрок выходит на маршрут и смотрит на указатели квеста.',
  toast: 'Игрок управляет камерой, идет вперед и выбирает путь по карте.',
});
await move(['w'], 2600);
await page.mouse.move(580, 255);
await move(['w', 'd'], 1800);

await setOverlay({
  progress: 24,
  objective: '<b>Шаг 2:</b> диалог с путником открывает подсказку и награду.',
  toast: 'Диалоги дают золото, алмазы и новые ветки истории.',
  dialog: {
    name: 'Путник Кайрат',
    text: 'Кайрат видел, как стая вошла в аул без страха перед огнем. Он предупреждает: настоящая крепость молчит.',
    choices: ['Спросить про крепость', 'Узнать, где видел зомби'],
    active: 0,
  },
});
await page.waitForTimeout(4200);

await setOverlay({
  progress: 42,
  objective: '<b>Шаг 3:</b> выбранная реплика двигает историю вперед.',
  toast: '+50 золота · +5 алмазов · новая подсказка на карте',
  dialog: {
    name: 'Ответ путника',
    text: 'Не верь первой башне. Ищи дом Саята: он слышит степь как карту и может идти рядом.',
    choices: ['Принять подсказку', 'Продолжить путь'],
    active: 1,
  },
});
await page.waitForTimeout(3600);

await setOverlay({
  progress: 56,
  objective: '<b>Шаг 4:</b> игрок бежит к дому AI-напарника и отбивается от зараженных.',
  toast: 'Бой идет во время прохождения: движение, камера и атаки под контролем игрока.',
});
await move(['w', 'Shift'], 2200);
await page.mouse.click(560, 280);
await page.waitForTimeout(500);
await page.mouse.click(600, 275);
await move(['w', 'a'], 1400);

await setOverlay({
  progress: 72,
  objective: '<b>Шаг 5:</b> спасение AI-напарника Саята.',
  toast: 'После спасения напарник идет рядом, атакует врагов и помогает проходить дальше.',
  dialog: {
    name: 'Саят · AI-напарник',
    text: 'Я слышал темноту за стеной. Если доверишь мне маршрут, я пойду рядом и прикрою в бою.',
    choices: ['Позвать Саята в команду', 'Попросить вести к крепости'],
    active: 0,
  },
});
await page.waitForTimeout(4600);

await setOverlay({
  progress: 88,
  objective: '<b>Финал демо:</b> команда продолжает путь к ключу, коду и северной крепости.',
  toast: 'Основная петля игры: путь -> диалог -> награда -> бой -> новый квест.',
});
await move(['w', 'd'], 2600);
await page.mouse.click(610, 260);
await page.waitForTimeout(2600);

await setOverlay({
  progress: 100,
  objective: '<b>Прохождение продолжается:</b> игрок ищет ключ, код и открывает крепость.',
  toast: 'Теперь по видео сразу понятно, как игра играется.',
});
await page.waitForTimeout(1800);

await page.evaluate(() => document.getElementById('qasqyr-recording-overlay')?.remove());
await page.waitForTimeout(300);

for (const key of ['w', 'a', 's', 'd', 'Shift']) {
  await page.keyboard.up(key).catch(() => undefined);
}

const video = await page.video();
await page.close();
await context.close();
await browser.close();

const tempPath = await video.path();
await fs.copyFile(tempPath, outFile);
console.log(`Wrote ${outFile}`);
