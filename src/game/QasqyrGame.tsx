import { useEffect, useRef, useState } from 'react';
import { CHARACTERS, ITEMS, type CharacterId, type ItemId } from './engine';

// ════════════════════════════ 2D SURVIVAL — QASQYR ════════════════════════════
// Вид сверху, движение в реальном времени (WASD). Canvas на весь экран.

const WORLD_W = 7200;   // ширина мира (px)
const WORLD_H = 20000;  // высота: старт внизу, крепость наверху (y≈0)
const FORTRESS_Y = 160; // дойти сюда = победа

const WALK = 215;       // скорость ходьбы px/с
const SNEAK = 195;      // скорость крадучись

// ── Типы сущностей ──
type EnemyKind = 'shala' | 'sokyr' | 'jarylys' | 'alyp' | 'wolf';
interface Enemy { x: number; y: number; hp: number; maxHp: number; r: number; kind: EnemyKind; speed: number; dmg: number; hitFlash: number; }
interface Ally { x: number; y: number; hp: number; maxHp: number; r: number; cd: number; name: string; emoji: string; }
interface Loot { x: number; y: number; item: ItemId; r: number; }
interface Bullet { x: number; y: number; vx: number; vy: number; life: number; }
interface Slot { item: ItemId; count: number; }

interface TunnelChaser { x: number; y: number; speed: number; r: number; hitCd: number; }

interface World {
  char: CharacterId;
  px: number; py: number; pvx: number; pvy: number;
  hp: number; maxHp: number;
  aim: number;             // угол прицела (к мыши)
  facing: number;          // последнее направление движения
  sneaking: boolean;
  torch: boolean;
  enemies: Enemy[];
  allies: Ally[];
  allyTimer: number;
  loot: Loot[];
  bullets: Bullet[];
  inv: (Slot | null)[];
  equipped: number | null;
  time: number;            // 0..1 сутки
  day: number;
  kills: number;
  attackTimer: number;
  attackCd: number;
  wantsAttack: boolean;
  spawnTimer: number;
  hurtFlash: number;
  result: '' | 'win' | 'lose';
  banner: string;
  bannerT: number;
  // ── Загадки и ложные крепости ──
  nearRiddle: number;      // -1 = нет, 0/1 = индекс загадки рядом
  riddleSolved: boolean[]; // [false, false] изначально
  fakeFortressMock: number;// кулдаун насмешки
  fortressKeyLoot: { x: number; y: number } | null; // позиция ключа на карте
  // ── Системы ивентов ──
  playTime: number;        // секунды с начала игры
  eventId: number;         // 0=нет, 1=хардкор, 2=туннель, 3=буря, 4=нашествие, 5=берсерк
  eventTimer: number;      // осталось секунд текущего ивента
  nextEventIn: number;     // секунд до следующего ивента
  eventCount: number;      // сколько ивентов запущено всего
  frozenTimer: number;     // секунды заморозки игрока
  berserkMult: number;     // множитель скорости врагов (берсерк)
  tunnelChaser: TunnelChaser | null;
}

const ENEMY_DEFS: Record<EnemyKind, { hp: number; r: number; speed: number; dmg: number; color: string; emoji: string; name: string }> = {
  shala:   { hp: 40,  r: 16, speed: 161, dmg: 16, color: '#6b8f3a', emoji: '🧟',   name: 'Шала' },
  sokyr:   { hp: 60,  r: 17, speed: 119, dmg: 22, color: '#4a6b6b', emoji: '🧟‍♂️', name: 'Сокыр' },
  jarylys: { hp: 35,  r: 19, speed: 102, dmg: 12, color: '#8a8f3a', emoji: '🤢',   name: 'Жарылыс' },
  alyp:    { hp: 130, r: 28, speed: 93,  dmg: 30, color: '#7a4a3a', emoji: '👹',   name: 'Алып' },
  wolf:    { hp: 45,  r: 15, speed: 278, dmg: 20, color: '#777',    emoji: '🐺',   name: 'Волк' },
};

const LOOT_TABLE: ItemId[] = ['food', 'medkit', 'herb', 'cloth', 'metal', 'spirit', 'ammo', 'ammo', 'ammo', 'revolver', 'revolver', 'rifle', 'rifle', 'club'];

// Подмога — союзники, что приходят на помощь
const ALLY_POOL: { name: string; emoji: string; hp: number }[] = [
  { name: 'Кочевник с берданкой', emoji: '🧔', hp: 70 },
  { name: 'Казак-разведчик', emoji: '💂', hp: 90 },
  { name: 'Охотник Степи', emoji: '🏹', hp: 80 },
  { name: 'Беглая знахарка', emoji: '🧕', hp: 60 },
  { name: 'Старый табиб', emoji: '👴', hp: 55 },
];

function hash(n: number): number { const x = Math.sin(n * 127.1) * 43758.5453; return x - Math.floor(x); }

// ── Ложные крепости и загадки ──
const FAKE_FORTRESS_DEFS = [
  { x: WORLD_W * 0.18, y: 7100, mockIdx: 0 },
  { x: WORLD_W * 0.82, y: 5200, mockIdx: 1 },
  { x: WORLD_W * 0.5,  y: 2800, mockIdx: 2 },
] as const;

const RIDDLE_DEFS = [
  { x: WORLD_W * 0.3,  y: 6000, item: 'code_scroll' as ItemId },
  { x: WORLD_W * 0.7,  y: 3800, item: 'lockpick'    as ItemId },
] as const;

const MOCK_MSGS = [
  '😂 ХА-ХА! Думал это крепость? Ты клоун, Баха!',
  '🤡 Ловушка! Это просто руины. Ищи настоящую!',
  '💀 Серьёзно?! Ты дошёл сюда ради картонной стены?',
];

const RIDDLES = [
  {
    question: 'Я иду, но ног нет. Я живу — пока ем, умираю — когда пью. Что я?',
    options: ['🔥 Огонь', '💨 Ветер', '💧 Вода', '⌛ Время'],
    correct: 0,
    reward: 'code_scroll' as ItemId,
    rewardText: '📜 Получен КОД К ВОРОТАМ! Почти у цели...',
    wrongText: '❌ Неверно! Дух загадки ударяет тебя — −20 HP',
  },
  {
    question: 'Чем больше берёшь — тем больше становится. Нельзя купить, можно потерять. Что это?',
    options: ['🕳️ Яма', '💰 Деньги', '📋 Долг', '🌑 Тень'],
    correct: 0,
    reward: 'lockpick' as ItemId,
    rewardText: '🗝️ Получена ОТМЫЧКА! Теперь ты готов.',
    wrongText: '❌ Неверно! Проклятие загадки — −20 HP',
  },
] as const;

// ── Инвентарь ──
function addItem(w: World, item: ItemId, count = 1): boolean {
  const meta = ITEMS[item];
  if (meta.stackable) {
    const i = w.inv.findIndex((s) => s && s.item === item);
    if (i >= 0) { w.inv[i]!.count += count; return true; }
  }
  const e = w.inv.findIndex((s) => s === null);
  if (e < 0) return false;
  w.inv[e] = { item, count: meta.stackable ? count : 1 };
  return true;
}
function removeOne(w: World, item: ItemId): boolean {
  const i = w.inv.findIndex((s) => s && s.item === item);
  if (i < 0) return false;
  w.inv[i]!.count -= 1;
  if (w.inv[i]!.count <= 0) { if (w.equipped === i) w.equipped = null; w.inv[i] = null; }
  return true;
}
function countItem(w: World, item: ItemId): number {
  return w.inv.reduce((a, s) => a + (s && s.item === item ? s.count : 0), 0);
}

function makeWorld(char: CharacterId): World {
  const maxHp = char === 'erlan' ? 130 : 100;
  const w: World = {
    char, px: WORLD_W / 2, py: WORLD_H - 200, pvx: 0, pvy: 0,
    hp: maxHp, maxHp, aim: -Math.PI / 2, facing: -Math.PI / 2,
    sneaking: false, torch: false,
    enemies: [], allies: [], allyTimer: 14, loot: [], bullets: [],
    inv: Array(9).fill(null), equipped: null,
    time: 0.15, day: 1, kills: 0,
    attackTimer: 0, attackCd: 0, wantsAttack: false, spawnTimer: 0,
    hurtFlash: 0, result: '', banner: '', bannerT: 0,
    nearRiddle: -1, riddleSolved: [false, false], fakeFortressMock: 0, fortressKeyLoot: null,
    playTime: 0, eventId: 0, eventTimer: 0, nextEventIn: 60, eventCount: 0,
    frozenTimer: 0, berserkMult: 1, tunnelChaser: null,
  };
  addItem(w, 'knife'); addItem(w, 'food', 2); addItem(w, 'cloth', 2);
  w.equipped = 0;
  // разбросать стартовый лут впереди
  for (let i = 0; i < 60; i++) {
    w.loot.push({ x: 120 + hash(i * 3.1) * (WORLD_W - 240), y: 200 + hash(i * 7.7) * (WORLD_H - 500), item: LOOT_TABLE[Math.floor(hash(i * 2.3) * LOOT_TABLE.length)], r: 12 });
  }
  banner(w, `${CHARACTERS[char].name}: на север, к крепости! 🧭`);
  return w;
}

function banner(w: World, text: string) { w.banner = text; w.bannerT = 3.2; }

// ════════════════════════════ JUMPSCARE SOUND ════════════════════════════
function playJumpscareSfx() {
  try {
    const ac = new AudioContext();
    const dur = 2.6;
    const sr = ac.sampleRate;
    // White noise burst
    const buf = ac.createBuffer(1, Math.floor(sr * dur), sr);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const noise = ac.createBufferSource();
    noise.buffer = buf;
    // Piercing band-pass filter
    const flt = ac.createBiquadFilter();
    flt.type = 'bandpass'; flt.frequency.value = 2800; flt.Q.value = 0.28;
    // Screech oscillator on top
    const osc = ac.createOscillator();
    osc.type = 'sawtooth'; osc.frequency.value = 880;
    osc.frequency.exponentialRampToValueAtTime(220, ac.currentTime + dur);
    // Gain envelope — instant loud attack, decay
    const gain = ac.createGain();
    gain.gain.setValueAtTime(1.6, ac.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + dur);
    const gainOsc = ac.createGain();
    gainOsc.gain.setValueAtTime(0.6, ac.currentTime);
    gainOsc.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + dur * 0.7);
    noise.connect(flt); flt.connect(gain); gain.connect(ac.destination);
    osc.connect(gainOsc); gainOsc.connect(ac.destination);
    noise.start(); osc.start();
    setTimeout(() => ac.close().catch(() => {}), (dur + 1) * 1000);
  } catch { /* AudioContext unavailable */ }
}

// ════════════════════════════ КОМПОНЕНТ ════════════════════════════
export function QasqyrGame({ onExit }: { onExit?: () => void }) {
  const [screen, setScreen] = useState<'intro' | 'playing' | 'over'>('intro');
  const [chosen, setChosen] = useState<CharacterId>('baha');
  const [result, setResult] = useState<{ kind: 'win' | 'lose'; title: string; text: string } | null>(null);
  const [jumpscare, setJumpscare] = useState(false);
  const [riddle, setRiddle] = useState<number | null>(null); // 0 или 1 — индекс загадки

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const worldRef = useRef<World | null>(null);
  const keysRef = useRef<Set<string>>(new Set());
  const mouseRef = useRef<{ x: number; y: number; down: boolean }>({ x: 0, y: 0, down: false });

  function handleRiddleAnswer(riddleIdx: number, answerIdx: number) {
    const w = worldRef.current;
    if (!w) return;
    const r = RIDDLES[riddleIdx];
    if (answerIdx === r.correct) {
      addItem(w, r.reward);
      w.riddleSolved[riddleIdx] = true;
      banner(w, r.rewardText);
    } else {
      w.hp = Math.max(1, w.hp - 20);
      w.hurtFlash = 0.4;
      banner(w, r.wrongText);
    }
    setRiddle(null);
  }

  function startGame(c: CharacterId) {
    setChosen(c);
    worldRef.current = makeWorld(c);
    setResult(null);
    setScreen('playing');
    // попытка перейти в полноэкранный режим браузера
    const el = document.getElementById('qasqyr-root');
    if (el && el.requestFullscreen) el.requestFullscreen().catch(() => {});
  }

  // ── Игровой цикл ──
  useEffect(() => {
    if (screen !== 'playing') return;
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    let raf = 0; let last = performance.now(); let stopped = false;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(window.innerWidth * dpr);
      canvas.height = Math.floor(window.innerHeight * dpr);
      canvas.style.width = window.innerWidth + 'px';
      canvas.style.height = window.innerHeight + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);

    const finish = (kind: 'win' | 'lose') => {
      const w = worldRef.current!;
      if (w.result) return;
      w.result = kind;
      if (kind === 'win') {
        const good = w.hp > w.maxHp * 0.4;
        setResult(good
          ? { kind, title: '🩸 Концовка «Вакцина»', text: 'Вы дошли до крепости. Кровь обоих друзей дала лекарство. Весной вы идёте по ожившей степи. Баха: «Я же говорил — у меня был план».' }
          : { kind, title: '💔 Концовка «Цена»', text: 'Вы дошли, но еле живыми. Крови хватило на лекарство — мир спасён дорогой ценой.' });
      } else {
        setResult({ kind, title: '🐺 Концовка «Волки»', text: 'Степь забрала вас раньше, чем вы дошли. Где-то воет стая. Karasan победил.' });
        playJumpscareSfx();
        setJumpscare(true);
        setTimeout(() => { setJumpscare(false); if (!stopped) setScreen('over'); }, 2800);
        return;
      }
      setTimeout(() => { if (!stopped) setScreen('over'); }, 700);
    };

    const loop = (now: number) => {
      if (stopped) return;
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      const w = worldRef.current!;
      if (!w.result) { update(w, dt, keysRef.current, mouseRef.current, finish); }
      render(ctx, w);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => { stopped = true; cancelAnimationFrame(raf); window.removeEventListener('resize', resize); };
  }, [screen]);

  // ── Клавиатура / мышь ──
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (k === 'escape') { if (document.fullscreenElement) document.exitFullscreen().catch(() => {}); onExit?.(); return; }
      if (screen !== 'playing') return;
      keysRef.current.add(k);
      const w = worldRef.current; if (!w || w.result) return;
      if (k === ' ') { e.preventDefault(); w.wantsAttack = true; }
      else if (k === 'f') { if (countItem(w, 'medkit') && w.hp < w.maxHp) { removeOne(w, 'medkit'); w.hp = Math.min(w.maxHp, w.hp + 45); banner(w, '💊 +45 HP'); } }
      else if (k === 'c') { if (countItem(w, 'torch')) { w.torch = !w.torch; banner(w, w.torch ? '🔥 Факел зажжён' : 'Факел потушен'); } else banner(w, 'Нет факела (скрафти в развалинах)'); }
      else if (k === 'r') { banner(w, countItem(w, 'ammo') ? `🔁 Патронов: ${countItem(w, 'ammo')}` : 'Нет патронов'); }
      else if (k === 'e') { if (w.nearRiddle >= 0) setRiddle(w.nearRiddle); }
      else if (k >= '1' && k <= '9') { const i = Number(k) - 1; const sl = w.inv[i]; if (sl) { const m = ITEMS[sl.item]; if (m.kind === 'melee' || m.kind === 'ranged') { w.equipped = i; banner(w, `🗡️ ${m.name}`); } else if (m.kind === 'heal') { removeOne(w, sl.item); w.hp = Math.min(w.maxHp, w.hp + 45); banner(w, '💊 +45 HP'); } else if (m.kind === 'food') { removeOne(w, sl.item); w.hp = Math.min(w.maxHp, w.hp + 15); banner(w, '🍖 +15 HP'); } } }
    };
    const up = (e: KeyboardEvent) => { keysRef.current.delete(e.key.toLowerCase()); };
    const mm = (e: MouseEvent) => { mouseRef.current.x = e.clientX; mouseRef.current.y = e.clientY; };
    const mdn = (e: MouseEvent) => { mouseRef.current.down = true; const w = worldRef.current; if (w && !w.result && screen === 'playing') w.wantsAttack = true; e.preventDefault(); };
    const mup = () => { mouseRef.current.down = false; };
    window.addEventListener('keydown', down); window.addEventListener('keyup', up);
    window.addEventListener('mousemove', mm); window.addEventListener('mousedown', mdn); window.addEventListener('mouseup', mup);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); window.removeEventListener('mousemove', mm); window.removeEventListener('mousedown', mdn); window.removeEventListener('mouseup', mup); };
  }, [screen, onExit]);

  // ════════ ЭКРАН ЗАСТАВКИ (постер) ════════
  if (screen === 'intro') {
    return (
      <div id="qasqyr-root" style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        overflow: 'hidden', color: '#e8e6e1',
        background: '#050807',
        display: 'flex', flexDirection: 'column'
      }}>
        {/* ── Постер ── */}
        <div style={{
          flex: '1 1 0', minHeight: 0, position: 'relative',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          overflow: 'hidden'
        }}>
          <div style={{
            position: 'absolute', inset: 0,
            background: 'linear-gradient(180deg, #040706 0%, #08120d 35%, #0d1b11 65%, #040706 100%)'
          }} />
          <div style={{
            position: 'absolute', inset: 0, zIndex: 1,
            background: 'radial-gradient(ellipse 90% 80% at 50% 40%, transparent 25%, rgba(0,0,0,0.72) 100%)'
          }} />
          <div style={{
            position: 'absolute', bottom: 0, left: 0, right: 0, height: '38%', zIndex: 2,
            background: 'linear-gradient(to top, rgba(4,6,5,0.92) 0%, transparent 100%)'
          }} />

          <svg
            viewBox="0 0 500 700"
            style={{
              position: 'relative', zIndex: 3,
              height: '100%', maxHeight: '100%',
              width: 'auto', display: 'block',
              filter: 'drop-shadow(0 12px 60px rgba(0,0,0,0.98))'
            }}
            preserveAspectRatio="xMidYMid meet"
          >
            {/* Степная растительность */}
            <g fill="#070e09" opacity="0.85">
              <path d="M25 700 Q18 570 10 460 Q13 456 16 460 Q24 570 30 700Z" />
              <path d="M48 700 Q55 595 66 488 Q69 485 72 488 Q65 595 68 700Z" />
              <path d="M10 700 Q4 630 -2 520 Q0 517 3 520 Q10 630 14 700Z" />
              <path d="M462 700 Q470 570 478 460 Q481 456 484 460 Q478 570 482 700Z" />
              <path d="M445 700 Q438 595 426 488 Q423 485 420 488 Q427 595 430 700Z" />
              <path d="M478 700 Q484 630 492 520 Q494 517 497 520 Q492 630 487 700Z" />
            </g>
            <g stroke="#09120b" strokeWidth="4" fill="none" opacity="0.55">
              <path d="M78 0 Q85 90 81 180 Q77 240 85 310" />
              <path d="M83 130 Q65 162 49 152" />
              <path d="M82 185 Q99 210 114 200" />
              <path d="M416 0 Q409 95 413 195 Q417 255 409 320" />
              <path d="M411 148 Q429 172 445 162" />
              <path d="M410 210 Q393 233 377 223" />
            </g>

            {/* ЕРЛАН — высокий крепкий, чуть сзади справа */}
            <g fill="#0c0e0c">
              <ellipse cx="292" cy="118" rx="33" ry="37" />
              <path d="M271 152 Q272 174 292 174 Q312 174 313 152Z" />
              <path d="M238 178
                Q228 252 224 355 Q220 458 224 588
                L269 588 Q273 518 280 458 Q286 408 292 384
                Q298 408 304 458 Q311 518 315 588
                L360 588 Q364 458 360 355 Q356 252 346 178
                Q319 168 292 165 Q265 168 238 178Z" />
              <path d="M238 190 L190 358 L177 354 L174 374 L206 382 L221 364 L251 205Z" />
              <path d="M346 190 L384 328 L372 332 L342 205Z" />
              <path d="M236 584 L224 700 L251 700 L267 640 L280 700 L304 700 L317 640 L332 700 L359 700 L347 584Z" />
              <rect x="160" y="362" width="94" height="11" rx="4" transform="rotate(4 208 367)" />
            </g>

            {/* БАХА — пониже стройнее, чуть впереди слева */}
            <g fill="#101310">
              <ellipse cx="175" cy="200" rx="25" ry="28" transform="rotate(-3 175 200)" />
              <path d="M151 224 Q153 241 175 243 Q197 241 199 224 Q187 231 175 231 Q163 231 151 224Z" />
              <path d="M163 228 Q163 247 175 247 Q187 247 187 228Z" />
              <path d="M141 250
                Q134 318 132 408 Q130 499 134 604
                L163 604 Q166 544 171 490 Q175 452 179 432
                Q183 452 187 490 Q192 544 196 604
                L225 604 Q229 499 227 408 Q225 318 218 250
                Q199 242 179 239 Q159 242 141 250Z" />
              <path d="M141 262 L108 390 L119 394 L151 276Z" />
              <path d="M218 262 L247 370 L257 365 L228 276Z" />
              <path d="M143 600 L134 700 L158 700 L172 644 L186 700 L210 700 L222 600Z" />
            </g>

            {/* Название — двустрочное, постерный стиль */}
            <text x="250" y="608" textAnchor="middle" fill="#f0ece4"
              fontSize="88" fontWeight="900"
              fontFamily="Georgia, 'Times New Roman', serif" letterSpacing="10">
              ҚАС
            </text>
            <text x="250" y="690" textAnchor="middle" fill="#f0ece4"
              fontSize="88" fontWeight="900"
              fontFamily="Georgia, 'Times New Roman', serif" letterSpacing="10">
              ҚЫР
            </text>
          </svg>

          {/* Подзаголовок поверх постера */}
          <div style={{
            position: 'absolute', bottom: 14, left: 0, right: 0, zIndex: 4,
            textAlign: 'center',
            fontSize: 'clamp(10px, 1.6vw, 14px)',
            letterSpacing: '0.38em',
            color: '#5a8a60',
            fontFamily: 'Georgia, serif',
            textTransform: 'uppercase',
            opacity: 0.9
          }}>
            Казахский постапокалипсис · 1873
          </div>
        </div>

        {/* ── Выбор персонажа + кнопка ── */}
        <div style={{
          background: '#050807',
          borderTop: '1px solid #182018',
          padding: '12px 16px 20px',
          textAlign: 'center', flexShrink: 0
        }}>
          <p style={{ margin: '0 0 8px', fontSize: 11, letterSpacing: '0.22em', textTransform: 'uppercase', opacity: 0.5, fontFamily: 'system-ui', fontWeight: 700 }}>— Выбери героя —</p>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12, justifyContent: 'center' }}>
            {(Object.keys(CHARACTERS) as CharacterId[]).map((id) => {
              const c = CHARACTERS[id]; const sel = chosen === id;
              return (
                <button key={id} onClick={() => setChosen(id)} style={{
                  flex: '0 1 190px',
                  border: `2px solid ${sel ? '#5a8a5a' : '#182018'}`,
                  borderRadius: 8, padding: '10px 12px', cursor: 'pointer',
                  color: '#e8e6e1', display: 'flex', flexDirection: 'column',
                  gap: 2, alignItems: 'center', textAlign: 'center',
                  background: sel ? 'rgba(90,138,90,0.14)' : 'rgba(4,6,5,0.85)',
                  fontFamily: 'system-ui'
                }}>
                  <div style={{ fontSize: 26 }}>{c.emoji}</div>
                  <div style={{ fontWeight: 800, fontSize: 14 }}>{c.name}</div>
                  <div style={{ fontSize: 11, opacity: 0.65, lineHeight: 1.3 }}>{c.perk}</div>
                </button>
              );
            })}
          </div>
          <button onClick={() => startGame(chosen)} style={{
            background: 'transparent', color: '#f0ece4',
            border: '2px solid #4e7c50', borderRadius: 3,
            padding: '12px 44px', fontSize: 14, fontWeight: 800,
            letterSpacing: '0.35em', cursor: 'pointer',
            textTransform: 'uppercase', fontFamily: 'system-ui',
            marginBottom: 6
          }}>▶  ИГРАТЬ</button>
          <p style={{ fontSize: 10, opacity: 0.3, marginTop: 6, fontFamily: 'system-ui', lineHeight: 1.4 }}>
            WASD — движение · мышь — прицел · ЛКМ / Space — атака · Shift — красться · F — лечиться · C — факел · 1–9 — инвентарь · Esc — выход
          </p>
        </div>
      </div>
    );
  }

  // ════════ ИГРА / ФИНАЛ ════════
  const c = CHARACTERS[chosen];
  return (
    <div id="qasqyr-root" style={{ ...overlay, cursor: screen === 'playing' ? 'crosshair' : 'default' }}>
      <canvas ref={canvasRef} style={{ display: 'block' }} />
      <button onClick={() => { if (document.fullscreenElement) document.exitFullscreen().catch(() => {}); onExit?.(); }}
        style={exitBtn}>✕ Выход (Esc)</button>

      {jumpscare && (
        <>
          <style>{`
            @keyframes js-bg {
              0%   { background:#aa2200; }
              6%   { background:#ff3300; }
              18%  { background:#880000; }
              45%  { background:#330000; }
              100% { background:#000000; }
            }
            @keyframes js-slam {
              0%   { transform:scale(1.9); }
              8%   { transform:scale(0.96); }
              15%  { transform:scale(1.04); }
              22%  { transform:scale(1); }
              100% { transform:scale(1); }
            }
            @keyframes js-shake {
              0%   { transform:translate(0,0); }
              10%  { transform:translate(-20px,12px); }
              20%  { transform:translate(16px,-14px); }
              30%  { transform:translate(-12px,18px); }
              40%  { transform:translate(14px,-8px); }
              55%  { transform:translate(-6px,8px); }
              70%  { transform:translate(5px,-5px); }
              100% { transform:translate(0,0); }
            }
            @keyframes js-fade {
              0%   { opacity:1; }
              65%  { opacity:1; }
              100% { opacity:0; }
            }
            .js-overlay { animation: js-bg 2.8s ease-out forwards; }
            .js-slam    { animation: js-slam 0.2s ease-out forwards, js-shake 0.42s ease-in-out, js-fade 2.8s ease-in-out forwards; }
          `}</style>
          <div className="js-overlay" style={{
            position:'absolute', inset:0, zIndex:9998, overflow:'hidden',
            display:'flex', alignItems:'center', justifyContent:'center'
          }}>
            <div className="js-slam" style={{ width:'100%', height:'100%' }}>
              <svg viewBox="0 0 400 400" width="100%" height="100%" preserveAspectRatio="xMidYMid slice">
                <defs>
                  <radialGradient id="fur" cx="50%" cy="42%">
                    <stop offset="0%"   stopColor="#d98c2c"/>
                    <stop offset="40%"  stopColor="#bf7218"/>
                    <stop offset="78%"  stopColor="#8a5010"/>
                    <stop offset="100%" stopColor="#3e1e06"/>
                  </radialGradient>
                  <radialGradient id="vign" cx="50%" cy="50%">
                    <stop offset="45%"  stopColor="#000000" stopOpacity="0"/>
                    <stop offset="100%" stopColor="#000000" stopOpacity="0.82"/>
                  </radialGradient>
                  <radialGradient id="glow" cx="50%" cy="44%">
                    <stop offset="0%"   stopColor="#b06010" stopOpacity="0.35"/>
                    <stop offset="100%" stopColor="#000000" stopOpacity="0"/>
                  </radialGradient>
                </defs>

                {/* Фон */}
                <rect width="400" height="400" fill="#050302"/>
                <rect width="400" height="400" fill="url(#glow)"/>

                {/* Голова — большой овал, выходит за края */}
                <ellipse cx="200" cy="190" rx="235" ry="250" fill="url(#fur)"/>

                {/* Верхняя тень (лоб) */}
                <ellipse cx="200" cy="28"  rx="250" ry="140" fill="#030201" opacity="0.7"/>

                {/* Морда — светлее */}
                <ellipse cx="200" cy="308" rx="115" ry="95"  fill="#c88c38"/>

                {/* Тень под мордой */}
                <ellipse cx="200" cy="420" rx="270" ry="170" fill="#030201" opacity="0.85"/>

                {/* Глазницы */}
                <ellipse cx="126" cy="192" rx="62" ry="64"   fill="#040202"/>
                <ellipse cx="274" cy="192" rx="62" ry="64"   fill="#040202"/>

                {/* Ободок глаз */}
                <ellipse cx="126" cy="192" rx="66" ry="68"   fill="none" stroke="#5c380e" strokeWidth="4" opacity="0.5"/>
                <ellipse cx="274" cy="192" rx="66" ry="68"   fill="none" stroke="#5c380e" strokeWidth="4" opacity="0.5"/>

                {/* Блик — белое пятно сверху-слева (как на фото) */}
                <ellipse cx="108" cy="171" rx="14" ry="16"   fill="#e8e4dc" opacity="0.88"/>
                <ellipse cx="256" cy="171" rx="14" ry="16"   fill="#e8e4dc" opacity="0.88"/>

                {/* Переносица */}
                <ellipse cx="200" cy="262" rx="28" ry="18"   fill="#7a4810" opacity="0.55"/>

                {/* Ноздри */}
                <ellipse cx="188" cy="302" rx="10" ry="7"    fill="#3a1c06" opacity="0.8"/>
                <ellipse cx="212" cy="302" rx="10" ry="7"    fill="#3a1c06" opacity="0.8"/>

                {/* Виньетка по краям */}
                <rect width="400" height="400" fill="url(#vign)"/>
              </svg>
            </div>
          </div>
        </>
      )}

      {riddle !== null && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 9990, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.82)' }}>
          <div style={{ background: '#0e1008', border: '2px solid #6b9a40', borderRadius: 16, padding: '28px 32px', width: 'min(500px,92vw)', textAlign: 'center', color: '#e8e6e1', fontFamily: 'system-ui' }}>
            <div style={{ fontSize: 36, marginBottom: 8 }}>{riddle === 0 ? '📜' : '🗝️'}</div>
            <h2 style={{ margin: '0 0 6px', color: '#d9c060', fontSize: 18 }}>Загадка {riddle + 1} из 2</h2>
            <p style={{ color: '#b0c090', fontSize: 13, margin: '0 0 4px' }}>Реши загадку, получи {riddle === 0 ? 'КОД К ВОРОТАМ' : 'ОТМЫЧКУ'}. Неверный ответ — −20 HP.</p>
            <p style={{ fontSize: 16, lineHeight: 1.6, margin: '16px 0 20px', color: '#f0ece0' }}>{RIDDLES[riddle].question}</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {(RIDDLES[riddle].options as readonly string[]).map((opt, i) => (
                <button key={i} onClick={() => handleRiddleAnswer(riddle, i)} style={{ background: '#1a2010', border: '1px solid #4a6a28', borderRadius: 8, padding: '11px 16px', color: '#d0e0a0', fontSize: 15, cursor: 'pointer', textAlign: 'left' }}>
                  {opt}
                </button>
              ))}
            </div>
            <button onClick={() => setRiddle(null)} style={{ marginTop: 14, background: 'transparent', border: '1px solid #444', borderRadius: 8, padding: '8px 24px', color: '#666', fontSize: 13, cursor: 'pointer' }}>
              Закрыть
            </button>
          </div>
        </div>
      )}

      {screen === 'over' && result && (
        <div style={overPanel}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>{result.kind === 'win' ? '🏰' : '💀'}</div>
          <h2 style={{ margin: '0 0 8px' }}>{result.title}</h2>
          <p style={{ opacity: 0.85, lineHeight: 1.5, marginBottom: 20 }}>{result.text}</p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
            <button onClick={() => startGame(chosen)} style={playBtn}>↺ Играть снова за {c.name}</button>
            <button onClick={() => setScreen('intro')} style={{ ...playBtn, background: 'transparent', border: '1px solid #555', color: '#ccc' }}>Меню</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ════════════════════════════ ОБНОВЛЕНИЕ МИРА ════════════════════════════
function update(w: World, dt: number, keys: Set<string>, mouse: { x: number; y: number; down: boolean }, finish: (k: 'win' | 'lose') => void) {
  // время суток
  w.time += dt / 90;
  if (w.time >= 1) { w.time -= 1; w.day += 1; banner(w, `📅 День ${w.day}`); }
  const night = w.time < 0.22 || w.time > 0.74;

  // ── playTime и заморозка ──
  w.playTime += dt;
  w.frozenTimer = Math.max(0, w.frozenTimer - dt);

  // ── Система ивентов ──
  if (w.eventId > 0) {
    w.eventTimer -= dt;
    // обратный отсчёт в баннере
    if (w.eventTimer > 0 && w.eventTimer <= 10) {
      const sec = Math.ceil(w.eventTimer);
      if (sec !== Math.ceil(w.eventTimer + dt)) banner(w, `⏱️ ${sec}с...`);
    }
    if (w.eventTimer <= 0) {
      const ended = w.eventId;
      if (ended === 1) {
        // хардкор → сразу туннель
        w.tunnelChaser = { x: w.px, y: w.py - 720, speed: WALK, r: 24, hitCd: 0 };
        w.eventId = 2; w.eventTimer = 30;
        banner(w, '🚇 ТУННЕЛЬ! Беги от монстра!');
      } else {
        if (ended === 5) w.berserkMult = 1;
        w.tunnelChaser = null;
        w.eventId = 0; w.nextEventIn = 90;
        const msgs: Record<number, string> = { 2: '✅ Вырвался из туннеля!', 3: '✅ Буря стихла!', 4: '✅ Нашествие отбито!', 5: '✅ Враги успокоились.' };
        banner(w, msgs[ended] ?? '✅ Испытание пройдено!');
      }
    }
  }
  if (w.eventId === 0) {
    w.nextEventIn -= dt;
    if (w.nextEventIn <= 0) {
      w.eventCount += 1;
      const evOrder = [1, 3, 4, 5, 3, 4, 5, 4, 5];
      const ev = evOrder[Math.min(w.eventCount - 1, evOrder.length - 1)];
      w.eventId = ev;
      if (ev === 1) {
        w.eventTimer = 30;
        // изъять всё кроме еды и ножа
        for (let i = 0; i < 9; i++) {
          const sl = w.inv[i];
          if (sl && sl.item !== 'food' && sl.item !== 'knife') { w.inv[i] = null; if (w.equipped === i) w.equipped = null; }
        }
        banner(w, '⚠️ ХАРДКОР! Снаряжение изъято — выживи 30 секунд!');
      } else if (ev === 3) {
        w.eventTimer = 25;
        banner(w, '🌪️ СТЕПНАЯ БУРЯ! Скорость снижена на 60%!');
      } else if (ev === 4) {
        w.eventTimer = 25;
        const d = ENEMY_DEFS['alyp'];
        for (let i = 0; i < 15; i++) {
          const ang = (i / 15) * Math.PI * 2;
          w.enemies.push({ x: w.px + Math.cos(ang) * 660, y: w.py + Math.sin(ang) * 660, hp: d.hp, maxHp: d.hp, r: d.r, kind: 'alyp', speed: d.speed, dmg: d.dmg, hitFlash: 0 });
        }
        banner(w, '👹 НАШЕСТВИЕ! Орда Алыпов атакует!');
      } else if (ev === 5) {
        w.eventTimer = 30;
        w.berserkMult = 2.2;
        banner(w, '🔴 БЕРСЕРК! Враги вдвое быстрее!');
      }
    }
  }

  // движение (учитываем заморозку и бурю)
  w.sneaking = keys.has('shift');
  const stormMult = w.eventId === 3 ? 0.4 : 1;
  const sp = w.frozenTimer > 0 ? 0 : (w.sneaking ? SNEAK : WALK) * stormMult;
  let dx = 0, dy = 0;
  if (w.frozenTimer <= 0) {
    if (keys.has('w')) dy -= 1; if (keys.has('s')) dy += 1;
    if (keys.has('a')) dx -= 1; if (keys.has('d')) dx += 1;
  }
  const len = Math.hypot(dx, dy) || 1;
  w.px += (dx / len) * sp * dt;
  w.py += (dy / len) * sp * dt;
  w.px = Math.max(40, Math.min(WORLD_W - 40, w.px));
  w.py = Math.max(60, Math.min(WORLD_H - 60, w.py));
  if (dx || dy) w.facing = Math.atan2(dy, dx);

  // прицел к мыши
  w.aim = Math.atan2(mouse.y - window.innerHeight / 2, mouse.x - window.innerWidth / 2);

  // победа — нужны код, отмычка и ключ
  if (w.py <= FORTRESS_Y) {
    const hasCode = countItem(w, 'code_scroll') > 0;
    const hasLock = countItem(w, 'lockpick') > 0;
    const hasKey  = countItem(w, 'fortress_key') > 0;
    if (hasCode && hasLock && hasKey) { finish('win'); return; }
    w.py = FORTRESS_Y + 95;
    if (!w.fortressKeyLoot && !hasKey) {
      const kx = 400 + Math.random() * (WORLD_W - 800);
      const ky = 2500 + Math.random() * (WORLD_H - 5000);
      w.fortressKeyLoot = { x: kx, y: ky };
      w.loot.push({ x: kx, y: ky, item: 'fortress_key', r: 14 });
      banner(w, '🔑 Ворота не открыть... КЛЮЧ вылетел в степь! Стрелка укажет путь.');
    } else {
      const missing: string[] = [];
      if (!hasCode) missing.push('КОД 📜');
      if (!hasLock)  missing.push('ОТМЫЧКУ 🗝️');
      if (!hasKey)   missing.push('КЛЮЧ 🔑');
      if (missing.length) banner(w, `🔒 Нужны: ${missing.join(', ')}`);
    }
  }

  // ложные крепости
  if (w.fakeFortressMock > 0) w.fakeFortressMock -= dt;
  for (const ff of FAKE_FORTRESS_DEFS) {
    if (Math.hypot(w.px - ff.x, w.py - ff.y) < 200 && w.fakeFortressMock <= 0) {
      w.fakeFortressMock = 8;
      banner(w, MOCK_MSGS[ff.mockIdx]);
      break;
    }
  }

  // загадки — подсказка при приближении
  w.nearRiddle = -1;
  for (let i = 0; i < RIDDLE_DEFS.length; i++) {
    if (!w.riddleSolved[i] && Math.hypot(w.px - RIDDLE_DEFS[i].x, w.py - RIDDLE_DEFS[i].y) < 88) {
      w.nearRiddle = i;
      if (w.bannerT <= 0.6) banner(w, `🔍 [E] — прочитать загадку (${i === 0 ? 'даёт КОД 📜' : 'даёт ОТМЫЧКУ 🗝️'})`);
      break;
    }
  }

  // атака
  w.attackCd = Math.max(0, w.attackCd - dt);
  w.attackTimer = Math.max(0, w.attackTimer - dt);
  if (w.wantsAttack && w.attackCd === 0) {
    w.wantsAttack = false;
    const wepId = w.equipped != null && w.inv[w.equipped] ? w.inv[w.equipped]!.item : null;
    const wep = wepId ? ITEMS[wepId] : null;
    if (wep && wep.ranged) {
      if (countItem(w, 'ammo') > 0) {
        removeOne(w, 'ammo');
        w.bullets.push({ x: w.px, y: w.py, vx: Math.cos(w.aim) * 760, vy: Math.sin(w.aim) * 760, life: 1.2 });
        w.attackCd = 0.32;
      } else { banner(w, 'Нет патронов! (R)'); w.attackCd = 0.2; }
    } else {
      // ближний бой — взмах
      w.attackTimer = 0.18; w.attackCd = 0.36;
      const reach = (wepId === 'club' ? 78 : 62);
      const dmg = (wep?.damage ?? 8) * (w.char === 'erlan' ? 1.4 : 1) + 4;
      for (const e of w.enemies) {
        const a = Math.atan2(e.y - w.py, e.x - w.px);
        let da = Math.abs(a - w.aim); if (da > Math.PI) da = 2 * Math.PI - da;
        if (Math.hypot(e.x - w.px, e.y - w.py) < reach + e.r && da < 1.1) { e.hp -= dmg; e.hitFlash = 0.12; }
      }
    }
  }
  w.wantsAttack = false;

  // пули
  for (const b of w.bullets) {
    b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
    for (const e of w.enemies) {
      if (e.hp > 0 && Math.hypot(e.x - b.x, e.y - b.y) < e.r + 4) { e.hp -= 32; e.hitFlash = 0.12; b.life = 0; break; }
    }
  }
  w.bullets = w.bullets.filter((b) => b.life > 0);

  // спавн врагов
  w.spawnTimer -= dt;
  const cap = w.eventId === 1 ? 80 : (night ? 60 : 45);
  const spawnRate = w.eventId === 1 ? 0.09 : (night ? 0.2 : 0.33);
  if (w.spawnTimer <= 0 && w.enemies.length < cap) {
    w.spawnTimer = spawnRate;
    const ang = Math.random() * Math.PI * 2;
    const dist = 560 + Math.random() * 160;
    const ex = w.px + Math.cos(ang) * dist;
    const ey = w.py + Math.sin(ang) * dist;
    let kind: EnemyKind;
    const roll = Math.random();
    if (night && roll < 0.45) kind = 'wolf';
    else if (roll < 0.4) kind = 'shala';
    else if (roll < 0.62) kind = 'sokyr';
    else if (roll < 0.8) kind = 'jarylys';
    else if (roll < 0.92) kind = 'wolf';
    else kind = 'alyp';
    const d = ENEMY_DEFS[kind];
    w.enemies.push({ x: ex, y: ey, hp: d.hp, maxHp: d.hp, r: d.r, kind, speed: d.speed, dmg: d.dmg, hitFlash: 0 });
  }

  // ИИ врагов — ВСЕГДА идут на героя (или на ближайшего союзника, если он ближе)
  for (const e of w.enemies) {
    e.hitFlash = Math.max(0, e.hitFlash - dt);
    // цель: герой, либо ближайший союзник в пределах 220px
    let tx = w.px, ty = w.py;
    let best = Math.hypot(w.px - e.x, w.py - e.y);
    for (const al of w.allies) {
      const d = Math.hypot(al.x - e.x, al.y - e.y);
      if (d < best && d < 240) { best = d; tx = al.x; ty = al.y; }
    }
    const a = Math.atan2(ty - e.y, tx - e.x);
    e.x += Math.cos(a) * e.speed * w.berserkMult * dt;
    e.y += Math.sin(a) * e.speed * w.berserkMult * dt;

    // урон герою при касании
    const dp = Math.hypot(w.px - e.x, w.py - e.y);
    if (dp < e.r + 16) {
      w.hp -= e.dmg * dt;
      w.hurtFlash = 0.25;
      const ba = Math.atan2(e.y - w.py, e.x - w.px);
      e.x += Math.cos(ba) * 120 * dt; e.y += Math.sin(ba) * 120 * dt; // лёгкий отскок
    }
    // урон союзникам при касании
    for (const al of w.allies) {
      if (Math.hypot(al.x - e.x, al.y - e.y) < e.r + al.r) al.hp -= e.dmg * 0.6 * dt;
    }
  }

  // ── ПОДМОГА: приходит время от времени и дерётся ──
  w.allyTimer -= dt;
  if (w.allyTimer <= 0 && w.allies.length < 3) {
    w.allyTimer = 22 + Math.random() * 12;
    const t = ALLY_POOL[Math.floor(Math.random() * ALLY_POOL.length)];
    const ang = Math.random() * Math.PI * 2;
    w.allies.push({ x: w.px + Math.cos(ang) * 520, y: w.py + Math.sin(ang) * 520, hp: t.hp, maxHp: t.hp, r: 15, cd: 0, name: t.name, emoji: t.emoji });
    banner(w, `⛑️ Подмога! ${t.emoji} ${t.name} спешит на помощь`);
  }
  for (const al of w.allies) {
    // держаться рядом с героем
    const dh = Math.hypot(w.px - al.x, w.py - al.y);
    if (dh > 120) { const a = Math.atan2(w.py - al.y, w.px - al.x); al.x += Math.cos(a) * 175 * dt; al.y += Math.sin(a) * 175 * dt; }
    // стрелять по ближайшему врагу
    al.cd = Math.max(0, al.cd - dt);
    if (al.cd === 0) {
      let target: Enemy | null = null; let bd = 320;
      for (const e of w.enemies) { const d = Math.hypot(e.x - al.x, e.y - al.y); if (d < bd) { bd = d; target = e; } }
      if (target) {
        const a = Math.atan2(target.y - al.y, target.x - al.x);
        w.bullets.push({ x: al.x, y: al.y, vx: Math.cos(a) * 720, vy: Math.sin(a) * 720, life: 1.0 });
        al.cd = 0.7;
      }
    }
  }
  // павшая подмога
  w.allies = w.allies.filter((al) => { if (al.hp <= 0) { banner(w, `🪦 ${al.name} пал в бою...`); return false; } return true; });

  // ── Туннельный преследователь ──
  if (w.tunnelChaser) {
    const tc = w.tunnelChaser;
    tc.hitCd = Math.max(0, tc.hitCd - dt);
    const ang = Math.atan2(w.py - tc.y, w.px - tc.x);
    tc.x += Math.cos(ang) * tc.speed * dt;
    tc.y += Math.sin(ang) * tc.speed * dt;
    if (Math.hypot(w.px - tc.x, w.py - tc.y) < tc.r + 18 && tc.hitCd <= 0) {
      w.frozenTimer = 1.2;
      w.hp -= 28;
      w.hurtFlash = 0.5;
      tc.hitCd = 1.8;
      banner(w, '❄️ Монстр поймал тебя! −28 HP');
    }
  }
  // смерть и деспавн врагов
  w.enemies = w.enemies.filter((e) => {
    if (e.hp <= 0) {
      w.kills += 1;
      if (e.kind === 'jarylys' && Math.hypot(e.x - w.px, e.y - w.py) < 70) { w.hp -= 16; w.hurtFlash = 0.3; banner(w, '🤢 Споры! −16 HP'); }
      if (Math.random() < 0.35) w.loot.push({ x: e.x, y: e.y, item: Math.random() < 0.5 ? 'food' : 'ammo', r: 12 });
      return false;
    }
    return Math.hypot(e.x - w.px, e.y - w.py) < 1400; // деспавн далёких
  });

  // подбор лута
  w.loot = w.loot.filter((l) => {
    if (Math.hypot(l.x - w.px, l.y - w.py) < l.r + 22) {
      if (addItem(w, l.item, ITEMS[l.item].stackable ? 1 + Math.floor(Math.random() * 2) : 1)) {
        banner(w, `🎒 +${ITEMS[l.item].emoji} ${ITEMS[l.item].name}`);
        if (l.item === 'fortress_key') w.fortressKeyLoot = null;
        return false;
      }
      return true; // инвентарь полон — оставить
    }
    return true;
  });

  w.hurtFlash = Math.max(0, w.hurtFlash - dt);
  if (w.bannerT > 0) w.bannerT -= dt;
  if (w.hp <= 0) { w.hp = 0; finish('lose'); }
}

// ════════════════════════════ РЕНДЕР (вид от третьего лица) ════════════════════════════
function render(ctx: CanvasRenderingContext2D, w: World) {
  const W = window.innerWidth, H = window.innerHeight;
  const night = w.time < 0.22 || w.time > 0.74;
  const dusk  = (w.time >= 0.22 && w.time < 0.3) || (w.time > 0.66 && w.time <= 0.74);

  // ── Камера: чуть позади игрока, смотрит на север (уменьшение Y = вперёд) ──
  const CAM_BACK = 160;  // мировых единиц позади игрока
  const CAM_H    = 88;   // высота камеры над землёй
  const FOCAL    = 460;  // фокусное расстояние
  const HORIZ    = Math.floor(H * 0.42); // горизонт на экране

  // Проекция мировой точки на экран. null = за камерой
  function proj(wx: number, wy: number) {
    const d = (w.py + CAM_BACK) - wy; // глубина: >0 = перед камерой
    if (d < 1) return null;
    return { sx: W / 2 + ((wx - w.px) / d) * FOCAL, sy: HORIZ + (CAM_H / d) * FOCAL, sc: FOCAL / d, d };
  }
  // туман прозрачности по дистанции
  function fog(d: number) { return Math.min(1, Math.max(0.06, 1 - d / (night ? 7000 : 18000))); }

  // ── 1. Небо ──
  const skyG = ctx.createLinearGradient(0, 0, 0, HORIZ);
  if (night)     { skyG.addColorStop(0, '#040810'); skyG.addColorStop(1, '#0d1828'); }
  else if (dusk) { skyG.addColorStop(0, '#0e0608'); skyG.addColorStop(1, '#7a3818'); }
  else           { skyG.addColorStop(0, '#0c1610'); skyG.addColorStop(1, '#3a5e38'); }
  ctx.fillStyle = skyG; ctx.fillRect(0, 0, W, HORIZ);
  // звёзды ночью
  if (night) {
    for (let i = 0; i < 90; i++) {
      ctx.fillStyle = `rgba(255,255,240,${0.4 + hash(i * 5.1) * 0.5})`;
      ctx.beginPath(); ctx.arc(hash(i * 13.7) * W, hash(i * 27.3 + 1) * HORIZ * 0.92,
        hash(i * 9.3 + 3) < 0.2 ? 1.4 : 0.9, 0, 7); ctx.fill();
    }
  }

  // ── 2. Земля ──
  const gG = ctx.createLinearGradient(0, HORIZ, 0, H);
  gG.addColorStop(0, night ? '#0c140c' : dusk ? '#2a3618' : '#456228');
  gG.addColorStop(1, night ? '#1a2417' : dusk ? '#5a6e36' : '#7a9a48');
  ctx.fillStyle = gG; ctx.fillRect(0, HORIZ, W, H - HORIZ);
  // перспективные линии земли
  ctx.lineWidth = 1;
  ctx.strokeStyle = night ? 'rgba(36,51,28,0.22)' : dusk ? 'rgba(70,80,40,0.2)' : 'rgba(80,110,45,0.22)';
  for (let depth = 30; depth < 8000; depth = depth < 200 ? depth + 30 : depth < 1200 ? depth + 130 : depth + 700) {
    const sy = HORIZ + (CAM_H / depth) * FOCAL; if (sy > H + 2) break;
    ctx.beginPath(); ctx.moveTo(0, sy); ctx.lineTo(W, sy); ctx.stroke();
  }
  for (let i = -14; i <= 14; i++) {
    const wx = w.px + i * 300;
    ctx.beginPath();
    ctx.moveTo(W / 2 + ((wx - w.px) / 9000) * FOCAL, HORIZ);
    ctx.lineTo(W / 2 + ((wx - w.px) / 1) * FOCAL, H);
    ctx.stroke();
  }

  // ── 3. Сбор и сортировка объектов по глубине (художник) ──
  const calls: { d: number; fn: () => void }[] = [];

  // Настоящая крепость
  calls.push({ d: (w.py + CAM_BACK) - FORTRESS_Y, fn: () => {
    const p = proj(WORLD_W / 2, FORTRESS_Y); if (!p) return;
    ctx.globalAlpha = fog(p.d);
    const fw = Math.min(W * 0.95, Math.max(6, 800 * p.sc));
    const fh = Math.min(H * 0.85, Math.max(4, 400 * p.sc));
    ctx.fillStyle = night ? '#282b34' : '#8a8275';
    ctx.fillRect(p.sx - fw / 2, p.sy - fh, fw, fh);
    // башни
    const tw = Math.max(2, fw * 0.16), th = fh * 1.25;
    ctx.fillStyle = night ? '#1e2028' : '#6a6460';
    ctx.fillRect(p.sx - fw / 2 - tw * 0.2, p.sy - th, tw, th);
    ctx.fillRect(p.sx + fw / 2 - tw * 0.8, p.sy - th, tw, th);
    // ворота
    ctx.fillStyle = '#040406';
    ctx.fillRect(p.sx - Math.max(1, fw * 0.06), p.sy - fh * 0.38, Math.max(1, fw * 0.12), fh * 0.38);
    if (p.sc > 0.012) {
      ctx.font = `bold ${Math.max(8, Math.min(22, 18 * p.sc))}px system-ui`;
      ctx.fillStyle = '#d97757'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
      ctx.fillText('🏰 КРЕПОСТЬ-ЛАБОРАТОРИЯ', p.sx, p.sy - fh - 3);
    }
    ctx.globalAlpha = 1;
  }});

  // Ложные крепости
  for (const ff of FAKE_FORTRESS_DEFS) {
    calls.push({ d: (w.py + CAM_BACK) - ff.y, fn: () => {
      const p = proj(ff.x, ff.y); if (!p) return;
      ctx.globalAlpha = fog(p.d);
      const fw = Math.min(W * 0.85, Math.max(5, 650 * p.sc));
      const fh = Math.min(H * 0.75, Math.max(3, 320 * p.sc));
      ctx.fillStyle = night ? '#232630' : '#7a7570';
      ctx.fillRect(p.sx - fw / 2, p.sy - fh, fw, fh);
      ctx.fillStyle = '#050407';
      ctx.fillRect(p.sx - Math.max(1, fw * 0.05), p.sy - fh * 0.35, Math.max(1, fw * 0.10), fh * 0.35);
      if (p.sc > 0.012) {
        ctx.font = `bold ${Math.max(7, Math.min(18, 14 * p.sc))}px system-ui`;
        ctx.fillStyle = '#c08060'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
        ctx.fillText('🏰 КРЕПОСТЬ', p.sx, p.sy - fh - 3);
      }
      ctx.globalAlpha = 1;
    }});
  }

  // Загадки
  for (let i = 0; i < RIDDLE_DEFS.length; i++) {
    if (w.riddleSolved[i]) continue;
    const rd = RIDDLE_DEFS[i];
    calls.push({ d: (w.py + CAM_BACK) - rd.y, fn: () => {
      const p = proj(rd.x, rd.y); if (!p || p.sx < -60 || p.sx > W + 60 || p.sy > H + 40) return;
      ctx.globalAlpha = Math.min(0.95, fog(p.d) * 1.4);
      const sz = Math.max(8, Math.min(38, 30 * p.sc));
      const gr = ctx.createRadialGradient(p.sx, p.sy, 0, p.sx, p.sy, sz * 1.6);
      gr.addColorStop(0, 'rgba(210,170,60,0.4)'); gr.addColorStop(1, 'rgba(210,170,60,0)');
      ctx.fillStyle = gr; ctx.fillRect(p.sx - sz * 2, p.sy - sz * 2, sz * 4, sz * 4);
      ctx.font = `${sz}px system-ui`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(i === 0 ? '📜' : '🗝️', p.sx, p.sy);
      if (sz > 10) {
        ctx.font = `bold ${Math.max(6, sz * 0.4)}px system-ui`;
        ctx.fillStyle = '#ffd060'; ctx.textBaseline = 'top';
        ctx.fillText(i === 0 ? 'КОД' : 'ОТМЫЧКА', p.sx, p.sy + sz * 0.55);
      }
      ctx.globalAlpha = 1;
    }});
  }

  // Лут
  for (const l of w.loot) {
    calls.push({ d: (w.py + CAM_BACK) - l.y, fn: () => {
      const p = proj(l.x, l.y); if (!p || p.sx < -50 || p.sx > W + 50 || p.sy > H + 30) return;
      ctx.globalAlpha = Math.min(0.9, fog(p.d) * 1.3);
      const sz = Math.max(7, Math.min(28, 22 * p.sc));
      ctx.font = `${sz}px system-ui`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(ITEMS[l.item].emoji, p.sx, p.sy);
      ctx.globalAlpha = 1;
    }});
  }

  // Пули
  for (const b of w.bullets) {
    calls.push({ d: (w.py + CAM_BACK) - b.y, fn: () => {
      const p = proj(b.x, b.y); if (!p) return;
      ctx.fillStyle = '#ffe08a';
      ctx.beginPath(); ctx.arc(p.sx, p.sy, Math.max(1.5, 4 * p.sc), 0, 7); ctx.fill();
    }});
  }

  // Враги
  for (const e of w.enemies) {
    calls.push({ d: (w.py + CAM_BACK) - e.y, fn: () => {
      const p = proj(e.x, e.y); if (!p || p.sx < -100 || p.sx > W + 100 || p.sy > H + 60) return;
      ctx.globalAlpha = Math.min(1, fog(p.d) * 1.5);
      const d = ENEMY_DEFS[e.kind];
      const r = Math.max(5, Math.min(62, e.r * p.sc * 2.4));
      // тень
      ctx.beginPath(); ctx.ellipse(p.sx, p.sy + r * 0.28, r * 0.82, r * 0.26, 0, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0,0,0,0.38)'; ctx.fill();
      // тело
      ctx.beginPath(); ctx.arc(p.sx, p.sy, r, 0, 7);
      ctx.fillStyle = e.hitFlash > 0 ? '#fff' : d.color; ctx.fill();
      ctx.font = `${Math.max(8, r * 1.6)}px system-ui`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(d.emoji, p.sx, p.sy);
      if (e.hp < e.maxHp) {
        const bw = r * 2.8;
        ctx.fillStyle = '#000a'; ctx.fillRect(p.sx - bw / 2, p.sy - r - 12, bw, 5);
        ctx.fillStyle = '#d9534f'; ctx.fillRect(p.sx - bw / 2, p.sy - r - 12, bw * (e.hp / e.maxHp), 5);
      }
      ctx.globalAlpha = 1;
    }});
  }

  // Союзники
  for (const al of w.allies) {
    calls.push({ d: (w.py + CAM_BACK) - al.y, fn: () => {
      const p = proj(al.x, al.y); if (!p || p.sx < -100 || p.sx > W + 100 || p.sy > H + 60) return;
      ctx.globalAlpha = Math.min(1, fog(p.d) * 1.5);
      const r = Math.max(5, Math.min(50, 15 * p.sc * 2.4));
      ctx.beginPath(); ctx.ellipse(p.sx, p.sy + r * 0.28, r * 0.82, r * 0.26, 0, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0,0,0,0.32)'; ctx.fill();
      ctx.beginPath(); ctx.arc(p.sx, p.sy, r, 0, 7);
      ctx.fillStyle = '#3a7d44'; ctx.fill();
      ctx.lineWidth = Math.max(1, 2 * p.sc); ctx.strokeStyle = '#9be7a8'; ctx.stroke();
      ctx.font = `${Math.max(8, r * 1.4)}px system-ui`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(al.emoji, p.sx, p.sy);
      const bw = r * 2.8;
      ctx.fillStyle = '#000a'; ctx.fillRect(p.sx - bw / 2, p.sy - r - 10, bw, 4);
      ctx.fillStyle = '#5fb87a'; ctx.fillRect(p.sx - bw / 2, p.sy - r - 10, bw * (al.hp / al.maxHp), 4);
      ctx.globalAlpha = 1;
    }});
  }

  // Туннельный преследователь
  if (w.tunnelChaser) {
    const tc = w.tunnelChaser;
    calls.push({ d: (w.py + CAM_BACK) - tc.y, fn: () => {
      const p = proj(tc.x, tc.y); if (!p) return;
      ctx.globalAlpha = Math.min(1, fog(p.d) * 1.8);
      const r = Math.max(8, Math.min(80, tc.r * p.sc * 2.6));
      const gr = ctx.createRadialGradient(p.sx, p.sy, 0, p.sx, p.sy, r * 2.5);
      gr.addColorStop(0, 'rgba(220,0,0,0.55)'); gr.addColorStop(1, 'rgba(220,0,0,0)');
      ctx.fillStyle = gr; ctx.fillRect(p.sx - r * 2.5, p.sy - r * 2.5, r * 5, r * 5);
      ctx.beginPath(); ctx.arc(p.sx, p.sy, r, 0, 7);
      ctx.fillStyle = '#880000'; ctx.fill();
      ctx.font = `${Math.max(12, r * 1.6)}px system-ui`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('👾', p.sx, p.sy);
      ctx.globalAlpha = 1;
    }});
  }

  // Игрок — фиксирован внизу по центру
  calls.push({ d: CAM_BACK, fn: () => {
    const pcx = W / 2, pcy = Math.floor(H * 0.76);
    ctx.beginPath(); ctx.ellipse(pcx, pcy + 26, 28, 10, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fill();
    if (w.attackTimer > 0) {
      ctx.strokeStyle = '#fff8'; ctx.lineWidth = 6;
      ctx.beginPath(); ctx.arc(pcx, pcy, 54, w.aim - 0.85, w.aim + 0.85); ctx.stroke();
    }
    ctx.beginPath(); ctx.arc(pcx, pcy, 24, 0, 7);
    ctx.fillStyle = w.hurtFlash > 0 ? '#ff6b6b' : (w.char === 'erlan' ? '#c98a4a' : '#4a90c9');
    ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = '#ffffff44'; ctx.stroke();
    ctx.font = '30px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(CHARACTERS[w.char].emoji, pcx, pcy);
    ctx.strokeStyle = '#fff9'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(pcx, pcy); ctx.lineTo(pcx + Math.cos(w.aim) * 34, pcy + Math.sin(w.aim) * 34); ctx.stroke();
  }});

  // Сортировка по глубине и отрисовка
  calls.sort((a, b) => b.d - a.d);
  for (const c of calls) c.fn();

  // ── 4. Тьма ночью + свет факела ──
  if (night || dusk) {
    const edge = night ? 0.50 : 0.32;
    ctx.fillStyle = `rgba(5,7,13,${edge})`; ctx.fillRect(0, 0, W, H);
    const pcx = W / 2, pcy = Math.floor(H * 0.76);
    const radius = night ? (w.torch ? 300 : 170) : (w.torch ? 420 : 260);
    ctx.globalCompositeOperation = 'destination-out';
    const hole = ctx.createRadialGradient(pcx, pcy, 0, pcx, pcy, radius);
    hole.addColorStop(0, `rgba(0,0,0,${edge})`); hole.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = hole; ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'source-over';
  }

  // туннельный ивент — виньетка
  if (w.eventId === 2) {
    const gr = ctx.createRadialGradient(W / 2, H / 2, H * 0.22, W / 2, H / 2, H * 0.72);
    gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(4,6,4,0.78)');
    ctx.fillStyle = gr; ctx.fillRect(0, 0, W, H);
  }

  // урон-вспышка
  if (w.hurtFlash > 0) { ctx.fillStyle = `rgba(200,0,0,${w.hurtFlash * 0.5})`; ctx.fillRect(0, 0, W, H); }

  // заморозка
  if (w.frozenTimer > 0) {
    ctx.fillStyle = `rgba(80,160,240,${Math.min(0.38, w.frozenTimer * 0.32)})`; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(160,220,255,0.55)'; ctx.lineWidth = 5; ctx.strokeRect(3, 3, W - 6, H - 6);
  }

  drawHUD(ctx, w, W, H);
}

function drawHUD(ctx: CanvasRenderingContext2D, w: World, W: number, H: number) {
  ctx.textBaseline = 'alphabetic';
  // HP бар
  ctx.fillStyle = '#000a'; ctx.fillRect(20, 20, 264, 26);
  ctx.fillStyle = w.hp > w.maxHp * 0.3 ? '#5fb87a' : '#d9534f';
  ctx.fillRect(22, 22, 260 * Math.max(0, w.hp / w.maxHp), 22);
  ctx.fillStyle = '#fff'; ctx.font = 'bold 14px system-ui'; ctx.textAlign = 'left';
  ctx.fillText(`❤️ ${Math.ceil(w.hp)}/${w.maxHp}`, 30, 38);

  // верхняя инфа
  const night = w.time < 0.22 || w.time > 0.74;
  ctx.textAlign = 'center'; ctx.fillStyle = '#fff'; ctx.font = 'bold 16px system-ui';
  ctx.fillText(`📅 День ${w.day}  ·  ${night ? '🌑 Ночь' : '☀️ День'}  ·  ☠️ ${w.kills}`, W / 2, 30);

  // таймер активного ивента
  if (w.eventId > 0 && w.eventTimer > 0) {
    const labels: Record<number, string> = { 1: '⚠️ ХАРДКОР', 2: '🚇 ТУННЕЛЬ', 3: '🌪️ БУРЯ', 4: '👹 НАШЕСТВИЕ', 5: '🔴 БЕРСЕРК' };
    const lbl = labels[w.eventId] ?? '⚠️ ИВЕНТ';
    ctx.textAlign = 'right'; ctx.fillStyle = '#ff4422'; ctx.font = 'bold 16px system-ui';
    ctx.fillText(`${lbl}  ⏱ ${Math.ceil(w.eventTimer)}с`, W - 18, 38);
  }

  // баннер
  if (w.bannerT > 0) {
    ctx.globalAlpha = Math.min(1, w.bannerT);
    ctx.fillStyle = '#000b'; const tw = ctx.measureText(w.banner).width + 40;
    ctx.fillRect(W / 2 - tw / 2, 44, tw, 30);
    ctx.fillStyle = '#ffd9a0'; ctx.font = 'bold 16px system-ui'; ctx.fillText(w.banner, W / 2, 64);
    ctx.globalAlpha = 1;
  }

  // стрелки к квест-предметам
  {
    type QArrow = { wx: number; wy: number; emoji: string; color: string; margin: number };
    const targets: QArrow[] = [];
    if (!w.riddleSolved[0]) targets.push({ wx: RIDDLE_DEFS[0].x, wy: RIDDLE_DEFS[0].y, emoji: '📜', color: '#60c8ff', margin: 58 });
    if (!w.riddleSolved[1]) targets.push({ wx: RIDDLE_DEFS[1].x, wy: RIDDLE_DEFS[1].y, emoji: '🗝️', color: '#c07cff', margin: 80 });
    if (w.fortressKeyLoot)  targets.push({ wx: w.fortressKeyLoot.x, wy: w.fortressKeyLoot.y, emoji: '🔑', color: '#ffd700', margin: 102 });
    const pulse = 0.65 + 0.35 * Math.sin(w.playTime * 4);
    for (const t of targets) {
      const ang = Math.atan2(t.wy - w.py, t.wx - w.px);
      const ca = Math.cos(ang), sa = Math.sin(ang);
      const edgeDist = Math.min(
        (W / 2 - t.margin) / (Math.abs(ca) || 0.001),
        (H / 2 - t.margin) / (Math.abs(sa) || 0.001),
      );
      const ax = W / 2 + ca * edgeDist, ay = H / 2 + sa * edgeDist;
      const verst = Math.max(1, Math.round(Math.hypot(t.wx - w.px, t.wy - w.py) / 90));
      ctx.save();
      ctx.globalAlpha = pulse;
      ctx.shadowColor = t.color; ctx.shadowBlur = 16;
      ctx.translate(ax, ay); ctx.rotate(ang);
      ctx.fillStyle = t.color;
      ctx.beginPath(); ctx.moveTo(18, 0); ctx.lineTo(-8, -9); ctx.lineTo(-8, 9); ctx.closePath();
      ctx.fill();
      ctx.restore();
      ctx.globalAlpha = pulse;
      ctx.font = 'bold 12px system-ui'; ctx.fillStyle = t.color;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.shadowColor = '#000'; ctx.shadowBlur = 4;
      ctx.fillText(`${t.emoji} ~${verst}в`, W / 2 + ca * (edgeDist - 30), H / 2 + sa * (edgeDist - 30));
      ctx.shadowBlur = 0; ctx.globalAlpha = 1;
    }
    ctx.textBaseline = 'alphabetic';
  }

  // инвентарь (9 слотов снизу)
  const n = 9, box = 52, gap = 8, totW = n * box + (n - 1) * gap;
  const sx = W / 2 - totW / 2, sy = H - box - 18;
  for (let i = 0; i < n; i++) {
    const x = sx + i * (box + gap);
    ctx.fillStyle = i === w.equipped ? '#d9775744' : '#000000aa';
    ctx.strokeStyle = i === w.equipped ? '#d97757' : '#ffffff33';
    ctx.lineWidth = i === w.equipped ? 3 : 1;
    ctx.fillRect(x, sy, box, box); ctx.strokeRect(x, sy, box, box);
    ctx.fillStyle = '#fff9'; ctx.font = '11px system-ui'; ctx.textAlign = 'left'; ctx.fillText(String(i + 1), x + 5, sy + 14);
    const sl = w.inv[i];
    if (sl) {
      ctx.font = '24px system-ui'; ctx.textAlign = 'center'; ctx.fillText(ITEMS[sl.item].emoji, x + box / 2, sy + box / 2 + 8);
      if (sl.count > 1) { ctx.font = 'bold 12px system-ui'; ctx.textAlign = 'right'; ctx.fillStyle = '#ffd9a0'; ctx.fillText(`×${sl.count}`, x + box - 4, sy + box - 5); }
    }
  }
  ctx.textAlign = 'left';
}

// ════════════════════════════ СТИЛИ ════════════════════════════
const overlay: React.CSSProperties = { position: 'fixed', inset: 0, zIndex: 9999, background: '#0c0d11', color: '#e8e6e1', overflow: 'hidden' };
const playBtn: React.CSSProperties = { background: '#d97757', color: '#fff', border: 'none', borderRadius: 12, padding: '14px 28px', fontSize: 18, fontWeight: 800, letterSpacing: 1, cursor: 'pointer' };
const exitBtn: React.CSSProperties = { position: 'absolute', top: 14, right: 16, background: '#000000aa', color: '#fff', border: '1px solid #ffffff33', borderRadius: 10, padding: '8px 12px', fontSize: 13, cursor: 'pointer' };
const overPanel: React.CSSProperties = { position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 'min(560px,92vw)', background: '#141519ee', border: '1px solid #2a2d35', borderRadius: 18, padding: 32, textAlign: 'center', boxShadow: '0 20px 80px #000c' };
