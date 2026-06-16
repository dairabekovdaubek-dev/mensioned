import { useEffect, useRef, useState } from 'react';
import { CHARACTERS, ITEMS, type CharacterId, type ItemId } from './engine';

// ════════════════════════════ 2D SURVIVAL — QASQYR ════════════════════════════
// Вид сверху, движение в реальном времени (WASD). Canvas на весь экран.

const WORLD_W = 3200;   // ширина мира (px)
const WORLD_H = 9000;   // высота: старт внизу, крепость наверху (y≈0)
const FORTRESS_Y = 160; // дойти сюда = победа

const WALK = 215;       // скорость ходьбы px/с
const SNEAK = 115;      // скорость крадучись

// ── Типы сущностей ──
type EnemyKind = 'shala' | 'sokyr' | 'jarylys' | 'alyp' | 'wolf';
interface Enemy { x: number; y: number; hp: number; maxHp: number; r: number; kind: EnemyKind; speed: number; dmg: number; hitFlash: number; }
interface Ally { x: number; y: number; hp: number; maxHp: number; r: number; cd: number; name: string; emoji: string; }
interface Loot { x: number; y: number; item: ItemId; r: number; }
interface Bullet { x: number; y: number; vx: number; vy: number; life: number; }
interface Slot { item: ItemId; count: number; }

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
  attackTimer: number;     // длительность взмаха
  attackCd: number;        // кулдаун
  wantsAttack: boolean;
  spawnTimer: number;
  hurtFlash: number;
  result: '' | 'win' | 'lose';
  banner: string;
  bannerT: number;
}

const ENEMY_DEFS: Record<EnemyKind, { hp: number; r: number; speed: number; dmg: number; color: string; emoji: string; name: string }> = {
  shala:   { hp: 40,  r: 16, speed: 95,  dmg: 16, color: '#6b8f3a', emoji: '🧟',   name: 'Шала' },
  sokyr:   { hp: 60,  r: 17, speed: 70,  dmg: 22, color: '#4a6b6b', emoji: '🧟‍♂️', name: 'Сокыр' },
  jarylys: { hp: 35,  r: 19, speed: 60,  dmg: 12, color: '#8a8f3a', emoji: '🤢',   name: 'Жарылыс' },
  alyp:    { hp: 130, r: 28, speed: 55,  dmg: 30, color: '#7a4a3a', emoji: '👹',   name: 'Алып' },
  wolf:    { hp: 45,  r: 15, speed: 205, dmg: 20, color: '#777',    emoji: '🐺',   name: 'Волк' },
};

const LOOT_TABLE: ItemId[] = ['food', 'medkit', 'herb', 'cloth', 'metal', 'spirit', 'ammo', 'ammo', 'revolver', 'club'];

// Подмога — союзники, что приходят на помощь
const ALLY_POOL: { name: string; emoji: string; hp: number }[] = [
  { name: 'Кочевник с берданкой', emoji: '🧔', hp: 70 },
  { name: 'Казак-разведчик', emoji: '💂', hp: 90 },
  { name: 'Охотник Степи', emoji: '🏹', hp: 80 },
  { name: 'Беглая знахарка', emoji: '🧕', hp: 60 },
  { name: 'Старый табиб', emoji: '👴', hp: 55 },
];

function hash(n: number): number { const x = Math.sin(n * 127.1) * 43758.5453; return x - Math.floor(x); }

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

// ════════════════════════════ КОМПОНЕНТ ════════════════════════════
export function QasqyrGame({ onExit }: { onExit?: () => void }) {
  const [screen, setScreen] = useState<'intro' | 'playing' | 'over'>('intro');
  const [chosen, setChosen] = useState<CharacterId>('baha');
  const [result, setResult] = useState<{ kind: 'win' | 'lose'; title: string; text: string } | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const worldRef = useRef<World | null>(null);
  const keysRef = useRef<Set<string>>(new Set());
  const mouseRef = useRef<{ x: number; y: number; down: boolean }>({ x: 0, y: 0, down: false });

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

  // ════════ ЭКРАН СЮЖЕТА ════════
  if (screen === 'intro') {
    return (
      <div id="qasqyr-root" style={overlay} >
        <div style={introCard}>
          <h1 style={{ fontSize: 44, letterSpacing: 2, margin: 0 }}>QASQYR</h1>
          <p style={{ color: '#d97757', margin: '2px 0 18px', fontWeight: 600 }}>Қасқыр · «Волк» — survival в степи</p>

          <div style={story}>
            <p><b>1873 год. Великая Степь.</b></p>
            <p>Караван кочевников шёл к зимовке, когда из гор пришли <i>бешеные волки</i> — с мутными глазами и чёрной пеной у пасти. Их укус нёс <b>«Карасан»</b> — чёрную заразу. Укушенный не умирал. Он менялся: чернели белки глаз, исчезал разум, и он бросался на живых.</p>
            <p>За одну зиму зараза выкосила аулы и города. К весне Степь стала кладбищем под открытым небом. А по ночам приходят <i>они</i>.</p>
            <p>Но вы двое в ту ночь так упились кумысом, что проспали резню в стогу сена — и наутро оказались единственными живыми. И единственными, кого вирус <b>не берёт</b>.</p>
            <p>Старый табиб перед смертью прошептал: <b>«Ваша кровь — лекарство. Идите на север, в крепость-лабораторию. Сто вёрст.»</b></p>
            <p style={{ color: '#d97757' }}>Дойдите. Через всю заражённую Степь.</p>
          </div>

          <p style={{ fontWeight: 700, margin: '8px 0 10px' }}>Выбери героя:</p>
          <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
            {(Object.keys(CHARACTERS) as CharacterId[]).map((id) => {
              const c = CHARACTERS[id]; const sel = chosen === id;
              return (
                <button key={id} onClick={() => setChosen(id)} style={{ ...charCard, borderColor: sel ? '#d97757' : '#33363f', background: sel ? '#d9775722' : '#1b1d24' }}>
                  <div style={{ fontSize: 34 }}>{c.emoji}</div>
                  <div style={{ fontWeight: 800 }}>{c.name}</div>
                  <div style={{ fontSize: 12, opacity: 0.75, lineHeight: 1.3 }}>{c.perk}</div>
                </button>
              );
            })}
          </div>

          <button onClick={() => startGame(chosen)} style={playBtn}>▶  ИГРАТЬ</button>
          <p style={{ fontSize: 12, opacity: 0.55, marginTop: 14 }}>
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
  w.time += dt / 90; // сутки = 90с
  if (w.time >= 1) { w.time -= 1; w.day += 1; banner(w, `📅 День ${w.day}`); }
  const night = w.time < 0.22 || w.time > 0.74;

  // движение
  w.sneaking = keys.has('shift');
  const sp = w.sneaking ? SNEAK : WALK;
  let dx = 0, dy = 0;
  if (keys.has('w')) dy -= 1; if (keys.has('s')) dy += 1;
  if (keys.has('a')) dx -= 1; if (keys.has('d')) dx += 1;
  const len = Math.hypot(dx, dy) || 1;
  w.px += (dx / len) * sp * dt;
  w.py += (dy / len) * sp * dt;
  w.px = Math.max(40, Math.min(WORLD_W - 40, w.px));
  w.py = Math.max(60, Math.min(WORLD_H - 60, w.py));
  if (dx || dy) w.facing = Math.atan2(dy, dx);

  // прицел к мыши
  w.aim = Math.atan2(mouse.y - window.innerHeight / 2, mouse.x - window.innerWidth / 2);

  // победа
  if (w.py <= FORTRESS_Y) { finish('win'); return; }

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

  // спавн врагов — постоянный поток на героя
  w.spawnTimer -= dt;
  const cap = night ? 32 : 20;
  if (w.spawnTimer <= 0 && w.enemies.length < cap) {
    w.spawnTimer = night ? 0.6 : 1.0;
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
    e.x += Math.cos(a) * e.speed * dt;
    e.y += Math.sin(a) * e.speed * dt;

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

// ════════════════════════════ РЕНДЕР ════════════════════════════
function render(ctx: CanvasRenderingContext2D, w: World) {
  const W = window.innerWidth, H = window.innerHeight;
  const camX = w.px - W / 2, camY = w.py - H / 2;
  const night = w.time < 0.22 || w.time > 0.74;
  const dusk = (w.time >= 0.22 && w.time < 0.3) || (w.time > 0.66 && w.time <= 0.74);

  // фон-степь
  ctx.fillStyle = night ? '#1a2417' : dusk ? '#5c6e3a' : '#7c9a48';
  ctx.fillRect(0, 0, W, H);

  // травяные кустики (детерминированно по сетке)
  const cell = 90;
  ctx.strokeStyle = night ? '#24331c' : '#6b8a3c';
  ctx.lineWidth = 2;
  const x0 = Math.floor(camX / cell), y0 = Math.floor(camY / cell);
  for (let gx = x0 - 1; gx < x0 + W / cell + 2; gx++) {
    for (let gy = y0 - 1; gy < y0 + H / cell + 2; gy++) {
      const h = hash(gx * 92.1 + gy * 13.7);
      if (h < 0.55) continue;
      const sx = gx * cell + hash(gx * 3.3 + gy) * cell - camX;
      const sy = gy * cell + hash(gy * 5.1 + gx) * cell - camY;
      ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx - 3, sy - 8); ctx.moveTo(sx, sy); ctx.lineTo(sx + 3, sy - 8); ctx.stroke();
    }
  }

  // крепость (наверху мира)
  const fy = FORTRESS_Y - camY;
  if (fy > -200 && fy < H + 200) {
    ctx.fillStyle = night ? '#2a2d34' : '#8a8275';
    ctx.fillRect(-camX + WORLD_W / 2 - 220, fy - 120, 440, 130);
    ctx.fillStyle = '#d97757';
    ctx.font = 'bold 26px system-ui'; ctx.textAlign = 'center';
    ctx.fillText('🏰 КРЕПОСТЬ-ЛАБОРАТОРИЯ', -camX + WORLD_W / 2, fy - 140);
    ctx.fillStyle = night ? '#3a3d44' : '#9a9285';
    ctx.fillRect(0 - camX, fy, WORLD_W, 14);
  }

  // лут
  for (const l of w.loot) {
    const sx = l.x - camX, sy = l.y - camY;
    if (sx < -40 || sx > W + 40 || sy < -40 || sy > H + 40) continue;
    ctx.font = '22px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.globalAlpha = 0.9; ctx.fillText('📦', sx, sy); ctx.globalAlpha = 1;
  }

  // пули
  ctx.fillStyle = '#ffe08a';
  for (const b of w.bullets) { ctx.beginPath(); ctx.arc(b.x - camX, b.y - camY, 4, 0, 7); ctx.fill(); }

  // враги
  for (const e of w.enemies) {
    const sx = e.x - camX, sy = e.y - camY;
    if (sx < -60 || sx > W + 60 || sy < -60 || sy > H + 60) continue;
    const d = ENEMY_DEFS[e.kind];
    ctx.beginPath(); ctx.arc(sx, sy, e.r, 0, 7);
    ctx.fillStyle = e.hitFlash > 0 ? '#fff' : d.color; ctx.fill();
    ctx.font = `${e.r + 6}px system-ui`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(d.emoji, sx, sy);
    // hp бар
    if (e.hp < e.maxHp) {
      ctx.fillStyle = '#000a'; ctx.fillRect(sx - e.r, sy - e.r - 9, e.r * 2, 4);
      ctx.fillStyle = '#d9534f'; ctx.fillRect(sx - e.r, sy - e.r - 9, e.r * 2 * (e.hp / e.maxHp), 4);
    }
  }

  // союзники (подмога)
  for (const al of w.allies) {
    const sx = al.x - camX, sy = al.y - camY;
    if (sx < -60 || sx > W + 60 || sy < -60 || sy > H + 60) continue;
    ctx.beginPath(); ctx.arc(sx, sy, al.r, 0, 7);
    ctx.fillStyle = '#3a7d44'; ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = '#9be7a8'; ctx.stroke();
    ctx.font = '20px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(al.emoji, sx, sy);
    ctx.fillStyle = '#000a'; ctx.fillRect(sx - al.r, sy - al.r - 8, al.r * 2, 4);
    ctx.fillStyle = '#5fb87a'; ctx.fillRect(sx - al.r, sy - al.r - 8, al.r * 2 * (al.hp / al.maxHp), 4);
  }

  // игрок
  const pcx = W / 2, pcy = H / 2;
  // взмах оружия
  if (w.attackTimer > 0) {
    ctx.strokeStyle = '#fff8'; ctx.lineWidth = 6;
    ctx.beginPath(); ctx.arc(pcx, pcy, 56, w.aim - 0.9, w.aim + 0.9); ctx.stroke();
  }
  ctx.beginPath(); ctx.arc(pcx, pcy, 17, 0, 7);
  ctx.fillStyle = w.hurtFlash > 0 ? '#ff6b6b' : (w.char === 'erlan' ? '#c98a4a' : '#4a90c9'); ctx.fill();
  ctx.font = '22px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(CHARACTERS[w.char].emoji, pcx, pcy);
  // ствол/прицел
  ctx.strokeStyle = '#fff9'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(pcx, pcy); ctx.lineTo(pcx + Math.cos(w.aim) * 26, pcy + Math.sin(w.aim) * 26); ctx.stroke();

  // тьма ночью + свет факела
  if (night || dusk) {
    const radius = night ? (w.torch ? 360 : 200) : (w.torch ? 460 : 320);
    const g = ctx.createRadialGradient(pcx, pcy, radius * 0.4, pcx, pcy, radius);
    const edge = night ? 0.92 : 0.6;
    g.addColorStop(0, 'rgba(8,10,16,0)');
    g.addColorStop(1, `rgba(6,8,14,${edge})`);
    ctx.fillStyle = `rgba(6,8,14,${edge})`; ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'destination-out';
    const hole = ctx.createRadialGradient(pcx, pcy, 0, pcx, pcy, radius);
    hole.addColorStop(0, 'rgba(0,0,0,1)'); hole.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = hole; ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'source-over';
    void g;
  }

  // урон-вспышка
  if (w.hurtFlash > 0) { ctx.fillStyle = `rgba(200,0,0,${w.hurtFlash * 0.5})`; ctx.fillRect(0, 0, W, H); }

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
  const verst = Math.max(0, Math.round((w.py - FORTRESS_Y) / (WORLD_H - FORTRESS_Y) * 100));
  const night = w.time < 0.22 || w.time > 0.74;
  ctx.textAlign = 'center'; ctx.fillStyle = '#fff'; ctx.font = 'bold 16px system-ui';
  ctx.fillText(`📅 День ${w.day}  ·  ${night ? '🌑 Ночь' : '☀️ День'}  ·  🧭 до крепости ${verst} вёрст  ·  ☠️ ${w.kills}`, W / 2, 30);

  // баннер
  if (w.bannerT > 0) {
    ctx.globalAlpha = Math.min(1, w.bannerT);
    ctx.fillStyle = '#000b'; const tw = ctx.measureText(w.banner).width + 40;
    ctx.fillRect(W / 2 - tw / 2, 44, tw, 30);
    ctx.fillStyle = '#ffd9a0'; ctx.font = 'bold 16px system-ui'; ctx.fillText(w.banner, W / 2, 64);
    ctx.globalAlpha = 1;
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
const introCard: React.CSSProperties = { position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 'min(760px, 92vw)', maxHeight: '92vh', overflowY: 'auto', background: '#141519', border: '1px solid #2a2d35', borderRadius: 20, padding: '32px 36px', boxShadow: '0 20px 80px #000a', textAlign: 'center' };
const story: React.CSSProperties = { textAlign: 'left', lineHeight: 1.6, fontSize: 15.5, color: '#cfccc6', background: '#0e0f13', border: '1px solid #23262e', borderRadius: 14, padding: '18px 22px', marginBottom: 22 };
const charCard: React.CSSProperties = { flex: 1, border: '2px solid', borderRadius: 14, padding: '16px 14px', cursor: 'pointer', color: '#e8e6e1', display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'center', textAlign: 'center' };
const playBtn: React.CSSProperties = { background: '#d97757', color: '#fff', border: 'none', borderRadius: 12, padding: '14px 28px', fontSize: 18, fontWeight: 800, letterSpacing: 1, cursor: 'pointer' };
const exitBtn: React.CSSProperties = { position: 'absolute', top: 14, right: 16, background: '#000000aa', color: '#fff', border: '1px solid #ffffff33', borderRadius: 10, padding: '8px 12px', fontSize: 13, cursor: 'pointer' };
const overPanel: React.CSSProperties = { position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 'min(560px,92vw)', background: '#141519ee', border: '1px solid #2a2d35', borderRadius: 18, padding: 32, textAlign: 'center', boxShadow: '0 20px 80px #000c' };
