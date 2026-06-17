// QASQYR — текстовая survival-игра. Чистая игровая логика (без React).
// Степь Казахстана, XIX век. Вирус "Карасан". Двое иммунных друзей идут к крепости-лаборатории.

// ───────────────────────────── ТИПЫ ─────────────────────────────

export type CharacterId = 'baha' | 'erlan';

export type ItemId =
  | 'food' | 'medkit' | 'herb' | 'cloth' | 'wood' | 'metal' | 'spirit'
  | 'knife' | 'club' | 'rifle' | 'revolver' | 'ammo'
  | 'torch' | 'molotov' | 'spike_trap' | 'map'
  | 'code_scroll' | 'lockpick' | 'fortress_key';

export type Phase = 'morning' | 'day' | 'dusk' | 'night';

export type GameStatus = 'menu' | 'playing' | 'won' | 'lost';

export interface ItemMeta {
  name: string;
  emoji: string;
  stackable: boolean;
  kind: 'food' | 'heal' | 'material' | 'melee' | 'ranged' | 'ammo' | 'tool' | 'throw' | 'quest';
  damage?: number;     // для оружия
  ranged?: boolean;
}

export interface Slot {
  item: ItemId;
  count: number;
}

export interface Enemy {
  id: string;
  name: string;
  emoji: string;
  hp: number;
  maxHp: number;
  damage: number;
  kind: 'zombie' | 'wolf' | 'boss';
  blind?: boolean;     // ориентируется на звук (Сокыр)
  explodes?: boolean;  // взрывается при смерти (Жарылыс)
}

export interface GameState {
  status: GameStatus;
  character: CharacterId | null;
  hp: number;
  maxHp: number;
  day: number;
  phase: Phase;
  distance: number;        // км до крепости (старт 100, победа на 0)
  inventory: (Slot | null)[];  // ровно 9 слотов
  equipped: number | null;     // индекс слота с экипированным оружием
  log: string[];
  encounter: Enemy | null;
  companionAlive: boolean;
  exposure: number;        // накопленное заражение (косметика/давление, не убивает иммунных)
  mission: number;         // индекс текущей сюжетной вехи
  flags: Record<string, boolean>;
  ended?: EndingId;
}

export type EndingId = 'vaccine' | 'price' | 'selfish' | 'ashes' | 'wolves';

// ───────────────────────────── КОНТЕНТ ─────────────────────────────

export const ITEMS: Record<ItemId, ItemMeta> = {
  food:       { name: 'Вяленое мясо',   emoji: '🍖', stackable: true,  kind: 'food' },
  medkit:     { name: 'Аптечка',        emoji: '💊', stackable: true,  kind: 'heal' },
  herb:       { name: 'Степная трава',  emoji: '🌿', stackable: true,  kind: 'material' },
  cloth:      { name: 'Тряпьё',         emoji: '🧵', stackable: true,  kind: 'material' },
  wood:       { name: 'Дерево',         emoji: '🪵', stackable: true,  kind: 'material' },
  metal:      { name: 'Металл',         emoji: '⛓️', stackable: true,  kind: 'material' },
  spirit:     { name: 'Спирт',          emoji: '🍶', stackable: true,  kind: 'material' },
  knife:      { name: 'Нож',            emoji: '🔪', stackable: false, kind: 'melee',  damage: 18 },
  club:       { name: 'Дубина',         emoji: '🏏', stackable: false, kind: 'melee',  damage: 26 },
  rifle:      { name: 'Кремнёвое ружьё',emoji: '🔫', stackable: false, kind: 'ranged', damage: 55, ranged: true },
  revolver:   { name: 'Револьвер',      emoji: '🔫', stackable: false, kind: 'ranged', damage: 38, ranged: true },
  ammo:       { name: 'Патроны',        emoji: '🧨', stackable: true,  kind: 'ammo' },
  torch:      { name: 'Факел',          emoji: '🔥', stackable: false, kind: 'tool' },
  molotov:    { name: 'Коктейль',       emoji: '🍾', stackable: true,  kind: 'throw' },
  spike_trap: { name: 'Ловушка',        emoji: '🪤', stackable: true,  kind: 'throw' },
  map:        { name: 'Карта крепости', emoji: '🗺️', stackable: false, kind: 'quest' },
  code_scroll: { name: 'Код ворот',      emoji: '📜', stackable: false, kind: 'quest' },
  lockpick:    { name: 'Отмычка',       emoji: '🗝️', stackable: false, kind: 'quest' },
  fortress_key:{ name: 'Ключ крепости', emoji: '🔑', stackable: false, kind: 'quest' },
};

export const RECIPES: { id: string; result: ItemId; cost: Partial<Record<ItemId, number>>; label: string }[] = [
  { id: 'medkit',  result: 'medkit',  cost: { herb: 2, cloth: 1 },             label: 'Аптечка (🌿×2 + 🧵×1)' },
  { id: 'molotov', result: 'molotov', cost: { spirit: 1, cloth: 1 },           label: 'Коктейль (🍶×1 + 🧵×1)' },
  { id: 'trap',    result: 'spike_trap', cost: { wood: 2, metal: 1 },          label: 'Ловушка (🪵×2 + ⛓️×1)' },
  { id: 'torch',   result: 'torch',   cost: { wood: 1, cloth: 1, spirit: 1 },  label: 'Факел (🪵+🧵+🍶)' },
  { id: 'ammo',    result: 'ammo',    cost: { spirit: 1, metal: 1 },           label: 'Патроны (🍶×1 + ⛓️×1)' },
];

export const CHARACTERS: Record<CharacterId, { name: string; full: string; perk: string; emoji: string }> = {
  baha:  { name: 'Баха',  full: 'Бахыт «Баха» Жолдыбай', emoji: '🕷️',
           perk: 'Хитрый и ловкий: лучше стелс и побег, чаще удачный крафт.' },
  erlan: { name: 'Ерлан', full: 'Ерлан «Медведь» Тасбулат', emoji: '💀',
           perk: 'Сильный и крепкий: +HP и +урон в ближнем бою.' },
};

// Шутливые реплики друзей — вставляются между событиями
export const BANTER: string[] = [
  'Баха: «Я не убегаю — я стратегически отступаю!»',
  'Ерлан: «Баха, а памятник нам поставят?» — Баха: «Тебе — поменьше. Камень дорогой.»',
  'Баха: «План простой.» Ерлан: «Как прошлый раз?» Баха: «...Не будем о прошлом разе.»',
  'Ерлан принял старый сапог за съедобное. Баха молча отобрал.',
  'Баха: «Слушай меня — и мы выживем.» (Степь зловеще молчит.)',
  'Ерлан: «Я не боюсь темноты. Я её... уважаю.»',
  'Баха: «Если что — беги ты, а я тебя морально поддержу. Издалека.»',
  'Ерлан спел колыбельную зомби. Зомби, кажется, обиделся.',
];

// ───────────────────────────── УТИЛИТЫ ─────────────────────────────

const PHASES: Phase[] = ['morning', 'day', 'dusk', 'night'];
export const PHASE_LABEL: Record<Phase, string> = {
  morning: '🌅 Утро', day: '☀️ День', dusk: '🌇 Сумерки', night: '🌑 Ночь',
};

export function isNight(s: GameState): boolean {
  return s.phase === 'night' || s.phase === 'dusk';
}

function rnd(n: number): number { return Math.floor(Math.random() * n); }
function pick<T>(arr: T[]): T { return arr[rnd(arr.length)]; }
function chance(p: number): boolean { return Math.random() < p; }

function clone(s: GameState): GameState {
  return {
    ...s,
    inventory: s.inventory.map((sl) => (sl ? { ...sl } : null)),
    log: [...s.log],
    encounter: s.encounter ? { ...s.encounter } : null,
    flags: { ...s.flags },
  };
}

function logLine(s: GameState, line: string) {
  s.log.push(line);
  if (s.log.length > 120) s.log.shift();
}

// ── Инвентарь ──
function findStack(s: GameState, item: ItemId): number {
  return s.inventory.findIndex((sl) => sl && sl.item === item);
}
function emptySlot(s: GameState): number {
  return s.inventory.findIndex((sl) => sl === null);
}
export function countItem(s: GameState, item: ItemId): number {
  return s.inventory.reduce((acc, sl) => acc + (sl && sl.item === item ? sl.count : 0), 0);
}

/** Пытается добавить предмет. Возвращает false, если инвентарь полон. */
export function addItem(s: GameState, item: ItemId, count = 1): boolean {
  const meta = ITEMS[item];
  if (meta.stackable) {
    const i = findStack(s, item);
    if (i >= 0) { s.inventory[i]!.count += count; return true; }
  }
  const e = emptySlot(s);
  if (e < 0) return false;
  s.inventory[e] = { item, count: meta.stackable ? count : 1 };
  return true;
}

function removeItem(s: GameState, item: ItemId, count = 1): boolean {
  const i = findStack(s, item);
  if (i < 0) return false;
  const sl = s.inventory[i]!;
  if (sl.count < count) return false;
  sl.count -= count;
  if (sl.count <= 0) {
    s.inventory[i] = null;
    if (s.equipped === i) s.equipped = null;
  }
  return true;
}

// ───────────────────────────── СТАРТ ─────────────────────────────

export function newGame(): GameState {
  return {
    status: 'menu',
    character: null,
    hp: 100, maxHp: 100,
    day: 1, phase: 'morning',
    distance: 100,
    inventory: Array(9).fill(null),
    equipped: null,
    log: [],
    encounter: null,
    companionAlive: true,
    exposure: 0,
    mission: 0,
    flags: {},
  };
}

export function startGame(_prev: GameState, character: CharacterId): GameState {
  const s = newGame();
  s.status = 'playing';
  s.character = character;
  if (character === 'erlan') { s.maxHp = 130; s.hp = 130; }
  const c = CHARACTERS[character];
  // Стартовый набор
  addItem(s, 'knife');
  addItem(s, 'food', 2);
  addItem(s, 'cloth', 2);
  s.equipped = findStack(s, 'knife');

  logLine(s, `🌾 Степь, 1873 год. Ты — ${c.full}.`);
  logLine(s, 'Вы с другом проспали в стогу сена ночь, когда заражённые волки вырезали аул.');
  logLine(s, 'Наутро — тишина и трупы. Вы двое. И вы почему-то ещё живы.');
  logLine(s, '👴 Лекарь-табиб перед смертью: «Ваша кровь — лекарство. Идите на север, в крепость. 100 вёрст.»');
  logLine(s, pick(BANTER));
  return s;
}

// ───────────────────────────── ВРЕМЯ ─────────────────────────────

function advanceTime(s: GameState) {
  const i = PHASES.indexOf(s.phase);
  if (i === PHASES.length - 1) { s.phase = 'morning'; s.day += 1; logLine(s, `📅 Наступил день ${s.day}.`); }
  else s.phase = PHASES[i + 1];
}

// ───────────────────────────── ВРАГИ ─────────────────────────────

function spawnEnemy(s: GameState): Enemy {
  const night = isNight(s);
  const roll = Math.random();

  // Ночью выше шанс волков
  if (night && roll < 0.45) {
    return { id: 'wolf', name: 'Заражённый волк', emoji: '🐺', hp: 45, maxHp: 45, damage: 22, kind: 'wolf' };
  }
  if (roll < 0.28) return { id: 'shala', name: 'Шала (полузаражённый)', emoji: '🧟', hp: 40, maxHp: 40, damage: 14, kind: 'zombie' };
  if (roll < 0.5)  return { id: 'sokyr', name: 'Сокыр (слепой)', emoji: '🧟‍♂️', hp: 55, maxHp: 55, damage: 20, kind: 'zombie', blind: true };
  if (roll < 0.7)  return { id: 'jarylys', name: 'Жарылыс (вздутый)', emoji: '🤢', hp: 35, maxHp: 35, damage: 10, kind: 'zombie', explodes: true };
  if (roll < 0.85) return { id: 'wolf', name: 'Заражённый волк', emoji: '🐺', hp: 45, maxHp: 45, damage: 22, kind: 'wolf' };
  return { id: 'alyp', name: 'Алып (великан)', emoji: '👹', hp: 110, maxHp: 110, damage: 30, kind: 'zombie' };
}

function spawnBoss(distance: number): Enemy {
  if (distance > 60) return { id: 'akbori', name: 'АҚ БӨРІ — Белый Волк', emoji: '🐺👑', hp: 180, maxHp: 180, damage: 28, kind: 'boss' };
  if (distance > 20) return { id: 'batyr', name: 'Заражённый Батыр в латах', emoji: '⚔️', hp: 240, maxHp: 240, damage: 34, kind: 'boss' };
  return { id: 'ana', name: 'АНА — Мать заразы', emoji: '🕷️', hp: 320, maxHp: 320, damage: 40, kind: 'boss' };
}

// ───────────────────────────── ДЕЙСТВИЯ НА КАРТЕ ─────────────────────────────

const LOOT_TABLE: ItemId[] = [
  'food', 'food', 'herb', 'herb', 'cloth', 'cloth', 'wood', 'metal',
  'spirit', 'ammo', 'medkit', 'revolver', 'club',
];

function maybeBanter(s: GameState) {
  if (chance(0.35)) logLine(s, pick(BANTER));
}

function maybeEncounter(s: GameState, baseChance: number): boolean {
  const c = baseChance * (isNight(s) ? 1.7 : 1);
  if (chance(c)) {
    s.encounter = spawnEnemy(s);
    logLine(s, `⚠️ Из ${isNight(s) ? 'темноты' : 'травы'} выходит: ${s.encounter.emoji} ${s.encounter.name}!`);
    if (s.encounter.blind) logLine(s, 'Он слеп — реагирует на ЗВУК. Можно тихо ускользнуть.');
    return true;
  }
  return false;
}

export type Direction = 'north' | 'south' | 'west' | 'east';

const DIR_INFO: Record<Direction, { label: string; arrow: string }> = {
  north: { label: 'вперёд, на север', arrow: '⬆️' },
  south: { label: 'назад, на юг',    arrow: '⬇️' },
  west:  { label: 'влево, на запад',  arrow: '⬅️' },
  east:  { label: 'вправо, на восток',arrow: '➡️' },
};

/** Попытка найти лут на месте. */
function tryLoot(s: GameState, p = 0.7) {
  if (chance(p)) {
    const item = pick(LOOT_TABLE);
    const cnt = ITEMS[item].stackable ? 1 + rnd(2) : 1;
    if (addItem(s, item, cnt)) logLine(s, `🎒 Найдено: ${ITEMS[item].emoji} ${ITEMS[item].name} ×${cnt}.`);
    else logLine(s, `Нашёл ${ITEMS[item].name}, но инвентарь полон (9/9). Освободи слот.`);
  } else {
    logLine(s, 'Здесь пусто — только ветер да кости.');
  }
}

/** Единое направленное движение W/A/S/D. */
export function move(prev: GameState, dir: Direction): GameState {
  const s = clone(prev);
  if (s.status !== 'playing' || s.encounter) return prev;
  const info = DIR_INFO[dir];

  // ── ВПЕРЁД (W): продвижение к крепости + босс-вехи + финал ──
  if (dir === 'north') {
    const bossGates = [70, 30, 0];
    const step = 8 + rnd(8); // 8..15 вёрст
    const newDist = Math.max(0, s.distance - step);

    for (const gate of bossGates) {
      if (s.distance > gate && newDist <= gate && !s.flags['boss@' + gate]) {
        s.flags['boss@' + gate] = true;
        s.distance = Math.max(newDist, gate);
        s.encounter = spawnBoss(s.distance);
        logLine(s, `${info.arrow} Идёте ${info.label}...`);
        logLine(s, `🛑 Дорогу преграждает БОСС: ${s.encounter.emoji} ${s.encounter.name}!`);
        advanceTime(s);
        return s;
      }
    }
    s.distance = newDist;
    logLine(s, `${info.arrow} Прошли ${step} вёрст ${info.label}. До крепости: ${s.distance}.`);
    if (s.distance === 0) {
      s.encounter = spawnBoss(0);
      logLine(s, '🏰 Вы у крепости-лаборатории. В её недрах что-то огромное шевелится...');
      logLine(s, `🛑 ${s.encounter.emoji} ${s.encounter.name} пробуждается!`);
      advanceTime(s);
      return s;
    }
    maybeEncounter(s, 0.5);
    maybeBanter(s);
    advanceTime(s);
    return s;
  }

  // ── НАЗАД (S): отступление, дальше от цели, но спокойнее ──
  if (dir === 'south') {
    const step = 5 + rnd(6);
    s.distance = Math.min(100, s.distance + step);
    logLine(s, `${info.arrow} Отступаете ${info.label} на ${step} вёрст. До крепости: ${s.distance}.`);
    tryLoot(s, 0.6);
    maybeEncounter(s, 0.3);
    advanceTime(s);
    return s;
  }

  // ── ВЛЕВО/ВПРАВО (A/D): разведка флангов, поиск ресурсов ──
  logLine(s, `${info.arrow} Сворачиваете ${info.label}, осматривая местность.`);
  tryLoot(s, 0.8);
  maybeEncounter(s, 0.4);
  maybeBanter(s);
  advanceTime(s);
  return s;
}

export function rest(prev: GameState): GameState {
  const s = clone(prev);
  if (s.status !== 'playing' || s.encounter) return prev;

  if (isNight(s)) {
    logLine(s, '🔥 Привал ночью — рискованно. Вы жжёте костёр...');
    if (chance(0.6)) {
      s.encounter = spawnEnemy(s);
      logLine(s, `Свет костра привлёк: ${s.encounter.emoji} ${s.encounter.name}!`);
      advanceTime(s);
      return s;
    }
  }
  if (countItem(s, 'food') > 0) {
    removeItem(s, 'food', 1);
    const heal = 25 + rnd(15);
    s.hp = Math.min(s.maxHp, s.hp + heal);
    logLine(s, `🍖 Вы поели и отдохнули. +${heal} HP.`);
  } else {
    s.hp = Math.max(1, s.hp - 5);
    logLine(s, '😣 Еды нет. Сон голодным не лечит. −5 HP.');
  }
  maybeBanter(s);
  advanceTime(s);
  return s;
}

// ───────────────────────────── КРАФТ / ПРЕДМЕТЫ ─────────────────────────────

export function craft(prev: GameState, recipeId: string): GameState {
  const s = clone(prev);
  const r = RECIPES.find((x) => x.id === recipeId);
  if (!r || s.status !== 'playing') return prev;

  const ok = Object.entries(r.cost).every(([it, n]) => countItem(s, it as ItemId) >= (n as number));
  if (!ok) { logLine(s, `❌ Не хватает материалов для: ${ITEMS[r.result].name}.`); return s; }
  if (emptySlot(s) < 0 && !(ITEMS[r.result].stackable && findStack(s, r.result) >= 0)) {
    logLine(s, '❌ Инвентарь полон — некуда положить результат.'); return s;
  }

  // Баха иногда крафтит "в подарок" — двойной выход
  const lucky = s.character === 'baha' && chance(0.25);
  for (const [it, n] of Object.entries(r.cost)) removeItem(s, it as ItemId, n as number);
  addItem(s, r.result, lucky ? 2 : 1);
  logLine(s, `🔨 Скрафчено: ${ITEMS[r.result].emoji} ${ITEMS[r.result].name}${lucky ? ' ×2 (повезло!)' : ''}.`);
  return s;
}

export function useSlot(prev: GameState, index: number): GameState {
  const s = clone(prev);
  const sl = s.inventory[index];
  if (!sl || s.status !== 'playing') return prev;
  const meta = ITEMS[sl.item];

  if (meta.kind === 'melee' || meta.kind === 'ranged') {
    s.equipped = index;
    logLine(s, `🗡️ Экипировано: ${meta.emoji} ${meta.name}.`);
    return s;
  }
  if (meta.kind === 'heal') {
    removeItem(s, sl.item, 1);
    const heal = 40;
    s.hp = Math.min(s.maxHp, s.hp + heal);
    logLine(s, `💊 Лечение. +${heal} HP (теперь ${s.hp}/${s.maxHp}).`);
    return s;
  }
  if (meta.kind === 'food') {
    removeItem(s, sl.item, 1);
    s.hp = Math.min(s.maxHp, s.hp + 15);
    logLine(s, '🍖 Перекус. +15 HP.');
    return s;
  }
  if (meta.kind === 'tool' && sl.item === 'torch') {
    s.flags.torch = !s.flags.torch;
    logLine(s, s.flags.torch ? '🔥 Факел зажжён. Видно дальше — но и тебя видно.' : 'Факел потушен.');
    return s;
  }
  if (meta.kind === 'throw' || meta.kind === 'material' || meta.kind === 'ammo' || meta.kind === 'quest') {
    logLine(s, `${meta.emoji} ${meta.name}: пригодится для крафта или боя.`);
    return s;
  }
  return s;
}

// ───────────────────────────── БОЙ ─────────────────────────────

function enemyTurn(s: GameState) {
  const e = s.encounter!;
  if (e.hp <= 0) return;
  let dmg = e.damage + rnd(6) - 3;
  if (s.character === 'erlan') dmg = Math.round(dmg * 0.85); // крепче
  s.hp -= dmg;
  s.exposure = Math.min(100, s.exposure + (e.kind === 'wolf' ? 3 : 2));
  logLine(s, `💥 ${e.name} бьёт. −${dmg} HP (осталось ${Math.max(0, s.hp)}).`);
  if (s.hp <= 0) loseGame(s, `Вас одолел ${e.name}.`);
}

function killEnemy(s: GameState) {
  const e = s.encounter!;
  logLine(s, `☠️ ${e.name} повержен.`);
  if (e.explodes) {
    const dmg = 18;
    s.hp -= dmg;
    s.exposure = Math.min(100, s.exposure + 10);
    logLine(s, `🤢 Тело лопается облаком спор! −${dmg} HP.`);
    if (s.hp <= 0) { loseGame(s, 'Споры Жарылыса добили вас.'); return; }
  }
  // награда
  if (e.kind === 'boss') handleBossDefeat(s, e);
  else if (chance(0.6)) {
    const drop = pick(['food', 'cloth', 'ammo', 'metal'] as ItemId[]);
    if (addItem(s, drop)) logLine(s, `🎒 С добычи: ${ITEMS[drop].emoji} ${ITEMS[drop].name}.`);
  }
  s.encounter = null;
}

export function attack(prev: GameState): GameState {
  const s = clone(prev);
  const e = s.encounter;
  if (!e || s.status !== 'playing') return prev;

  const wepSlot = s.equipped != null ? s.inventory[s.equipped] : null;
  const wep = wepSlot ? ITEMS[wepSlot.item] : null;

  let dmg: number;
  if (wep && wep.ranged) {
    if (countItem(s, 'ammo') <= 0) { logLine(s, '🔫 Нет патронов! Нажми R для перезарядки или дерись врукопашную.'); return s; }
    removeItem(s, 'ammo', 1);
    dmg = (wep.damage ?? 30) + rnd(15);
    logLine(s, `🔫 Выстрел! −${dmg}. (Звук разнёсся по степи...)`);
    if (e.blind || chance(0.4)) logLine(s, 'Грохот может привлечь ещё тварей.');
  } else if (wep) {
    dmg = (wep.damage ?? 12) + rnd(8);
    if (s.character === 'erlan') dmg = Math.round(dmg * 1.4); // Медведь силён
    logLine(s, `🗡️ Удар ${wep.name}. −${dmg}.`);
  } else {
    dmg = 6 + rnd(6);
    logLine(s, `👊 Удар кулаком. −${dmg}.`);
  }

  e.hp -= dmg;
  if (e.hp <= 0) { killEnemy(s); return s; }
  enemyTurn(s);
  return s;
}

export function reload(prev: GameState): GameState {
  const s = clone(prev);
  if (s.status !== 'playing') return prev;
  const wepSlot = s.equipped != null ? s.inventory[s.equipped] : null;
  const wep = wepSlot ? ITEMS[wepSlot.item] : null;
  if (!wep || !wep.ranged) { logLine(s, 'Нечего перезаряжать — нет дальнобойного оружия.'); return s; }
  if (countItem(s, 'ammo') <= 0) { logLine(s, 'Патронов нет совсем. Скрафти из 🍶+⛓️.'); return s; }
  logLine(s, '🔁 Оружие готово к стрельбе.');
  if (s.encounter) enemyTurn(s); // перезарядка в бою стоит хода
  return s;
}

export function stealthKill(prev: GameState): GameState {
  const s = clone(prev);
  const e = s.encounter;
  if (!e || s.status !== 'playing') return prev;
  if (e.kind === 'boss') { logLine(s, 'Босса со спины не снять — он слишком огромен.'); return s; }

  let p = 0.45;
  if (s.character === 'baha') p += 0.25;  // ловкий
  if (e.blind) p += 0.2;                  // слепого проще
  if (s.flags.torch) p -= 0.2;            // факел демаскирует
  if (chance(p)) {
    logLine(s, `🤫 Тихое убийство со спины! ${e.name} падает беззвучно.`);
    killEnemy(s);
  } else {
    logLine(s, '😱 Хрустнула ветка — тебя заметили!');
    enemyTurn(s);
  }
  return s;
}

export function throwMolotov(prev: GameState): GameState {
  const s = clone(prev);
  const e = s.encounter;
  if (!e || s.status !== 'playing') return prev;
  if (countItem(s, 'molotov') <= 0) { logLine(s, 'Нет коктейлей. Скрафти 🍶+🧵.'); return s; }
  removeItem(s, 'molotov', 1);
  const dmg = 60 + rnd(30);
  e.hp -= dmg;
  logLine(s, `🍾🔥 Огненный коктёль! −${dmg}.`);
  if (e.hp <= 0) { killEnemy(s); return s; }
  enemyTurn(s);
  return s;
}

export function flee(prev: GameState): GameState {
  const s = clone(prev);
  const e = s.encounter;
  if (!e || s.status !== 'playing') return prev;
  if (e.kind === 'boss') { logLine(s, 'От босса не убежать — дерись или умри.'); enemyTurn(s); return s; }

  let p = 0.5;
  if (s.character === 'baha') p += 0.25;
  if (e.kind === 'wolf') p -= 0.15; // волки быстрые
  if (e.blind && !s.flags.torch) p += 0.25; // от слепого тихо уйти легко
  if (chance(p)) {
    logLine(s, '🏃 Вы оторвались и скрылись в высокой траве.');
    s.encounter = null;
    advanceTime(s);
  } else {
    logLine(s, '❌ Сбежать не вышло — тварь догоняет!');
    enemyTurn(s);
  }
  return s;
}

// ───────────────────────────── БОССЫ И ФИНАЛ ─────────────────────────────

function handleBossDefeat(s: GameState, e: Enemy) {
  if (e.id === 'akbori') {
    logLine(s, '🏆 Белый Волк рухнул. Стая разбежалась. Вы нашли при нём 🗺️ карту крепости.');
    addItem(s, 'map');
    s.flags.akbori = true;
  } else if (e.id === 'batyr') {
    logLine(s, '🏆 Латник пал. За воротами — лаборатория. Вы почти у цели.');
    s.flags.batyr = true;
  } else if (e.id === 'ana') {
    logLine(s, '🏆 АНА содрогается и замирает. Источник заразы перед вами. Что теперь?');
    s.flags.anaDefeated = true;
    s.encounter = null;
    s.flags.finalChoice = true; // открыть финальный выбор
    return;
  }
}

/** Доступен ли финальный выбор (после победы над Аной). */
export function canChooseEnding(s: GameState): boolean {
  return !!s.flags.finalChoice && !s.encounter && s.status === 'playing';
}

export function chooseEnding(prev: GameState, choice: 'give' | 'refuse' | 'destroy'): GameState {
  const s = clone(prev);
  if (!canChooseEnding(s)) return prev;

  // выживание напарника зависит от того, насколько потрёпан игрок
  const companionSurvives = s.hp > 45 || chance(0.5);
  s.companionAlive = companionSurvives;

  if (choice === 'give') {
    if (companionSurvives) endGame(s, 'vaccine');
    else endGame(s, 'price');
  } else if (choice === 'refuse') {
    endGame(s, 'selfish');
  } else {
    endGame(s, 'ashes');
  }
  return s;
}

const ENDINGS: Record<EndingId, { title: string; text: string }> = {
  vaccine: {
    title: '🩸 Концовка «Вакцина» (хорошая)',
    text: 'Кровь обоих друзей дала лекарство. Военные врачи начали вакцинацию. Весной вы вдвоём идёте по ожившей степи. Баха: «Я же говорил — у меня был план».',
  },
  price: {
    title: '💔 Концовка «Цена» (горько-сладкая)',
    text: 'Друг погиб, прикрыв тебя в последнем бою. Твоей крови хватило за двоих — мир спасён. Но у двух могил одна осталась пустой: для тебя, «когда-нибудь».',
  },
  selfish: {
    title: '🕳️ Концовка «Эгоист» (тёмная)',
    text: 'Ты отказался отдать кровь — «это моё». Сбежал в чистую долину и живёшь. Один. Совсем один. Навсегда.',
  },
  ashes: {
    title: '🔥 Концовка «Пепел» (неоднозначная)',
    text: 'Ты сжёг лабораторию вместе с источником. Вирус остановлен в огне, но лекарства не будет — выжившим придётся справляться самим. Дым над степью виден за версту.',
  },
  wolves: {
    title: '🐺 Концовка «Волки» (плохая)',
    text: 'Степь забрала вас раньше, чем вы дошли. Где-то воет стая. Karasan победил.',
  },
};

export function endingText(id: EndingId) { return ENDINGS[id]; }

function endGame(s: GameState, id: EndingId) {
  s.status = 'won';
  s.ended = id;
  const e = ENDINGS[id];
  logLine(s, `\n=== ФИНАЛ ===\n${e.title}\n${e.text}`);
}

function loseGame(s: GameState, reason: string) {
  s.status = 'lost';
  s.ended = 'wolves';
  logLine(s, `\n💀 ${reason}`);
  logLine(s, ENDINGS.wolves.text);
}
