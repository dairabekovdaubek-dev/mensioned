import { useCallback, useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react';
import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { supabase } from '../lib/supabase';

type WeaponKind = 'knife' | 'club' | 'sabre' | 'rifle';
type PickupKind = 'medkit' | 'crystal' | 'key' | 'code' | 'revive' | WeaponKind;
type EventKind = 'ambush' | 'storm' | 'rage' | 'starvation';
type GamePhase = 'intro' | 'tutorial' | 'playing' | 'won' | 'lost';
type Dimension = 'steppe' | 'hloddev';
type NpcMood = 'neutral' | 'evil' | 'good';
type DialogEffect = 'story' | 'heal' | 'medkit' | 'weapon' | 'damage' | 'steal' | 'ambush' | 'trade';
type Difficulty = 'story' | 'survival' | 'nightmare';
type MenuTab = 'modes' | 'skins' | 'shop';
type SkinRarity = 'Common' | 'Rare' | 'Epic' | 'Legendary';
type KnifeShape = 'butterfly' | 'stiletto' | 'karambit' | 'bowie' | 'gut' | 'bayonet';
type CaseOpening = { caseType: string; rewardName: string; rarity: SkinRarity; isPremium: boolean; nonce: number };
type VisionKind = '' | 'bloodmoon' | 'echo' | 'whiteout';
type DayPhase = 'dawn' | 'day' | 'dusk' | 'night';
type WalkMode = 'walk' | 'sneak' | 'sprint' | 'tired';
type LockableScreenOrientation = ScreenOrientation & {
  lock?: (orientation: 'landscape' | 'portrait') => Promise<void>;
  unlock?: () => void;
};

type Enemy = {
  mesh: THREE.Group;
  hp: number;
  speed: number;
  damage: number;
  hitTimer: number;
  animator?: CharacterAnimator;
};

type CharacterAnimationName = 'idle' | 'walk' | 'attack';
type OutfitRole = 'player' | 'enemy' | 'npc';
type OutfitKind = 'maleRanger' | 'femaleRanger' | 'malePeasant' | 'femalePeasant';
type MedievalPropKind = 'wagon' | 'crate' | 'woodFence' | 'metalFence' | 'roundDoor' | 'roundRoof' | 'vine' | 'chimney';
type MedievalExtraPropKind =
  | 'wallPlaster'
  | 'wallBrick'
  | 'wallWindow'
  | 'roofDormer'
  | 'roofTower'
  | 'roofWood'
  | 'floorBrick'
  | 'floorWood'
  | 'stairs'
  | 'doorFrame'
  | 'shutter'
  | 'brickPile'
  | 'vine2'
  | 'ornamentFence'
  | 'border'
  | 'support';

type CharacterAnimator = {
  mixer: THREE.AnimationMixer;
  actions: Partial<Record<CharacterAnimationName, THREE.AnimationAction>>;
  active: CharacterAnimationName | null;
};

type Pickup = {
  mesh: THREE.Object3D;
  kind: PickupKind;
};

type InventoryEntry = {
  kind: PickupKind;
  count: number;
};

type FakeFortress = {
  id: number;
  x: number;
  z: number;
  triggered: boolean;
  message: string;
};

type QuestItem = {
  x: number;
  z: number;
  collected: boolean;
};

function useMobileLayout() {
  const [mobile, setMobile] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(max-width: 760px), (pointer: coarse)').matches;
  });

  useEffect(() => {
    const query = window.matchMedia('(max-width: 760px), (pointer: coarse)');
    const update = () => setMobile(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  return mobile;
}

function usePortraitLayout() {
  const [portrait, setPortrait] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(orientation: portrait)').matches;
  });

  useEffect(() => {
    const query = window.matchMedia('(orientation: portrait)');
    const update = () => setPortrait(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  return portrait;
}

type NpcChoice = {
  text: string;
  reply: string;
  effect: DialogEffect;
};

type HouseNpc = {
  id: number;
  name: string;
  mood: NpcMood;
  x: number;
  z: number;
  title: string;
  story: string;
  choices: NpcChoice[];
  visited: boolean;
};

type DialogState = {
  npc: HouseNpc;
  step: number;
  lastReply: string;
};

type PhysicsObstacle = {
  key: string;
  x: number;
  z: number;
  radius: number;
  kind: 'solid' | 'water';
};

type DustPuff = {
  mesh: THREE.Mesh<THREE.CircleGeometry, THREE.MeshBasicMaterial>;
  life: number;
  age: number;
};

type StoryFlags = {
  trust: number;
  lore: number;
  risk: number;
  cruelty: number;
};

type SavedGameState = {
  player: { x: number; z: number };
  hp: number;
  score: number;
  dayTime: number;
  stamina: number;
  inventory: InventoryEntry[];
  selectedSlot: number;
  heldItem: PickupKind;
  weapon: WeaponKind;
  storyFlags: StoryFlags;
  key: QuestItem;
  code: QuestItem;
  revive: QuestItem;
  traderCoordsBought: boolean;
  companionRecruited: boolean;
  companionAlive: boolean;
  companionHp: number;
  houseVisitedIds: number[];
};

type GameProgressRow = {
  gold: number;
  diamonds: number;
  unlocked_skins: string[];
  selected_knife_skin_id: string;
  difficulty: Difficulty;
  game_state: SavedGameState | Record<string, never>;
};

class KnifeSkin {
  constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly rarity: SkinRarity,
    public readonly shape: KnifeShape,
    public readonly unlocked: boolean,
  ) {}
}

const WORLD_HALF = 140;
const START_Z = 105;
const FINISH_Z = -680;
const PLAYER_SPEED = 32;
const PLAYER_ACCEL = 112;
const PLAYER_FRICTION = 8.4;
const PLAYER_RADIUS = 1.15;
const PLAYER_TURN_SPEED = 8.5;
const ENEMY_RADIUS = 1.35;
const EVENT_INTERVAL = 60;
const EVENT_DURATION = 18;
const TELEPORT_DURATION = 11;
const TELEPORT_COOLDOWN = 24;
const CHUNK_SIZE = 90;
const CHUNK_RADIUS = 1;
const FAR_WORLD_LIMIT = 100000;
const DAY_LENGTH = 210;
const STAMINA_MAX = 100;
const TRADER_NPC_ID = 8;
const TRADER_PRICE_MEDKITS = 5;
const FREE_KNIFE_SKIN_ID = 'bowie_oxide';
const STARTING_UNLOCKED_SKINS = [FREE_KNIFE_SKIN_ID];
const STARTING_WALLET = { gold: 0, premium: 0 };
const DIALOG_REWARD = {
  success: { gold: 50, premium: 5 },
  fail: { gold: 10, premium: 1 },
};
const assetPath = (path: string) => `${import.meta.env.BASE_URL}${path.replace(/^\/+/, '')}`;
const USE_CHARACTER_RUNTIME_ASSETS = true;
const USE_WORLD_TEXTURE_ASSETS = true;
const USE_WORLD_RUNTIME_ASSETS = true;
const USE_MEDIEVAL_FBX_HOUSES = false;
const MEDIEVAL_PROP_SCALE = 0.28;
const HOUSE_WORLD_SCALE = 0.72;
const COMPANION_HOUSE: HouseNpc = {
  id: 99,
  name: 'Саят',
  mood: 'good',
  x: -24,
  z: -455,
  title: 'Дом второго игрока',
  story: 'В доме сидит Саят. Он говорит, что слышит степь как карту и может идти рядом, если ты не боишься доверять живому голосу.',
  choices: [
    { text: 'Позвать Саята в команду', reply: 'Саят берет оружие и выходит рядом с тобой. Теперь он помогает в бою и подсказывает дорогу.', effect: 'story' },
  ],
  visited: false,
};
const OUTFIT_URLS: Record<OutfitKind, string> = {
  maleRanger: assetPath('models/outfits/fantasy/Male_Ranger.gltf'),
  femaleRanger: assetPath('models/outfits/fantasy/Female_Ranger.gltf'),
  malePeasant: assetPath('models/outfits/fantasy/Male_Peasant.gltf'),
  femalePeasant: assetPath('models/outfits/fantasy/Female_Peasant.gltf'),
};
const PLAYER_OUTFIT_BY_DIFFICULTY: Record<Difficulty, OutfitKind> = {
  story: 'femalePeasant',
  survival: 'maleRanger',
  nightmare: 'femaleRanger',
};
const ANIMATION_LIBRARY_URL = assetPath('models/animations/ual2-standard.glb');
const MEDIEVAL_PROP_URLS: Record<MedievalPropKind, string> = {
  wagon: assetPath('models/medieval-village/fbx/Prop_Wagon.fbx'),
  crate: assetPath('models/medieval-village/fbx/Prop_Crate.fbx'),
  woodFence: assetPath('models/medieval-village/fbx/Prop_WoodenFence_Single.fbx'),
  metalFence: assetPath('models/medieval-village/fbx/Prop_MetalFence_Simple.fbx'),
  roundDoor: assetPath('models/medieval-village/fbx/Door_1_Round.fbx'),
  roundRoof: assetPath('models/medieval-village/fbx/Roof_2x4_RoundTile.fbx'),
  vine: assetPath('models/medieval-village/fbx/Prop_Vine2.fbx'),
  chimney: assetPath('models/medieval-village/fbx/Prop_Chimney.fbx'),
};
const MEDIEVAL_EXTRA_PROP_URLS: Record<MedievalExtraPropKind, string> = {
  wallPlaster: assetPath('models/medieval-village/fbx/Wall_Plaster_WoodGrid.fbx'),
  wallBrick: assetPath('models/medieval-village/fbx/Wall_UnevenBrick_Straight.fbx'),
  wallWindow: assetPath('models/medieval-village/fbx/Wall_Plaster_Window_Wide_Round.fbx'),
  roofDormer: assetPath('models/medieval-village/fbx/Roof_Dormer_RoundTile.fbx'),
  roofTower: assetPath('models/medieval-village/fbx/Roof_Tower_RoundTiles.fbx'),
  roofWood: assetPath('models/medieval-village/fbx/Roof_Wooden_2x1.fbx'),
  floorBrick: assetPath('models/medieval-village/fbx/Floor_UnevenBrick.fbx'),
  floorWood: assetPath('models/medieval-village/fbx/Floor_WoodDark.fbx'),
  stairs: assetPath('models/medieval-village/fbx/Stairs_Exterior_Straight.fbx'),
  doorFrame: assetPath('models/medieval-village/fbx/DoorFrame_Round_Brick.fbx'),
  shutter: assetPath('models/medieval-village/fbx/WindowShutters_Wide_Round_Open.fbx'),
  brickPile: assetPath('models/medieval-village/fbx/Prop_Brick4.fbx'),
  vine2: assetPath('models/medieval-village/fbx/Prop_Vine2.fbx'),
  ornamentFence: assetPath('models/medieval-village/fbx/Prop_MetalFence_Ornament.fbx'),
  border: assetPath('models/medieval-village/fbx/Prop_ExteriorBorder_Straight1.fbx'),
  support: assetPath('models/medieval-village/fbx/Prop_Support.fbx'),
};
const WORLD_REAL_TEXTURE_FILES = [
  'boulder_diff.jpg',
  'covered_car_diff.jpg',
  'fish_knife_diff.jpg',
  'island_tree_bark_diff.jpg',
  'island_tree_leaves_diff.png',
  'medical_box_diff.jpg',
  'rock_moss_diff.jpg',
  'rocky_terrain_diff.jpg',
  'service_pistol_diff.jpg',
  'tree_stump_diff.jpg',
];
const GAME_LOADING_TEXTURE_FILES = [
  ...WORLD_REAL_TEXTURE_FILES.map((file) => `textures/world-real/${file}`),
  'models/outfits/fantasy/T_Peasant_BaseColor.png',
  'models/outfits/fantasy/T_Ranger_BaseColor.png',
  'models/outfits/fantasy/T_Regular_Female_Dark_BaseColor.png',
  'models/outfits/fantasy/T_Regular_Male_Dark_BaseColor.png',
  'textures/world-real/medieval_plaster.png',
  'textures/world-real/medieval_rock_trim.png',
  'textures/world-real/medieval_roof_tiles.png',
  'textures/world-real/medieval_uneven_brick.png',
  'textures/world-real/medieval_wood_trim.png',
];

const DIFFICULTY: Record<Difficulty, {
  label: string;
  hp: number;
  enemyHp: number;
  enemySpeed: number;
  enemyDamage: number;
  spawn: number;
  eventInterval: number;
  score: number;
}> = {
  story: { label: 'Сюжет', hp: 125, enemyHp: 0.82, enemySpeed: 0.88, enemyDamage: 0.72, spawn: 1.28, eventInterval: 78, score: 0.85 },
  survival: { label: 'Выживание', hp: 100, enemyHp: 1, enemySpeed: 1, enemyDamage: 1, spawn: 1, eventInterval: 60, score: 1 },
  nightmare: { label: 'Кошмар', hp: 82, enemyHp: 1.32, enemySpeed: 1.22, enemyDamage: 1.36, spawn: 0.72, eventInterval: 42, score: 1.35 },
};

const MODE_DESCRIPTIONS: Record<Difficulty, string> = {
  story: 'Сюжетный режим: больше HP, спокойнее темп, удобнее проходить историю.',
  survival: 'Выживание: честный баланс ресурсов, врагов и событий.',
  nightmare: 'Кошмар: меньше HP, агрессивнее враги, больше давление карты.',
};

const KNIFE_SKINS: KnifeSkin[] = [
  new KnifeSkin('butterfly_fade', 'Butterfly Fade', 'Rare', 'butterfly', false),
  new KnifeSkin('stiletto_crimson', 'Stiletto Crimson', 'Epic', 'stiletto', false),
  new KnifeSkin('karambit_steppe', 'Karambit Steppe', 'Legendary', 'karambit', false),
  new KnifeSkin('bowie_oxide', 'Bowie Oxide', 'Common', 'bowie', true),
  new KnifeSkin('gut_kumys', 'Gut Kumys', 'Rare', 'gut', false),
  new KnifeSkin('bayonet_hloddev', 'Bayonet Hloddev', 'Epic', 'bayonet', false),
];

const CASE_BONUS_REWARDS: { name: string; rarity: SkinRarity }[] = [
  { name: 'Shadow Talon Finish', rarity: 'Rare' },
  { name: 'Nomad Bone Handle', rarity: 'Epic' },
  { name: 'Wolfmark Gold Edge', rarity: 'Legendary' },
];

const pickCaseReward = (isPremium: boolean) => {
  const premiumPool = [
    ...KNIFE_SKINS.filter((skin) => skin.rarity === 'Epic' || skin.rarity === 'Legendary'),
    ...CASE_BONUS_REWARDS,
  ];
  const regularPool = [...KNIFE_SKINS, ...CASE_BONUS_REWARDS.slice(0, 2)];
  const pool = isPremium ? premiumPool : regularPool;
  return pool[Math.floor(Math.random() * pool.length)] ?? KNIFE_SKINS[0];
};

const CASE_PRICES = {
  gold: 250,
  premium: 15,
};

const SKIN_RARITY_COLORS: Record<SkinRarity, string> = {
  Common: '#d8d1c3',
  Rare: '#70d6ff',
  Epic: '#d78bff',
  Legendary: '#ffd37b',
};

const KNIFE_SKIN_VISUALS: Record<string, { blade: number; grip: number; accent: number; ui: string; clip: string }> = {
  butterfly_fade: {
    blade: 0xf0d38a,
    grip: 0x182638,
    accent: 0xff7f50,
    ui: 'linear-gradient(90deg, #16283a 0 20%, #ffd37b 20% 46%, #ff7f50 46% 74%, #70d6ff 74%)',
    clip: 'polygon(0 26%, 72% 18%, 100% 50%, 72% 82%, 0 74%)',
  },
  stiletto_crimson: {
    blade: 0xf3f0eb,
    grip: 0x361518,
    accent: 0xb9242d,
    ui: 'linear-gradient(90deg, #351416 0 24%, #e7e4df 24% 86%, #b9242d 86%)',
    clip: 'polygon(0 35%, 82% 35%, 100% 50%, 82% 65%, 0 65%)',
  },
  karambit_steppe: {
    blade: 0xb8d7d0,
    grip: 0x1d3b29,
    accent: 0xffd37b,
    ui: 'radial-gradient(circle at 82% 50%, transparent 0 22%, #b8d7d0 24% 48%, transparent 50%), linear-gradient(90deg, #1d3b29 0 46%, #ffd37b 46% 60%, #b8d7d0 60%)',
    clip: 'polygon(0 35%, 38% 35%, 52% 10%, 100% 20%, 74% 58%, 38% 65%, 0 65%)',
  },
  bowie_oxide: {
    blade: 0xa2adad,
    grip: 0x5a3927,
    accent: 0x8d4f37,
    ui: 'linear-gradient(90deg, #5a3927 0 28%, #8d4f37 28% 36%, #a2adad 36% 78%, #d8dde4 78%)',
    clip: 'polygon(0 24%, 58% 24%, 100% 42%, 88% 76%, 0 76%)',
  },
  gut_kumys: {
    blade: 0xefe1be,
    grip: 0x2d2922,
    accent: 0xa89a54,
    ui: 'linear-gradient(90deg, #2d2922 0 30%, #a89a54 30% 42%, #efe1be 42% 82%, #4f5f42 82%)',
    clip: 'polygon(0 28%, 62% 28%, 100% 12%, 84% 50%, 100% 88%, 62% 72%, 0 72%)',
  },
  bayonet_hloddev: {
    blade: 0xcde9ef,
    grip: 0x15191f,
    accent: 0x70d6ff,
    ui: 'linear-gradient(90deg, #15191f 0 24%, #70d6ff 24% 32%, #cde9ef 32% 92%, #ffffff 92%)',
    clip: 'polygon(0 34%, 88% 34%, 100% 50%, 88% 66%, 0 66%)',
  },
};

const WEAPONS: Record<WeaponKind, { name: string; damage: number; range: number; cooldown: number; color: number }> = {
  knife: { name: 'Нож', damage: 24, range: 5.3, cooldown: 0.42, color: 0xd9dde4 },
  club: { name: 'Дубина', damage: 34, range: 5.9, cooldown: 0.58, color: 0x7a4a2a },
  sabre: { name: 'Сабля', damage: 45, range: 6.8, cooldown: 0.46, color: 0xe8edf4 },
  rifle: { name: 'Ружье', damage: 72, range: 18, cooldown: 0.88, color: 0x2b2420 },
};

const ITEM_LABELS: Record<PickupKind, string> = {
  medkit: 'Аптечка',
  crystal: 'Кристалл',
  key: 'Ключ',
  code: 'Код',
  revive: 'Сыворотка',
  knife: 'Нож',
  club: 'Дубина',
  sabre: 'Сабля',
  rifle: 'Ружье',
};

const ITEM_ICONS: Record<PickupKind, string> = {
  medkit: '+',
  crystal: '*',
  key: 'K',
  code: '#',
  revive: 'V',
  knife: '/',
  club: '!',
  sabre: 'S',
  rifle: 'R',
};

const EVENT_LABELS: Record<EventKind, string> = {
  ambush: 'Засада',
  storm: 'Пыльная буря',
  rage: 'Ярость зараженных',
  starvation: 'Голодный час',
};

const EVENT_HINTS: Record<EventKind, string> = {
  ambush: 'Из травы полезла новая волна. Двигайся и бей первым.',
  storm: 'Буря режет скорость и видимость. Не стой на месте.',
  rage: 'Враги ускорились и бьют больнее.',
  starvation: 'Степь вытягивает силы. Найди аптечку быстрее.',
};

const FAKE_FORTRESSES: FakeFortress[] = [
  { id: 1, x: -46, z: -72, triggered: false, message: 'Ха! Это сарай с башнями. Крепость бы тебя даже на порог не пустила.' },
  { id: 2, x: 48, z: -178, triggered: false, message: 'Мимо, герой. Это декорация для тех, кто верит каждому камню.' },
  { id: 3, x: -18, z: -260, triggered: false, message: 'Опять не та крепость. Степь смеется, а настоящая цель дальше на севере.' },
];

const HOUSE_NPCS: HouseNpc[] = [
  {
    id: 1, name: 'Старый табиб', mood: 'good', x: -92, z: 42, visited: false,
    title: 'Дом лекаря',
    story: 'Табиб прячет в сундуке высушенные травы и клянется, что кумыс не просто напиток, а последняя защита крови.',
    choices: [
      { text: 'Попросить лечение', reply: 'Табиб быстро перевязал раны и дал кислый глоток кумыса.', effect: 'heal' },
      { text: 'Попросить припасы', reply: 'Он сунул тебе аптечку: "На дороге не геройствуй".', effect: 'medkit' },
    ],
  },
  {
    id: 2, name: 'Кузнец Сырым', mood: 'good', x: 78, z: -38, visited: false,
    title: 'Кузница у солончака',
    story: 'Кузнец слышал вой волков еще до эпидемии. Он говорит, что железо помогает думать, когда голова не справляется.',
    choices: [
      { text: 'Взять оружие', reply: 'Сырым отдал саблю с затупленной, но честной гардой.', effect: 'weapon' },
      { text: 'Спросить дорогу', reply: 'Он отмечает на земле короткий путь между руинами.', effect: 'story' },
    ],
  },
  {
    id: 3, name: 'Беглая знахарка', mood: 'good', x: -112, z: -214, visited: false,
    title: 'Юрта у камышей',
    story: 'Знахарка уверена: вирус пришел не от волков, а через старый караван. Волки только первыми сорвались с цепи.',
    choices: [
      { text: 'Выпить настой', reply: 'Настой горький, но силы возвращаются.', effect: 'heal' },
      { text: 'Взять аптечку', reply: 'Она молча дает перевязочный набор.', effect: 'medkit' },
    ],
  },
  {
    id: 4, name: 'Пастух Кайрат', mood: 'neutral', x: 108, z: -150, visited: false,
    title: 'Пустой загон',
    story: 'Кайрат видел, как волчья стая вошла в аул без страха перед огнем. После этого люди начали забывать свои имена.',
    choices: [
      { text: 'Выслушать историю', reply: 'Он рассказывает про первую ночь заражения. Теперь ты лучше понимаешь степь.', effect: 'story' },
      { text: 'Спросить про крепость', reply: 'Кайрат говорит: "Не верь первой башне. Настоящая крепость молчит".', effect: 'story' },
    ],
  },
  {
    id: 5, name: 'Сказительница Айша', mood: 'neutral', x: -70, z: -330, visited: false,
    title: 'Дом с красной дверью',
    story: 'Айша собирает имена пропавших. Она говорит, что мир держится на тех, кто помнит даже смешных и глупых.',
    choices: [
      { text: 'Послушать песню', reply: 'Песня не лечит раны, но возвращает смысл идти дальше.', effect: 'story' },
      { text: 'Спросить про кумыс', reply: 'Айша смеется: "Ваш иммунитет, похоже, родился из упрямства и кислого молока".', effect: 'story' },
    ],
  },
  {
    id: 6, name: 'Писарь Нурлан', mood: 'neutral', x: 96, z: -424, visited: false,
    title: 'Архивная изба',
    story: 'Писарь хранит листы с печатями крепости. Он видел похожий код, но боится читать его вслух.',
    choices: [
      { text: 'Попросить запись', reply: 'Нурлан показывает старый знак на воротах. Это может пригодиться.', effect: 'story' },
      { text: 'Пошутить про конец света', reply: 'Он записывает шутку как исторический документ.', effect: 'story' },
    ],
  },
  {
    id: 7, name: 'Молчаливый охотник', mood: 'neutral', x: -118, z: -548, visited: false,
    title: 'Охотничий дом',
    story: 'Охотник говорит редко. По его зарубкам ясно: волки шли не стаей, а будто по чьей-то команде.',
    choices: [
      { text: 'Изучить зарубки', reply: 'Ты понимаешь, где чаще появляются зараженные.', effect: 'story' },
      { text: 'Поблагодарить', reply: 'Охотник кивает. Это почти речь.', effect: 'story' },
    ],
  },
  {
    id: 8, name: 'Купец Жанат', mood: 'evil', x: 118, z: 20, visited: false,
    title: 'Лавка без товара',
    story: 'Купец улыбается слишком широко. В его доме чисто, но у порога свежие следы когтей.',
    choices: [
      { text: 'Купить подсказку', reply: 'Он забирает припасы и дает ложное направление.', effect: 'steal' },
      { text: 'Пригрозить', reply: 'Жанат свистит в щель. Снаружи кто-то отвечает рычанием.', effect: 'ambush' },
    ],
  },
  {
    id: 9, name: 'Лже-табиб', mood: 'evil', x: -35, z: -402, visited: false,
    title: 'Темная мазанка',
    story: 'Он говорит медицинскими словами, но пахнет не травами, а ржавчиной и страхом.',
    choices: [
      { text: 'Выпить лекарство', reply: 'Это яд. Не смертельный, но очень неприятный.', effect: 'damage' },
      { text: 'Обыскать дом', reply: 'Ты находишь аптечку, но шум зовет зараженных.', effect: 'ambush' },
    ],
  },
  {
    id: 10, name: 'Проводник без имени', mood: 'evil', x: 52, z: -590, visited: false,
    title: 'Дом у оврага',
    story: 'Проводник обещает короткую дорогу к крепости. Он слишком внимательно смотрит на твой инвентарь.',
    choices: [
      { text: 'Довериться', reply: 'Он уводит тебя к опасной тропе и исчезает.', effect: 'ambush' },
      { text: 'Отказаться', reply: 'Он злится и успевает ударить ножом по руке.', effect: 'damage' },
    ],
  },
];

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function randomRange(min: number, max: number) {
  return min + Math.random() * (max - min);
}

function lerpAngle(current: number, target: number, t: number) {
  const delta = Math.atan2(Math.sin(target - current), Math.cos(target - current));
  return current + delta * clamp(t, 0, 1);
}

function randomQuestPoint(): QuestItem {
  return {
    x: randomRange(-WORLD_HALF + 18, WORLD_HALF - 18),
    z: randomRange(FINISH_Z + 62, START_Z - 75),
    collected: false,
  };
}

function findAnimationClip(clips: THREE.AnimationClip[], names: string[]) {
  for (const name of names) {
    const clip = THREE.AnimationClip.findByName(clips, name);
    if (clip) return clip;
  }
  const lowerNames = names.map((name) => name.toLowerCase());
  return clips.find((clip) => lowerNames.some((name) => clip.name.toLowerCase().includes(name.toLowerCase()))) ?? null;
}

function createCharacterAnimator(root: THREE.Object3D, clips: THREE.AnimationClip[], zombie = false): CharacterAnimator | null {
  const idle = findAnimationClip(clips, zombie ? ['Zombie_Idle_Loop', 'Zombie Idle', 'Idle_No_Loop', 'Idle'] : ['Idle_Lantern_Loop', 'Idle_FoldArms_Loop', 'Idle_No_Loop', 'Idle']);
  const walk = findAnimationClip(clips, zombie ? ['Zombie_Walk_Fwd_Loop', 'Zombie Walk', 'Walk_Fwd', 'Walk'] : ['Walk_Carry_Loop', 'Walk_Fwd', 'Run_Fwd', 'Walk']);
  const attack = findAnimationClip(clips, zombie ? ['Zombie_Scratch', 'Zombie Attack', 'Scratch', 'Melee_Hook', 'Attack'] : ['Sword_Regular_A', 'Melee_Hook', 'Attack', 'Slash']);
  if (!idle && !walk && !attack) return null;

  const mixer = new THREE.AnimationMixer(root);
  const actions: CharacterAnimator['actions'] = {};
  if (idle) actions.idle = mixer.clipAction(idle);
  if (walk) actions.walk = mixer.clipAction(walk);
  if (attack) {
    actions.attack = mixer.clipAction(attack);
    actions.attack.setLoop(THREE.LoopOnce, 1);
    actions.attack.clampWhenFinished = false;
  }
  return { mixer, actions, active: null };
}

function playCharacterAnimation(animator: CharacterAnimator | undefined | null, name: CharacterAnimationName, fade = 0.18) {
  if (!animator) return;
  const next = animator.actions[name];
  if (!next || animator.active === name) return;
  const previous = animator.active ? animator.actions[animator.active] : null;
  next.enabled = true;
  next.reset();
  next.play();
  if (previous) next.crossFadeFrom(previous, fade, false);
  animator.active = name;
}

function enableAssetShadows(asset: THREE.Object3D) {
  asset.traverse((part) => {
    if (part instanceof THREE.Mesh) {
      part.castShadow = true;
      part.receiveShadow = true;
    }
  });
}

function fitAssetHeight(asset: THREE.Object3D, targetHeight: number) {
  const bounds = new THREE.Box3().setFromObject(asset);
  const height = bounds.max.y - bounds.min.y;
  if (height <= 0) return;
  asset.scale.multiplyScalar(targetHeight / height);
}

function fitAssetMaxSpan(asset: THREE.Object3D, targetSpan: number) {
  const bounds = new THREE.Box3().setFromObject(asset);
  const size = bounds.getSize(new THREE.Vector3());
  const span = Math.max(size.x, size.y, size.z);
  if (span <= 0) return;
  asset.scale.multiplyScalar(targetSpan / span);
}

function clampAssetMaxSpan(asset: THREE.Object3D, maxSpan: number) {
  asset.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(asset);
  const size = bounds.getSize(new THREE.Vector3());
  const span = Math.max(size.x, size.y, size.z);
  if (!Number.isFinite(span) || span <= 0 || span <= maxSpan) return;
  asset.scale.multiplyScalar(maxSpan / span);
}

function centerAssetOnGround(asset: THREE.Object3D) {
  asset.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(asset);
  const centerX = (bounds.min.x + bounds.max.x) / 2;
  const centerZ = (bounds.min.z + bounds.max.z) / 2;
  const liftY = bounds.min.y;
  for (const child of asset.children) {
    child.position.x -= centerX;
    child.position.y -= liftY;
    child.position.z -= centerZ;
  }
  asset.updateMatrixWorld(true);
}

function cloneMaterial(material: THREE.Material | THREE.Material[]) {
  return Array.isArray(material) ? material.map((entry) => entry.clone()) : material.clone();
}

type WorldTextureSet = {
  soil: THREE.Texture;
  grass: THREE.Texture;
  bark: THREE.Texture;
  leaves: THREE.Texture;
  rock: THREE.Texture;
  snow: THREE.Texture;
  roof: THREE.Texture;
  wall: THREE.Texture;
  boulder: THREE.Texture;
  rockMoss: THREE.Texture;
  rockyTerrain: THREE.Texture;
  stump: THREE.Texture;
  medkit: THREE.Texture;
  coveredCar: THREE.Texture;
  fishKnife: THREE.Texture;
  servicePistol: THREE.Texture;
  islandBark: THREE.Texture;
  islandLeaves: THREE.Texture;
};

let cachedWorldTextures: WorldTextureSet | null = null;

function makeProceduralTexture(name: string, colors: string[], size = 128, streak = 0.35) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return new THREE.CanvasTexture(canvas);

  ctx.fillStyle = colors[0];
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < size * size * 0.42; i++) {
    const color = colors[Math.floor(Math.random() * colors.length)];
    const x = Math.random() * size;
    const y = Math.random() * size;
    const w = 1 + Math.random() * (streak > 0.5 ? 8 : 4);
    const h = 1 + Math.random() * (streak > 0.5 ? 2 : 5);
    ctx.globalAlpha = 0.16 + Math.random() * 0.28;
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
  }
  ctx.globalAlpha = 1;
  for (let i = 0; i < 22; i++) {
    ctx.strokeStyle = colors[(i + 1) % colors.length];
    ctx.globalAlpha = 0.08 + Math.random() * 0.16;
    ctx.lineWidth = 1 + Math.random() * 2;
    ctx.beginPath();
    ctx.moveTo(Math.random() * size, Math.random() * size);
    ctx.lineTo(Math.random() * size, Math.random() * size);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  const texture = new THREE.CanvasTexture(canvas);
  texture.name = name;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(3, 3);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  texture.needsUpdate = true;
  return texture;
}

function makeAssetTexture(file: string, _fallback: THREE.Texture, repeatX = 1, repeatY = 1) {
  if (!USE_WORLD_TEXTURE_ASSETS) {
    _fallback.repeat.set(repeatX, repeatY);
    return _fallback;
  }
  const texture = new THREE.TextureLoader().load(
    assetPath(`textures/world-real/${file}`),
    undefined,
    undefined,
    () => undefined,
  );
  texture.name = file;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeatX, repeatY);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

function worldTextures() {
  if (!cachedWorldTextures) {
    const soil = makeProceduralTexture('steppe soil texture', ['#6f6a45', '#897b4d', '#4b4632', '#a09159'], 128, 0.28);
    const grass = makeProceduralTexture('steppe grass texture', ['#526a39', '#354b2e', '#8a8750', '#6f7d48'], 128, 0.75);
    const bark = makeProceduralTexture('tree bark texture', ['#3a261a', '#5a3d29', '#2b1c14', '#7a5636'], 128, 0.9);
    const leaves = makeProceduralTexture('tree leaves texture', ['#21472f', '#2f6b3f', '#193525', '#5f7042'], 128, 0.45);
    const rock = makeProceduralTexture('rock mountain texture', ['#5f625c', '#77746a', '#444743', '#8d897e'], 128, 0.22);
    cachedWorldTextures = {
      soil,
      grass,
      bark,
      leaves,
      rock,
      snow: makeProceduralTexture('snow cap texture', ['#d9e5e2', '#f4f1e8', '#b7c8c7', '#edf8f4'], 96, 0.2),
      roof: makeAssetTexture('medieval_roof_tiles.png', makeProceduralTexture('dark roof texture', ['#2b1715', '#3f2b1f', '#17120f', '#60412c'], 128, 0.82), 2.2, 2.2),
      wall: makeAssetTexture('medieval_plaster.png', makeProceduralTexture('mud wall texture', ['#6f7f63', '#746957', '#4f3a35', '#8a7d5e'], 128, 0.36), 1.8, 1.8),
      boulder: makeAssetTexture('boulder_diff.jpg', rock, 2, 2),
      rockMoss: makeAssetTexture('rock_moss_diff.jpg', rock, 2, 2),
      rockyTerrain: makeAssetTexture('rocky_terrain_diff.jpg', soil, 5, 5),
      stump: makeAssetTexture('tree_stump_diff.jpg', bark, 1.5, 1.5),
      medkit: makeAssetTexture('medical_box_diff.jpg', soil, 1, 1),
      coveredCar: makeAssetTexture('covered_car_diff.jpg', soil, 1, 1),
      fishKnife: makeAssetTexture('fish_knife_diff.jpg', rock, 1, 1),
      servicePistol: makeAssetTexture('service_pistol_diff.jpg', rock, 1, 1),
      islandBark: makeAssetTexture('island_tree_bark_diff.jpg', bark, 1, 1),
      islandLeaves: makeAssetTexture('island_tree_leaves_diff.png', leaves, 1.5, 1.5),
    };
  }
  return cachedWorldTextures;
}

function makeOutfitInstance(template: THREE.Group, role: OutfitRole) {
  const outfit = cloneSkeleton(template) as THREE.Group;
  outfit.traverse((part) => {
    if (!(part instanceof THREE.Mesh)) return;
    part.visible = true;
    part.frustumCulled = false;
    part.castShadow = true;
    part.receiveShadow = true;
    part.material = cloneMaterial(part.material);
    const materials = Array.isArray(part.material) ? part.material : [part.material];
    for (const material of materials) {
      if (material instanceof THREE.MeshStandardMaterial) {
        material.envMapIntensity = role === 'player' ? 0.72 : 0.48;
        material.roughness = clamp(material.roughness, 0.34, 0.92);
        if (material.normalMap) material.normalScale.set(0.82, 0.82);
        if (material.map) material.map.anisotropy = 8;
        if (role === 'enemy') {
          material.color.multiplyScalar(0.48);
          material.color.offsetHSL(-0.02, 0.08, -0.06);
          material.emissive.setHex(0x35120f);
          material.emissiveIntensity = 0.22;
          material.roughness = Math.min(1, material.roughness + 0.18);
        } else if (role === 'npc') {
          material.color.multiplyScalar(1.06);
          material.roughness = Math.min(1, material.roughness + 0.06);
        } else {
          material.color.multiplyScalar(1.18);
          material.metalness = Math.min(0.2, material.metalness + 0.04);
          material.transparent = false;
          material.opacity = 1;
          material.depthWrite = true;
        }
      }
    }
  });
  outfit.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(outfit);
  const size = bounds.getSize(new THREE.Vector3());
  if (Number.isFinite(size.y) && size.y > 0.01) {
    const targetHeight = role === 'player' ? 1.72 : role === 'enemy' ? 2.12 : 1.86;
    const scale = clamp(targetHeight / size.y, 0.003, 0.75);
    outfit.scale.multiplyScalar(scale);
    clampAssetMaxSpan(outfit, role === 'player' ? 1.55 : role === 'enemy' ? 1.75 : 1.55);
    outfit.updateMatrixWorld(true);
    const scaledBounds = new THREE.Box3().setFromObject(outfit);
    outfit.userData.groundLift = -scaledBounds.min.y;
  }
  outfit.name = role === 'player' ? 'Player Outfit' : role === 'enemy' ? 'Infected Outfit' : 'Village NPC Outfit';
  return outfit;
}

function makeAssetInstance(template: THREE.Group) {
  const asset = template.clone(true);
  asset.traverse((part) => {
    if (part instanceof THREE.Mesh) {
      part.castShadow = true;
      part.receiveShadow = true;
    }
  });
  return asset;
}

function medievalMaterialForName(name: string) {
  const key = name.toLowerCase();
  const textures = worldTextures();
  if (key.includes('roof') || key.includes('tile')) {
    return new THREE.MeshStandardMaterial({ color: 0xc27a46, map: textures.roof, roughness: 0.82, metalness: 0 });
  }
  if (key.includes('wood') || key.includes('door') || key.includes('shutter') || key.includes('support') || key.includes('wagon') || key.includes('crate')) {
    return new THREE.MeshStandardMaterial({ color: 0x8a6040, map: textures.stump, roughness: 0.86, metalness: 0 });
  }
  if (key.includes('brick') || key.includes('stone') || key.includes('rock') || key.includes('floor') || key.includes('stairs')) {
    return new THREE.MeshStandardMaterial({ color: 0x8b8171, map: textures.rockyTerrain, roughness: 0.93, metalness: 0 });
  }
  if (key.includes('vine')) {
    return new THREE.MeshStandardMaterial({ color: 0x5f8f52, map: textures.islandLeaves, roughness: 0.82, metalness: 0 });
  }
  if (key.includes('metal') || key.includes('fence')) {
    return new THREE.MeshStandardMaterial({ color: 0x3f4340, map: textures.rockMoss, roughness: 0.66, metalness: 0.42 });
  }
  return new THREE.MeshStandardMaterial({ color: 0xa88e6f, map: textures.wall, roughness: 0.9, metalness: 0 });
}

function prepareMedievalTemplate(template: THREE.Group, kind: string) {
  template.traverse((part) => {
    if (!(part instanceof THREE.Mesh)) return;
    part.castShadow = true;
    part.receiveShadow = true;
    part.frustumCulled = false;
    const current = Array.isArray(part.material) ? part.material[0] : part.material;
    if (current && 'map' in current && current.map) {
      part.material = cloneMaterial(part.material);
      const materials = Array.isArray(part.material) ? part.material : [part.material];
      for (const material of materials) {
        if (material instanceof THREE.MeshStandardMaterial || material instanceof THREE.MeshPhongMaterial) {
          if (material.map) {
            material.map.colorSpace = THREE.SRGBColorSpace;
            material.map.anisotropy = 8;
            material.color.setHex(0xffffff);
          }
          material.transparent = false;
          material.depthWrite = true;
          material.opacity = 1;
          if (material instanceof THREE.MeshStandardMaterial) {
            material.roughness = Math.min(0.95, Math.max(0.45, material.roughness));
          }
        }
      }
    } else {
      part.material = medievalMaterialForName(`${kind} ${part.name}`);
    }
  });
  const key = kind.toLowerCase();
  if (key.includes('floor')) {
    fitAssetMaxSpan(template, 5.2);
    centerAssetOnGround(template);
    enableAssetShadows(template);
    template.userData.medievalKind = kind;
    return;
  }
  if (key.includes('border')) {
    fitAssetMaxSpan(template, 3.2);
    centerAssetOnGround(template);
    enableAssetShadows(template);
    template.userData.medievalKind = kind;
    return;
  }
  if (key.includes('brick')) {
    fitAssetMaxSpan(template, 0.9);
    centerAssetOnGround(template);
    enableAssetShadows(template);
    template.userData.medievalKind = kind;
    return;
  }
  const targetHeight =
    key.includes('wall') ? 3.4 :
      key.includes('roof') ? 2.2 :
        key.includes('door') ? 2.35 :
          key.includes('window') || key.includes('shutter') ? 1.35 :
            key.includes('stairs') ? 0.9 :
              key.includes('floor') ? 0.16 :
                key.includes('wagon') ? 2.25 :
                  key.includes('crate') ? 0.85 :
                    key.includes('fence') ? 1.55 :
                      key.includes('chimney') || key.includes('support') ? 1.75 :
                        key.includes('vine') ? 1.8 : 2.2;
  fitAssetHeight(template, targetHeight);
  clampAssetMaxSpan(template, 4.8);
  centerAssetOnGround(template);
  enableAssetShadows(template);
  template.userData.medievalKind = kind;
}

function makeRuntimeOutfit(kind: OutfitKind, role: OutfitRole, mood: NpcMood = 'neutral') {
  const group = new THREE.Group();
  const textures = worldTextures();
  const walkParts: { part: THREE.Object3D; side: number; baseX: number; baseZ: number; role: 'arm' | 'leg' }[] = [];
  const isEnemy = role === 'enemy' || mood === 'evil';
  const isRanger = kind === 'maleRanger' || kind === 'femaleRanger';
  const isFemale = kind === 'femaleRanger' || kind === 'femalePeasant';
  const clothColor = isEnemy ? 0x3a2a24 : isRanger ? 0x274f62 : 0x5a6f42;
  const accentColor = isEnemy ? 0x7a201b : isRanger ? 0x70d6ff : 0xffd37b;
  const skinColor = isEnemy ? 0x8f9570 : isFemale ? 0xc58c68 : 0xb77a54;
  const cloth = new THREE.MeshStandardMaterial({ color: clothColor, map: textures.grass, roughness: 0.86 });
  const leather = new THREE.MeshStandardMaterial({ color: 0x3f2a1e, map: textures.bark, roughness: 0.9 });
  const skin = new THREE.MeshStandardMaterial({ color: skinColor, roughness: 0.72 });
  const metal = new THREE.MeshStandardMaterial({ color: 0xbec5c2, map: textures.rock, metalness: 0.28, roughness: 0.34 });
  const dark = new THREE.MeshStandardMaterial({ color: isEnemy ? 0x140f0d : 0x1b1714, roughness: 0.9 });
  const accent = new THREE.MeshStandardMaterial({
    color: accentColor,
    emissive: accentColor,
    emissiveIntensity: isEnemy ? 0.05 : 0.08,
    roughness: 0.58,
  });

  const body = new THREE.Mesh(new THREE.CapsuleGeometry(isFemale ? 0.44 : 0.5, 1.42, 7, 16), cloth);
  body.position.y = 1.46;
  body.scale.set(isFemale ? 0.88 : 0.98, 1.06, 0.72);
  body.castShadow = true;
  group.add(body);

  const chestPlate = new THREE.Mesh(new THREE.BoxGeometry(isFemale ? 0.66 : 0.74, 0.76, 0.08), isRanger ? metal : leather);
  chestPlate.position.set(0, 1.55, -0.42);
  chestPlate.castShadow = true;
  group.add(chestPlate);

  const sash = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.12, 0.11), accent);
  sash.position.set(0, 1.22, -0.45);
  sash.rotation.z = isEnemy ? -0.18 : 0.18;
  group.add(sash);

  const belt = new THREE.Mesh(new THREE.BoxGeometry(1.08, 0.16, 0.22), leather);
  belt.position.set(0, 1.02, -0.02);
  group.add(belt);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.36, 18, 14), skin);
  head.position.set(0, 2.58, -0.05);
  head.scale.set(0.92, 1.08, 0.86);
  head.castShadow = true;
  group.add(head);

  const hood = new THREE.Mesh(new THREE.SphereGeometry(0.41, 16, 12), isRanger || isEnemy ? dark : leather);
  hood.position.set(0, 2.76, 0.02);
  hood.scale.set(1.0, 0.52, 0.92);
  hood.castShadow = true;
  group.add(hood);

  const eyeMat = new THREE.MeshBasicMaterial({ color: isEnemy ? 0xffefe5 : 0x101010 });
  const leftEye = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 8), eyeMat);
  const rightEye = leftEye.clone();
  leftEye.position.set(-0.11, 2.64, -0.34);
  rightEye.position.set(0.11, 2.64, -0.34);
  group.add(leftEye, rightEye);

  const scarf = new THREE.Mesh(new THREE.TorusGeometry(0.38, 0.052, 8, 24), accent);
  scarf.position.y = 2.13;
  scarf.rotation.x = Math.PI / 2;
  group.add(scarf);

  const shoulderGeo = new THREE.SphereGeometry(0.17, 10, 8);
  for (const side of [-1, 1]) {
    const shoulder = new THREE.Mesh(shoulderGeo, isRanger ? metal : leather);
    shoulder.position.set(side * 0.5, 1.94, -0.04);
    shoulder.scale.set(1.2, 0.72, 0.9);
    shoulder.castShadow = true;
    group.add(shoulder);

    const upperArm = new THREE.Mesh(new THREE.CapsuleGeometry(0.105, 0.58, 4, 8), cloth);
    upperArm.position.set(side * 0.62, 1.63, -0.04);
    upperArm.rotation.z = side * 0.28;
    upperArm.castShadow = true;
    group.add(upperArm);
    walkParts.push({ part: upperArm, side, baseX: upperArm.rotation.x, baseZ: upperArm.rotation.z, role: 'arm' });

    const forearm = new THREE.Mesh(new THREE.CapsuleGeometry(0.09, 0.55, 4, 8), isEnemy ? skin : leather);
    forearm.position.set(side * 0.78, 1.18, -0.28);
    forearm.rotation.x = isEnemy ? -0.8 : -0.45;
    forearm.rotation.z = side * 0.18;
    forearm.castShadow = true;
    group.add(forearm);
    walkParts.push({ part: forearm, side, baseX: forearm.rotation.x, baseZ: forearm.rotation.z, role: 'arm' });

    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), skin);
    hand.position.set(side * 0.83, 0.94, -0.46);
    hand.scale.set(0.78, 0.62, 1);
    hand.castShadow = true;
    group.add(hand);

    const thigh = new THREE.Mesh(new THREE.CapsuleGeometry(0.135, 0.76, 4, 8), leather);
    thigh.position.set(side * 0.22, 0.72, 0.02);
    thigh.castShadow = true;
    group.add(thigh);
    walkParts.push({ part: thigh, side, baseX: thigh.rotation.x, baseZ: thigh.rotation.z, role: 'leg' });

    const shin = new THREE.Mesh(new THREE.CapsuleGeometry(0.115, 0.68, 4, 8), dark);
    shin.position.set(side * 0.22, 0.22, -0.04);
    shin.castShadow = true;
    group.add(shin);
    walkParts.push({ part: shin, side, baseX: shin.rotation.x, baseZ: shin.rotation.z, role: 'leg' });

    const boot = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.14, 0.48), dark);
    boot.position.set(side * 0.22, 0.03, -0.2);
    boot.castShadow = true;
    group.add(boot);
  }

  const cape = new THREE.Mesh(new THREE.BoxGeometry(0.78, 1.28, 0.05), new THREE.MeshStandardMaterial({ color: isEnemy ? 0x251312 : 0x253d37, map: textures.grass, roughness: 0.94 }));
  cape.position.set(0, 1.42, 0.48);
  cape.rotation.x = -0.12;
  cape.castShadow = true;
  group.add(cape);

  if (isRanger) {
    const quiver = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.14, 0.92, 10), leather);
    quiver.position.set(-0.34, 1.55, 0.62);
    quiver.rotation.z = -0.38;
    quiver.castShadow = true;
    group.add(quiver);
  }

  if (isEnemy) {
    const wound = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.08, 0.04), accent);
    wound.position.set(0.16, 2.42, -0.36);
    wound.rotation.z = 0.25;
    group.add(wound);
    group.rotation.z = randomRange(-0.08, 0.08);
  }

  group.userData.walkParts = walkParts;
  group.userData.phase = randomRange(0, Math.PI * 2);
  group.userData.baseRotZ = group.rotation.z;
  group.name = role === 'player' ? 'Runtime Modular Player Outfit' : role === 'enemy' ? 'Runtime Modular Enemy Outfit' : 'Runtime Modular NPC Outfit';
  return { mesh: group, walkParts };
}

function makeEnemy() {
  const group = new THREE.Group();
  const walkParts: { part: THREE.Object3D; side: number; baseX: number; baseZ: number }[] = [];
  const deadSkin = new THREE.MeshStandardMaterial({ color: 0x9b9d7a, roughness: 0.92 });
  const shirt = new THREE.MeshStandardMaterial({ color: 0x3e4c38, roughness: 0.95 });
  const pants = new THREE.MeshStandardMaterial({ color: 0x2b2d2f, roughness: 0.9 });
  const bone = new THREE.MeshStandardMaterial({ color: 0xd8c9a8, roughness: 0.72 });
  const blood = new THREE.MeshStandardMaterial({ color: 0x5c1210, roughness: 0.88 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x15100d, roughness: 0.9 });

  const body = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.58, 1.55, 6, 14),
    shirt,
  );
  body.position.y = 1.42;
  body.rotation.x = -0.18;
  body.scale.set(0.92, 1.04, 0.72);
  body.castShadow = true;
  group.add(body);

  const chestTear = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.58, 0.04), blood);
  chestTear.position.set(0.16, 1.5, -0.49);
  chestTear.rotation.z = -0.18;
  group.add(chestTear);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.42, 18, 14), deadSkin);
  head.position.set(0.02, 2.58, -0.26);
  head.scale.set(0.92, 1.12, 0.86);
  head.rotation.z = -0.22;
  head.castShadow = true;
  group.add(head);

  const hair = new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 0.5, 4, 7), dark);
  hair.position.set(-0.12, 2.92, -0.18);
  hair.rotation.z = 0.65;
  hair.castShadow = true;
  group.add(hair);

  const eyeMat = new THREE.MeshBasicMaterial({ color: 0xf1f6c9 });
  const eyeGeo = new THREE.SphereGeometry(0.045, 8, 8);
  const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
  const rightEye = leftEye.clone();
  leftEye.position.set(-0.13, 2.63, -0.63);
  rightEye.position.set(0.17, 2.62, -0.63);
  group.add(leftEye, rightEye);

  const cheek = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.08, 0.04), blood);
  cheek.position.set(0.22, 2.48, -0.62);
  cheek.rotation.z = 0.25;
  group.add(cheek);

  const jaw = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.11, 0.16), dark);
  jaw.position.set(0.04, 2.36, -0.62);
  jaw.rotation.z = -0.12;
  group.add(jaw);

  for (const side of [-1, 1]) {
    const sleeve = new THREE.Mesh(new THREE.CapsuleGeometry(0.12, 0.48, 4, 8), shirt);
    sleeve.position.set(side * 0.58, 1.8, -0.12);
    sleeve.rotation.z = side * 0.45;
    sleeve.rotation.x = -0.22;
    sleeve.castShadow = true;
    group.add(sleeve);
    walkParts.push({ part: sleeve, side, baseX: sleeve.rotation.x, baseZ: sleeve.rotation.z });

    const forearm = new THREE.Mesh(new THREE.CapsuleGeometry(0.105, 0.76, 4, 8), deadSkin);
    forearm.position.set(side * 0.9, 1.32, -0.52);
    forearm.rotation.z = side * 0.28;
    forearm.rotation.x = -1.02;
    forearm.castShadow = true;
    group.add(forearm);
    walkParts.push({ part: forearm, side, baseX: forearm.rotation.x, baseZ: forearm.rotation.z });

    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), deadSkin);
    hand.position.set(side * 1.02, 1.08, -0.88);
    hand.scale.set(0.8, 0.58, 1.15);
    hand.castShadow = true;
    group.add(hand);

    for (let i = 0; i < 3; i++) {
      const finger = new THREE.Mesh(new THREE.ConeGeometry(0.025, 0.28, 5), bone);
      finger.position.set(side * (1.0 + i * 0.045), 1.0, -1.02);
      finger.rotation.x = Math.PI / 2;
      finger.castShadow = true;
      group.add(finger);
    }

    const thigh = new THREE.Mesh(new THREE.CapsuleGeometry(0.15, 0.78, 4, 8), pants);
    thigh.position.set(side * 0.26, 0.78, 0.03);
    thigh.rotation.x = side > 0 ? -0.18 : 0.24;
    thigh.castShadow = true;
    group.add(thigh);
    walkParts.push({ part: thigh, side, baseX: thigh.rotation.x, baseZ: thigh.rotation.z });

    const shin = new THREE.Mesh(new THREE.CapsuleGeometry(0.13, 0.7, 4, 8), pants);
    shin.position.set(side * 0.28, 0.24, side > 0 ? -0.16 : 0.16);
    shin.rotation.x = side > 0 ? 0.38 : -0.24;
    shin.castShadow = true;
    group.add(shin);
    walkParts.push({ part: shin, side, baseX: shin.rotation.x, baseZ: shin.rotation.z });

    const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.14, 0.5), dark);
    shoe.position.set(side * 0.28, 0.03, -0.22);
    shoe.castShadow = true;
    group.add(shoe);
  }

  const rag = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.08, 0.04), bone);
  rag.position.set(-0.22, 1.08, -0.51);
  rag.rotation.z = 0.8;
  group.add(rag);

  group.rotation.z = randomRange(-0.08, 0.08);
  group.userData.walkParts = walkParts;
  group.userData.phase = randomRange(0, Math.PI * 2);
  group.userData.baseRotZ = group.rotation.z;

  return group;
}

function makePickup(kind: PickupKind) {
  const group = new THREE.Group();
  const textures = worldTextures();
  const metal = new THREE.MeshStandardMaterial({ color: 0xd8dde4, metalness: 0.45, roughness: 0.28 });
  const darkMetal = new THREE.MeshStandardMaterial({ color: 0x252422, metalness: 0.32, roughness: 0.42 });
  const leather = new THREE.MeshStandardMaterial({ color: 0x4a2f22, roughness: 0.82 });
  const wood = new THREE.MeshStandardMaterial({ color: 0x6a4428, roughness: 0.8 });

  if (kind === 'medkit') {
    const bag = new THREE.Mesh(new THREE.BoxGeometry(1.28, 0.68, 0.95), new THREE.MeshStandardMaterial({ color: 0xf0eee8, map: textures.medkit, roughness: 0.55 }));
    const lid = new THREE.Mesh(new THREE.BoxGeometry(1.34, 0.1, 1.0), new THREE.MeshStandardMaterial({ color: 0xc9c6bd, roughness: 0.58 }));
    const crossA = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.08, 0.58), new THREE.MeshStandardMaterial({ color: 0xb92828, roughness: 0.5 }));
    const crossB = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.08, 0.18), new THREE.MeshStandardMaterial({ color: 0xb92828, roughness: 0.5 }));
    lid.position.y = 0.39;
    crossA.position.set(0, 0.46, -0.48);
    crossB.position.set(0, 0.46, -0.48);
    group.add(bag, lid, crossA, crossB);
  } else if (kind === 'crystal') {
    const core = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.72, 1),
      new THREE.MeshStandardMaterial({ color: 0x54d6ff, emissive: 0x0a5266, emissiveIntensity: 0.55, roughness: 0.28 }),
    );
    const shard = new THREE.Mesh(
      new THREE.ConeGeometry(0.18, 0.65, 5),
      new THREE.MeshStandardMaterial({ color: 0xb6f2ff, emissive: 0x1a6c82, emissiveIntensity: 0.38, roughness: 0.25 }),
    );
    shard.position.set(0.42, 0.12, 0.05);
    shard.rotation.z = -0.45;
    group.add(core, shard);
  } else if (kind === 'revive') {
    const vial = new THREE.Mesh(
      new THREE.CylinderGeometry(0.18, 0.22, 0.92, 16),
      new THREE.MeshStandardMaterial({ color: 0x8cffb8, emissive: 0x1c8f55, emissiveIntensity: 0.55, roughness: 0.24, transparent: true, opacity: 0.82 }),
    );
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.16, 16), darkMetal);
    const glow = new THREE.Mesh(
      new THREE.SphereGeometry(0.34, 16, 10),
      new THREE.MeshBasicMaterial({ color: 0x8cffb8, transparent: true, opacity: 0.22 }),
    );
    vial.position.y = 0.12;
    cap.position.y = 0.66;
    group.add(vial, cap, glow);
  } else if (kind === 'key') {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.43, 0.07, 10, 24), new THREE.MeshStandardMaterial({ color: 0xffd34d, metalness: 0.55, roughness: 0.24, emissive: 0x3d2a00, emissiveIntensity: 0.2 }));
    const stem = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.1, 0.88), ring.material);
    const toothA = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.11, 0.16), ring.material);
    const toothB = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.11, 0.16), ring.material);
    stem.position.z = -0.62;
    toothA.position.set(0.14, 0, -1.04);
    toothB.position.set(-0.1, 0, -0.86);
    group.add(ring, stem, toothA, toothB);
  } else if (kind === 'code') {
    const scroll = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.06, 0.86), new THREE.MeshStandardMaterial({ color: 0xf2e5b8, roughness: 0.75 }));
    const seal = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.08, 14), new THREE.MeshStandardMaterial({ color: 0x9f1f20, roughness: 0.5 }));
    const lineA = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.02, 0.035), darkMetal);
    const lineB = lineA.clone();
    seal.position.set(0.36, 0.07, -0.18);
    lineA.position.set(-0.18, 0.08, -0.12);
    lineB.position.set(-0.12, 0.08, 0.12);
    group.add(scroll, seal, lineA, lineB);
  } else if (kind === 'rifle') {
    const stock = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.28, 0.82), wood);
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 2.1, 12), new THREE.MeshStandardMaterial({ color: 0xbfc1c0, map: textures.servicePistol, metalness: 0.55, roughness: 0.32 }));
    const trigger = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.025, 8, 14), darkMetal);
    stock.position.z = 0.58;
    barrel.position.z = -0.5;
    barrel.rotation.x = Math.PI / 2;
    trigger.position.set(0, -0.24, 0.18);
    group.add(stock, barrel, trigger);
  } else if (kind === 'sabre') {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.05, 1.85), metal);
    const guard = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.035, 8, 18), metal);
    const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.42, 10), leather);
    blade.position.z = -0.45;
    guard.rotation.x = Math.PI / 2;
    grip.position.z = 0.7;
    grip.rotation.x = Math.PI / 2;
    group.add(blade, guard, grip);
  } else if (kind === 'club') {
    const handle = new THREE.Mesh(new THREE.CapsuleGeometry(0.12, 1.25, 5, 10), wood);
    const head = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 0.52, 5, 10), new THREE.MeshStandardMaterial({ color: 0x5a3520, roughness: 0.88 }));
    handle.rotation.x = Math.PI / 2;
    head.rotation.x = Math.PI / 2;
    head.position.z = -0.72;
    group.add(handle, head);
  } else {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.05, 0.92), new THREE.MeshStandardMaterial({ color: 0xd8dde4, map: textures.fishKnife, metalness: 0.48, roughness: 0.25 }));
    const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.42, 10), leather);
    blade.position.z = -0.26;
    grip.position.z = 0.48;
    grip.rotation.x = Math.PI / 2;
    group.add(blade, grip);
  }

  group.traverse((part) => {
    if (part instanceof THREE.Mesh) part.castShadow = true;
  });
  group.position.y = kind === 'code' ? 0.14 : kind === 'medkit' ? 0.52 : 0.82;
  if (kind === 'rifle' || kind === 'sabre' || kind === 'knife' || kind === 'club' || kind === 'key') group.rotation.x = Math.PI / 2;
  return group;
}

function makeKnifeSkinModel(skinId: string) {
  const skin = KNIFE_SKINS.find((item) => item.id === skinId) ?? KNIFE_SKINS[0];
  const group = new THREE.Group();
  const rarityColor = new THREE.Color(SKIN_RARITY_COLORS[skin.rarity]);
  const visual = KNIFE_SKIN_VISUALS[skin.id] ?? KNIFE_SKIN_VISUALS.butterfly_fade;
  const textures = worldTextures();
  const bladeMat = new THREE.MeshStandardMaterial({
    color: visual.blade,
    map: textures.fishKnife,
    emissive: rarityColor,
    emissiveIntensity: skin.rarity === 'Legendary' ? 0.16 : skin.rarity === 'Epic' ? 0.09 : 0.03,
    metalness: 0.62,
    roughness: 0.2,
  });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x171717, metalness: 0.35, roughness: 0.42 });
  const gripMat = new THREE.MeshStandardMaterial({
    color: visual.grip,
    metalness: 0.12,
    roughness: 0.72,
  });
  const accentMat = new THREE.MeshStandardMaterial({ color: visual.accent, emissive: rarityColor, emissiveIntensity: 0.05, metalness: 0.45, roughness: 0.28 });

  const addGrip = (length = 0.58, radius = 0.065) => {
    const grip = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius * 1.15, length, 12), gripMat);
    grip.rotation.x = Math.PI / 2;
    grip.position.z = 0.42;
    group.add(grip);
    return grip;
  };

  if (skin.shape === 'butterfly') {
    const leftHandle = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.08, 0.72), gripMat);
    const rightHandle = leftHandle.clone();
    leftHandle.position.set(-0.085, 0, 0.32);
    rightHandle.position.set(0.085, 0, 0.32);
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.045, 0.96), bladeMat);
    blade.position.z = -0.42;
    const stripeA = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.052, 0.56), accentMat);
    const stripeB = stripeA.clone();
    stripeA.position.set(-0.086, 0, 0.32);
    stripeB.position.set(0.086, 0, 0.32);
    const latch = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.015, 8, 18), accentMat);
    latch.rotation.x = Math.PI / 2;
    latch.position.z = 0.72;
    group.add(leftHandle, rightHandle, blade, stripeA, stripeB, latch);
  } else if (skin.shape === 'stiletto') {
    addGrip(0.62, 0.055);
    const blade = new THREE.Mesh(new THREE.ConeGeometry(0.11, 1.18, 4), bladeMat);
    blade.rotation.x = Math.PI / 2;
    blade.position.z = -0.42;
    const bloodline = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.054, 0.66), accentMat);
    bloodline.position.z = -0.44;
    const guard = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.05, 0.08), accentMat);
    guard.position.z = 0.06;
    group.add(blade, bloodline, guard);
  } else if (skin.shape === 'karambit') {
    addGrip(0.52, 0.06);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.027, 10, 24), darkMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.z = 0.74;
    const blade = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.045, 8, 36, Math.PI * 1.18), bladeMat);
    blade.rotation.set(Math.PI / 2, 0, -0.95);
    blade.position.set(0.22, 0, -0.22);
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.24, 8), bladeMat);
    tip.rotation.set(0, 0, -0.8);
    tip.position.set(0.47, 0, -0.52);
    const charm = new THREE.Mesh(new THREE.SphereGeometry(0.055, 10, 8), accentMat);
    charm.position.set(-0.1, 0, 0.58);
    group.add(ring, blade, tip, charm);
  } else if (skin.shape === 'bowie') {
    addGrip(0.62, 0.075);
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.055, 1.1), bladeMat);
    blade.position.z = -0.42;
    blade.scale.x = 1.25;
    const oxidePatch = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.058, 0.28), accentMat);
    oxidePatch.position.set(0.055, 0, -0.5);
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.32, 4), bladeMat);
    tip.rotation.x = Math.PI / 2;
    tip.position.z = -1.14;
    const guard = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.06, 0.08), darkMat);
    guard.position.z = 0.08;
    group.add(blade, oxidePatch, tip, guard);
  } else if (skin.shape === 'gut') {
    addGrip(0.58, 0.07);
    const blade = new THREE.Mesh(new THREE.CapsuleGeometry(0.13, 0.82, 5, 12), bladeMat);
    blade.rotation.x = Math.PI / 2;
    blade.position.z = -0.48;
    blade.scale.x = 0.74;
    const hook = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.025, 8, 20, Math.PI * 0.85), bladeMat);
    hook.rotation.set(Math.PI / 2, 0, 0.45);
    hook.position.set(0.14, 0, -0.9);
    const inlay = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.055, 0.62), accentMat);
    inlay.position.z = -0.46;
    group.add(blade, hook, inlay);
  } else {
    addGrip(0.72, 0.058);
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.105, 0.045, 1.36), bladeMat);
    blade.position.z = -0.62;
    const fuller = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.052, 0.82), darkMat);
    fuller.position.z = -0.55;
    const guard = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.05, 0.08), accentMat);
    guard.position.z = 0.08;
    group.add(blade, fuller, guard);
  }

  group.traverse((part) => {
    if (part instanceof THREE.Mesh) {
      part.castShadow = true;
      part.receiveShadow = true;
    }
  });
  return group;
}

function makeHeldItemModel(kind: PickupKind, knifeSkinId: string) {
  return kind === 'knife' ? makeKnifeSkinModel(knifeSkinId) : makePickup(kind);
}

function knifePreviewStyle(skin: KnifeSkin): CSSProperties {
  const visual = KNIFE_SKIN_VISUALS[skin.id] ?? KNIFE_SKIN_VISUALS.butterfly_fade;
  return {
    background: visual.ui,
    clipPath: visual.clip,
    boxShadow: `0 0 18px ${SKIN_RARITY_COLORS[skin.rarity]}33`,
  };
}

function makeFortress(x: number, z: number, fake = false) {
  const fortress = new THREE.Group();
  const stone = new THREE.MeshStandardMaterial({ color: fake ? 0x8a735f : 0x7f8178, roughness: 0.9 });
  const dark = new THREE.MeshStandardMaterial({ color: fake ? 0x2a1711 : 0x17191f, roughness: 0.9 });

  const wall = new THREE.Mesh(new THREE.BoxGeometry(fake ? 26 : 38, fake ? 6 : 9, 4), stone);
  wall.position.set(0, fake ? 3 : 4.5, 0);
  wall.castShadow = true;
  wall.receiveShadow = true;
  fortress.add(wall);

  for (const towerX of [fake ? -13 : -19, fake ? 13 : 19]) {
    const tower = new THREE.Mesh(
      new THREE.CylinderGeometry(fake ? 2.4 : 3.4, fake ? 3 : 4, fake ? 9 : 13, 12),
      stone,
    );
    tower.position.set(towerX, fake ? 4.5 : 6.5, 0);
    tower.castShadow = true;
    tower.receiveShadow = true;
    fortress.add(tower);
  }

  const gate = new THREE.Mesh(new THREE.BoxGeometry(fake ? 5 : 7, fake ? 4 : 6, 4.2), dark);
  gate.position.set(0, fake ? 2 : 3, 2.2);
  fortress.add(gate);

  if (fake) {
    const sign = new THREE.Mesh(
      new THREE.BoxGeometry(7, 0.55, 0.4),
      new THREE.MeshStandardMaterial({ color: 0x3b2119, roughness: 0.8 }),
    );
    sign.position.set(0, 6.7, 2.8);
    fortress.add(sign);
  }

  fortress.position.set(x, 0, z);
  return fortress;
}

function makeRockCluster() {
  const group = new THREE.Group();
  const textures = worldTextures();
  const mat = new THREE.MeshStandardMaterial({ color: 0x8f8a7f, map: textures.boulder, bumpMap: textures.rock, bumpScale: 0.09, roughness: 0.96 });
  const mossMat = new THREE.MeshStandardMaterial({ color: 0x7f9172, map: textures.rockMoss, bumpMap: textures.rock, bumpScale: 0.06, roughness: 0.98 });
  const count = 3 + Math.floor(Math.random() * 4);
  for (let i = 0; i < count; i++) {
    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(randomRange(0.35, 1.1), 0), i % 3 === 0 ? mossMat : mat);
    rock.position.set(randomRange(-1.4, 1.4), randomRange(0.18, 0.45), randomRange(-1.1, 1.1));
    rock.scale.set(randomRange(1.0, 1.8), randomRange(0.45, 0.95), randomRange(0.8, 1.4));
    rock.rotation.set(randomRange(0, 1.2), randomRange(0, Math.PI), randomRange(0, 0.8));
    rock.castShadow = true;
    rock.receiveShadow = true;
    group.add(rock);
  }
  return group;
}

function makeDryTree() {
  const group = new THREE.Group();
  const textures = worldTextures();
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x6b503b, map: textures.stump, bumpMap: textures.bark, bumpScale: 0.08, roughness: 0.94 });
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.27, 3.2, 7), trunkMat);
  trunk.position.y = 1.6;
  trunk.rotation.z = randomRange(-0.18, 0.18);
  trunk.castShadow = true;
  group.add(trunk);

  for (const side of [-1, 1]) {
    const branch = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.11, 1.65, 6), trunkMat);
    branch.position.set(side * 0.46, 2.65, 0);
    branch.rotation.z = side * 0.82;
    branch.rotation.x = randomRange(-0.25, 0.25);
    branch.castShadow = true;
    group.add(branch);
  }
  return group;
}

function makeForestTree() {
  const group = new THREE.Group();
  const textures = worldTextures();
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x7a573a, map: textures.islandBark, bumpMap: textures.bark, bumpScale: 0.08, roughness: 0.88 });
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x6ca968, map: textures.islandLeaves, bumpMap: textures.leaves, bumpScale: 0.045, roughness: 0.78 });
  const darkLeafMat = new THREE.MeshStandardMaterial({ color: 0x497a4d, map: textures.islandLeaves, bumpMap: textures.leaves, bumpScale: 0.04, roughness: 0.84 });
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.32, 3.4, 8), trunkMat);
  trunk.position.y = 1.7;
  trunk.castShadow = true;
  group.add(trunk);

  for (let i = 0; i < 3; i++) {
    const crown = new THREE.Mesh(new THREE.ConeGeometry(1.25 - i * 0.18, 1.65, 9), i % 2 === 0 ? leafMat : darkLeafMat);
    crown.position.y = 2.75 + i * 0.72;
    crown.castShadow = true;
    group.add(crown);
  }
  for (let i = 0; i < 5; i++) {
    const cluster = new THREE.Mesh(new THREE.DodecahedronGeometry(randomRange(0.34, 0.58), 1), i % 2 === 0 ? leafMat : darkLeafMat);
    cluster.position.set(randomRange(-0.78, 0.78), randomRange(2.55, 4.25), randomRange(-0.68, 0.68));
    cluster.scale.set(randomRange(1.0, 1.55), randomRange(0.72, 1.05), randomRange(1.0, 1.45));
    cluster.castShadow = true;
    group.add(cluster);
  }
  return group;
}

function makeJacarandaTree() {
  const group = new THREE.Group();
  const textures = worldTextures();
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x73543c, map: textures.islandBark, bumpMap: textures.bark, bumpScale: 0.08, roughness: 0.88 });
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x9b86dd, map: textures.islandLeaves, bumpMap: textures.leaves, bumpScale: 0.028, roughness: 0.78 });
  const bloomMat = new THREE.MeshStandardMaterial({ color: 0xc6a8ff, emissive: 0x5a3f91, emissiveIntensity: 0.12, roughness: 0.7 });

  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.34, 3.2, 8), trunkMat);
  trunk.position.y = 1.6;
  trunk.rotation.z = randomRange(-0.08, 0.08);
  trunk.castShadow = true;
  group.add(trunk);

  for (const side of [-1, 1]) {
    const branch = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.13, 1.55, 7), trunkMat);
    branch.position.set(side * 0.44, 2.55, 0);
    branch.rotation.z = side * 0.72;
    branch.rotation.x = randomRange(-0.24, 0.24);
    branch.castShadow = true;
    group.add(branch);
  }

  for (let i = 0; i < 5; i++) {
    const crown = new THREE.Mesh(new THREE.DodecahedronGeometry(randomRange(0.78, 1.14), 1), i % 2 === 0 ? leafMat : bloomMat);
    crown.position.set(randomRange(-0.95, 0.95), randomRange(3.05, 4.15), randomRange(-0.85, 0.85));
    crown.scale.set(randomRange(1.1, 1.65), randomRange(0.65, 1.0), randomRange(1.0, 1.45));
    crown.castShadow = true;
    group.add(crown);
  }
  return group;
}

function makeAssetTree(cx = 0, cz = 0, salt = 0) {
  return hash2(cx, cz, salt) > 0.56 ? makeJacarandaTree() : makeForestTree();
}

function makeMountain() {
  const group = new THREE.Group();
  const textures = worldTextures();
  const rockMat = new THREE.MeshStandardMaterial({ color: 0x73736b, map: textures.rockyTerrain, bumpMap: textures.rockMoss, bumpScale: 0.16, roughness: 0.98, flatShading: true });
  const mossMat = new THREE.MeshStandardMaterial({ color: 0x66775e, map: textures.rockMoss, bumpMap: textures.rock, bumpScale: 0.09, roughness: 0.98, flatShading: true });
  const snowMat = new THREE.MeshStandardMaterial({ color: 0xd9e5e2, map: textures.snow, bumpMap: textures.snow, bumpScale: 0.025, roughness: 0.82, flatShading: true });
  const height = randomRange(4.5, 8.5);
  const base = randomRange(3.5, 6.2);
  const peak = new THREE.Mesh(new THREE.ConeGeometry(base, height, 6), rockMat);
  peak.position.y = height / 2;
  peak.rotation.y = randomRange(0, Math.PI);
  peak.castShadow = true;
  peak.receiveShadow = true;
  group.add(peak);

  const cap = new THREE.Mesh(new THREE.ConeGeometry(base * 0.34, height * 0.24, 6), snowMat);
  cap.position.y = height * 0.88;
  cap.rotation.y = peak.rotation.y;
  cap.castShadow = true;
  group.add(cap);

  for (let i = 0; i < 3; i++) {
    const shoulder = new THREE.Mesh(new THREE.ConeGeometry(base * randomRange(0.35, 0.62), height * randomRange(0.35, 0.58), 5), i % 2 === 0 ? mossMat : rockMat);
    shoulder.position.set(randomRange(-base * 0.52, base * 0.52), shoulder.geometry.parameters.height / 2, randomRange(-base * 0.52, base * 0.52));
    shoulder.rotation.y = randomRange(0, Math.PI);
    shoulder.castShadow = true;
    shoulder.receiveShadow = true;
    group.add(shoulder);
  }
  return group;
}

function makeRiverSegment(size: number) {
  const group = new THREE.Group();
  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(size * 1.16, 18, 8, 2),
    makeWaterShaderMaterial(),
  );
  water.userData.shader = 'water';
  water.rotation.x = -Math.PI / 2;
  water.position.y = 0.045;
  water.rotation.z = randomRange(-0.24, 0.24);
  group.add(water);

  const shoreMat = new THREE.MeshStandardMaterial({ color: 0x827852, map: worldTextures().soil, bumpMap: worldTextures().soil, bumpScale: 0.045, roughness: 0.98 });
  for (const side of [-1, 1]) {
    const shore = new THREE.Mesh(new THREE.PlaneGeometry(size * 1.12, 3.2), shoreMat);
    shore.rotation.x = -Math.PI / 2;
    shore.rotation.z = water.rotation.z;
    shore.position.set(0, 0.052, side * 10.5);
    group.add(shore);
  }
  return group;
}

function makeGroundShaderMaterial(seed = 0) {
  const textures = worldTextures();
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uSeed: { value: seed },
      uFogNear: { value: 95 },
      uFogFar: { value: 340 },
      uFogColor: { value: new THREE.Color(0x9fb7c9) },
      uGrassTex: { value: textures.grass },
      uSoilTex: { value: textures.rockyTerrain },
      uRockTex: { value: textures.rockMoss },
    },
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vWorld;
      varying float vHeight;
      uniform float uSeed;
      void main() {
        vUv = uv;
        vec3 p = position;
        float ridge = sin((p.x + ${CHUNK_SIZE.toFixed(1)}) * 0.075 + uSeed) * 0.42 + cos(p.y * 0.06 - uSeed) * 0.38;
        p.z += ridge;
        vec4 world = modelMatrix * vec4(p, 1.0);
        vWorld = world.xyz;
        vHeight = ridge;
        gl_Position = projectionMatrix * viewMatrix * world;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform float uSeed;
      uniform float uFogNear;
      uniform float uFogFar;
      uniform vec3 uFogColor;
      uniform sampler2D uGrassTex;
      uniform sampler2D uSoilTex;
      uniform sampler2D uRockTex;
      varying vec2 vUv;
      varying vec3 vWorld;
      varying float vHeight;
      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7)) + uSeed) * 43758.5453);
      }
      float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        float a = hash(i);
        float b = hash(i + vec2(1.0, 0.0));
        float c = hash(i + vec2(0.0, 1.0));
        float d = hash(i + vec2(1.0, 1.0));
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
      }
      void main() {
        float n = noise(vWorld.xz * 0.055);
        float fine = noise(vWorld.xz * 0.22 + uTime * 0.015);
        float grit = noise(vWorld.xz * 1.35 + uSeed * 0.17);
        float blades = noise(vec2(vWorld.x * 0.82, vWorld.z * 3.4));
        float pebble = smoothstep(0.88, 0.985, noise(vWorld.xz * 2.15 + 19.0));
        vec2 worldUv = vWorld.xz * 0.055;
        vec3 grassTex = texture2D(uGrassTex, worldUv * 1.8).rgb;
        vec3 soilTex = texture2D(uSoilTex, worldUv * 1.25 + vec2(0.17, 0.31)).rgb;
        vec3 rockTex = texture2D(uRockTex, worldUv * 1.55 + vec2(0.43, 0.08)).rgb;
        vec3 grass = mix(vec3(0.22, 0.36, 0.18), grassTex * vec3(0.72, 0.9, 0.6), 0.68);
        vec3 dry = mix(vec3(0.62, 0.52, 0.29), soilTex * vec3(0.96, 0.84, 0.58), 0.74);
        vec3 damp = mix(vec3(0.17, 0.28, 0.21), grassTex * vec3(0.42, 0.58, 0.42), 0.45);
        vec3 rock = mix(vec3(0.42, 0.42, 0.35), rockTex * vec3(0.86, 0.88, 0.78), 0.72);
        vec3 color = mix(dry, grass, smoothstep(0.22, 0.78, n));
        color = mix(color, damp, smoothstep(0.72, 0.95, fine) * 0.38);
        color = mix(color, rock, smoothstep(0.58, 1.05, abs(vHeight)));
        color += (grit - 0.5) * 0.2;
        color = mix(color, color + vec3(0.12, 0.16, 0.04), smoothstep(0.5, 0.86, blades) * 0.3);
        color = mix(color, vec3(0.28, 0.27, 0.23), pebble * 0.42);
        float light = 0.78 + 0.22 * smoothstep(-0.35, 0.55, vHeight);
        color *= light;
        float dist = length(cameraPosition.xz - vWorld.xz);
        float fog = smoothstep(uFogNear, uFogFar, dist);
        color = pow(max(color, vec3(0.0)), vec3(0.92));
        gl_FragColor = vec4(mix(color, uFogColor, fog * 0.62), 1.0);
      }
    `,
  });
}

function makeWaterShaderMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true,
    uniforms: {
      uTime: { value: 0 },
      uFogColor: { value: new THREE.Color(0x9fb7c9) },
    },
    vertexShader: `
      uniform float uTime;
      varying vec2 vUv;
      varying vec3 vWorld;
      void main() {
        vUv = uv;
        vec3 p = position;
        p.z += sin(p.x * 0.18 + uTime * 1.8) * 0.16 + cos(p.y * 0.35 + uTime * 1.2) * 0.08;
        vec4 world = modelMatrix * vec4(p, 1.0);
        vWorld = world.xyz;
        gl_Position = projectionMatrix * viewMatrix * world;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform vec3 uFogColor;
      varying vec2 vUv;
      varying vec3 vWorld;
      void main() {
        float ripple = sin(vUv.x * 42.0 + uTime * 3.4) * 0.5 + sin((vUv.x + vUv.y) * 24.0 - uTime * 2.2) * 0.5;
        float fineRipple = sin(vWorld.x * 0.9 + uTime * 4.8) * sin(vWorld.z * 0.7 - uTime * 3.1);
        float shine = smoothstep(0.68, 0.98, ripple);
        float foam = smoothstep(0.02, 0.09, min(vUv.y, 1.0 - vUv.y)) * (1.0 - smoothstep(0.09, 0.18, min(vUv.y, 1.0 - vUv.y)));
        vec3 deep = vec3(0.06, 0.36, 0.48);
        vec3 shallow = vec3(0.18, 0.68, 0.78);
        vec3 color = mix(deep, shallow, vUv.y);
        color += shine * vec3(0.45, 0.72, 0.78);
        color += fineRipple * vec3(0.025, 0.055, 0.06);
        color = mix(color, vec3(0.72, 0.92, 0.9), foam * 0.34);
        float dist = length(cameraPosition.xz - vWorld.xz);
        float fog = smoothstep(120.0, 360.0, dist);
        color = pow(max(color, vec3(0.0)), vec3(0.88));
        gl_FragColor = vec4(mix(color, uFogColor, fog * 0.42), 0.82);
      }
    `,
  });
}

function makeSkyDome() {
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(520, 32, 16),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        uTop: { value: new THREE.Color(0x6ea7c5) },
        uHorizon: { value: new THREE.Color(0xf0d79b) },
        uNight: { value: new THREE.Color(0x16252f) },
        uMix: { value: 0 },
      },
      vertexShader: `
        varying vec3 vWorld;
        void main() {
          vec4 world = modelMatrix * vec4(position, 1.0);
          vWorld = normalize(world.xyz);
          gl_Position = projectionMatrix * viewMatrix * world;
        }
      `,
      fragmentShader: `
        uniform vec3 uTop;
        uniform vec3 uHorizon;
        uniform vec3 uNight;
        uniform float uMix;
        varying vec3 vWorld;
        void main() {
          float h = smoothstep(-0.08, 0.72, vWorld.y);
          vec3 day = mix(uHorizon, uTop, h);
          vec3 col = mix(day, uNight, uMix);
          float sun = pow(max(dot(vWorld, normalize(vec3(-0.35, 0.82, 0.28))), 0.0), 180.0);
          col += sun * vec3(1.0, 0.72, 0.38);
          gl_FragColor = vec4(col, 1.0);
        }
      `,
    }),
  );
  sky.frustumCulled = false;
  return sky;
}

function makeRuin() {
  const group = new THREE.Group();
  const stone = new THREE.MeshStandardMaterial({ color: 0x817a6d, map: worldTextures().rock, bumpMap: worldTextures().rock, bumpScale: 0.08, roughness: 0.98 });
  for (let i = 0; i < 6; i++) {
    const block = new THREE.Mesh(new THREE.BoxGeometry(randomRange(1.0, 2.2), randomRange(0.5, 1.6), randomRange(0.55, 1.1)), stone);
    block.position.set(randomRange(-3.2, 3.2), block.geometry.parameters.height / 2, randomRange(-1.8, 1.8));
    block.rotation.y = randomRange(-0.45, 0.45);
    block.castShadow = true;
    block.receiveShadow = true;
    group.add(block);
  }
  return group;
}

function makeCampDebris() {
  const group = new THREE.Group();
  const ash = new THREE.MeshStandardMaterial({ color: 0x2a2926, roughness: 0.9 });
  const wood = new THREE.MeshStandardMaterial({ color: 0x593821, map: worldTextures().bark, bumpMap: worldTextures().bark, bumpScale: 0.07, roughness: 0.88 });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1.05, 0.08, 8, 22), ash);
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.06;
  group.add(ring);

  for (let i = 0; i < 4; i++) {
    const log = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 1.4, 7), wood);
    log.position.y = 0.15;
    log.rotation.set(Math.PI / 2, 0, (Math.PI / 4) * i);
    log.castShadow = true;
    group.add(log);
  }
  return group;
}

function makeDetailPatch(kindSeed = 0) {
  const group = new THREE.Group();
  const textures = worldTextures();
  const twigMat = new THREE.MeshStandardMaterial({ color: 0x4b301f, map: textures.stump, bumpMap: textures.bark, bumpScale: 0.05, roughness: 0.92 });
  const flowerMat = new THREE.MeshStandardMaterial({ color: kindSeed % 3 === 0 ? 0xd6c35f : kindSeed % 3 === 1 ? 0xc78464 : 0x8fb36b, roughness: 0.86 });
  const bushMat = new THREE.MeshStandardMaterial({ color: kindSeed % 2 === 0 ? 0x314f32 : 0x55663a, map: textures.islandLeaves, bumpMap: textures.leaves, bumpScale: 0.025, roughness: 0.94 });
  const pebbleMat = new THREE.MeshStandardMaterial({ color: 0x77746a, map: textures.rockMoss, bumpMap: textures.rock, bumpScale: 0.06, roughness: 0.98 });

  for (let i = 0; i < 5; i++) {
    const pebble = new THREE.Mesh(new THREE.DodecahedronGeometry(randomRange(0.08, 0.24), 0), pebbleMat);
    pebble.position.set(randomRange(-1.6, 1.6), randomRange(0.04, 0.1), randomRange(-1.3, 1.3));
    pebble.scale.set(randomRange(1, 1.8), randomRange(0.35, 0.7), randomRange(0.8, 1.5));
    pebble.rotation.set(randomRange(0, 1), randomRange(0, Math.PI), randomRange(0, 1));
    pebble.castShadow = true;
    group.add(pebble);
  }

  for (let i = 0; i < 3; i++) {
    const twig = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.045, randomRange(0.7, 1.45), 6), twigMat);
    twig.position.set(randomRange(-1.2, 1.2), 0.08, randomRange(-1.2, 1.2));
    twig.rotation.set(Math.PI / 2 + randomRange(-0.2, 0.2), randomRange(0, Math.PI), randomRange(0, Math.PI));
    twig.castShadow = true;
    group.add(twig);
  }

  const bush = new THREE.Mesh(new THREE.DodecahedronGeometry(randomRange(0.35, 0.72), 1), bushMat);
  bush.position.set(randomRange(-0.8, 0.8), 0.35, randomRange(-0.8, 0.8));
  bush.scale.set(1.45, 0.68, 1.1);
  bush.castShadow = true;
  group.add(bush);

  for (let i = 0; i < 4; i++) {
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.018, randomRange(0.3, 0.62), 5), bushMat);
    const bloom = new THREE.Mesh(new THREE.SphereGeometry(0.055, 7, 5), flowerMat);
    stem.position.set(randomRange(-1.1, 1.1), 0.22, randomRange(-1.1, 1.1));
    bloom.position.set(stem.position.x, stem.position.y + 0.28, stem.position.z);
    group.add(stem, bloom);
  }

  return group;
}

function makeTreeStump() {
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0x6a4b33, map: worldTextures().stump, bumpMap: worldTextures().bark, bumpScale: 0.08, roughness: 0.94 });
  const stump = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.46, 0.72, 9), mat);
  stump.position.y = 0.36;
  stump.castShadow = true;
  stump.receiveShadow = true;
  const top = new THREE.Mesh(new THREE.CylinderGeometry(0.39, 0.39, 0.035, 18), new THREE.MeshStandardMaterial({ color: 0x8b6846, roughness: 0.9 }));
  top.position.y = 0.74;
  group.add(stump, top);
  return group;
}

function makeReedCluster() {
  const group = new THREE.Group();
  const reedMat = new THREE.MeshStandardMaterial({ color: 0x6f7d48, map: worldTextures().grass, bumpMap: worldTextures().grass, bumpScale: 0.03, roughness: 0.96 });
  const cattailMat = new THREE.MeshStandardMaterial({ color: 0x5a3520, roughness: 0.9 });
  for (let i = 0; i < 9; i++) {
    const height = randomRange(0.85, 1.7);
    const reed = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.018, height, 5), reedMat);
    reed.position.set(randomRange(-0.7, 0.7), height / 2, randomRange(-0.55, 0.55));
    reed.rotation.z = randomRange(-0.14, 0.14);
    reed.castShadow = true;
    group.add(reed);
    if (i % 3 === 0) {
      const head = new THREE.Mesh(new THREE.CapsuleGeometry(0.04, 0.18, 5, 8), cattailMat);
      head.position.set(reed.position.x, height + 0.07, reed.position.z);
      head.castShadow = true;
      group.add(head);
    }
  }
  return group;
}

function makeFallenLog() {
  const group = new THREE.Group();
  const barkMat = new THREE.MeshStandardMaterial({ color: 0x6a4b33, map: worldTextures().stump, bumpMap: worldTextures().bark, bumpScale: 0.08, roughness: 0.94 });
  const cutMat = new THREE.MeshStandardMaterial({ color: 0x9c7650, roughness: 0.86 });
  const log = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.34, 2.7, 10), barkMat);
  log.rotation.z = Math.PI / 2;
  log.position.y = 0.33;
  log.castShadow = true;
  log.receiveShadow = true;
  group.add(log);
  for (const x of [-1.36, 1.36]) {
    const cut = new THREE.Mesh(new THREE.CylinderGeometry(0.285, 0.285, 0.035, 14), cutMat);
    cut.rotation.z = Math.PI / 2;
    cut.position.set(x, 0.33, 0);
    group.add(cut);
  }
  for (let i = 0; i < 4; i++) {
    const mushroom = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.055, 0.11, 5, 7),
      new THREE.MeshStandardMaterial({ color: i % 2 === 0 ? 0xd6c18a : 0x9d6d55, roughness: 0.82 }),
    );
    mushroom.position.set(randomRange(-0.9, 0.9), 0.22, randomRange(-0.38, 0.38));
    group.add(mushroom);
  }
  return group;
}

function makeTrailStonePatch() {
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0x8c887f, map: worldTextures().rockyTerrain, bumpMap: worldTextures().rock, bumpScale: 0.08, roughness: 0.98, flatShading: true });
  for (let i = 0; i < 8; i++) {
    const stone = new THREE.Mesh(new THREE.DodecahedronGeometry(randomRange(0.18, 0.42), 0), mat);
    stone.position.set((i - 3.5) * randomRange(0.55, 0.86), randomRange(0.04, 0.1), randomRange(-0.55, 0.55));
    stone.scale.set(randomRange(1.1, 1.9), randomRange(0.2, 0.45), randomRange(0.7, 1.35));
    stone.rotation.set(randomRange(0, 0.7), randomRange(0, Math.PI), randomRange(0, 0.7));
    stone.castShadow = true;
    stone.receiveShadow = true;
    group.add(stone);
  }
  return group;
}

function makeRockyTerrainPatch() {
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({
    color: 0xd0c7b6,
    map: worldTextures().rockyTerrain,
    roughness: 0.98,
    transparent: true,
    opacity: 0.84,
  });
  const patch = new THREE.Mesh(new THREE.CircleGeometry(randomRange(3.5, 7.5), 18), mat);
  patch.rotation.x = -Math.PI / 2;
  patch.position.y = 0.055;
  patch.scale.set(randomRange(1.0, 1.8), randomRange(0.58, 1.1), 1);
  patch.receiveShadow = true;
  group.add(patch);
  return group;
}

function makeCoveredCarWreck() {
  const group = new THREE.Group();
  const carMat = new THREE.MeshStandardMaterial({ color: 0x7d7a70, map: worldTextures().coveredCar, roughness: 0.82, metalness: 0.12 });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x1f211f, roughness: 0.7 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.95, 1.8), carMat);
  body.position.y = 0.75;
  body.castShadow = true;
  body.receiveShadow = true;
  const tarp = new THREE.Mesh(new THREE.CapsuleGeometry(0.75, 2.3, 6, 10), carMat);
  tarp.rotation.z = Math.PI / 2;
  tarp.position.set(0, 1.25, 0);
  tarp.scale.z = 1.15;
  tarp.castShadow = true;
  const hood = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.24, 1.72), carMat);
  hood.position.set(-2.05, 0.88, 0);
  hood.rotation.z = -0.12;
  hood.castShadow = true;
  for (const x of [-1.12, 1.12]) {
    for (const z of [-1.0, 1.0]) {
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.24, 16), darkMat);
      wheel.rotation.x = Math.PI / 2;
      wheel.position.set(x, 0.32, z * 0.72);
      wheel.castShadow = true;
      group.add(wheel);
    }
  }
  group.add(body, tarp, hood);
  return group;
}

function makeMedicalSupplyCache() {
  const group = new THREE.Group();
  const crateMat = new THREE.MeshStandardMaterial({ color: 0xded8c8, map: worldTextures().medkit, roughness: 0.62 });
  for (let i = 0; i < 3; i++) {
    const box = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.62, 0.9), crateMat);
    box.position.set((i - 1) * 0.86, 0.34 + i * 0.06, i % 2 === 0 ? 0.1 : -0.48);
    box.rotation.y = randomRange(-0.22, 0.22);
    box.castShadow = true;
    box.receiveShadow = true;
    group.add(box);
  }
  const pickup = makePickup('medkit');
  pickup.position.set(0, 0.64, -1.05);
  pickup.scale.setScalar(0.85);
  group.add(pickup);
  return group;
}

function makeServicePistolCache() {
  const group = new THREE.Group();
  const cloth = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.5), new THREE.MeshStandardMaterial({ color: 0x4d473d, map: worldTextures().coveredCar, roughness: 0.9 }));
  cloth.rotation.x = -Math.PI / 2;
  cloth.position.y = 0.055;
  group.add(cloth);
  const pistol = makePickup('rifle');
  pistol.position.set(0, 0.28, 0);
  pistol.rotation.set(Math.PI / 2, 0, Math.PI / 2);
  pistol.scale.setScalar(0.82);
  group.add(pistol);
  return group;
}

function makeWoodenPierPatch() {
  const group = new THREE.Group();
  const woodMat = new THREE.MeshStandardMaterial({ color: 0x8b6948, map: worldTextures().stump, bumpMap: worldTextures().bark, bumpScale: 0.045, roughness: 0.9 });
  for (let i = 0; i < 5; i++) {
    const plank = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.14, 0.34), woodMat);
    plank.position.set(0, 0.18, (i - 2) * 0.42);
    plank.rotation.y = randomRange(-0.04, 0.04);
    plank.castShadow = true;
    plank.receiveShadow = true;
    group.add(plank);
  }
  for (const x of [-0.9, 0.9]) {
    for (const z of [-0.75, 0.75]) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 0.8, 7), woodMat);
      pole.position.set(x, 0.3, z);
      pole.castShadow = true;
      group.add(pole);
    }
  }
  return group;
}

function makeHouse(mood: NpcMood) {
  const group = new THREE.Group();
  const wallColor = mood === 'good' ? 0x6f7f63 : mood === 'evil' ? 0x4f3a35 : 0x746957;
  const textures = worldTextures();
  const wall = new THREE.Mesh(
    new THREE.BoxGeometry(8, 4.2, 7),
    new THREE.MeshStandardMaterial({ color: wallColor, map: textures.wall, bumpMap: textures.wall, bumpScale: 0.055, roughness: 0.9 }),
  );
  wall.position.y = 2.1;
  wall.castShadow = true;
  wall.receiveShadow = true;

  const roof = new THREE.Mesh(
    new THREE.ConeGeometry(6.2, 3, 4),
    new THREE.MeshStandardMaterial({ color: mood === 'evil' ? 0x2b1715 : 0x3f2b1f, map: textures.roof, bumpMap: textures.roof, bumpScale: 0.065, roughness: 0.85 }),
  );
  roof.position.y = 5.3;
  roof.rotation.y = Math.PI / 4;
  roof.castShadow = true;

  const door = new THREE.Mesh(
    new THREE.BoxGeometry(1.6, 2.4, 0.18),
    new THREE.MeshStandardMaterial({ color: 0x24160f, map: textures.bark, bumpMap: textures.bark, bumpScale: 0.05, roughness: 0.8 }),
  );
  door.position.set(0, 1.2, -3.6);

  const windowMat = new THREE.MeshBasicMaterial({ color: mood === 'evil' ? 0x9a332d : 0xf0c66a });
  const windowA = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.75, 0.12), windowMat);
  const windowB = windowA.clone();
  windowA.position.set(-2.4, 2.35, -3.64);
  windowB.position.set(2.4, 2.35, -3.64);

  const beamMat = new THREE.MeshStandardMaterial({ color: 0x372417, map: textures.bark, bumpMap: textures.bark, bumpScale: 0.045, roughness: 0.88 });
  const trimMat = new THREE.MeshStandardMaterial({ color: 0x22150d, map: textures.bark, bumpMap: textures.bark, bumpScale: 0.04, roughness: 0.82 });
  for (const x of [-3.75, 3.75]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.28, 4.55, 0.24), beamMat);
    post.position.set(x, 2.28, -3.64);
    post.castShadow = true;
    group.add(post);
  }
  for (const y of [0.42, 4.18]) {
    const beam = new THREE.Mesh(new THREE.BoxGeometry(8.25, 0.24, 0.26), beamMat);
    beam.position.set(0, y, -3.66);
    beam.castShadow = true;
    group.add(beam);
  }
  for (const x of [-2.4, 2.4]) {
    const frameTop = new THREE.Mesh(new THREE.BoxGeometry(1.34, 0.14, 0.18), trimMat);
    const frameBottom = frameTop.clone();
    const frameLeft = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.96, 0.18), trimMat);
    const frameRight = frameLeft.clone();
    frameTop.position.set(x, 2.8, -3.73);
    frameBottom.position.set(x, 1.9, -3.73);
    frameLeft.position.set(x - 0.66, 2.35, -3.73);
    frameRight.position.set(x + 0.66, 2.35, -3.73);
    const shutterL = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.95, 0.16), trimMat);
    const shutterR = shutterL.clone();
    shutterL.position.set(x - 0.92, 2.35, -3.76);
    shutterR.position.set(x + 0.92, 2.35, -3.76);
    group.add(frameTop, frameBottom, frameLeft, frameRight, shutterL, shutterR);
  }
  const roofRidge = new THREE.Mesh(new THREE.BoxGeometry(7.25, 0.2, 0.22), trimMat);
  roofRidge.position.set(0, 6.86, 0);
  roofRidge.rotation.y = Math.PI / 4;
  roofRidge.castShadow = true;
  const lantern = new THREE.Mesh(
    new THREE.BoxGeometry(0.34, 0.46, 0.2),
    new THREE.MeshBasicMaterial({ color: mood === 'evil' ? 0xff5b40 : 0xffcf72 }),
  );
  lantern.position.set(0, 2.18, -3.78);
  const smokeMat = new THREE.MeshBasicMaterial({ color: 0x9aa2a3, transparent: true, opacity: 0.22, depthWrite: false });
  for (let i = 0; i < 3; i++) {
    const smoke = new THREE.Mesh(new THREE.SphereGeometry(0.34 + i * 0.11, 10, 8), smokeMat);
    smoke.position.set(2.35 + i * 0.12, 7.05 + i * 0.42, 0.72 - i * 0.04);
    smoke.scale.set(1.2 + i * 0.2, 0.72, 1);
    group.add(smoke);
  }
  const chimney = new THREE.Mesh(new THREE.BoxGeometry(0.68, 1.55, 0.68), new THREE.MeshStandardMaterial({ color: 0x5c4a3c, map: textures.rockyTerrain, roughness: 0.9 }));
  chimney.position.set(2.35, 6.15, 0.72);
  chimney.castShadow = true;
  const steps = new THREE.Mesh(new THREE.BoxGeometry(2.35, 0.28, 1.28), new THREE.MeshStandardMaterial({ color: 0x7a7467, map: textures.rockMoss, roughness: 0.94 }));
  steps.position.set(0, 0.14, -4.34);
  steps.castShadow = true;
  steps.receiveShadow = true;

  group.add(wall, roof, door, windowA, windowB, roofRidge, lantern, chimney, steps);
  return group;
}

function makeNpcFigure(mood: NpcMood) {
  const group = new THREE.Group();
  const cloth = new THREE.MeshStandardMaterial({
    color: mood === 'good' ? 0x3f7d55 : mood === 'evil' ? 0x6b2822 : 0x5f6571,
    roughness: 0.8,
  });
  const skin = new THREE.MeshStandardMaterial({ color: 0xc99666, roughness: 0.7 });
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.35, 1.2, 6, 12), cloth);
  body.position.y = 1.25;
  body.castShadow = true;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 10), skin);
  head.position.y = 2.18;
  head.castShadow = true;
  group.add(body, head);
  return group;
}

function placeScenery(scene: THREE.Scene, object: THREE.Object3D, x: number, z: number, scale = 1) {
  object.position.set(x, 0, z);
  object.rotation.y = randomRange(0, Math.PI * 2);
  object.scale.setScalar(scale);
  scene.add(object);
}

function hash2(x: number, z: number, salt = 0) {
  const n = Math.sin(x * 127.1 + z * 311.7 + salt * 74.7) * 43758.5453123;
  return n - Math.floor(n);
}

function chunkRandom(cx: number, cz: number, salt: number, min: number, max: number) {
  return min + hash2(cx, cz, salt) * (max - min);
}

function terrainHeightAt(x: number, z: number) {
  const broad = Math.sin(x * 0.035) * 0.34 + Math.cos(z * 0.028) * 0.28;
  const detail = Math.sin((x + z) * 0.08) * 0.08 + Math.cos((x - z) * 0.05) * 0.06;
  return Math.max(-0.06, broad + detail) * 0.34;
}

function resolvePlayerPhysics(position: THREE.Vector3, velocity: THREE.Vector3, obstacles: PhysicsObstacle[]) {
  let waterDrag = 1;
  for (const obstacle of obstacles) {
    const dx = position.x - obstacle.x;
    const dz = position.z - obstacle.z;
    const dist = Math.hypot(dx, dz);
    if (obstacle.kind === 'water') {
      if (dist < obstacle.radius) waterDrag = Math.min(waterDrag, 0.54);
      continue;
    }

    const minDist = PLAYER_RADIUS + obstacle.radius;
    if (dist > 0.001 && dist < minDist) {
      const push = minDist - dist;
      const nx = dx / dist;
      const nz = dz / dist;
      position.x += nx * push;
      position.z += nz * push;
      const intoObstacle = velocity.x * nx + velocity.z * nz;
      if (intoObstacle < 0) {
        velocity.x -= nx * intoObstacle * 1.08;
        velocity.z -= nz * intoObstacle * 1.08;
      }
    }
  }
  return waterDrag;
}

function makeSteppeGrassPatch(cx: number, cz: number, count: number) {
  const geometry = new THREE.ConeGeometry(0.13, 1, 4);
  const material = new THREE.MeshStandardMaterial({
    color: 0x5d6b3f,
    map: worldTextures().grass,
    bumpMap: worldTextures().grass,
    bumpScale: 0.025,
    roughness: 0.98,
    metalness: 0,
    vertexColors: true,
  });
  const grass = new THREE.InstancedMesh(geometry, material, count);
  const matrix = new THREE.Matrix4();
  const quaternion = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  const color = new THREE.Color();

  for (let i = 0; i < count; i++) {
    const x = chunkRandom(cx, cz, 400 + i * 3, -CHUNK_SIZE * 0.48, CHUNK_SIZE * 0.48);
    const z = chunkRandom(cx, cz, 401 + i * 3, -CHUNK_SIZE * 0.48, CHUNK_SIZE * 0.48);
    const worldX = cx * CHUNK_SIZE + x;
    const worldZ = cz * CHUNK_SIZE + z;
    const height = terrainHeightAt(worldX, worldZ);
    const bladeHeight = chunkRandom(cx, cz, 402 + i * 3, 0.45, 1.55);
    const lean = chunkRandom(cx, cz, 403 + i * 3, -0.18, 0.18);
    const yaw = chunkRandom(cx, cz, 404 + i * 3, 0, Math.PI * 2);
    quaternion.setFromEuler(new THREE.Euler(lean, yaw, lean * 0.6));
    scale.set(
      chunkRandom(cx, cz, 405 + i * 3, 0.58, 1.2),
      bladeHeight,
      chunkRandom(cx, cz, 406 + i * 3, 0.58, 1.15),
    );
    matrix.compose(new THREE.Vector3(x, height + bladeHeight * 0.48, z), quaternion, scale);
    grass.setMatrixAt(i, matrix);
    color.setHex(i % 5 === 0 ? 0xa89a54 : i % 7 === 0 ? 0x3f5632 : 0x5f7042);
    grass.setColorAt(i, color);
  }

  grass.castShadow = true;
  grass.receiveShadow = true;
  grass.frustumCulled = false;
  return grass;
}

function makeAtmosphereParticles(count: number) {
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const color = new THREE.Color();

  for (let i = 0; i < count; i++) {
    positions[i * 3] = randomRange(-135, 135);
    positions[i * 3 + 1] = randomRange(3.5, 34);
    positions[i * 3 + 2] = randomRange(-135, 135);
    color.setHex(i % 6 === 0 ? 0xd9d6c4 : 0xbcae8a);
    colors[i * 3] = color.r;
    colors[i * 3 + 1] = color.g;
    colors[i * 3 + 2] = color.b;
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const material = new THREE.PointsMaterial({
    size: 0.16,
    transparent: true,
    opacity: 0.32,
    depthWrite: false,
    vertexColors: true,
  });
  const particles = new THREE.Points(geometry, material);
  particles.frustumCulled = false;
  return particles;
}

function makeWorldChunk(cx: number, cz: number) {
  const group = new THREE.Group();
  group.position.set(cx * CHUNK_SIZE, 0, cz * CHUNK_SIZE);
  const obstacles: Omit<PhysicsObstacle, 'key'>[] = [];

  const seed = hash2(cx, cz, 9) * 1000;
  const terrainRoll = hash2(cx, cz, 1);
  const groundColor = terrainRoll > 0.72 ? 0x59633d : terrainRoll > 0.44 ? 0x6f7d48 : 0x7f884d;
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(CHUNK_SIZE + 2, CHUNK_SIZE + 2, 14, 14),
    makeGroundShaderMaterial(seed + groundColor * 0.000001),
  );
  ground.userData.shader = 'ground';
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = 0.006;
  ground.receiveShadow = true;
  group.add(ground);

  const grassCount = terrainRoll > 0.72 ? 72 : terrainRoll > 0.38 ? 128 : 96;
  group.add(makeSteppeGrassPatch(cx, cz, grassCount));

  const riverBand = Math.abs(Math.sin(cx * 0.62 + cz * 0.38)) < 0.18;
  if (riverBand) {
    const river = makeRiverSegment(CHUNK_SIZE);
    river.rotation.y = Math.sin((cx + cz) * 0.7) * 0.65;
    group.add(river);
    obstacles.push({ x: 0, z: 0, radius: CHUNK_SIZE * 0.54, kind: 'water' });
    for (let i = 0; i < 4; i++) {
      const reeds = makeReedCluster();
      const side = i % 2 === 0 ? -1 : 1;
      reeds.position.set(chunkRandom(cx, cz, i + 830, -38, 38), 0, side * chunkRandom(cx, cz, i + 850, 10.8, 16.8));
      reeds.rotation.y = chunkRandom(cx, cz, i + 870, 0, Math.PI * 2);
      reeds.scale.setScalar(chunkRandom(cx, cz, i + 890, 0.75, 1.35));
      group.add(reeds);
    }
    if (hash2(cx, cz, 1210) > 0.42) {
      const pier = makeWoodenPierPatch();
      const side = hash2(cx, cz, 1211) > 0.5 ? -1 : 1;
      pier.position.set(chunkRandom(cx, cz, 1212, -24, 24), 0, side * chunkRandom(cx, cz, 1213, 9.8, 12.8));
      pier.rotation.y = river.rotation.y + Math.PI / 2 + chunkRandom(cx, cz, 1214, -0.22, 0.22);
      pier.scale.setScalar(chunkRandom(cx, cz, 1215, 0.9, 1.4));
      group.add(pier);
    }
  }

  if (terrainRoll > 0.76) {
    const count = 1 + Math.floor(hash2(cx, cz, 3) * 2);
    for (let i = 0; i < count; i++) {
      const mountain = makeMountain();
      mountain.position.set(chunkRandom(cx, cz, i + 10, -32, 32), 0, chunkRandom(cx, cz, i + 20, -32, 32));
      const scale = chunkRandom(cx, cz, i + 30, 0.38, 0.78);
      mountain.scale.setScalar(scale);
      obstacles.push({ x: mountain.position.x, z: mountain.position.z, radius: 2.8 * scale, kind: 'solid' });
      group.add(mountain);
    }
    const treeCount = 2 + Math.floor(hash2(cx, cz, 1230) * 3);
    for (let i = 0; i < treeCount; i++) {
      const tree = makeAssetTree(cx, cz, i + 1240);
      tree.position.set(chunkRandom(cx, cz, i + 1240, -40, 40), 0, chunkRandom(cx, cz, i + 1260, -40, 40));
      tree.rotation.y = chunkRandom(cx, cz, i + 1280, 0, Math.PI * 2);
      const scale = chunkRandom(cx, cz, i + 1300, 0.68, 1.18);
      tree.scale.setScalar(scale);
      obstacles.push({ x: tree.position.x, z: tree.position.z, radius: 0.72 * scale, kind: 'solid' });
      group.add(tree);
    }
  } else if (terrainRoll > 0.38) {
    const count = 7 + Math.floor(hash2(cx, cz, 4) * 10);
    for (let i = 0; i < count; i++) {
      const tree = makeAssetTree(cx, cz, i + 40);
      tree.position.set(chunkRandom(cx, cz, i + 40, -40, 40), 0, chunkRandom(cx, cz, i + 90, -40, 40));
      tree.rotation.y = chunkRandom(cx, cz, i + 140, 0, Math.PI * 2);
      const scale = chunkRandom(cx, cz, i + 180, 0.72, 1.38);
      tree.scale.setScalar(scale);
      obstacles.push({ x: tree.position.x, z: tree.position.z, radius: 0.72 * scale, kind: 'solid' });
      group.add(tree);
    }
    const logCount = 1 + Math.floor(hash2(cx, cz, 910) * 2);
    for (let i = 0; i < logCount; i++) {
      const log = makeFallenLog();
      log.position.set(chunkRandom(cx, cz, i + 930, -35, 35), 0, chunkRandom(cx, cz, i + 950, -35, 35));
      log.rotation.y = chunkRandom(cx, cz, i + 970, 0, Math.PI * 2);
      const scale = chunkRandom(cx, cz, i + 990, 0.7, 1.35);
      log.scale.setScalar(scale);
      obstacles.push({ x: log.position.x, z: log.position.z, radius: 1.25 * scale, kind: 'solid' });
      group.add(log);
    }
  } else {
    const count = 3 + Math.floor(hash2(cx, cz, 5) * 5);
    for (let i = 0; i < count; i++) {
      const rocks = makeRockCluster();
      rocks.position.set(chunkRandom(cx, cz, i + 220, -40, 40), 0, chunkRandom(cx, cz, i + 260, -40, 40));
      const scale = chunkRandom(cx, cz, i + 300, 0.6, 1.55);
      rocks.scale.setScalar(scale);
      obstacles.push({ x: rocks.position.x, z: rocks.position.z, radius: 1.8 * scale, kind: 'solid' });
      group.add(rocks);
    }
    if (hash2(cx, cz, 1220) > 0.42) {
      const car = makeCoveredCarWreck();
      car.position.set(chunkRandom(cx, cz, 1221, -34, 34), 0, chunkRandom(cx, cz, 1222, -34, 34));
      car.rotation.y = chunkRandom(cx, cz, 1223, 0, Math.PI * 2);
      const scale = chunkRandom(cx, cz, 1224, 0.72, 1.12);
      car.scale.setScalar(scale);
      obstacles.push({ x: car.position.x, z: car.position.z, radius: 2.1 * scale, kind: 'solid' });
      group.add(car);
    }
  }

  if (hash2(cx, cz, 1500) > 0.78) {
    const car = makeCoveredCarWreck();
    car.position.set(chunkRandom(cx, cz, 1501, -36, 36), 0, chunkRandom(cx, cz, 1502, -36, 36));
    car.rotation.y = chunkRandom(cx, cz, 1503, 0, Math.PI * 2);
    const scale = chunkRandom(cx, cz, 1504, 0.66, 0.96);
    car.scale.setScalar(scale);
    obstacles.push({ x: car.position.x, z: car.position.z, radius: 2.1 * scale, kind: 'solid' });
    group.add(car);
  }

  if (hash2(cx, cz, 1320) > 0.82) {
    const cache = makeMedicalSupplyCache();
    cache.position.set(chunkRandom(cx, cz, 1321, -34, 34), 0, chunkRandom(cx, cz, 1322, -34, 34));
    cache.rotation.y = chunkRandom(cx, cz, 1323, 0, Math.PI * 2);
    cache.scale.setScalar(chunkRandom(cx, cz, 1324, 0.85, 1.2));
    group.add(cache);
  }
  if (hash2(cx, cz, 1330) > 0.88) {
    const pistolCache = makeServicePistolCache();
    pistolCache.position.set(chunkRandom(cx, cz, 1331, -34, 34), 0, chunkRandom(cx, cz, 1332, -34, 34));
    pistolCache.rotation.y = chunkRandom(cx, cz, 1333, 0, Math.PI * 2);
    pistolCache.scale.setScalar(chunkRandom(cx, cz, 1334, 0.9, 1.18));
    group.add(pistolCache);
  }

  const detailCount = 10 + Math.floor(hash2(cx, cz, 540) * 12);
  for (let i = 0; i < detailCount; i++) {
    const detail = makeDetailPatch(i + cx * 17 + cz * 31);
    detail.position.set(chunkRandom(cx, cz, i + 560, -42, 42), 0, chunkRandom(cx, cz, i + 590, -42, 42));
    detail.rotation.y = chunkRandom(cx, cz, i + 620, 0, Math.PI * 2);
    detail.scale.setScalar(chunkRandom(cx, cz, i + 650, 0.55, 1.35));
    group.add(detail);
  }

  const trailCount = 1 + Math.floor(hash2(cx, cz, 1010) * 2);
  for (let i = 0; i < trailCount; i++) {
    const stones = makeTrailStonePatch();
    stones.position.set(chunkRandom(cx, cz, i + 1030, -34, 34), 0, chunkRandom(cx, cz, i + 1050, -34, 34));
    stones.rotation.y = chunkRandom(cx, cz, i + 1070, 0, Math.PI * 2);
    stones.scale.setScalar(chunkRandom(cx, cz, i + 1090, 0.72, 1.45));
    group.add(stones);
  }

  const terrainPatchCount = 1 + Math.floor(hash2(cx, cz, 1120) * 3);
  for (let i = 0; i < terrainPatchCount; i++) {
    const patch = makeRockyTerrainPatch();
    patch.position.set(chunkRandom(cx, cz, i + 1140, -38, 38), 0, chunkRandom(cx, cz, i + 1160, -38, 38));
    patch.rotation.y = chunkRandom(cx, cz, i + 1180, 0, Math.PI * 2);
    group.add(patch);
  }

  if (terrainRoll > 0.34 && terrainRoll < 0.72) {
    const stumpCount = 1 + Math.floor(hash2(cx, cz, 700) * 3);
    for (let i = 0; i < stumpCount; i++) {
      const stump = makeTreeStump();
      stump.position.set(chunkRandom(cx, cz, i + 720, -38, 38), 0, chunkRandom(cx, cz, i + 750, -38, 38));
      stump.rotation.y = chunkRandom(cx, cz, i + 780, 0, Math.PI * 2);
      const scale = chunkRandom(cx, cz, i + 810, 0.65, 1.2);
      stump.scale.setScalar(scale);
      obstacles.push({ x: stump.position.x, z: stump.position.z, radius: 0.46 * scale, kind: 'solid' });
      group.add(stump);
    }
  }

  group.userData.obstacles = obstacles;
  return group;
}

function questNav(player: THREE.Vector3, quest: QuestItem) {
  const dx = quest.x - player.x;
  const dz = quest.z - player.z;
  const distance = Math.round(Math.hypot(dx, dz));
  const angle = Math.atan2(dx, -dz) * (180 / Math.PI);
  return { distance, angle };
}

function navPoint(x: number, z: number): QuestItem {
  return { x, z, collected: false };
}

function addInventoryItem(items: InventoryEntry[], kind: PickupKind) {
  const existing = items.find((item) => item.kind === kind);
  if (existing) existing.count += 1;
  else if (items.length < 9) items.push({ kind, count: 1 });
  return [...items];
}

function isWeapon(kind: string): kind is WeaponKind {
  return kind === 'knife' || kind === 'club' || kind === 'sabre' || kind === 'rifle';
}

function isDifficulty(value: string): value is Difficulty {
  return value === 'story' || value === 'survival' || value === 'nightmare';
}

function isPickupKind(value: string): value is PickupKind {
  return value === 'medkit' || value === 'crystal' || value === 'key' || value === 'code' || value === 'revive' || isWeapon(value);
}

function isQuestItem(value: unknown): value is QuestItem {
  if (!value || typeof value !== 'object') return false;
  const item = value as Record<string, unknown>;
  return typeof item.x === 'number' && typeof item.z === 'number' && typeof item.collected === 'boolean';
}

function isStoryFlags(value: unknown): value is StoryFlags {
  if (!value || typeof value !== 'object') return false;
  const flags = value as Record<string, unknown>;
  return typeof flags.trust === 'number' && typeof flags.lore === 'number' && typeof flags.risk === 'number' && typeof flags.cruelty === 'number';
}

function isInventoryEntry(value: unknown): value is InventoryEntry {
  if (!value || typeof value !== 'object') return false;
  const entry = value as Record<string, unknown>;
  return typeof entry.kind === 'string' && isPickupKind(entry.kind) && typeof entry.count === 'number';
}

function parseSavedGameState(value: unknown): SavedGameState | null {
  if (!value || typeof value !== 'object') return null;
  const state = value as Record<string, unknown>;
  const player = state.player as Record<string, unknown> | undefined;
  if (!player || typeof player.x !== 'number' || typeof player.z !== 'number') return null;
  if (
    typeof state.hp !== 'number' ||
    typeof state.score !== 'number' ||
    typeof state.dayTime !== 'number' ||
    typeof state.stamina !== 'number' ||
    typeof state.selectedSlot !== 'number' ||
    typeof state.heldItem !== 'string' ||
    !isPickupKind(state.heldItem) ||
    typeof state.weapon !== 'string' ||
    !isWeapon(state.weapon) ||
    !isStoryFlags(state.storyFlags) ||
    !isQuestItem(state.key) ||
    !isQuestItem(state.code) ||
    !isQuestItem(state.revive) ||
    typeof state.traderCoordsBought !== 'boolean' ||
    typeof state.companionRecruited !== 'boolean' ||
    typeof state.companionAlive !== 'boolean' ||
    typeof state.companionHp !== 'number' ||
    !Array.isArray(state.inventory) ||
    !state.inventory.every(isInventoryEntry) ||
    !Array.isArray(state.houseVisitedIds) ||
    !state.houseVisitedIds.every((id) => typeof id === 'number')
  ) {
    return null;
  }

  return {
    player: { x: player.x, z: player.z },
    hp: state.hp,
    score: state.score,
    dayTime: state.dayTime,
    stamina: state.stamina,
    inventory: state.inventory,
    selectedSlot: state.selectedSlot,
    heldItem: state.heldItem,
    weapon: state.weapon,
    storyFlags: state.storyFlags,
    key: state.key,
    code: state.code,
    revive: state.revive,
    traderCoordsBought: state.traderCoordsBought,
    companionRecruited: state.companionRecruited,
    companionAlive: state.companionAlive,
    companionHp: state.companionHp,
    houseVisitedIds: state.houseVisitedIds,
  };
}

function storyScore(flags: StoryFlags) {
  return flags.trust * 2 + flags.lore - flags.risk - flags.cruelty * 2;
}

function endingFor(flags: StoryFlags, difficulty: Difficulty, score: number) {
  const thread = storyScore(flags);
  if (thread >= 18 && flags.lore >= 9) {
    return `Ending: Cure. The fortress opens, but you do not burn it. You use the old kumys culture and the northern records to turn the infection into a vaccine. Difficulty: ${DIFFICULTY[difficulty].label}. Score: ${score}.`;
  }
  if (flags.trust >= 7 && flags.risk < 8) {
    return `Ending: Caravan. The fortress survives as a shelter. The people you helped arrive after sunrise and the steppe gets a second road north. Difficulty: ${DIFFICULTY[difficulty].label}. Score: ${score}.`;
  }
  if (flags.cruelty >= 5 || flags.risk >= 11) {
    return `Ending: Ashes. You open the gates, but too many choices fed the fear inside the fortress. The source burns, and the cure burns with it. Difficulty: ${DIFFICULTY[difficulty].label}. Score: ${score}.`;
  }
  return `Ending: Silent Gate. You survive and seal the fortress for now. The infection is stopped here, but the steppe keeps some of its secrets. Difficulty: ${DIFFICULTY[difficulty].label}. Score: ${score}.`;
}

function dayPhaseAt(dayTime: number): DayPhase {
  if (dayTime < 0.18) return 'dawn';
  if (dayTime < 0.62) return 'day';
  if (dayTime < 0.78) return 'dusk';
  return 'night';
}

function dayPhaseLabel(phase: DayPhase) {
  if (phase === 'dawn') return 'Рассвет';
  if (phase === 'day') return 'День';
  if (phase === 'dusk') return 'Закат';
  return 'Ночь';
}

function walkModeLabel(mode: WalkMode) {
  if (mode === 'sneak') return 'Тихо';
  if (mode === 'sprint') return 'Бег';
  if (mode === 'tired') return 'Устал';
  return 'Шаг';
}

function createDynamicMusic() {
  try {
    const audio = new AudioContext();
    const master = audio.createGain();
    const drone = audio.createOscillator();
    const pulse = audio.createOscillator();
    const danger = audio.createOscillator();
    const droneGain = audio.createGain();
    const pulseGain = audio.createGain();
    const dangerGain = audio.createGain();
    const filter = audio.createBiquadFilter();

    master.gain.value = 0.0001;
    drone.type = 'sine';
    pulse.type = 'triangle';
    danger.type = 'sawtooth';
    filter.type = 'lowpass';
    filter.frequency.value = 720;
    drone.frequency.value = 88;
    pulse.frequency.value = 132;
    danger.frequency.value = 55;
    droneGain.gain.value = 0.035;
    pulseGain.gain.value = 0.0001;
    dangerGain.gain.value = 0.0001;

    drone.connect(droneGain);
    pulse.connect(pulseGain);
    danger.connect(dangerGain);
    droneGain.connect(filter);
    pulseGain.connect(filter);
    dangerGain.connect(filter);
    filter.connect(master);
    master.connect(audio.destination);
    drone.start();
    pulse.start();
    danger.start();
    master.gain.exponentialRampToValueAtTime(0.22, audio.currentTime + 1.2);

    return {
      update(dangerLevel: number, hp: number, eventActive: boolean, inHloddev: boolean) {
        const now = audio.currentTime;
        const tension = clamp(dangerLevel + (100 - hp) / 160 + (eventActive ? 0.35 : 0), 0, 1.4);
        drone.frequency.setTargetAtTime(inHloddev ? 104 : 82 + tension * 18, now, 0.12);
        pulse.frequency.setTargetAtTime(118 + tension * 92, now, 0.08);
        danger.frequency.setTargetAtTime(42 + tension * 64, now, 0.08);
        filter.frequency.setTargetAtTime(inHloddev ? 520 : 680 + tension * 420, now, 0.15);
        pulseGain.gain.setTargetAtTime(0.012 + tension * 0.032, now, 0.08);
        dangerGain.gain.setTargetAtTime(tension > 0.45 ? 0.018 + tension * 0.025 : 0.0001, now, 0.08);
      },
      stop() {
        const now = audio.currentTime;
        master.gain.setTargetAtTime(0.0001, now, 0.08);
        setTimeout(() => {
          drone.stop();
          pulse.stop();
          danger.stop();
          audio.close().catch(() => {});
        }, 500);
      },
    };
  } catch {
    return null;
  }
}

function heldItemScale(kind: PickupKind) {
  if (kind === 'rifle') return { x: 1, y: 1, z: 1.55 };
  if (kind === 'sabre') return { x: 0.72, y: 0.8, z: 1.25 };
  if (kind === 'club') return { x: 1.15, y: 1.15, z: 1 };
  if (kind === 'medkit') return { x: 2.5, y: 2.1, z: 0.34 };
  if (kind === 'crystal') return { x: 1.4, y: 1.4, z: 0.52 };
  if (kind === 'revive') return { x: 1.35, y: 1.35, z: 0.62 };
  if (kind === 'key') return { x: 1.1, y: 0.8, z: 0.62 };
  if (kind === 'code') return { x: 2.2, y: 1.35, z: 0.24 };
  return { x: 0.82, y: 0.82, z: 0.82 };
}

function playJumpscareSfx() {
  try {
    const audio = new AudioContext();
    const now = audio.currentTime;
    const duration = 1.25;
    const noiseBuffer = audio.createBuffer(1, Math.floor(audio.sampleRate * duration), audio.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);

    const noise = audio.createBufferSource();
    noise.buffer = noiseBuffer;
    const filter = audio.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(2300, now);
    filter.frequency.exponentialRampToValueAtTime(620, now + duration);
    filter.Q.value = 0.85;

    const screech = audio.createOscillator();
    screech.type = 'sawtooth';
    screech.frequency.setValueAtTime(980, now);
    screech.frequency.exponentialRampToValueAtTime(140, now + duration);

    const bass = audio.createOscillator();
    bass.type = 'square';
    bass.frequency.setValueAtTime(72, now);
    bass.frequency.exponentialRampToValueAtTime(38, now + 0.42);

    const master = audio.createGain();
    master.gain.setValueAtTime(0.001, now);
    master.gain.exponentialRampToValueAtTime(1.0, now + 0.025);
    master.gain.exponentialRampToValueAtTime(0.001, now + duration);

    const bassGain = audio.createGain();
    bassGain.gain.setValueAtTime(0.65, now);
    bassGain.gain.exponentialRampToValueAtTime(0.001, now + 0.48);

    noise.connect(filter);
    filter.connect(master);
    screech.connect(master);
    bass.connect(bassGain);
    bassGain.connect(master);
    master.connect(audio.destination);
    noise.start(now);
    screech.start(now);
    bass.start(now);
    noise.stop(now + duration);
    screech.stop(now + duration);
    bass.stop(now + 0.5);
    setTimeout(() => audio.close().catch(() => {}), 1800);
  } catch {
    // Browser audio can be unavailable; the visual screamer still appears.
  }
}

export function QasqyrGame({
  userId,
  preloadProgress = 100,
  preloadDone = true,
  onExit,
}: {
  userId?: string;
  preloadProgress?: number;
  preloadDone?: boolean;
  onExit?: () => void;
}) {
  const isMobile = useMobileLayout();
  const isPortrait = usePortraitLayout();
  const mountRef = useRef<HTMLDivElement>(null);
  const keysRef = useRef(new Set<string>());
  const virtualAttackRef = useRef<() => void>(() => {});
  const virtualUseItemRef = useRef<() => void>(() => {});
  const virtualTeleportRef = useRef<() => void>(() => {});
  const playerRef = useRef(new THREE.Vector3(0, 0, START_Z));
  const playerVelocityRef = useRef(new THREE.Vector3());
  const aimRef = useRef(new THREE.Vector2(0, -1));
  const enemiesRef = useRef<Enemy[]>([]);
  const pickupsRef = useRef<Pickup[]>([]);
  const inventoryRef = useRef<InventoryEntry[]>([]);
  const fakeFortressesRef = useRef<FakeFortress[]>([]);
  const houseNpcsRef = useRef<HouseNpc[]>([]);
  const insideHouseRef = useRef<number | null>(null);
  const exitHouseBurstRef = useRef(0);
  const traderCoordsBoughtRef = useRef(false);
  const companionRecruitedRef = useRef(false);
  const companionAliveRef = useRef(false);
  const companionHpRef = useRef(100);
  const companionAttackCdRef = useRef(0);
  const companionFinalSpokenRef = useRef(false);
  const reviveRef = useRef<QuestItem>({ x: 0, z: 0, collected: true });
  const keyRef = useRef<QuestItem>(randomQuestPoint());
  const codeRef = useRef<QuestItem>(randomQuestPoint());
  const hpRef = useRef(100);
  const scoreRef = useRef(0);
  const dayTimeRef = useRef(0.13);
  const staminaRef = useRef(STAMINA_MAX);
  const walkModeRef = useRef<WalkMode>('walk');
  const storyFlagsRef = useRef<StoryFlags>({ trust: 0, lore: 0, risk: 0, cruelty: 0 });
  const difficultyRef = useRef<Difficulty>('survival');
  const endingRef = useRef('');
  const weaponRef = useRef<WeaponKind>('knife');
  const selectedSlotRef = useRef(0);
  const heldItemRef = useRef<PickupKind>('knife');
  const attackCdRef = useRef(0);
  const spawnTimerRef = useRef(0);
  const nextEventRef = useRef(EVENT_INTERVAL);
  const eventTimerRef = useRef(0);
  const eventKindRef = useRef<EventKind | null>(null);
  const dimensionRef = useRef<Dimension>('steppe');
  const dimensionTimerRef = useRef(0);
  const teleportCooldownRef = useRef(0);
  const deathTriggeredRef = useRef(false);
  const hintRef = useRef('WASD: движение, мышь: прицел, клик/Space: удар');
  const [phase, setPhase] = useState<GamePhase>('intro');
  const [difficulty, setDifficulty] = useState<Difficulty>('survival');
  const [activeMenuTab, setActiveMenuTab] = useState<MenuTab>('modes');
  const [unlockedSkinIds, setUnlockedSkinIds] = useState<string[]>(STARTING_UNLOCKED_SKINS);
  const [selectedKnifeSkinId, setSelectedKnifeSkinId] = useState(FREE_KNIFE_SKIN_ID);
  const [wallet, setWallet] = useState(STARTING_WALLET);
  const [caseLog, setCaseLog] = useState('Магазин готов: выбери кейс и валюту.');
  const [caseOpening, setCaseOpening] = useState<CaseOpening | null>(null);
  const [progressLoaded, setProgressLoaded] = useState(!userId);
  const [savedGameState, setSavedGameState] = useState<SavedGameState | null>(null);
  const [assetLoading, setAssetLoading] = useState(false);
  const [assetLoadingProgress, setAssetLoadingProgress] = useState(0);
  const [assetLoadingLabel, setAssetLoadingLabel] = useState('Готовим мир...');
  const [vision, setVision] = useState<VisionKind>('');
  const [ending, setEnding] = useState('');
  const [taunt, setTaunt] = useState('');
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [jumpscare, setJumpscare] = useState(false);
  const [aiThinking, setAiThinking] = useState(false);
  const [hud, setHud] = useState({
    hp: 100,
    score: 0,
    distance: 100,
    nextEvent: EVENT_INTERVAL,
    event: '',
    eventLeft: 0,
    timeOfDay: dayPhaseLabel(dayPhaseAt(dayTimeRef.current)),
    stamina: STAMINA_MAX,
    walkMode: walkModeLabel('walk' as WalkMode),
    difficulty: DIFFICULTY.survival.label,
    story: 0,
    weapon: WEAPONS.knife.name,
    heldItem: ITEM_LABELS.knife,
    selectedSlot: 0,
    dimension: 'Степь',
    teleport: 0,
    dimensionLeft: 0,
    hasKey: false,
    hasCode: false,
    traderNav: questNav(playerRef.current, navPoint(HOUSE_NPCS.find((npc) => npc.id === TRADER_NPC_ID)?.x ?? 0, HOUSE_NPCS.find((npc) => npc.id === TRADER_NPC_ID)?.z ?? 0)),
    companionNav: questNav(playerRef.current, navPoint(COMPANION_HOUSE.x, COMPANION_HOUSE.z)),
    reviveNav: questNav(playerRef.current, reviveRef.current),
    coordsBought: false,
    companionRecruited: false,
    companionAlive: false,
    reviveVisible: false,
    keyNav: questNav(playerRef.current, keyRef.current),
    codeNav: questNav(playerRef.current, codeRef.current),
    inventory: [] as InventoryEntry[],
    hint: hintRef.current,
  });

  const buildSavedGameState = useCallback((): SavedGameState => ({
    player: { x: playerRef.current.x, z: playerRef.current.z },
    hp: hpRef.current,
    score: scoreRef.current,
    dayTime: dayTimeRef.current,
    stamina: staminaRef.current,
    inventory: inventoryRef.current,
    selectedSlot: selectedSlotRef.current,
    heldItem: heldItemRef.current,
    weapon: weaponRef.current,
    storyFlags: storyFlagsRef.current,
    key: keyRef.current,
    code: codeRef.current,
    revive: reviveRef.current,
    traderCoordsBought: traderCoordsBoughtRef.current,
    companionRecruited: companionRecruitedRef.current,
    companionAlive: companionAliveRef.current,
    companionHp: companionHpRef.current,
    houseVisitedIds: houseNpcsRef.current.filter((npc) => npc.visited).map((npc) => npc.id),
  }), []);

  const saveProgress = useCallback(async (stateOverride?: SavedGameState | null) => {
    if (!userId) return;
    const state = stateOverride === undefined ? buildSavedGameState() : stateOverride;
    const { error } = await supabase.from('game_progress').upsert({
      user_id: userId,
      gold: wallet.gold,
      diamonds: wallet.premium,
      unlocked_skins: unlockedSkinIds,
      selected_knife_skin_id: selectedKnifeSkinId,
      difficulty,
      game_state: state ?? {},
      updated_at: new Date().toISOString(),
    });
    if (error) {
      console.error('Failed to save game progress', error.message);
    }
  }, [buildSavedGameState, difficulty, selectedKnifeSkinId, unlockedSkinIds, userId, wallet.gold, wallet.premium]);

  const refreshHudFromRefs = useCallback(() => {
    const balance = DIFFICULTY[difficultyRef.current];
    setHud((current) => ({
      ...current,
      hp: Math.max(0, Math.ceil(hpRef.current)),
      score: scoreRef.current,
      distance: Math.max(0, Math.round(((playerRef.current.z - FINISH_Z) / (START_Z - FINISH_Z)) * 100)),
      nextEvent: Math.ceil(nextEventRef.current),
      event: eventKindRef.current ? EVENT_LABELS[eventKindRef.current] : '',
      eventLeft: Math.ceil(eventTimerRef.current),
      timeOfDay: dayPhaseLabel(dayPhaseAt(dayTimeRef.current)),
      stamina: Math.ceil(staminaRef.current),
      walkMode: walkModeLabel(walkModeRef.current),
      difficulty: balance.label,
      story: storyScore(storyFlagsRef.current),
      weapon: WEAPONS[weaponRef.current].name,
      heldItem: ITEM_LABELS[heldItemRef.current],
      selectedSlot: selectedSlotRef.current,
      dimension: dimensionRef.current === 'hloddev' ? 'Хлоддев' : 'Степь',
      teleport: Math.ceil(teleportCooldownRef.current),
      dimensionLeft: Math.ceil(dimensionTimerRef.current),
      hasKey: keyRef.current.collected,
      hasCode: codeRef.current.collected,
      traderNav: questNav(playerRef.current, navPoint(HOUSE_NPCS.find((npc) => npc.id === TRADER_NPC_ID)?.x ?? 0, HOUSE_NPCS.find((npc) => npc.id === TRADER_NPC_ID)?.z ?? 0)),
      companionNav: questNav(playerRef.current, navPoint(COMPANION_HOUSE.x, COMPANION_HOUSE.z)),
      reviveNav: questNav(playerRef.current, reviveRef.current),
      coordsBought: traderCoordsBoughtRef.current,
      companionRecruited: companionRecruitedRef.current,
      companionAlive: companionAliveRef.current,
      reviveVisible: companionRecruitedRef.current && !companionAliveRef.current && !reviveRef.current.collected,
      keyNav: questNav(playerRef.current, keyRef.current),
      codeNav: questNav(playerRef.current, codeRef.current),
      inventory: [...inventoryRef.current],
      hint: hintRef.current,
    }));
  }, []);

  const applySavedGameState = useCallback((state: SavedGameState) => {
    playerRef.current.set(state.player.x, terrainHeightAt(state.player.x, state.player.z), state.player.z);
    hpRef.current = state.hp;
    scoreRef.current = state.score;
    dayTimeRef.current = state.dayTime;
    staminaRef.current = state.stamina;
    inventoryRef.current = state.inventory.length > 0 ? state.inventory : [{ kind: 'knife', count: 1 }];
    selectedSlotRef.current = clamp(Math.floor(state.selectedSlot), 0, Math.max(0, inventoryRef.current.length - 1));
    heldItemRef.current = state.heldItem;
    weaponRef.current = state.weapon;
    storyFlagsRef.current = state.storyFlags;
    keyRef.current = state.key;
    codeRef.current = state.code;
    reviveRef.current = state.revive;
    traderCoordsBoughtRef.current = state.traderCoordsBought;
    companionRecruitedRef.current = state.companionRecruited;
    companionAliveRef.current = state.companionAlive;
    companionHpRef.current = state.companionHp;
    houseNpcsRef.current = HOUSE_NPCS.map((npc) => ({ ...npc, visited: state.houseVisitedIds.includes(npc.id) }));
    hintRef.current = 'Прогресс загружен: ты продолжаешь с места последнего сохранения.';
    refreshHudFromRefs();
  }, [refreshHudFromRefs]);

  useEffect(() => {
    let cancelled = false;
    if (!userId) {
      setProgressLoaded(true);
      setWallet(STARTING_WALLET);
      setUnlockedSkinIds(STARTING_UNLOCKED_SKINS);
      setSelectedKnifeSkinId(FREE_KNIFE_SKIN_ID);
      setSavedGameState(null);
      return () => {
        cancelled = true;
      };
    }

    setProgressLoaded(false);
    supabase
      .from('game_progress')
      .select('gold, diamonds, unlocked_skins, selected_knife_skin_id, difficulty, game_state')
      .eq('user_id', userId)
      .maybeSingle()
      .then(async ({ data, error }) => {
        if (cancelled) return;
        if (error) console.error('Failed to load game progress', error.message);
        if (!data) {
          await supabase.from('game_progress').insert({ user_id: userId });
          setWallet(STARTING_WALLET);
          setUnlockedSkinIds(STARTING_UNLOCKED_SKINS);
          setSelectedKnifeSkinId(FREE_KNIFE_SKIN_ID);
          setSavedGameState(null);
          setProgressLoaded(true);
          return;
        }

        const row = data as GameProgressRow;
        const unlocked = row.unlocked_skins.includes(FREE_KNIFE_SKIN_ID)
          ? row.unlocked_skins
          : [FREE_KNIFE_SKIN_ID, ...row.unlocked_skins];
        const selected = unlocked.includes(row.selected_knife_skin_id) ? row.selected_knife_skin_id : FREE_KNIFE_SKIN_ID;
        setWallet({ gold: Math.max(0, row.gold), premium: Math.max(0, row.diamonds) });
        setUnlockedSkinIds(unlocked);
        setSelectedKnifeSkinId(selected);
        if (isDifficulty(row.difficulty)) {
          setDifficulty(row.difficulty);
          difficultyRef.current = row.difficulty;
        }
        setSavedGameState(parseSavedGameState(row.game_state));
        setProgressLoaded(true);
      });

    return () => {
      cancelled = true;
    };
  }, [userId]);

  useEffect(() => {
    if (!progressLoaded || !userId) return;
    void saveProgress(savedGameState);
  }, [difficulty, progressLoaded, saveProgress, savedGameState, selectedKnifeSkinId, unlockedSkinIds, userId, wallet.gold, wallet.premium]);

  useEffect(() => {
    if (!userId || phase !== 'playing') return;
    const timer = window.setInterval(() => {
      void saveProgress();
    }, 5000);
    return () => window.clearInterval(timer);
  }, [phase, saveProgress, userId]);

  useEffect(() => {
    if (!userId || (phase !== 'won' && phase !== 'lost')) return;
    setSavedGameState(null);
    void saveProgress(null);
  }, [phase, saveProgress, userId]);

  const reset = () => {
    difficultyRef.current = difficulty;
    const balance = DIFFICULTY[difficultyRef.current];
    playerRef.current.set(0, 0, START_Z);
    playerVelocityRef.current.set(0, 0, 0);
    aimRef.current.set(0, -1);
    enemiesRef.current = [];
    pickupsRef.current = [];
    inventoryRef.current = [{ kind: 'knife', count: 1 }];
    fakeFortressesRef.current = FAKE_FORTRESSES.map((fortress) => ({ ...fortress, triggered: false }));
    houseNpcsRef.current = HOUSE_NPCS.map((npc) => ({ ...npc, visited: false }));
    insideHouseRef.current = null;
    exitHouseBurstRef.current = 0;
    traderCoordsBoughtRef.current = false;
    companionRecruitedRef.current = false;
    companionAliveRef.current = false;
    companionHpRef.current = 100;
    companionAttackCdRef.current = 0;
    companionFinalSpokenRef.current = false;
    reviveRef.current = { x: randomRange(-WORLD_HALF + 16, WORLD_HALF - 16), z: randomRange(FINISH_Z + 70, START_Z - 90), collected: true };
    keyRef.current = randomQuestPoint();
    codeRef.current = randomQuestPoint();
    hpRef.current = balance.hp;
    scoreRef.current = 0;
    dayTimeRef.current = 0.24;
    staminaRef.current = STAMINA_MAX;
    walkModeRef.current = 'walk';
    storyFlagsRef.current = { trust: 0, lore: 0, risk: 0, cruelty: 0 };
    endingRef.current = '';
    weaponRef.current = 'knife';
    selectedSlotRef.current = 0;
    heldItemRef.current = 'knife';
    attackCdRef.current = 0;
    spawnTimerRef.current = 0;
    nextEventRef.current = balance.eventInterval;
    eventTimerRef.current = 0;
    eventKindRef.current = null;
    dimensionRef.current = 'steppe';
    dimensionTimerRef.current = 0;
    teleportCooldownRef.current = 0;
    deathTriggeredRef.current = false;
    hintRef.current = 'Найди ключ и код от крепости. Стрелки показывают путь.';
    setTaunt('');
    setDialog(null);
    setJumpscare(false);
    setVision('');
    setEnding('');
    setHud({
      hp: balance.hp,
      score: 0,
      distance: 100,
      nextEvent: balance.eventInterval,
      event: '',
      eventLeft: 0,
      timeOfDay: dayPhaseLabel(dayPhaseAt(dayTimeRef.current)),
      stamina: STAMINA_MAX,
      walkMode: walkModeLabel('walk'),
      difficulty: balance.label,
      story: 0,
    weapon: WEAPONS.knife.name,
    heldItem: ITEM_LABELS.knife,
    selectedSlot: 0,
      dimension: 'Степь',
      teleport: 0,
      dimensionLeft: 0,
      hasKey: false,
      hasCode: false,
      traderNav: questNav(playerRef.current, navPoint(HOUSE_NPCS.find((npc) => npc.id === TRADER_NPC_ID)?.x ?? 0, HOUSE_NPCS.find((npc) => npc.id === TRADER_NPC_ID)?.z ?? 0)),
      companionNav: questNav(playerRef.current, navPoint(COMPANION_HOUSE.x, COMPANION_HOUSE.z)),
      reviveNav: questNav(playerRef.current, reviveRef.current),
      coordsBought: false,
      companionRecruited: false,
      companionAlive: false,
      reviveVisible: false,
      keyNav: questNav(playerRef.current, keyRef.current),
      codeNav: questNav(playerRef.current, codeRef.current),
      inventory: [...inventoryRef.current],
      hint: hintRef.current,
    });
  };

  useEffect(() => {
    if (phase !== 'playing') return;
    const mount = mountRef.current;
    if (!mount) return;
    setAssetLoading(true);
    setAssetLoadingProgress(1);
    setAssetLoadingLabel('У вас лагает компьютер, подождите загрузку...');
    const balance = DIFFICULTY[difficultyRef.current];

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xa8c9d4);
    scene.fog = new THREE.Fog(0xa8c9d4, 72, 460);

    const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 900);
    const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.18;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.domElement.style.filter = 'saturate(1.2) contrast(1.04) brightness(1.08)';
    mount.appendChild(renderer.domElement);

    const shaderMaterials = new Set<THREE.ShaderMaterial>();
    const trackShaders = (object: THREE.Object3D) => {
      object.traverse((part) => {
        if (part instanceof THREE.Mesh && part.material instanceof THREE.ShaderMaterial) shaderMaterials.add(part.material);
      });
    };

    const skyDome = makeSkyDome();
    scene.add(skyDome);
    trackShaders(skyDome);

    const hemi = new THREE.HemisphereLight(0xf4fbff, 0x74815a, 1.42);
    scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xffd39a, 3.75);
    sun.position.set(-44, 58, 28);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.bias = -0.00012;
    sun.shadow.normalBias = 0.025;
    sun.shadow.camera.left = -230;
    sun.shadow.camera.right = 230;
    sun.shadow.camera.top = 230;
    sun.shadow.camera.bottom = -230;
    scene.add(sun);
    scene.add(sun.target);
    const rimLight = new THREE.DirectionalLight(0xa7e8ff, 1.72);
    rimLight.position.set(38, 26, -42);
    scene.add(rimLight);
    const fireGlow = new THREE.PointLight(0xff9b48, 1.6, 42, 1.8);
    fireGlow.position.set(0, 5.2, START_Z - 18);
    scene.add(fireGlow);
    const atmosphereParticles = makeAtmosphereParticles(360);
    scene.add(atmosphereParticles);

    const groundGeo = new THREE.PlaneGeometry(WORLD_HALF * 2 + 70, START_Z - FINISH_Z + 140, 72, 180);
    const groundPos = groundGeo.attributes.position;
    for (let i = 0; i < groundPos.count; i++) {
      const x = groundPos.getX(i);
      const y = groundPos.getY(i);
      const wave = Math.sin(x * 0.035) * 0.75 + Math.cos(y * 0.024) * 0.9 + Math.sin((x + y) * 0.018) * 0.55;
      groundPos.setZ(i, wave);
    }
    groundGeo.computeVertexNormals();
    const ground = new THREE.Mesh(
      groundGeo,
      makeGroundShaderMaterial(12.5),
    );
    ground.userData.shader = 'ground';
    ground.rotation.x = -Math.PI / 2;
    ground.position.z = (START_Z + FINISH_Z) / 2 - 18;
    ground.receiveShadow = true;
    scene.add(ground);
    trackShaders(ground);

    const pathTexture = makeProceduralTexture('sun baked steppe trail', ['#9f7a3d', '#b18b4d', '#7d5f31', '#c49b5b', '#6b542d'], 192, 0.42);
    pathTexture.wrapS = THREE.RepeatWrapping;
    pathTexture.wrapT = THREE.RepeatWrapping;
    pathTexture.repeat.set(2.1, 44);
    const path = new THREE.Mesh(
      new THREE.PlaneGeometry(22, START_Z - FINISH_Z + 80),
      new THREE.MeshStandardMaterial({
        color: 0xffcf84,
        map: pathTexture,
        emissive: 0x6f4617,
        emissiveIntensity: 0.34,
        roughness: 0.88,
        metalness: 0,
        side: THREE.DoubleSide,
      }),
    );
    path.rotation.x = -Math.PI / 2;
    path.position.set(0, 0.02, (START_Z + FINISH_Z) / 2 - 10);
    path.receiveShadow = false;
    scene.add(path);

    const dustMat = new THREE.MeshStandardMaterial({ color: 0x8a7a4c, map: worldTextures().soil, bumpMap: worldTextures().soil, bumpScale: 0.026, roughness: 0.98 });
    for (let i = 0; i < 18; i++) {
      const patch = new THREE.Mesh(new THREE.CircleGeometry(randomRange(4, 11), 18), dustMat);
      patch.rotation.x = -Math.PI / 2;
      patch.position.set(randomRange(-WORLD_HALF + 18, WORLD_HALF - 18), 0.035, randomRange(FINISH_Z + 35, START_Z - 20));
      patch.scale.x = randomRange(1.0, 2.4);
      patch.scale.y = randomRange(0.55, 1.2);
      patch.rotation.z = randomRange(0, Math.PI);
      scene.add(patch);
    }

    const grassMat = new THREE.MeshStandardMaterial({ color: 0x4d5e36, map: worldTextures().grass, bumpMap: worldTextures().grass, bumpScale: 0.035, roughness: 0.95 });
    const strawMat = new THREE.MeshStandardMaterial({ color: 0xb0a35a, map: worldTextures().grass, bumpMap: worldTextures().grass, bumpScale: 0.025, roughness: 0.98 });
    for (let i = 0; i < 120; i++) {
      const tuft = new THREE.Mesh(new THREE.ConeGeometry(0.18 + (i % 3) * 0.08, 0.9 + (i % 5) * 0.24, 5), i % 4 === 0 ? strawMat : grassMat);
      tuft.position.set(randomRange(-WORLD_HALF, WORLD_HALF), 0.6, randomRange(FINISH_Z + 20, START_Z + 4));
      tuft.rotation.y = i * 0.71;
      tuft.castShadow = true;
      scene.add(tuft);
    }

    for (let i = 0; i < 22; i++) {
      placeScenery(scene, makeRockCluster(), randomRange(-WORLD_HALF + 8, WORLD_HALF - 8), randomRange(FINISH_Z + 28, START_Z - 18), randomRange(0.7, 1.8));
    }
    for (let i = 0; i < 10; i++) {
      placeScenery(scene, makeForestTree(), randomRange(-WORLD_HALF + 12, WORLD_HALF - 12), randomRange(FINISH_Z + 42, START_Z - 28), randomRange(0.85, 1.55));
    }
    for (let i = 0; i < 12; i++) {
      placeScenery(scene, makeDryTree(), randomRange(-WORLD_HALF + 12, WORLD_HALF - 12), randomRange(FINISH_Z + 42, START_Z - 28), randomRange(0.75, 1.4));
    }
    for (let i = 0; i < 5; i++) {
      placeScenery(scene, makeRuin(), randomRange(-WORLD_HALF + 28, WORLD_HALF - 28), randomRange(FINISH_Z + 70, START_Z - 60), randomRange(0.7, 1.35));
    }
    for (let i = 0; i < 4; i++) {
      placeScenery(scene, makeCampDebris(), randomRange(-WORLD_HALF + 24, WORLD_HALF - 24), randomRange(FINISH_Z + 55, START_Z - 50), randomRange(0.8, 1.3));
    }
    for (let i = 0; i < 16; i++) {
      placeScenery(scene, makeDetailPatch(i), randomRange(-WORLD_HALF + 10, WORLD_HALF - 10), randomRange(FINISH_Z + 28, START_Z - 12), randomRange(0.65, 1.45));
    }
    for (let i = 0; i < 8; i++) {
      placeScenery(scene, makeTreeStump(), randomRange(-WORLD_HALF + 18, WORLD_HALF - 18), randomRange(FINISH_Z + 48, START_Z - 34), randomRange(0.65, 1.3));
    }
    for (let i = 0; i < 3; i++) {
      placeScenery(scene, makeCoveredCarWreck(), randomRange(-WORLD_HALF + 26, WORLD_HALF - 26), randomRange(FINISH_Z + 70, START_Z - 65), randomRange(0.78, 1.18));
    }
    for (let i = 0; i < 4; i++) {
      placeScenery(scene, makeMedicalSupplyCache(), randomRange(-WORLD_HALF + 22, WORLD_HALF - 22), randomRange(FINISH_Z + 65, START_Z - 40), randomRange(0.8, 1.15));
    }
    for (let i = 0; i < 2; i++) {
      placeScenery(scene, makeServicePistolCache(), randomRange(-WORLD_HALF + 28, WORLD_HALF - 28), randomRange(FINISH_Z + 85, START_Z - 70), randomRange(0.82, 1.05));
    }

    const physicsObstacles: PhysicsObstacle[] = [];
    const npcFigures: { npc: HouseNpc; mesh: THREE.Group; animator?: CharacterAnimator }[] = [];
    const placedHouses: { npc: HouseNpc; mesh: THREE.Group; replaced: boolean }[] = [];
    const addObstacle = (obstacle: PhysicsObstacle) => physicsObstacles.push(obstacle);

    scene.add(makeFortress(0, FINISH_Z - 10, false));
    addObstacle({ key: 'fortress-real', x: 0, z: FINISH_Z - 10, radius: 10, kind: 'solid' });
    for (const fake of fakeFortressesRef.current) {
      scene.add(makeFortress(fake.x, fake.z, true));
      addObstacle({ key: `fake-${fake.id}`, x: fake.x, z: fake.z, radius: 8, kind: 'solid' });
    }
    for (const npc of houseNpcsRef.current) {
      const house = makeHouse(npc.mood);
      house.position.set(npc.x, 0, npc.z);
      house.rotation.y = npc.x < 0 ? -0.28 : 0.28;
      house.scale.setScalar(HOUSE_WORLD_SCALE);
      scene.add(house);
      placedHouses.push({ npc, mesh: house, replaced: false });
      addObstacle({ key: `house-${npc.id}`, x: npc.x, z: npc.z, radius: 3.8, kind: 'solid' });
      const windowGlow = new THREE.PointLight(npc.mood === 'evil' ? 0xb84230 : 0xffc978, npc.mood === 'evil' ? 1.15 : 0.9, 18, 2.1);
      windowGlow.position.set(npc.x, 1.85, npc.z - 3.35);
      scene.add(windowGlow);

      const figure = makeNpcFigure(npc.mood);
      figure.position.set(npc.x, 0, npc.z - 3.55);
      scene.add(figure);
      npcFigures.push({ npc, mesh: figure });
    }
    const companionHouse = makeHouse(COMPANION_HOUSE.mood);
    companionHouse.position.set(COMPANION_HOUSE.x, 0, COMPANION_HOUSE.z);
    companionHouse.rotation.y = 0.18;
    companionHouse.scale.setScalar(HOUSE_WORLD_SCALE);
    scene.add(companionHouse);
    placedHouses.push({ npc: COMPANION_HOUSE, mesh: companionHouse, replaced: false });
    addObstacle({ key: 'companion-house', x: COMPANION_HOUSE.x, z: COMPANION_HOUSE.z, radius: 3.8, kind: 'solid' });
    const companionDoorGlow = new THREE.PointLight(0x8cffb8, 1.25, 20, 2);
    companionDoorGlow.position.set(COMPANION_HOUSE.x, 1.88, COMPANION_HOUSE.z - 3.35);
    scene.add(companionDoorGlow);
    const companionHouseFigure = makeNpcFigure(COMPANION_HOUSE.mood);
    companionHouseFigure.position.set(COMPANION_HOUSE.x, 0, COMPANION_HOUSE.z - 3.55);
    scene.add(companionHouseFigure);
    npcFigures.push({ npc: COMPANION_HOUSE, mesh: companionHouseFigure });

    const worldChunks = new Map<string, THREE.Group>();
    const updateWorldChunks = () => {
      const pcx = Math.floor(playerRef.current.x / CHUNK_SIZE);
      const pcz = Math.floor(playerRef.current.z / CHUNK_SIZE);
      const needed = new Set<string>();

      for (let dz = -CHUNK_RADIUS; dz <= CHUNK_RADIUS; dz++) {
        for (let dx = -CHUNK_RADIUS; dx <= CHUNK_RADIUS; dx++) {
          const cx = pcx + dx;
          const cz = pcz + dz;
          const key = `${cx},${cz}`;
          needed.add(key);
          if (!worldChunks.has(key)) {
            const chunk = makeWorldChunk(cx, cz);
            worldChunks.set(key, chunk);
            scene.add(chunk);
            trackShaders(chunk);
            const chunkObstacles = (chunk.userData.obstacles as Omit<PhysicsObstacle, 'key'>[] | undefined) ?? [];
            for (const obstacle of chunkObstacles) {
              addObstacle({
                ...obstacle,
                key,
                x: chunk.position.x + obstacle.x,
                z: chunk.position.z + obstacle.z,
              });
            }
          }
        }
      }

      for (const [key, chunk] of worldChunks) {
        if (!needed.has(key)) {
          chunk.traverse((part) => {
            if (part instanceof THREE.Mesh && part.material instanceof THREE.ShaderMaterial) shaderMaterials.delete(part.material);
          });
          scene.remove(chunk);
          worldChunks.delete(key);
          for (let i = physicsObstacles.length - 1; i >= 0; i--) {
            if (physicsObstacles[i].key === key) physicsObstacles.splice(i, 1);
          }
        }
      }
    };
    updateWorldChunks();

    const player = new THREE.Group();
    const coatMat = new THREE.MeshStandardMaterial({ color: 0x2c5f86, roughness: 0.72 });
    const shirtMat = new THREE.MeshStandardMaterial({ color: 0xd8c9a1, roughness: 0.72 });
    const skinMat = new THREE.MeshStandardMaterial({ color: 0xc98f62, roughness: 0.68 });
    const leatherMat = new THREE.MeshStandardMaterial({ color: 0x4a2f22, roughness: 0.82 });
    const hairMat = new THREE.MeshStandardMaterial({ color: 0x201712, roughness: 0.9 });
    const bootMat = new THREE.MeshStandardMaterial({ color: 0x1b1714, roughness: 0.84 });
    const furMat = new THREE.MeshStandardMaterial({ color: 0xe5dcc8, roughness: 0.94 });
    const hloodMat = new THREE.MeshBasicMaterial({ color: 0x9cf3ff, transparent: true, opacity: 0.28 });
    const playerBody = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.48, 1.48, 7, 16),
      coatMat,
    );
    playerBody.position.y = 1.46;
    playerBody.scale.set(0.95, 1.08, 0.7);
    playerBody.castShadow = true;
    const shirtFront = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.92, 0.04), shirtMat);
    shirtFront.position.set(0, 1.5, -0.39);
    shirtFront.castShadow = true;
    const playerHead = new THREE.Mesh(
      new THREE.SphereGeometry(0.38, 18, 16),
      skinMat,
    );
    playerHead.position.set(0, 2.62, -0.03);
    playerHead.scale.set(0.92, 1.08, 0.86);
    playerHead.castShadow = true;
    const hair = new THREE.Mesh(new THREE.SphereGeometry(0.4, 14, 10), hairMat);
    hair.position.set(0, 2.82, 0.02);
    hair.scale.set(0.98, 0.38, 0.9);
    hair.castShadow = true;
    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.18, 8), skinMat);
    nose.position.set(0, 2.58, -0.39);
    nose.rotation.x = Math.PI / 2;
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x171717 });
    const leftEye = new THREE.Mesh(new THREE.SphereGeometry(0.032, 8, 8), eyeMat);
    const rightEye = leftEye.clone();
    leftEye.position.set(-0.12, 2.68, -0.34);
    rightEye.position.set(0.12, 2.68, -0.34);
    const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.025, 0.025), new THREE.MeshBasicMaterial({ color: 0x3f1d19 }));
    mouth.position.set(0, 2.45, -0.36);
    const hat = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.52, 0.3, 16), furMat);
    hat.position.y = 3.05;
    hat.castShadow = true;
    const belt = new THREE.Mesh(new THREE.BoxGeometry(1.32, 0.18, 0.38), leatherMat);
    belt.position.set(0, 1.25, -0.02);
    const pack = new THREE.Mesh(new THREE.BoxGeometry(0.82, 1.05, 0.38), leatherMat);
    pack.position.set(0, 1.45, 0.72);
    pack.castShadow = true;
    const scarf = new THREE.Mesh(new THREE.TorusGeometry(0.46, 0.06, 8, 24), new THREE.MeshStandardMaterial({ color: 0xc84836, roughness: 0.65 }));
    scarf.position.y = 2.13;
    scarf.rotation.x = Math.PI / 2;
    const playerWalkParts: { part: THREE.Object3D; side: number; baseX: number; baseZ: number; role: 'arm' | 'leg' }[] = [];
    for (const side of [-1, 1]) {
      const upperArm = new THREE.Mesh(new THREE.CapsuleGeometry(0.105, 0.62, 4, 8), coatMat);
      upperArm.position.set(side * 0.56, 1.66, -0.03);
      upperArm.rotation.z = side * 0.32;
      upperArm.castShadow = true;
      player.add(upperArm);
      playerWalkParts.push({ part: upperArm, side, baseX: upperArm.rotation.x, baseZ: upperArm.rotation.z, role: 'arm' });

      const forearm = new THREE.Mesh(new THREE.CapsuleGeometry(0.09, 0.55, 4, 8), skinMat);
      forearm.position.set(side * 0.74, 1.22, -0.32);
      forearm.rotation.z = side * 0.18;
      forearm.rotation.x = -0.55;
      forearm.castShadow = true;
      player.add(forearm);
      playerWalkParts.push({ part: forearm, side, baseX: forearm.rotation.x, baseZ: forearm.rotation.z, role: 'arm' });

      const hand = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), skinMat);
      hand.position.set(side * 0.8, 0.98, -0.55);
      hand.scale.set(0.8, 0.62, 1);
      hand.castShadow = true;
      player.add(hand);

      const thigh = new THREE.Mesh(new THREE.CapsuleGeometry(0.14, 0.76, 4, 8), leatherMat);
      thigh.position.set(side * 0.22, 0.82, 0.02);
      thigh.castShadow = true;
      player.add(thigh);
      playerWalkParts.push({ part: thigh, side, baseX: thigh.rotation.x, baseZ: thigh.rotation.z, role: 'leg' });

      const shin = new THREE.Mesh(new THREE.CapsuleGeometry(0.12, 0.72, 4, 8), leatherMat);
      shin.position.set(side * 0.22, 0.28, -0.03);
      shin.castShadow = true;
      player.add(shin);
      playerWalkParts.push({ part: shin, side, baseX: shin.rotation.x, baseZ: shin.rotation.z, role: 'leg' });

      const boot = new THREE.Mesh(new THREE.BoxGeometry(0.27, 0.16, 0.5), bootMat);
      boot.position.set(side * 0.22, 0.04, -0.22);
      boot.castShadow = true;
      player.add(boot);
    }
    const hloodAura = new THREE.Mesh(new THREE.SphereGeometry(1.75, 24, 16), hloodMat);
    hloodAura.position.y = 1.55;
    hloodAura.visible = false;
    const heldWeaponModel = new THREE.Group();
    heldWeaponModel.position.set(0.82, 1.03, -0.62);
    heldWeaponModel.rotation.set(-0.2, 0.12, -0.12);
    let renderedHeldKind: PickupKind | null = null;
    let renderedKnifeSkinId = '';
    const refreshHeldWeaponModel = () => {
      if (renderedHeldKind === heldItemRef.current && renderedKnifeSkinId === selectedKnifeSkinId) return;
      heldWeaponModel.clear();
      const model = makeHeldItemModel(heldItemRef.current, selectedKnifeSkinId);
      model.position.set(0, 0, 0);
      model.rotation.set(0, 0, 0);
      heldWeaponModel.add(model);
      renderedHeldKind = heldItemRef.current;
      renderedKnifeSkinId = selectedKnifeSkinId;
    };
    refreshHeldWeaponModel();
    player.add(playerBody, shirtFront, playerHead, hair, nose, leftEye, rightEye, mouth, hat, belt, pack, scarf, hloodAura, heldWeaponModel);
    const runtimePlayerOutfit = makeRuntimeOutfit(PLAYER_OUTFIT_BY_DIFFICULTY[difficultyRef.current], 'player');
    runtimePlayerOutfit.mesh.position.set(0, -0.08, 0.04);
    player.add(runtimePlayerOutfit.mesh);
    for (const limb of runtimePlayerOutfit.walkParts) playerWalkParts.push(limb);
    for (const part of [playerBody, shirtFront, playerHead, hair, nose, leftEye, rightEye, mouth, hat, belt, pack, scarf]) {
      part.visible = false;
    }
    scene.add(player);
    const gltfLoader = new GLTFLoader();
    const fbxLoader = new FBXLoader();
    const textureLoader = new THREE.TextureLoader();
    let stopped = false;
    const assetLoadTotal = Math.max(1,
      (USE_CHARACTER_RUNTIME_ASSETS ? Object.keys(OUTFIT_URLS).length + 1 : 0) +
      (USE_WORLD_RUNTIME_ASSETS ? Object.keys(MEDIEVAL_PROP_URLS).length + Object.keys(MEDIEVAL_EXTRA_PROP_URLS).length + GAME_LOADING_TEXTURE_FILES.length : 0),
    );
    let assetLoadDone = 0;
    const markAssetReady = (label: string) => {
      if (stopped) return;
      assetLoadDone += 1;
      const progress = Math.min(100, Math.round((assetLoadDone / assetLoadTotal) * 100));
      setAssetLoadingProgress(progress);
      setAssetLoadingLabel(label);
      if (assetLoadDone >= assetLoadTotal) {
        window.setTimeout(() => {
          if (!stopped) setAssetLoading(false);
        }, 450);
      }
    };
    if (!USE_CHARACTER_RUNTIME_ASSETS && !USE_WORLD_RUNTIME_ASSETS) {
      setAssetLoadingProgress(100);
      setAssetLoadingLabel('Легкий режим: кинематографичные fallback-модели готовы.');
      window.setTimeout(() => {
        if (!stopped) setAssetLoading(false);
      }, 250);
    }
    for (const file of GAME_LOADING_TEXTURE_FILES) {
      if (!USE_WORLD_RUNTIME_ASSETS) break;
      textureLoader.load(
        assetPath(file),
        () => markAssetReady(`Текстура загружена: ${file}`),
        undefined,
        () => markAssetReady(`Текстура пропущена: ${file}`),
      );
    }
    const assetMixers: THREE.AnimationMixer[] = [];
    const outfitTemplates: Partial<Record<OutfitKind, THREE.Group>> = {};
    const medievalPropTemplates: Partial<Record<MedievalPropKind, THREE.Group>> = {};
    const medievalExtraPropTemplates: Partial<Record<MedievalExtraPropKind, THREE.Group>> = {};
    let outfitModel: THREE.Group | null = null;
    let animationClips: THREE.AnimationClip[] = [];
    let playerAnimator: CharacterAnimator | null = null;
    let companionMesh: THREE.Group | null = null;
    let companionAnimator: CharacterAnimator | undefined;
    let animationGuide: THREE.Group | null = null;
    const playerOutfitKind = PLAYER_OUTFIT_BY_DIFFICULTY[difficultyRef.current];
    const loadGltf = (url: string, onLoad: (gltf: GLTF) => void, onError: () => void, attempt = 0, enabled = USE_WORLD_RUNTIME_ASSETS) => {
      if (!enabled) return;
      gltfLoader.load(
        url,
        onLoad,
        undefined,
        () => {
          if (stopped) return;
          if (attempt < 2) {
            window.setTimeout(() => loadGltf(url, onLoad, onError, attempt + 1, enabled), 450 * (attempt + 1));
            return;
          }
          onError();
        },
      );
    };
    const loadFbx = (url: string, onLoad: (fbx: THREE.Group) => void, onError: () => void, attempt = 0, enabled = USE_WORLD_RUNTIME_ASSETS) => {
      if (!enabled) return;
      fbxLoader.load(
        url,
        onLoad,
        undefined,
        () => {
          if (stopped) return;
          if (attempt < 2) {
            window.setTimeout(() => loadFbx(url, onLoad, onError, attempt + 1, enabled), 450 * (attempt + 1));
            return;
          }
          onError();
        },
      );
    };

    const attachPlayerAnimator = () => {
      if (!outfitModel || playerAnimator || animationClips.length === 0) return;
      playerAnimator = createCharacterAnimator(outfitModel, animationClips);
      if (playerAnimator) {
        assetMixers.push(playerAnimator.mixer);
        playCharacterAnimation(playerAnimator, 'idle', 0);
      }
    };
    const attachPlayerOutfit = (template: THREE.Group) => {
      if (outfitModel) return;
      const importedOutfit = makeOutfitInstance(template, 'player');
      importedOutfit.position.set(0, -0.08 + (Number(importedOutfit.userData.groundLift) || 0), 0.04);
      importedOutfit.rotation.y = Math.PI;
      if (runtimePlayerOutfit.mesh.parent === player) {
        player.remove(runtimePlayerOutfit.mesh);
      }
      player.add(importedOutfit);
      outfitModel = importedOutfit;
      attachPlayerAnimator();
    };
    const attachBestLoadedPlayerOutfit = () => {
      const template =
        outfitTemplates[playerOutfitKind] ??
        outfitTemplates.maleRanger ??
        outfitTemplates.femaleRanger ??
        outfitTemplates.malePeasant ??
        outfitTemplates.femalePeasant;
      if (template) attachPlayerOutfit(template);
    };
    const removeMixer = (mixer: THREE.AnimationMixer | undefined) => {
      if (!mixer) return;
      const index = assetMixers.indexOf(mixer);
      if (index >= 0) assetMixers.splice(index, 1);
    };
    const enemyTemplatePool = () => [
      outfitTemplates.femalePeasant,
      outfitTemplates.malePeasant,
      outfitTemplates.femaleRanger,
      outfitTemplates.maleRanger,
    ].filter((template): template is THREE.Group => !!template);
    const npcTemplateFor = (npc: HouseNpc) => {
      if (npc.mood === 'evil') return outfitTemplates.maleRanger ?? outfitTemplates.femaleRanger ?? outfitTemplates.malePeasant ?? outfitTemplates.femalePeasant;
      return npc.id % 2 === 0
        ? outfitTemplates.malePeasant ?? outfitTemplates.femalePeasant ?? outfitTemplates.maleRanger
        : outfitTemplates.femalePeasant ?? outfitTemplates.malePeasant ?? outfitTemplates.femaleRanger;
    };
    const createEnemyModel = () => {
      const templates = enemyTemplatePool();
      const template = templates.length > 0 ? templates[Math.floor(Math.random() * templates.length)] : null;
      if (!template) {
        if (Math.random() < 0.18) return { mesh: makeEnemy(), animator: undefined };
        const fallback = makeRuntimeOutfit(Math.random() > 0.5 ? 'maleRanger' : 'femalePeasant', 'enemy', 'evil');
        return { mesh: fallback.mesh, animator: undefined };
      }

      const mesh = new THREE.Group();
      const outfit = makeOutfitInstance(template, 'enemy');
      outfit.position.set(0, -0.08 + (Number(outfit.userData.groundLift) || 0), 0.04);
      outfit.rotation.y = Math.PI;
      mesh.add(outfit);
      mesh.userData.outfitEnemy = true;
      mesh.userData.outfitRoot = outfit;
      mesh.userData.phase = randomRange(0, Math.PI * 2);
      mesh.userData.baseRotZ = 0;

      const eyeMat = new THREE.MeshBasicMaterial({ color: 0xffede2 });
      const leftEye = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 8), eyeMat);
      const rightEye = leftEye.clone();
      leftEye.position.set(-0.13, 2.55, -0.4);
      rightEye.position.set(0.13, 2.55, -0.4);
      mesh.add(leftEye, rightEye);

      const animator = animationClips.length > 0 ? createCharacterAnimator(outfit, animationClips, true) ?? undefined : undefined;
      if (animator) {
        assetMixers.push(animator.mixer);
        playCharacterAnimation(animator, 'walk', 0);
      }
      return { mesh, animator };
    };
    const createNpcModel = (npc: HouseNpc) => {
      const template = npcTemplateFor(npc);
      if (!template) {
        const fallback = makeRuntimeOutfit(
          npc.mood === 'evil' ? 'maleRanger' : npc.id % 2 === 0 ? 'malePeasant' : 'femalePeasant',
          'npc',
          npc.mood,
        );
        return { mesh: fallback.mesh, animator: undefined };
      }
      const mesh = new THREE.Group();
      const outfit = makeOutfitInstance(template, 'npc');
      outfit.position.set(0, -0.08 + (Number(outfit.userData.groundLift) || 0), 0.04);
      outfit.rotation.y = Math.PI;
      mesh.add(outfit);
      mesh.userData.outfitNpc = true;
      mesh.userData.outfitRoot = outfit;

      const animator = animationClips.length > 0 ? createCharacterAnimator(outfit, animationClips, npc.mood === 'evil') ?? undefined : undefined;
      if (animator) {
        assetMixers.push(animator.mixer);
        playCharacterAnimation(animator, npc.mood === 'evil' ? 'walk' : 'idle', 0);
      }
      return { mesh, animator };
    };
    const ensureCompanionModel = () => {
      if (companionMesh || !companionRecruitedRef.current || !companionAliveRef.current) return;
      const template = outfitTemplates.malePeasant ?? outfitTemplates.femalePeasant ?? outfitTemplates.femaleRanger ?? outfitTemplates.maleRanger;
      const mesh = new THREE.Group();
      const runtimeFallback = template ? null : makeRuntimeOutfit('malePeasant', 'npc', 'good');
      const root = template ? makeOutfitInstance(template, 'npc') : runtimeFallback!.mesh;
      root.position.set(0, -0.08 + (Number(root.userData.groundLift) || 0), 0.04);
      root.rotation.y = Math.PI;
      mesh.add(root);
      mesh.userData.outfitCompanion = !!template;
      mesh.userData.outfitRoot = root;
      mesh.position.set(playerRef.current.x - 2.2, terrainHeightAt(playerRef.current.x, playerRef.current.z), playerRef.current.z + 2.4);
      scene.add(mesh);
      companionMesh = mesh;
      companionAnimator = template && animationClips.length > 0 ? createCharacterAnimator(root, animationClips) ?? undefined : undefined;
      if (companionAnimator) {
        assetMixers.push(companionAnimator.mixer);
        playCharacterAnimation(companionAnimator, 'idle', 0);
      }
    };
    const removeCompanionModel = () => {
      if (companionAnimator) removeMixer(companionAnimator.mixer);
      companionAnimator = undefined;
      if (companionMesh) scene.remove(companionMesh);
      companionMesh = null;
    };
    const replaceCompanionFallback = () => {
      if (!companionMesh || !companionRecruitedRef.current || !companionAliveRef.current) return;
      if (companionMesh.userData.outfitCompanion) {
        const root = companionMesh.userData.outfitRoot as THREE.Object3D | undefined;
        if (!companionAnimator && root && animationClips.length > 0) {
          companionAnimator = createCharacterAnimator(root, animationClips) ?? undefined;
          if (companionAnimator) {
            assetMixers.push(companionAnimator.mixer);
            playCharacterAnimation(companionAnimator, 'idle', 0);
          }
        }
        return;
      }
      const position = companionMesh.position.clone();
      const rotation = companionMesh.rotation.clone();
      removeCompanionModel();
      ensureCompanionModel();
      if (companionMesh) {
        companionMesh.position.copy(position);
        companionMesh.rotation.copy(rotation);
      }
    };
    const replaceFallbackEnemies = () => {
      if (enemyTemplatePool().length === 0) return;
      for (const enemy of enemiesRef.current) {
        if (enemy.mesh.userData.outfitEnemy) {
          const root = enemy.mesh.userData.outfitRoot as THREE.Object3D | undefined;
          if (!enemy.animator && root && animationClips.length > 0) {
            enemy.animator = createCharacterAnimator(root, animationClips, true) ?? undefined;
            if (enemy.animator) {
              assetMixers.push(enemy.animator.mixer);
              playCharacterAnimation(enemy.animator, 'walk', 0);
            }
          }
          continue;
        }
        const previous = enemy.mesh;
        const { mesh, animator } = createEnemyModel();
        mesh.position.copy(previous.position);
        mesh.rotation.copy(previous.rotation);
        mesh.userData.outfitEnemy = true;
        scene.add(mesh);
        scene.remove(previous);
        enemy.mesh = mesh;
        enemy.animator = animator;
      }
    };
    const replaceFallbackNpcs = () => {
      for (const entry of npcFigures) {
        if (entry.mesh.userData.outfitNpc) {
          const root = entry.mesh.userData.outfitRoot as THREE.Object3D | undefined;
          if (!entry.animator && root && animationClips.length > 0) {
            entry.animator = createCharacterAnimator(root, animationClips, entry.npc.mood === 'evil') ?? undefined;
            if (entry.animator) {
              assetMixers.push(entry.animator.mixer);
              playCharacterAnimation(entry.animator, entry.npc.mood === 'evil' ? 'walk' : 'idle', 0);
            }
          }
          continue;
        }

        const previous = entry.mesh;
        const { mesh, animator } = createNpcModel(entry.npc);
        mesh.position.copy(previous.position);
        mesh.rotation.copy(previous.rotation);
        scene.add(mesh);
        scene.remove(previous);
        entry.mesh = mesh;
        entry.animator = animator;
      }
    };
    const placedMedievalDecor = new Set<MedievalPropKind>();
    const addMedievalModule = (
      parent: THREE.Group,
      template: THREE.Group | undefined,
      x: number,
      y: number,
      z: number,
      scale = 1,
      rotationY = 0,
    ) => {
      if (!template) return;
      const module = makeAssetInstance(template);
      module.position.set(x, y, z);
      module.rotation.y = rotationY;
      module.scale.multiplyScalar(scale);
      parent.add(module);
    };
    const makeMedievalKitHouse = (npc: HouseNpc) => {
      const group = new THREE.Group();
      const sideTurn = npc.x < 0 ? -0.28 : 0.28;
      const wall = npc.mood === 'evil' ? medievalExtraPropTemplates.wallBrick : medievalExtraPropTemplates.wallPlaster;
      const roof = npc.id % 3 === 1 ? medievalExtraPropTemplates.roofWood : medievalPropTemplates.roundRoof;
      const frontWindow = medievalExtraPropTemplates.wallWindow;
      if (!wall || !frontWindow || !roof || !medievalPropTemplates.roundDoor) return null;

      addMedievalModule(group, wall, -2.4, 0, -3.45, 1.0, 0);
      addMedievalModule(group, frontWindow, 2.3, 0, -3.45, 1.0, 0);
      addMedievalModule(group, wall, -4.05, 0, 0, 1.0, Math.PI / 2);
      addMedievalModule(group, wall, 4.05, 0, 0, 1.0, Math.PI / 2);
      addMedievalModule(group, wall, -2.1, 0, 3.45, 1.0, Math.PI);
      addMedievalModule(group, wall, 2.1, 0, 3.45, 1.0, Math.PI);

      addMedievalModule(group, medievalPropTemplates.roundDoor, 0, 0, -3.7, 1.05, 0);
      addMedievalModule(group, medievalExtraPropTemplates.doorFrame, 0, 0, -3.74, 1.02, 0);
      addMedievalModule(group, medievalExtraPropTemplates.shutter, -2.7, 1.05, -3.78, 0.72, 0);
      addMedievalModule(group, medievalExtraPropTemplates.shutter, 2.7, 1.05, -3.78, 0.72, 0);

      addMedievalModule(group, roof, 0, 3.75, 0, 2.1, Math.PI / 2);
      if (npc.id % 2 === 0) addMedievalModule(group, medievalExtraPropTemplates.roofDormer, 0, 4.35, -1.55, 0.9, 0);
      addMedievalModule(group, medievalPropTemplates.chimney, npc.x < 0 ? -2.2 : 2.2, 4.85, 0.7, 1.0, 0);
      addMedievalModule(group, medievalExtraPropTemplates.stairs, 0, 0, -4.8, 0.95, 0);
      addMedievalModule(group, medievalExtraPropTemplates.support, -3.6, 0, -3.95, 0.9, 0);
      addMedievalModule(group, medievalExtraPropTemplates.support, 3.6, 0, -3.95, 0.9, 0);
      if (npc.mood !== 'evil') {
        addMedievalModule(group, medievalPropTemplates.vine, -3.95, 1.25, -3.85, 1.2, -0.2);
        addMedievalModule(group, medievalExtraPropTemplates.vine2, 3.95, 1.15, -3.85, 1.1, 0.2);
      }

      group.position.set(npc.x, terrainHeightAt(npc.x, npc.z), npc.z);
      group.rotation.y = sideTurn;
      group.scale.setScalar(0.46);
      group.name = `FBX Medieval House ${npc.id}`;
      return group;
    };
    const replaceProceduralHousesWithFbx = () => {
      if (!USE_MEDIEVAL_FBX_HOUSES) return;
      for (const entry of placedHouses) {
        if (entry.replaced) continue;
        const replacement = makeMedievalKitHouse(entry.npc);
        if (!replacement) return;
        scene.add(replacement);
        scene.remove(entry.mesh);
        entry.mesh = replacement;
        entry.replaced = true;
      }
    };
    const addMedievalProp = (kind: MedievalPropKind, x: number, z: number, scale: number, rotation = 0) => {
      const template = medievalPropTemplates[kind];
      if (!template) return;
      const prop = makeAssetInstance(template);
      prop.position.set(x, terrainHeightAt(x, z), z);
      prop.rotation.y = rotation;
      prop.scale.setScalar(scale * MEDIEVAL_PROP_SCALE);
      scene.add(prop);
    };
    const placeMedievalDecor = (kind: MedievalPropKind) => {
      if (placedMedievalDecor.has(kind) || !medievalPropTemplates[kind]) return;
      placedMedievalDecor.add(kind);

      for (const npc of houseNpcsRef.current) {
        const side = npc.x < 0 ? -1 : 1;
        if (kind === 'wagon' && npc.id % 3 === 0) addMedievalProp(kind, npc.x + side * 7.8, npc.z - 1.6, 1.35, side * 0.7);
        if (kind === 'crate') {
          addMedievalProp(kind, npc.x - side * 4.6, npc.z - 5.9, 0.9 + (npc.id % 3) * 0.12, npc.id * 0.8);
          if (npc.id % 2 === 0) addMedievalProp(kind, npc.x - side * 5.6, npc.z - 5.2, 0.72, npc.id * 0.45);
        }
        if (kind === 'woodFence') {
          addMedievalProp(kind, npc.x - 4.2, npc.z + 4.9, 1.2, Math.PI / 2);
          addMedievalProp(kind, npc.x + 4.2, npc.z + 4.9, 1.2, Math.PI / 2);
        }
        if (kind === 'vine' && npc.mood !== 'evil') addMedievalProp(kind, npc.x + side * 3.8, npc.z - 3.95, 1.5, side * 0.2);
      }

      for (const fake of fakeFortressesRef.current) {
        if (kind === 'metalFence') {
          addMedievalProp(kind, fake.x - 8, fake.z + 7, 1.8, Math.PI / 2);
          addMedievalProp(kind, fake.x + 8, fake.z + 7, 1.8, Math.PI / 2);
        }
        if (kind === 'crate') addMedievalProp(kind, fake.x + 5, fake.z + 5, 1.1, fake.id * 0.4);
        if (kind === 'chimney') addMedievalProp(kind, fake.x - 4, fake.z - 3, 1.25, fake.id * 0.25);
      }
    };
    const placedMedievalExtraDecor = new Set<MedievalExtraPropKind>();
    const addMedievalExtraProp = (kind: MedievalExtraPropKind, x: number, z: number, scale: number, rotation = 0) => {
      const template = medievalExtraPropTemplates[kind];
      if (!template) return;
      const prop = makeAssetInstance(template);
      prop.position.set(x, terrainHeightAt(x, z), z);
      prop.rotation.y = rotation;
      prop.scale.setScalar(scale * MEDIEVAL_PROP_SCALE);
      scene.add(prop);
    };
    const placeMedievalExtraDecor = (kind: MedievalExtraPropKind) => {
      if (placedMedievalExtraDecor.has(kind) || !medievalExtraPropTemplates[kind]) return;
      placedMedievalExtraDecor.add(kind);

      for (const npc of houseNpcsRef.current) {
        const side = npc.x < 0 ? -1 : 1;
        if (kind === 'vine2' && npc.mood !== 'evil') addMedievalExtraProp(kind, npc.x - side * 3.75, npc.z - 3.95, 1.28, -side * 0.2);
      }

      for (const fake of fakeFortressesRef.current) {
        if (kind === 'roofTower') addMedievalExtraProp(kind, fake.x, fake.z + 1.2, 1.45, fake.id * 0.25);
        if (kind === 'ornamentFence') {
          addMedievalExtraProp(kind, fake.x - 10.5, fake.z + 9.2, 1.6, Math.PI / 2);
          addMedievalExtraProp(kind, fake.x + 10.5, fake.z + 9.2, 1.6, Math.PI / 2);
        }
        if (kind === 'border') {
          addMedievalExtraProp(kind, fake.x - 5.5, fake.z - 6.5, 1.55, 0);
          addMedievalExtraProp(kind, fake.x + 5.5, fake.z - 6.5, 1.55, 0);
        }
        if (kind === 'brickPile') {
          addMedievalExtraProp(kind, fake.x - 6.4, fake.z + 4.4, 1.2, fake.id * 0.5);
          addMedievalExtraProp(kind, fake.x + 6.1, fake.z - 3.8, 0.95, fake.id * 0.7);
        }
      }
    };

    replaceFallbackNpcs();

    for (const [kind, url] of Object.entries(OUTFIT_URLS) as [OutfitKind, string][]) {
      loadGltf(
        url,
        (gltf) => {
          if (stopped) return;
          const template = gltf.scene;
          fitAssetHeight(template, 3.05);
          enableAssetShadows(template);
          outfitTemplates[kind] = template;

          if (kind === playerOutfitKind) attachPlayerOutfit(template);
          attachBestLoadedPlayerOutfit();

          replaceFallbackEnemies();
          replaceFallbackNpcs();
          replaceCompanionFallback();
          markAssetReady(`Персонаж загружен: ${kind}`);
        },
        () => {
          hintRef.current = 'Не удалось загрузить один из fantasy outfit ассетов. Игра использует fallback-модель.';
          setHud((h) => ({ ...h, hint: hintRef.current }));
          markAssetReady(`Персонаж пропущен: ${kind}`);
        },
        0,
        USE_CHARACTER_RUNTIME_ASSETS,
      );
    }

    for (const [kind, url] of Object.entries(MEDIEVAL_PROP_URLS) as [MedievalPropKind, string][]) {
      loadFbx(
        url,
        (fbx) => {
          if (stopped) return;
          const template = fbx;
          prepareMedievalTemplate(template, kind);
          medievalPropTemplates[kind] = template;
          placeMedievalDecor(kind);
          replaceProceduralHousesWithFbx();
          markAssetReady(`Декор загружен: ${kind}`);
        },
        () => {
          hintRef.current = 'Не удалось загрузить часть Medieval Village декора.';
          setHud((h) => ({ ...h, hint: hintRef.current }));
          markAssetReady(`Декор пропущен: ${kind}`);
        },
      );
    }

    for (const [kind, url] of Object.entries(MEDIEVAL_EXTRA_PROP_URLS) as [MedievalExtraPropKind, string][]) {
      loadFbx(
        url,
        (fbx) => {
          if (stopped) return;
          const template = fbx;
          prepareMedievalTemplate(template, kind);
          medievalExtraPropTemplates[kind] = template;
          placeMedievalExtraDecor(kind);
          replaceProceduralHousesWithFbx();
          markAssetReady(`MegaKit модель загружена: ${kind}`);
        },
        () => {
          hintRef.current = 'Часть новых MegaKit-моделей не загрузилась, игра продолжит с доступным декором.';
          setHud((h) => ({ ...h, hint: hintRef.current }));
          markAssetReady(`MegaKit модель пропущена: ${kind}`);
        },
      );
    }

    loadGltf(
      ANIMATION_LIBRARY_URL,
      (gltf) => {
        if (stopped) return;
        animationClips = gltf.animations;
        attachBestLoadedPlayerOutfit();
        attachPlayerAnimator();
        replaceFallbackEnemies();
        replaceFallbackNpcs();
        replaceCompanionFallback();
        animationGuide = gltf.scene;
        animationGuide.name = 'Universal Animation Library Guide';
        fitAssetHeight(animationGuide, 2.95);
        enableAssetShadows(animationGuide);
        scene.add(animationGuide);
        animationGuide.visible = false;
        markAssetReady('Анимации персонажей загружены');

        const mixer = new THREE.AnimationMixer(animationGuide);
        const clip =
          findAnimationClip(gltf.animations, ['Walk_Carry_Loop', 'Idle_Lantern_Loop', 'Zombie_Walk_Fwd_Loop']) ??
          gltf.animations[0];
        if (clip) {
          const action = mixer.clipAction(clip);
          action.play();
          assetMixers.push(mixer);
        }
      },
      () => {
        hintRef.current = 'Не удалось загрузить Universal Animation Library, игра продолжит с fallback-анимацией.';
        setHud((h) => ({ ...h, hint: hintRef.current }));
        markAssetReady('Анимации персонажей пропущены');
      },
      0,
      USE_CHARACTER_RUNTIME_ASSETS,
    );
    window.setTimeout(() => {
      if (stopped) return;
      setAssetLoadingProgress(100);
      setAssetLoadingLabel('Мир готов, можно играть.');
      setAssetLoading(false);
    }, 14000);
    const playerShadow = new THREE.Mesh(
      new THREE.CircleGeometry(1.25, 28),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.28, depthWrite: false }),
    );
    playerShadow.rotation.x = -Math.PI / 2;
    scene.add(playerShadow);
    const dustPuffs: DustPuff[] = [];
    const spawnFootDust = (side: number, speedRatio: number) => {
      const material = new THREE.MeshBasicMaterial({
        color: dimensionRef.current === 'hloddev' ? 0xb7f6ff : 0x8c7650,
        transparent: true,
        opacity: 0.24,
        depthWrite: false,
      });
      const mesh = new THREE.Mesh(new THREE.CircleGeometry(0.32 + speedRatio * 0.22, 14), material);
      const yaw = player.rotation.y;
      const right = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
      const back = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
      mesh.position.copy(playerRef.current);
      mesh.position.addScaledVector(right, side * 0.34);
      mesh.position.addScaledVector(back, 0.52);
      mesh.position.y = playerRef.current.y + 0.035;
      mesh.rotation.x = -Math.PI / 2;
      mesh.rotation.z = randomRange(0, Math.PI * 2);
      scene.add(mesh);
      dustPuffs.push({ mesh, life: 0.68, age: 0 });
    };

    const addEnemy = (nearPlayer = true) => {
      const { mesh, animator } = createEnemyModel();
      const angle = randomRange(0, Math.PI * 2);
      const radius = randomRange(32, 72);
      const x = nearPlayer ? playerRef.current.x + Math.cos(angle) * radius : randomRange(-WORLD_HALF + 8, WORLD_HALF - 8);
      const z = nearPlayer ? playerRef.current.z + Math.sin(angle) * radius : randomRange(FINISH_Z + 28, START_Z - 35);
      mesh.position.set(x, 0, z);
      scene.add(mesh);
      enemiesRef.current.push({
        mesh,
        hp: 42 * balance.enemyHp,
        speed: (6.2 + Math.random() * 3.2) * balance.enemySpeed,
        damage: 17 * balance.enemyDamage,
        hitTimer: 0,
        animator,
      });
    };

    const clearEnemies = () => {
      for (const enemy of enemiesRef.current) {
        removeMixer(enemy.animator?.mixer);
        scene.remove(enemy.mesh);
      }
      enemiesRef.current = [];
    };

    const enterHouse = (npc: HouseNpc) => {
      insideHouseRef.current = npc.id;
      clearEnemies();
      hintRef.current = `Ты вошел в дом: ${npc.title}. Снаружи стало тихо.`;
      setDialog({ npc: { ...npc }, step: 0, lastReply: '' });
      setHud((h) => ({ ...h, hint: hintRef.current }));
    };

    const addPickup = (kind: PickupKind, x?: number, z?: number) => {
      const mesh = makePickup(kind);
      mesh.position.x = x ?? randomRange(-WORLD_HALF + 10, WORLD_HALF - 10);
      mesh.position.z = z ?? randomRange(FINISH_Z + 24, START_Z - 15);
      scene.add(mesh);
      pickupsRef.current.push({ mesh, kind });
    };

    const startEvent = () => {
      const eventKinds: EventKind[] = ['ambush', 'storm', 'rage', 'starvation'];
      const event = eventKinds[Math.floor(Math.random() * eventKinds.length)];
      eventKindRef.current = event;
      eventTimerRef.current = EVENT_DURATION;
      nextEventRef.current = balance.eventInterval;
      hintRef.current = `Ивент: ${EVENT_LABELS[event]}. ${EVENT_HINTS[event]}`;
      if (event === 'ambush') for (let i = 0; i < Math.round(9 / balance.spawn); i++) addEnemy(true);
      if (event === 'starvation') hpRef.current = Math.max(12, hpRef.current - 14 * balance.enemyDamage);
    };

    for (let i = 0; i < 58; i++) addPickup(i % 3 === 0 || i % 11 === 0 ? 'medkit' : 'crystal');
    for (const weapon of ['club', 'sabre', 'rifle', 'club', 'sabre'] as WeaponKind[]) {
      addPickup(weapon, randomRange(-WORLD_HALF + 14, WORLD_HALF - 14), randomRange(FINISH_Z + 42, START_Z - 56));
    }
    addPickup('key', keyRef.current.x, keyRef.current.z);
    addPickup('code', codeRef.current.x, codeRef.current.z);
    for (let i = 0; i < 14; i++) addEnemy(false);

    const clock = new THREE.Clock();
    const music = createDynamicMusic();
    let raf = 0;
    let playerWalkTime = 0;
    let playerYaw = Math.PI;
    let cameraYaw = Math.PI;
    let cameraPitch = 0;
    let footSide = 1;
    let footstepTimer = 0;
    let visionTimer = 18;
    let activeVision: VisionKind = '';
    let activeVisionLeft = 0;
    let previousDayPhase = dayPhaseAt(dayTimeRef.current);

    const resize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };

    const attack = () => {
      const held = heldItemRef.current;
      if (!isWeapon(held)) {
        hintRef.current = `${ITEM_LABELS[held]} РЅРµ РїРѕРјРѕР¶РµС‚ РІ РґСЂР°РєРµ. Р’С‹Р±РµСЂРё РѕСЂСѓР¶РёРµ РЅР° СЃР»РѕС‚Рµ 1-9.`;
        setHud((h) => ({ ...h, hint: hintRef.current }));
        return;
      }
      weaponRef.current = held;
      const weapon = WEAPONS[held];
      if (attackCdRef.current > 0) return;
      attackCdRef.current = weapon.cooldown;
      const attackAction = playerAnimator?.actions.attack;
      if (attackAction) {
        attackAction.reset();
        attackAction.timeScale = 1.25;
        attackAction.play();
      }
      let hit = false;

      for (const enemy of enemiesRef.current) {
        const toEnemy = new THREE.Vector2(enemy.mesh.position.x - playerRef.current.x, enemy.mesh.position.z - playerRef.current.z);
        const dist = toEnemy.length();
        const dir = toEnemy.normalize();
        const facing = aimRef.current.dot(dir);
        if (dist < weapon.range && facing > 0.25) {
          enemy.hp -= weapon.damage * (dimensionRef.current === 'hloddev' ? 1.28 : 1);
          enemy.hitTimer = 0.18;
          hit = true;
        }
      }

      hintRef.current = hit ? `${weapon.name}: попадание!` : `${weapon.name}: слишком далеко.`;
      setHud((h) => ({ ...h, hint: hintRef.current }));
    };

    const teleportToHloddev = () => {
      if (dimensionRef.current === 'hloddev') {
        hintRef.current = 'Ты уже в Хлоддеве. Воздух звенит, как ледяное стекло.';
        setHud((h) => ({ ...h, hint: hintRef.current }));
        return;
      }
      if (teleportCooldownRef.current > 0) {
        hintRef.current = `Переход в Хлоддев перезаряжается: ${Math.ceil(teleportCooldownRef.current)}с.`;
        setHud((h) => ({ ...h, hint: hintRef.current }));
        return;
      }

      dimensionRef.current = 'hloddev';
      dimensionTimerRef.current = TELEPORT_DURATION;
      teleportCooldownRef.current = TELEPORT_COOLDOWN;
      scoreRef.current += 5;
      hintRef.current = 'Переход открыт: Хлоддев. Враги слабее, ты быстрее, но холод ест HP.';
      setTaunt('ХЛОДДЕВ: чужое измерение без солнца. Здесь стены дышат инеем, а тени идут следом.');
      setTimeout(() => setTaunt(''), 3600);
      setHud((h) => ({ ...h, hint: hintRef.current }));
    };

    const refreshHeldItemAfterUse = () => {
      const item = inventoryRef.current[selectedSlotRef.current];
      if (item) {
        heldItemRef.current = item.kind;
        if (isWeapon(item.kind)) weaponRef.current = item.kind;
        return;
      }

      const fallbackSlot = inventoryRef.current.findIndex((entry) => isWeapon(entry.kind));
      if (fallbackSlot >= 0) {
        selectedSlotRef.current = fallbackSlot;
        heldItemRef.current = inventoryRef.current[fallbackSlot].kind;
        if (isWeapon(heldItemRef.current)) weaponRef.current = heldItemRef.current;
      }
    };

    const selectInventorySlot = (slot: number) => {
      selectedSlotRef.current = slot;
      const item = inventoryRef.current[slot];
      if (!item) {
        hintRef.current = `РЎР»РѕС‚ ${slot + 1} РїСѓСЃС‚.`;
        setHud((h) => ({ ...h, selectedSlot: slot, hint: hintRef.current }));
        return;
      }

      heldItemRef.current = item.kind;
      if (isWeapon(item.kind)) weaponRef.current = item.kind;
      hintRef.current = `Р’ СЂСѓРєРµ: ${ITEM_LABELS[item.kind]}. ${item.kind === 'medkit' ? 'РќР°Р¶РјРё E, С‡С‚РѕР±С‹ РёСЃРїРѕР»СЊР·РѕРІР°С‚СЊ.' : isWeapon(item.kind) ? 'РљР»РёРє Р±СЊРµС‚ РёРј.' : 'Р­С‚Рѕ РІР°Р¶РЅС‹Р№ РїСЂРµРґРјРµС‚.'}`;
      setHud((h) => ({
        ...h,
        weapon: WEAPONS[weaponRef.current].name,
        heldItem: ITEM_LABELS[heldItemRef.current],
        selectedSlot: slot,
        hint: hintRef.current,
      }));
    };

    const useSelectedItem = () => {
      const item = inventoryRef.current[selectedSlotRef.current];
      if (!item || item.kind !== 'medkit') {
        hintRef.current = 'Р’С‹Р±РµСЂРё СЃР»РѕС‚ СЃ Р°РїС‚РµС‡РєРѕР№ Рё РЅР°Р¶РјРё E.';
        setHud((h) => ({ ...h, hint: hintRef.current }));
        return;
      }
      if (hpRef.current >= balance.hp) {
        hintRef.current = 'HP СѓР¶Рµ РїРѕР»РЅС‹Р№. РђРїС‚РµС‡РєСѓ Р»СѓС‡С€Рµ СЃРѕС…СЂР°РЅРёС‚СЊ.';
        setHud((h) => ({ ...h, hint: hintRef.current }));
        return;
      }

      item.count -= 1;
      if (item.count <= 0) inventoryRef.current = inventoryRef.current.filter((entry) => entry !== item);
      refreshHeldItemAfterUse();
      hpRef.current = Math.min(balance.hp, hpRef.current + 32);
      hintRef.current = 'РђРїС‚РµС‡РєР° РёСЃРїРѕР»СЊР·РѕРІР°РЅР°: +32 HP.';
      setHud((h) => ({
        ...h,
        hp: Math.ceil(hpRef.current),
        weapon: WEAPONS[weaponRef.current].name,
        heldItem: ITEM_LABELS[heldItemRef.current],
        selectedSlot: selectedSlotRef.current,
        inventory: [...inventoryRef.current],
        hint: hintRef.current,
      }));
    };

    const useMedkit = () => {
      const medkit = inventoryRef.current.find((item) => item.kind === 'medkit');
      if (!medkit || medkit.count <= 0) {
        hintRef.current = 'В инвентаре нет аптечек.';
        setHud((h) => ({ ...h, hint: hintRef.current }));
        return;
      }
      if (hpRef.current >= balance.hp) {
        hintRef.current = 'HP уже полный. Аптечку лучше сохранить.';
        setHud((h) => ({ ...h, hint: hintRef.current }));
        return;
      }
      medkit.count -= 1;
      if (medkit.count <= 0) inventoryRef.current = inventoryRef.current.filter((item) => item.kind !== 'medkit');
      hpRef.current = Math.min(balance.hp, hpRef.current + 32);
      hintRef.current = 'Аптечка использована: +32 HP.';
      setHud((h) => ({ ...h, hp: Math.ceil(hpRef.current), inventory: [...inventoryRef.current], hint: hintRef.current }));
    };

    virtualAttackRef.current = attack;
    virtualUseItemRef.current = useSelectedItem;
    virtualTeleportRef.current = teleportToHloddev;

    void useMedkit;

    const normalizeGameKey = (e: KeyboardEvent) => {
      if (e.code === 'KeyW') return 'w';
      if (e.code === 'KeyA') return 'a';
      if (e.code === 'KeyS') return 's';
      if (e.code === 'KeyD') return 'd';
      if (e.code === 'KeyE') return 'e';
      if (e.code === 'KeyC') return 'c';
      if (e.code === 'ControlLeft' || e.code === 'ControlRight') return 'control';
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') return 'shift';
      if (e.code === 'Space') return ' ';
      if (e.code === 'ArrowUp') return 'arrowup';
      if (e.code === 'ArrowDown') return 'arrowdown';
      if (e.code === 'ArrowLeft') return 'arrowleft';
      if (e.code === 'ArrowRight') return 'arrowright';
      return e.key.toLowerCase();
    };

    const keyDown = (e: KeyboardEvent) => {
      const key = normalizeGameKey(e);
      if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(key)) e.preventDefault();
      if (key === 'escape') {
        setPhase('intro');
        onExit?.();
        return;
      }
      if (key === 'shift') {
        renderer.domElement.requestPointerLock?.();
        renderer.domElement.style.cursor = 'none';
      }
      if (key === ' ') {
        e.preventDefault();
        teleportToHloddev();
        return;
      }
      if (/^[1-9]$/.test(key)) {
        selectInventorySlot(Number(key) - 1);
        return;
      }
      if (key === 'e') {
        useSelectedItem();
        return;
      }
      keysRef.current.add(key);
    };
    const keyUp = (e: KeyboardEvent) => {
      const key = normalizeGameKey(e);
      keysRef.current.delete(key);
      if (key === 'shift') {
        if (document.pointerLockElement === renderer.domElement) document.exitPointerLock?.();
        renderer.domElement.style.cursor = '';
      }
    };
    const pointerMove = (e: PointerEvent) => {
      if (document.pointerLockElement === renderer.domElement || keysRef.current.has('shift')) {
        cameraYaw -= e.movementX * 0.0027;
        playerYaw = cameraYaw;
        cameraPitch = clamp(cameraPitch - e.movementY * 0.0022, -0.52, 0.42);
        aimRef.current.set(Math.sin(playerYaw), Math.cos(playerYaw)).normalize();
        return;
      }
      const nx = (e.clientX / window.innerWidth) * 2 - 1;
      const ny = (e.clientY / window.innerHeight) * 2 - 1;
      aimRef.current.set(nx, ny - 0.35).normalize();
    };
    const pointerLockChange = () => {
      renderer.domElement.style.cursor = document.pointerLockElement === renderer.domElement ? 'none' : '';
    };
    const pointerDown = (event: PointerEvent) => {
      if (event.target instanceof Element && event.target.closest('button')) return;
      renderer.domElement.focus();
      attack();
    };

    window.addEventListener('resize', resize);
    window.addEventListener('keydown', keyDown);
    window.addEventListener('keyup', keyUp);
    window.addEventListener('pointermove', pointerMove);
    document.addEventListener('pointerlockchange', pointerLockChange);
    window.addEventListener('pointerdown', pointerDown);

    const loop = () => {
      if (stopped) return;
      const dt = Math.min(clock.getDelta(), 0.045);
      for (const mixer of assetMixers) mixer.update(dt);
      const activeEvent = eventKindRef.current;
      const inHloddev = dimensionRef.current === 'hloddev';
      const insideHouse = insideHouseRef.current !== null;
      dayTimeRef.current = (dayTimeRef.current + dt / DAY_LENGTH) % 1;
      const dayPhase = dayPhaseAt(dayTimeRef.current);
      const nightFactor = dayPhase === 'night' ? 1.28 : dayPhase === 'dusk' ? 1.12 : 1;
      if (dayPhase !== previousDayPhase) {
        previousDayPhase = dayPhase;
        hintRef.current = `Time changed: ${dayPhaseLabel(dayPhase)}. ${dayPhase === 'night' ? 'Enemies are faster and the steppe is darker.' : dayPhase === 'dawn' ? 'Dawn weakens the infected for a while.' : 'Visibility returns.'}`;
      }
      attackCdRef.current = Math.max(0, attackCdRef.current - dt);
      spawnTimerRef.current -= dt;
      nextEventRef.current -= dt;
      teleportCooldownRef.current = Math.max(0, teleportCooldownRef.current - dt);
      visionTimer -= dt;
      activeVisionLeft = Math.max(0, activeVisionLeft - dt);
      if (activeVision && activeVisionLeft <= 0) {
        activeVision = '';
        setVision('');
      }
      if (!activeVision && visionTimer <= 0) {
        const roll = Math.random();
        activeVision = roll < 0.34 ? 'bloodmoon' : roll < 0.67 ? 'echo' : 'whiteout';
        activeVisionLeft = 5.5;
        visionTimer = randomRange(24, 38);
        setVision(activeVision);
        hintRef.current = activeVision === 'bloodmoon'
          ? 'Vision: the fortress remembers every violent choice.'
          : activeVision === 'echo'
            ? 'Vision: house voices open another branch of the story.'
            : 'Vision: the steppe disappears for a breath. Keep walking.';
      }

      if (inHloddev) {
        dimensionTimerRef.current -= dt;
        hpRef.current -= dt * 0.55 * balance.enemyDamage;
        if (dimensionTimerRef.current <= 0) {
          dimensionRef.current = 'steppe';
          dimensionTimerRef.current = 0;
          hintRef.current = 'Хлоддев отпустил тебя обратно в степь.';
        }
      }

      if (eventTimerRef.current > 0) {
        eventTimerRef.current -= dt;
        if (eventTimerRef.current <= 0) {
          eventKindRef.current = null;
          hintRef.current = 'Ивент закончился. До следующей беды меньше минуты.';
        }
      } else if (!insideHouse && nextEventRef.current <= 0) {
        startEvent();
      }

      if (insideHouseRef.current === null && exitHouseBurstRef.current > 0) {
        const count = exitHouseBurstRef.current;
        exitHouseBurstRef.current = 0;
        for (let i = 0; i < count; i++) addEnemy(true);
        hintRef.current = 'Ты вышел из дома. Шум привлек зараженных.';
      }

      const stormPenalty = activeEvent === 'storm' ? 0.64 : 1;
      const dimensionSpeed = inHloddev ? 1.32 : 1;
      const keys = keysRef.current;
      const strafe = (keys.has('d') ? 1 : 0) - (keys.has('a') ? 1 : 0);
      const forwardInput = (keys.has('w') || keys.has('arrowup') ? 1 : 0) - (keys.has('s') || keys.has('arrowdown') ? 1 : 0);
      const hasMoveInput = strafe !== 0 || forwardInput !== 0;
      const sneak = keys.has('control') || keys.has('c');
      const wantsSprint = keys.has('shift') && !sneak && staminaRef.current > 8;
      const sprint = wantsSprint && hasMoveInput;
      const cameraForward = new THREE.Vector3(Math.sin(cameraYaw), 0, Math.cos(cameraYaw));
      const cameraRight = new THREE.Vector3(Math.cos(cameraYaw), 0, -Math.sin(cameraYaw));
      const move = new THREE.Vector3()
        .addScaledVector(cameraForward, forwardInput)
        .addScaledVector(cameraRight, strafe);
      const movementScale = sneak ? 0.58 : sprint ? 1.52 : staminaRef.current < 6 ? 0.82 : 1;
      walkModeRef.current = sneak ? 'sneak' : sprint ? 'sprint' : staminaRef.current < 12 ? 'tired' : 'walk';
      if (move.lengthSq() > 0) {
        move.normalize();
        const sprintBoost = sprint ? 1.62 : sneak ? 0.72 : 1;
        playerVelocityRef.current.addScaledVector(move, PLAYER_ACCEL * sprintBoost * stormPenalty * dimensionSpeed * dt);
      }
      if (sprint) {
        staminaRef.current = Math.max(0, staminaRef.current - dt * 24);
      } else {
        staminaRef.current = Math.min(STAMINA_MAX, staminaRef.current + dt * (sneak ? 18 : 12));
      }
      const maxSpeed = PLAYER_SPEED * movementScale * stormPenalty * dimensionSpeed;
      const horizontalSpeed = Math.hypot(playerVelocityRef.current.x, playerVelocityRef.current.z);
      if (horizontalSpeed > maxSpeed) {
        playerVelocityRef.current.x = (playerVelocityRef.current.x / horizontalSpeed) * maxSpeed;
        playerVelocityRef.current.z = (playerVelocityRef.current.z / horizontalSpeed) * maxSpeed;
      }
      const drag = Math.max(0, 1 - PLAYER_FRICTION * dt);
      playerVelocityRef.current.x *= drag;
      playerVelocityRef.current.z *= drag;
      playerRef.current.addScaledVector(playerVelocityRef.current, dt);
      const waterDrag = resolvePlayerPhysics(playerRef.current, playerVelocityRef.current, physicsObstacles);
      playerVelocityRef.current.x *= waterDrag;
      playerVelocityRef.current.z *= waterDrag;
      const currentSpeed = Math.hypot(playerVelocityRef.current.x, playerVelocityRef.current.z);
      playerRef.current.y = terrainHeightAt(playerRef.current.x, playerRef.current.z);
      const playerMoving = currentSpeed > 0.9 || move.lengthSq() > 0;
      const speedRatio = clamp(currentSpeed / PLAYER_SPEED, 0, 1.45);
      playerWalkTime += playerMoving ? dt * (inHloddev ? 9.8 : 7.4) * (0.82 + speedRatio * 0.52) : dt * 2.6;
      if (currentSpeed > 0.7) {
        playerYaw = lerpAngle(playerYaw, Math.atan2(playerVelocityRef.current.x, playerVelocityRef.current.z), PLAYER_TURN_SPEED * dt);
      }
      footstepTimer -= dt;
      if (playerMoving && !sneak && footstepTimer <= 0 && insideHouseRef.current === null) {
        spawnFootDust(footSide, speedRatio);
        footSide *= -1;
        footstepTimer = sprint ? 0.18 : 0.24;
      }
      playerRef.current.x = clamp(playerRef.current.x, -FAR_WORLD_LIMIT, FAR_WORLD_LIMIT);
      playerRef.current.z = clamp(playerRef.current.z, -FAR_WORLD_LIMIT, FAR_WORLD_LIMIT);
      updateWorldChunks();

      if (!insideHouse) {
        for (const npc of houseNpcsRef.current) {
          if (npc.visited) continue;
          const dist = Math.hypot(playerRef.current.x - npc.x, playerRef.current.z - npc.z);
          if (dist < 8.5) {
            enterHouse(npc);
            break;
          }
        }
        if (!insideHouseRef.current && traderCoordsBoughtRef.current && !companionRecruitedRef.current) {
          const dist = Math.hypot(playerRef.current.x - COMPANION_HOUSE.x, playerRef.current.z - COMPANION_HOUSE.z);
          if (dist < 8.5) enterHouse(COMPANION_HOUSE);
        }
      }
      const companionHouseNpcFigure = npcFigures.find((entry) => entry.npc.id === COMPANION_HOUSE.id)?.mesh ?? companionHouseFigure;
      companionHouseNpcFigure.visible = !companionRecruitedRef.current;

      player.position.copy(playerRef.current);
      player.rotation.y = playerYaw;
      if (animationGuide) {
        const guideSide = new THREE.Vector3(Math.cos(playerYaw), 0, -Math.sin(playerYaw));
        const guideBack = new THREE.Vector3(-Math.sin(playerYaw), 0, -Math.cos(playerYaw));
        animationGuide.position.copy(playerRef.current);
        animationGuide.position.addScaledVector(guideSide, -2.25);
        animationGuide.position.addScaledVector(guideBack, 1.35);
        animationGuide.position.y = terrainHeightAt(animationGuide.position.x, animationGuide.position.z);
        animationGuide.rotation.y = playerYaw + 0.08;
        animationGuide.visible = false;
      }
      playCharacterAnimation(playerAnimator, playerMoving ? 'walk' : 'idle');
      const playerAction = playerAnimator?.active ? playerAnimator.actions[playerAnimator.active] : null;
      if (playerAction) playerAction.timeScale = playerMoving ? (sprint ? 1.5 : sneak ? 0.62 : 0.92 + speedRatio * 0.28) : 0.82;
      aimRef.current.set(Math.sin(playerYaw), Math.cos(playerYaw)).normalize();
      const localSideSpeed = playerVelocityRef.current.x * Math.cos(playerYaw) - playerVelocityRef.current.z * Math.sin(playerYaw);
      const localForwardSpeed = playerVelocityRef.current.x * Math.sin(playerYaw) + playerVelocityRef.current.z * Math.cos(playerYaw);
      player.rotation.x = clamp(-localForwardSpeed * 0.006, -0.08, 0.08);
      player.rotation.z = clamp(-localSideSpeed * 0.015, -0.14, 0.14);
      const stride = playerMoving ? Math.sin(playerWalkTime) : 0;
      const settle = playerMoving ? 1 : 0.18;
      player.position.y = playerRef.current.y + Math.abs(stride) * 0.07 * clamp(currentSpeed / PLAYER_SPEED, 0.35, 1.1);
      playerShadow.position.set(playerRef.current.x, playerRef.current.y + 0.012, playerRef.current.z);
      playerShadow.scale.setScalar(1 + Math.min(0.28, currentSpeed * 0.012));
      const shadowMat = playerShadow.material;
      if (shadowMat instanceof THREE.MeshBasicMaterial) shadowMat.opacity = inHloddev ? 0.18 : 0.28;
      for (const limb of playerWalkParts) {
        const swing = Math.sin(playerWalkTime + (limb.side > 0 ? 0 : Math.PI));
        limb.part.rotation.x = limb.baseX + swing * (limb.role === 'arm' ? 0.55 : 0.42) * settle;
        limb.part.rotation.z = limb.baseZ + swing * (limb.role === 'arm' ? 0.08 : 0.05) * settle;
      }
      hloodAura.visible = inHloddev;
      hloodAura.rotation.y += dt * 1.8;
      hloodAura.scale.setScalar(1 + Math.sin(performance.now() * 0.008) * 0.04);
      refreshHeldWeaponModel();
      const heldScale = heldItemScale(heldItemRef.current);
      const heldWeapon = isWeapon(heldItemRef.current) ? WEAPONS[heldItemRef.current] : null;
      heldWeaponModel.scale.set(heldScale.x * 0.86, heldScale.y * 0.86, heldScale.z * 0.86);
      heldWeaponModel.visible = true;
      const attackSwing = heldWeapon && attackCdRef.current > heldWeapon.cooldown * 0.55;
      heldWeaponModel.position.set(0.82, 1.03, -0.62);
      heldWeaponModel.rotation.set(attackSwing ? -1.08 : -0.24, attackSwing ? 0.34 : 0.12, attackSwing ? -0.42 : -0.12);

      ensureCompanionModel();
      companionAttackCdRef.current = Math.max(0, companionAttackCdRef.current - dt);
      if (companionMesh && companionAliveRef.current) {
        const followOffset = new THREE.Vector3(-Math.cos(playerYaw) * 2.2 + Math.sin(playerYaw) * 1.6, 0, Math.sin(playerYaw) * 2.2 + Math.cos(playerYaw) * 1.6);
        const target = playerRef.current.clone().add(followOffset);
        const toTarget = new THREE.Vector3().subVectors(target, companionMesh.position);
        toTarget.y = 0;
        const companionMoving = toTarget.length() > 1.4;
        if (companionMoving) {
          toTarget.normalize();
          companionMesh.position.addScaledVector(toTarget, PLAYER_SPEED * 0.82 * dt);
          companionMesh.rotation.y = Math.atan2(toTarget.x, toTarget.z);
        }
        companionMesh.position.y = terrainHeightAt(companionMesh.position.x, companionMesh.position.z);
        playCharacterAnimation(companionAnimator, companionMoving ? 'walk' : 'idle');
        const companionWalkParts = companionMesh.userData.outfitRoot instanceof THREE.Object3D
          ? companionMesh.userData.outfitRoot.userData.walkParts as { part: THREE.Object3D; side: number; baseX: number; baseZ: number; role: 'arm' | 'leg' }[] | undefined
          : undefined;
        if (companionWalkParts) {
          companionMesh.userData.phase = (companionMesh.userData.phase ?? 0) + dt * (companionMoving ? 7.2 : 2.2);
          const companionStep = Math.sin(companionMesh.userData.phase);
          for (const limb of companionWalkParts) {
            limb.part.rotation.x = limb.baseX + companionStep * (limb.role === 'arm' ? 0.46 : 0.34) * (companionMoving ? 1 : 0.16);
            limb.part.rotation.z = limb.baseZ + companionStep * (limb.role === 'arm' ? 0.08 : 0.04) * (companionMoving ? 1 : 0.16);
          }
        }

        let nearest: Enemy | null = null;
        let nearestDist = Infinity;
        for (const enemy of enemiesRef.current) {
          const dist = enemy.mesh.position.distanceTo(companionMesh.position);
          if (dist < nearestDist) {
            nearest = enemy;
            nearestDist = dist;
          }
        }
        if (nearest && nearestDist < 7.2 && companionAttackCdRef.current <= 0) {
          nearest.hp -= 18 * (dimensionRef.current === 'hloddev' ? 1.2 : 1);
          nearest.hitTimer = 0.16;
          companionAttackCdRef.current = 0.62;
          playCharacterAnimation(companionAnimator, 'attack', 0.05);
        }
      }

      for (let i = dustPuffs.length - 1; i >= 0; i--) {
        const puff = dustPuffs[i];
        puff.age += dt;
        const k = clamp(puff.age / puff.life, 0, 1);
        puff.mesh.scale.setScalar(1 + k * 2.2);
        puff.mesh.material.opacity = (1 - k) * (inHloddev ? 0.16 : 0.24);
        puff.mesh.position.y = terrainHeightAt(puff.mesh.position.x, puff.mesh.position.z) + 0.04;
        if (k >= 1) {
          scene.remove(puff.mesh);
          puff.mesh.geometry.dispose();
          puff.mesh.material.dispose();
          dustPuffs.splice(i, 1);
        }
      }

      for (const pickup of pickupsRef.current) {
        pickup.mesh.rotation.y += dt * 1.8;
        pickup.mesh.position.y = (pickup.kind === 'code' ? 0.12 : pickup.kind === 'medkit' ? 0.55 : 0.8) + Math.sin(performance.now() * 0.003 + pickup.mesh.position.x) * 0.14;
      }

      pickupsRef.current = pickupsRef.current.filter((pickup) => {
        const dist = pickup.mesh.position.distanceTo(playerRef.current);
        if (dist > 2.25) return true;
        scene.remove(pickup.mesh);
        if (pickup.kind === 'revive') {
          reviveRef.current.collected = true;
          companionAliveRef.current = true;
          companionHpRef.current = 100;
          ensureCompanionModel();
          scoreRef.current += 25;
          hintRef.current = 'Сыворотка сработала: Саят снова в строю.';
          setTaunt('Саят: Я слышал темноту. Спасибо, что нашел меня.');
          setTimeout(() => setTaunt(''), 4200);
          setHud((h) => ({
            ...h,
            score: scoreRef.current,
            companionAlive: true,
            reviveVisible: false,
            reviveNav: questNav(playerRef.current, reviveRef.current),
            hint: hintRef.current,
          }));
          return false;
        }
        inventoryRef.current = addInventoryItem(inventoryRef.current, pickup.kind);
        const pickedSlot = inventoryRef.current.findIndex((item) => item.kind === pickup.kind);

        if (pickup.kind === 'medkit') {
          hintRef.current = 'Аптечка добавлена в инвентарь. Нажми H, чтобы лечиться.';
        } else if (pickup.kind === 'crystal') {
          scoreRef.current += 10;
          hintRef.current = 'Кристалл добавлен в инвентарь: +10 очков.';
        } else if (pickup.kind === 'key') {
          keyRef.current.collected = true;
          scoreRef.current += 40;
          hintRef.current = 'Ключ от крепости найден. Теперь нужен код.';
        } else if (pickup.kind === 'code') {
          codeRef.current.collected = true;
          scoreRef.current += 40;
          hintRef.current = 'Код от ворот найден. Теперь нужен ключ.';
        } else {
          weaponRef.current = pickup.kind;
          heldItemRef.current = pickup.kind;
          if (pickedSlot >= 0) selectedSlotRef.current = pickedSlot;
          scoreRef.current += 15;
          hintRef.current = `Оружие найдено: ${WEAPONS[pickup.kind].name}`;
        }
        setHud((h) => ({
          ...h,
          weapon: WEAPONS[weaponRef.current].name,
          heldItem: ITEM_LABELS[heldItemRef.current],
          selectedSlot: selectedSlotRef.current,
          inventory: [...inventoryRef.current],
          hint: hintRef.current,
        }));
        return false;
      });

      for (const fake of fakeFortressesRef.current) {
        if (fake.triggered) continue;
        const dist = Math.hypot(playerRef.current.x - fake.x, playerRef.current.z - fake.z);
        if (dist < 10.5) {
          fake.triggered = true;
          scoreRef.current = Math.max(0, scoreRef.current - 15);
          hpRef.current = Math.max(8, hpRef.current - 8);
          hintRef.current = 'Ложная крепость: -15 очков и -8 HP за доверчивость.';
          setTaunt(fake.message);
          setTimeout(() => setTaunt(''), 4300);
        }
      }

      if (insideHouseRef.current === null) for (const enemy of enemiesRef.current) {
        enemy.hitTimer = Math.max(0, enemy.hitTimer - dt);
        const dir = new THREE.Vector3().subVectors(playerRef.current, enemy.mesh.position);
        dir.y = 0;
        const dist = dir.length();
        let enemyMoving = false;
        if (dist > 0.1) {
          dir.normalize();
          const eventSpeed = activeEvent === 'rage' ? 1.45 : 1;
          const dimensionDrag = inHloddev ? 0.72 : 1;
          const stealthDrag = sneak && dist > 8 ? 0.62 : 1;
          enemy.mesh.position.addScaledVector(dir, enemy.speed * eventSpeed * dimensionDrag * nightFactor * stealthDrag * dt);
          enemy.mesh.rotation.y = Math.atan2(dir.x, dir.z);
          enemyMoving = true;
        }
        playCharacterAnimation(enemy.animator, enemyMoving ? 'walk' : 'idle');
        const enemyAction = enemy.animator?.active ? enemy.animator.actions[enemy.animator.active] : null;
        if (enemyAction) enemyAction.timeScale = enemyMoving ? (activeEvent === 'rage' ? 1.35 : 0.92) : 0.72;
        const walkParts = enemy.mesh.userData.walkParts as { part: THREE.Object3D; side: number; baseX: number; baseZ: number }[] | undefined;
        enemy.mesh.userData.phase = (enemy.mesh.userData.phase ?? 0) + dt * (enemyMoving ? 7.2 : 2.2);
        const zombieStep = Math.sin(enemy.mesh.userData.phase);
        enemy.mesh.rotation.z = (enemy.mesh.userData.baseRotZ ?? 0) + Math.sin(enemy.mesh.userData.phase * 0.5) * 0.08;
        enemy.mesh.position.y = Math.abs(zombieStep) * 0.035;
        if (walkParts) {
          for (const limb of walkParts) {
            const swing = Math.sin(enemy.mesh.userData.phase + (limb.side > 0 ? 0 : Math.PI));
            limb.part.rotation.x = limb.baseX + swing * 0.28;
            limb.part.rotation.z = limb.baseZ + swing * 0.12;
          }
        }
        const mat = enemy.mesh.children[0] instanceof THREE.Mesh ? enemy.mesh.children[0].material : null;
        if (mat instanceof THREE.MeshStandardMaterial) mat.color.set(enemy.hitTimer > 0 ? 0xfff1dc : inHloddev ? 0x2c6c82 : activeEvent === 'rage' ? 0xa72f26 : 0x793f34);
        if (dist < PLAYER_RADIUS + ENEMY_RADIUS) hpRef.current -= enemy.damage * (activeEvent === 'rage' ? 1.55 : 1) * (inHloddev ? 0.62 : 1) * dt;
        if (companionMesh && companionAliveRef.current) {
          const companionDist = enemy.mesh.position.distanceTo(companionMesh.position);
          if (companionDist < PLAYER_RADIUS + ENEMY_RADIUS + 0.4) {
            companionHpRef.current -= enemy.damage * 0.82 * dt;
            if (companionHpRef.current <= 0) {
              companionAliveRef.current = false;
              companionHpRef.current = 0;
              reviveRef.current = randomQuestPoint();
              reviveRef.current.collected = false;
              addPickup('revive', reviveRef.current.x, reviveRef.current.z);
              removeCompanionModel();
              hintRef.current = 'Саят упал. На карте появилась стрелка к сыворотке, которая оживит тиммейта.';
              setTaunt(hintRef.current);
              setTimeout(() => setTaunt(''), 4800);
            }
          }
        }
      }

      enemiesRef.current = enemiesRef.current.filter((enemy) => {
        if (enemy.hp > 0) return true;
        removeMixer(enemy.animator?.mixer);
        scene.remove(enemy.mesh);
        scoreRef.current += 25;
        if (Math.random() < 0.48) addPickup('medkit', enemy.mesh.position.x, enemy.mesh.position.z);
        return false;
      });

      const maxEnemies = Math.round(((activeEvent === 'ambush' || activeEvent === 'rage' ? 24 : 18) / balance.spawn) * (dayPhase === 'night' ? 1.25 : 1));
      const spawnDelay = (activeEvent === 'ambush' ? 0.85 : activeEvent === 'rage' ? 1.1 : 1.45) * balance.spawn * (dayPhase === 'night' ? 0.78 : 1);
      if (insideHouseRef.current === null && spawnTimerRef.current <= 0 && enemiesRef.current.length < maxEnemies) {
        spawnTimerRef.current = spawnDelay;
        addEnemy(true);
      }

      if (activeEvent === 'starvation') hpRef.current -= dt * 0.85 * balance.enemyDamage;
      music?.update(clamp(enemiesRef.current.length / maxEnemies, 0, 1), hpRef.current, !!activeEvent, inHloddev);
      const shaderTime = performance.now() * 0.001;
      const dayAngle = dayTimeRef.current * Math.PI * 2 - Math.PI * 0.5;
      const sunLift = Math.max(0, Math.sin(dayAngle));
      const moonLift = Math.max(0, -Math.sin(dayAngle));
      const daylight = clamp(0.12 + sunLift * 0.88, 0.12, 1);
      renderer.toneMappingExposure = inHloddev ? 0.98 : 0.82 + daylight * 0.56;
      hemi.intensity = inHloddev ? 0.72 : 0.22 + daylight * 0.72;
      sun.intensity = inHloddev ? 2.7 : 0.45 + daylight * 4.3;
      rimLight.intensity = inHloddev ? 1.05 : 0.42 + moonLift * 1.15;
      fireGlow.intensity = (dayPhase === 'night' || dayPhase === 'dusk' ? 2.1 : 0.85) * (activeEvent === 'storm' ? 1.35 : 1);
      fireGlow.position.set(playerRef.current.x + Math.sin(shaderTime * 0.8) * 18, playerRef.current.y + 4.8, playerRef.current.z - 18 + Math.cos(shaderTime * 0.6) * 12);
      const fogColor = activeVision === 'bloodmoon'
        ? 0x6f2428
        : activeVision === 'echo'
          ? 0x9fd7bd
          : activeVision === 'whiteout'
            ? 0xe8edf0
            : inHloddev ? 0x86dff2 : dayPhase === 'night' ? 0x182238 : dayPhase === 'dusk' ? 0xa07864 : dayPhase === 'dawn' ? 0xc39a73 : 0xa8c9d4;
      scene.background = new THREE.Color(fogColor);
      scene.fog = new THREE.Fog(
        fogColor,
        activeVision === 'whiteout' ? 8 : inHloddev ? 12 : activeEvent === 'storm' ? 20 : 42,
        activeVision === 'bloodmoon' ? 150 : activeVision === 'echo' ? 118 : activeVision === 'whiteout' ? 70 : inHloddev ? 92 : activeEvent === 'storm' ? 82 : 245,
      );
      for (const material of shaderMaterials) {
        if (material.uniforms.uTime) material.uniforms.uTime.value = shaderTime;
        if (material.uniforms.uFogColor) material.uniforms.uFogColor.value.setHex(fogColor);
        if (material.uniforms.uMix) material.uniforms.uMix.value = activeVision ? 0.48 : inHloddev ? 0.62 : activeEvent === 'storm' ? 0.28 : 0.04;
        if (material.uniforms.uFogNear) material.uniforms.uFogNear.value = activeVision === 'whiteout' ? 18 : inHloddev ? 40 : activeEvent === 'storm' ? 35 : 120;
        if (material.uniforms.uFogFar) material.uniforms.uFogFar.value = activeVision ? 120 : inHloddev ? 130 : activeEvent === 'storm' ? 125 : 380;
      }

      const cameraTarget = playerRef.current.clone();
      atmosphereParticles.position.copy(cameraTarget);
      atmosphereParticles.rotation.y += dt * (activeEvent === 'storm' ? 0.18 : 0.035);
      atmosphereParticles.rotation.x = Math.sin(shaderTime * 0.12) * 0.04;
      const atmosphereMat = atmosphereParticles.material;
      if (atmosphereMat instanceof THREE.PointsMaterial) {
        atmosphereMat.opacity = activeVision === 'whiteout' ? 0.62 : activeEvent === 'storm' ? 0.5 : dayPhase === 'night' ? 0.18 : 0.3;
        atmosphereMat.size = activeEvent === 'storm' ? 0.24 : 0.16;
      }
      skyDome.position.copy(cameraTarget);
      const sunArcY = Math.sin(dayAngle) * 78;
      const sunArcX = Math.cos(dayAngle) * 74;
      sun.position.set(cameraTarget.x + sunArcX, cameraTarget.y + sunArcY + 14, cameraTarget.z + 28);
      sun.target.position.set(cameraTarget.x, cameraTarget.y, cameraTarget.z - 12);
      sun.target.updateMatrixWorld();
      if (document.pointerLockElement !== renderer.domElement && !keysRef.current.has('shift')) {
        cameraYaw = lerpAngle(cameraYaw, playerYaw, dt * (currentSpeed > 1 ? 3.1 : 1.8));
      }
      const followForward = new THREE.Vector3(Math.sin(cameraYaw), 0, Math.cos(cameraYaw));
      const followRight = new THREE.Vector3(Math.cos(cameraYaw), 0, -Math.sin(cameraYaw));
      const speedSway = Math.min(1, currentSpeed / PLAYER_SPEED);
      const camBob = Math.sin(playerWalkTime * 0.65) * 0.18 * speedSway;
      const shoulder = inHloddev ? 1.65 : 1.35;
      const cameraDistance = inHloddev ? 10.5 : activeEvent === 'storm' ? 11.5 : 12.5;
      const cameraHeight = inHloddev ? 6.9 : activeEvent === 'storm' ? 6.4 : 7.1;
      const desiredCamera = cameraTarget
        .clone()
        .addScaledVector(followForward, -cameraDistance - speedSway * 1.35)
        .addScaledVector(followRight, shoulder)
        .add(new THREE.Vector3(0, cameraHeight + camBob, 0));
      camera.position.lerp(
        desiredCamera,
        clamp(dt * 5.2, 0.04, 0.16),
      );
      const lookAhead = cameraTarget.clone().addScaledVector(followForward, 9.5 + speedSway * 3.1);
      camera.lookAt(lookAhead.x, lookAhead.y + 1.9 + cameraPitch * 4.6, lookAhead.z);

      const distance = Math.max(0, Math.round(((playerRef.current.z - FINISH_Z) / (START_Z - FINISH_Z)) * 100));
      setHud({
        hp: Math.max(0, Math.ceil(hpRef.current)),
        score: scoreRef.current,
        distance,
        nextEvent: Math.max(0, Math.ceil(nextEventRef.current)),
        event: eventKindRef.current ? EVENT_LABELS[eventKindRef.current] : '',
        eventLeft: Math.max(0, Math.ceil(eventTimerRef.current)),
        timeOfDay: dayPhaseLabel(dayPhase),
        stamina: Math.round(staminaRef.current),
        walkMode: walkModeLabel(walkModeRef.current),
        difficulty: balance.label,
        story: storyScore(storyFlagsRef.current),
        weapon: WEAPONS[weaponRef.current].name,
        dimension: inHloddev ? 'Хлоддев' : 'Степь',
        heldItem: ITEM_LABELS[heldItemRef.current],
        selectedSlot: selectedSlotRef.current,
        teleport: Math.max(0, Math.ceil(teleportCooldownRef.current)),
        dimensionLeft: Math.max(0, Math.ceil(dimensionTimerRef.current)),
        hasKey: keyRef.current.collected,
        hasCode: codeRef.current.collected,
        traderNav: questNav(playerRef.current, navPoint(HOUSE_NPCS.find((npc) => npc.id === TRADER_NPC_ID)?.x ?? 0, HOUSE_NPCS.find((npc) => npc.id === TRADER_NPC_ID)?.z ?? 0)),
        companionNav: questNav(playerRef.current, navPoint(COMPANION_HOUSE.x, COMPANION_HOUSE.z)),
        reviveNav: questNav(playerRef.current, reviveRef.current),
        coordsBought: traderCoordsBoughtRef.current,
        companionRecruited: companionRecruitedRef.current,
        companionAlive: companionAliveRef.current,
        reviveVisible: companionRecruitedRef.current && !companionAliveRef.current && !reviveRef.current.collected,
        keyNav: questNav(playerRef.current, keyRef.current),
        codeNav: questNav(playerRef.current, codeRef.current),
        inventory: [...inventoryRef.current],
        hint: hintRef.current,
      });

      if (hpRef.current <= 0 && !deathTriggeredRef.current) {
        deathTriggeredRef.current = true;
        playJumpscareSfx();
        setJumpscare(true);
        setTimeout(() => {
          setJumpscare(false);
          const lostEnding = `Ending: Taken by the Steppe. Difficulty: ${DIFFICULTY[difficultyRef.current].label}. Story thread: ${storyScore(storyFlagsRef.current)}. Score: ${scoreRef.current}.`;
          endingRef.current = lostEnding;
          setEnding(lostEnding);
          setPhase('lost');
        }, 1550);
      }
      if (playerRef.current.z <= FINISH_Z + 8) {
        const dialoguesLeft = houseNpcsRef.current.filter((npc) => !npc.visited).length;
        if (keyRef.current.collected && codeRef.current.collected && dialoguesLeft === 0) {
          endingRef.current = endingFor(storyFlagsRef.current, difficultyRef.current, scoreRef.current);
          setEnding(endingRef.current);
          setPhase('won');
          void askCompanionFinalLine(endingRef.current);
        } else {
          playerRef.current.z = FINISH_Z + 13;
          hintRef.current = 'Ворота закрыты. Нужны и ключ, и код.';
          setTaunt('Настоящая крепость перед тобой, но без ключа и кода ты просто стучишься в стену.');
          if (dialoguesLeft > 0) hintRef.current = `Р’РѕСЂРѕС‚Р° Р¶РґСѓС‚ РІСЃРµ РёСЃС‚РѕСЂРёРё. Р—Р°РІРµСЂС€Рё РґРёР°Р»РѕРіРё: ${dialoguesLeft}.`;
          setTimeout(() => setTaunt(''), 4200);
        }
      }

      renderer.render(scene, camera);
      raf = requestAnimationFrame(loop);
    };

    raf = requestAnimationFrame(loop);

    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      window.removeEventListener('keydown', keyDown);
      window.removeEventListener('keyup', keyUp);
      window.removeEventListener('pointermove', pointerMove);
      document.removeEventListener('pointerlockchange', pointerLockChange);
      window.removeEventListener('pointerdown', pointerDown);
      if (document.pointerLockElement === renderer.domElement) document.exitPointerLock?.();
      music?.stop();
      keysRef.current.clear();
      virtualAttackRef.current = () => {};
      virtualUseItemRef.current = () => {};
      virtualTeleportRef.current = () => {};
      renderer.dispose();
      mount.innerHTML = '';
    };
  }, [phase, onExit]);

  const start = (useSavedState: boolean) => {
    reset();
    if (useSavedState && savedGameState) {
      applySavedGameState(savedGameState);
    }
    setPhase('playing');
  };

  const openTutorial = () => {
    setPhase('tutorial');
  };

  const requestLandscapeMode = async () => {
    if (!isMobile) return;
    try {
      await document.documentElement.requestFullscreen?.();
    } catch {
      // Some mobile browsers only allow orientation hints, not fullscreen.
    }
    try {
      await (window.screen.orientation as LockableScreenOrientation | undefined)?.lock?.('landscape');
    } catch {
      // Fallback is the in-game rotate-phone overlay.
    }
  };

  const releaseLandscapeMode = async () => {
    if (!isMobile) return;
    try {
      (window.screen.orientation as LockableScreenOrientation | undefined)?.unlock?.();
    } catch {
      // Ignore browsers without orientation unlock.
    }
    try {
      if (document.fullscreenElement) await document.exitFullscreen?.();
    } catch {
      // Ignore fullscreen exit failures.
    }
  };

  const canStartGame = progressLoaded && preloadDone;

  const handleMainPlay = () => {
    if (!canStartGame) return;
    if (phase === 'intro') {
      openTutorial();
      return;
    }
    if (phase === 'tutorial') {
      void requestLandscapeMode();
      start(!!savedGameState);
      return;
    }
    setSavedGameState(null);
    void requestLandscapeMode();
    start(false);
  };

  const exit = () => {
    void releaseLandscapeMode();
    setPhase('intro');
    onExit?.();
  };

  // UI-ready shop method: hook it to any button by passing a case id and currency flag.
  const BuyCase = (caseType: string, isPremium: boolean) => {
    const currency = isPremium ? 'premium' : 'gold';
    const price = isPremium ? CASE_PRICES.premium : CASE_PRICES.gold;
    setWallet((current) => {
      if (current[currency] < price) {
        const message = `Недостаточно ${isPremium ? 'алмазов' : 'золота'} для кейса ${caseType}. Нужно: ${price}.`;
        console.log(message);
        setCaseLog(message);
        return current;
      }

      const nextWallet = { ...current, [currency]: current[currency] - price };
      const reward = pickCaseReward(isPremium);
      if ('id' in reward) {
        setUnlockedSkinIds((ids) => (ids.includes(reward.id) ? ids : [...ids, reward.id]));
      }
      setCaseOpening({
        caseType,
        rewardName: reward.name,
        rarity: reward.rarity,
        isPremium,
        nonce: Date.now(),
      });
      const message = `Кейс ${caseType} открыт за ${price} ${isPremium ? 'алмазов' : 'золота'}. Выпало: ${reward.name} (${reward.rarity}).`;
      console.log(message);
      setCaseLog(message);
      return nextWallet;
    });
  };

  const awardDialogReward = (success: boolean) => {
    const reward = success ? DIALOG_REWARD.success : DIALOG_REWARD.fail;
    setWallet((current) => ({
      gold: current.gold + reward.gold,
      premium: current.premium + reward.premium,
    }));
    setCaseLog(
      success
        ? `Диалог успешен: +${reward.gold} золота и +${reward.premium} алмазов.`
        : `Диалог неудачный: +${reward.gold} золота и +${reward.premium} алмаз.`,
    );
  };

  const askGeminiHint = async () => {
    if (aiThinking || phase !== 'playing') return;
    setAiThinking(true);
    const inventory = inventoryRef.current.length > 0
      ? inventoryRef.current.map((item) => `${ITEM_LABELS[item.kind]} x${item.count}`).join(', ')
      : 'пусто';
    const prompt = [
      `HP: ${Math.ceil(hpRef.current)}`,
      `Оружие: ${WEAPONS[weaponRef.current].name}`,
      `Предмет в руке: ${ITEM_LABELS[heldItemRef.current]}`,
      `Инвентарь: ${inventory}`,
      `Есть ключ: ${keyRef.current.collected ? 'да' : 'нет'}`,
      `Есть код: ${codeRef.current.collected ? 'да' : 'нет'}`,
      `Дистанция до ключа: ${questNav(playerRef.current, keyRef.current).distance} м`,
      `Дистанция до кода: ${questNav(playerRef.current, codeRef.current).distance} м`,
      `Врагов рядом: ${enemiesRef.current.length}`,
      `Ивент: ${eventKindRef.current ? EVENT_LABELS[eventKindRef.current] : 'нет'}`,
      `Сложность: ${DIFFICULTY[difficultyRef.current].label}`,
      `Измерение: ${dimensionRef.current}`,
      `Очки сюжета: ${storyScore(storyFlagsRef.current)}`,
    ].join('\n');

    try {
      hintRef.current = 'Gemini думает над советом...';
      setHud((current) => ({ ...current, hint: hintRef.current }));
      const { data, error } = await supabase.functions.invoke('ai', {
        body: {
          system: 'Ты внутриигровой помощник survival-игры QASQYR. Дай один короткий практичный совет на русском, максимум 2 предложения. Не пересказывай правила.',
          prompt,
        },
      });
      if (error) throw error;
      const text = typeof data?.text === 'string' && data.text.trim()
        ? data.text.trim()
        : 'Gemini не дал ответ. Попробуй еще раз через пару секунд.';
      hintRef.current = `Gemini 2.5: ${text}`;
      setHud((current) => ({ ...current, hint: hintRef.current }));
    } catch {
      hintRef.current = 'Gemini сейчас не ответил. Проверь секрет GEMINI_API_KEY и деплой функции ai.';
      setHud((current) => ({ ...current, hint: hintRef.current }));
    } finally {
      setAiThinking(false);
    }
  };

  const askCompanionFinalLine = async (endingText: string) => {
    if (!companionRecruitedRef.current || !companionAliveRef.current || companionFinalSpokenRef.current) return;
    companionFinalSpokenRef.current = true;
    try {
      const { data, error } = await supabase.functions.invoke('ai', {
        body: {
          system: 'Ты Саят, второй игрок и 3D-напарник в survival-игре QASQYR. Скажи одну короткую эмоциональную фразу на русском после финала. Не больше 18 слов.',
          prompt: `Финал игрока: ${endingText}. Сложность: ${DIFFICULTY[difficultyRef.current].label}. Очки: ${scoreRef.current}.`,
        },
      });
      if (error) throw error;
      const text = typeof data?.text === 'string' && data.text.trim()
        ? data.text.trim()
        : 'Мы дошли. Значит, степь еще помнит наши имена.';
      setEnding(`${endingText}\n\nСаят: ${text}`);
    } catch {
      setEnding(`${endingText}\n\nСаят: Мы дошли. Значит, степь еще помнит наши имена.`);
    }
  };

  const handleDialogChoice = (choice: NpcChoice) => {
    if (dialog && dialog.step < 2 && choice.effect !== 'trade' && dialog.npc.id !== COMPANION_HOUSE.id) {
      storyFlagsRef.current.lore += 1;
      scoreRef.current += 3;
      awardDialogReward(true);
      hintRef.current = choice.reply;
      setDialog({ ...dialog, step: dialog.step + 1, lastReply: choice.reply });
      setHud((h) => ({
        ...h,
        score: scoreRef.current,
        hint: hintRef.current,
      }));
      return;
    }

    const activeNpcId = dialog?.npc.id;
    let reply = choice.reply;
    if (choice.effect === 'trade') {
      const medkits = inventoryRef.current.find((item) => item.kind === 'medkit');
      if (!medkits || medkits.count < TRADER_PRICE_MEDKITS) {
        awardDialogReward(false);
        reply = `Жанату нужно ${TRADER_PRICE_MEDKITS} аптечек. Собери их и вернись к лавке.`;
        hintRef.current = reply;
        setDialog(dialog ? { ...dialog, lastReply: reply } : null);
        setHud((h) => ({
          ...h,
          inventory: [...inventoryRef.current],
          hint: hintRef.current,
        }));
        return;
      }
      medkits.count -= TRADER_PRICE_MEDKITS;
      if (medkits.count <= 0) inventoryRef.current = inventoryRef.current.filter((item) => item !== medkits);
      traderCoordsBoughtRef.current = true;
      storyFlagsRef.current.risk += 1;
      scoreRef.current += 20;
    } else if (activeNpcId === COMPANION_HOUSE.id) {
      companionRecruitedRef.current = true;
      companionAliveRef.current = true;
      companionHpRef.current = 100;
      reviveRef.current.collected = true;
      storyFlagsRef.current.trust += 2;
      scoreRef.current += 30;
      reply = 'Саят выходит из дома и становится вторым игроком. Он будет держаться рядом, атаковать зараженных и давать голос Gemini 2.5.';
    } else if (choice.effect === 'heal') {
      storyFlagsRef.current.trust += 2;
      hpRef.current = Math.min(DIFFICULTY[difficultyRef.current].hp, hpRef.current + 30);
      scoreRef.current += 10;
    } else if (choice.effect === 'medkit') {
      storyFlagsRef.current.trust += 1;
      inventoryRef.current = addInventoryItem(inventoryRef.current, 'medkit');
      scoreRef.current += 8;
    } else if (choice.effect === 'weapon') {
      storyFlagsRef.current.risk += 1;
      inventoryRef.current = addInventoryItem(inventoryRef.current, 'sabre');
      weaponRef.current = 'sabre';
      heldItemRef.current = 'sabre';
      selectedSlotRef.current = Math.max(0, inventoryRef.current.findIndex((item) => item.kind === 'sabre'));
      scoreRef.current += 12;
    } else if (choice.effect === 'damage') {
      storyFlagsRef.current.risk += 2;
      storyFlagsRef.current.cruelty += 1;
      hpRef.current = Math.max(5, hpRef.current - 24);
      scoreRef.current = Math.max(0, scoreRef.current - 8);
    } else if (choice.effect === 'steal') {
      storyFlagsRef.current.risk += 2;
      storyFlagsRef.current.cruelty += 1;
      const target = inventoryRef.current.find((item) => item.kind === 'crystal' || item.kind === 'medkit');
      if (target) {
        target.count -= 1;
        if (target.count <= 0) inventoryRef.current = inventoryRef.current.filter((item) => item !== target);
      } else {
        scoreRef.current = Math.max(0, scoreRef.current - 20);
      }
    } else if (choice.effect === 'ambush') {
      storyFlagsRef.current.risk += 3;
      exitHouseBurstRef.current = 10 + Math.floor(Math.random() * 5);
      scoreRef.current = Math.max(0, scoreRef.current - 5);
    } else {
      storyFlagsRef.current.lore += 2;
      scoreRef.current += 5;
    }

    awardDialogReward(!(choice.effect === 'damage' || choice.effect === 'steal' || choice.effect === 'ambush'));

    if (activeNpcId !== undefined) {
      const npc = houseNpcsRef.current.find((item) => item.id === activeNpcId);
      if (npc) npc.visited = true;
    }
    if (activeNpcId !== COMPANION_HOUSE.id && choice.effect !== 'ambush' && choice.effect !== 'trade') exitHouseBurstRef.current = 4 + Math.floor(Math.random() * 5);
    insideHouseRef.current = null;
    hintRef.current = reply;
    setTaunt(reply);
    setTimeout(() => setTaunt(''), 4200);
    setDialog(null);
    setHud((h) => ({
      ...h,
      hp: Math.max(0, Math.ceil(hpRef.current)),
      score: scoreRef.current,
      story: storyScore(storyFlagsRef.current),
      weapon: WEAPONS[weaponRef.current].name,
      heldItem: ITEM_LABELS[heldItemRef.current],
      selectedSlot: selectedSlotRef.current,
      inventory: [...inventoryRef.current],
      coordsBought: traderCoordsBoughtRef.current,
      companionRecruited: companionRecruitedRef.current,
      companionAlive: companionAliveRef.current,
      reviveVisible: companionRecruitedRef.current && !companionAliveRef.current && !reviveRef.current.collected,
      companionNav: questNav(playerRef.current, navPoint(COMPANION_HOUSE.x, COMPANION_HOUSE.z)),
      reviveNav: questNav(playerRef.current, reviveRef.current),
      hint: hintRef.current,
    }));
  };

  const rootStyle = {
    ...styles.root,
    ...(isMobile && phase !== 'playing' ? styles.rootMobileMenu : null),
    ...(isMobile && phase === 'playing' ? styles.rootMobilePlaying : null),
  };
  const panelStyle = {
    ...styles.panel,
    ...(isMobile ? styles.panelMobile : null),
  };
  const pressVirtualKey = (key: string, pressed: boolean) => {
    if (pressed) keysRef.current.add(key);
    else keysRef.current.delete(key);
  };
  const virtualKeyProps = (key: string) => ({
    onPointerDown: (event: ReactPointerEvent<HTMLButtonElement>) => {
      event.preventDefault();
      event.stopPropagation();
      pressVirtualKey(key, true);
    },
    onPointerUp: (event: ReactPointerEvent<HTMLButtonElement>) => {
      event.preventDefault();
      event.stopPropagation();
      pressVirtualKey(key, false);
    },
    onPointerCancel: (event: ReactPointerEvent<HTMLButtonElement>) => {
      event.preventDefault();
      event.stopPropagation();
      pressVirtualKey(key, false);
    },
    onPointerLeave: (event: ReactPointerEvent<HTMLButtonElement>) => {
      event.preventDefault();
      event.stopPropagation();
      pressVirtualKey(key, false);
    },
  });
  const tapActionProps = (action: () => void) => ({
    onPointerDown: (event: ReactPointerEvent<HTMLButtonElement>) => {
      event.preventDefault();
      event.stopPropagation();
      action();
    },
  });

  return (
    <div style={rootStyle}>
      <style>
        {`
          @keyframes qasqyrCaseShake {
            0%, 100% { transform: translateY(0) rotate(0deg); }
            18% { transform: translateY(-3px) rotate(-1.4deg); }
            36% { transform: translateY(2px) rotate(1.2deg); }
            54% { transform: translateY(-2px) rotate(.8deg); }
            72% { transform: translateY(1px) rotate(-.6deg); }
          }
          @keyframes qasqyrCaseLid {
            0% { transform: translate(-50%, 0) rotateX(0deg); opacity: 1; }
            55% { transform: translate(-50%, -8px) rotateX(0deg); opacity: 1; }
            100% { transform: translate(-50%, -42px) rotateX(64deg); opacity: .72; }
          }
          @keyframes qasqyrCaseGlow {
            0% { opacity: 0; transform: scale(.7); }
            55% { opacity: .18; transform: scale(.88); }
            100% { opacity: .72; transform: scale(1.18); }
          }
          @keyframes qasqyrRewardPop {
            0%, 48% { opacity: 0; transform: translateY(20px) scale(.86); }
            72% { opacity: 1; transform: translateY(-4px) scale(1.04); }
            100% { opacity: 1; transform: translateY(0) scale(1); }
          }
        `}
      </style>
      {phase === 'playing' && <div ref={mountRef} style={styles.mount} />}
      {phase === 'playing' && <div style={styles.cinematicGrade} />}
      {phase !== 'playing' && <div style={styles.menuBackdrop} />}
      {phase === 'playing' && isMobile && isPortrait && (
        <div style={styles.orientationOverlay}>
          <div style={styles.orientationPhone}>↻</div>
          <b>Поверни телефон горизонтально</b>
          <span>QASQYR 3D лучше играть в landscape: карта шире, кнопки не закрывают обзор.</span>
        </div>
      )}
      {phase === 'won' && <ZombieCongratsPhoto score={hud.score} />}
      {phase === 'playing' && assetLoading && (
        <div style={styles.loadingOverlay}>
          <div style={styles.loadingPanel}>
            <b>У вас лагает компьютер, подождите загрузку</b>
            <span>{assetLoadingLabel}</span>
            <div style={styles.loadingTrack}>
              <span style={{ ...styles.loadingFill, width: `${assetLoadingProgress}%` }} />
            </div>
            <small>{assetLoadingProgress}%</small>
          </div>
        </div>
      )}

      <button type="button" onClick={exit} style={styles.exit}>Выйти</button>

      {phase === 'playing' && (
        <>
          {!isMobile && (
            <button
              type="button"
              style={styles.focusControl}
              onClick={() => {
                mountRef.current?.querySelector('canvas')?.requestPointerLock?.();
              }}
            >
              WASD · фокус мыши
            </button>
          )}
          <div style={{ ...styles.hud, ...(isMobile ? styles.hudMobile : null) }}>
            <div style={styles.stat}><b>Здоровье</b><span>{hud.hp}</span></div>
            <div style={styles.stat}><b>Время</b><span>{hud.timeOfDay}</span></div>
            <div style={styles.stat}><b>Ход</b><span>{hud.walkMode}</span></div>
            <div style={styles.stat}><b>Выносливость</b><span>{hud.stamina}</span></div>
            <div style={styles.stat}><b>Режим</b><span>{hud.difficulty}</span></div>
            <div style={styles.stat}><b>Сюжет</b><span>{hud.story}</span></div>
            <div style={styles.stat}><b>Очки</b><span>{hud.score}</span></div>
            <div style={styles.stat}><b>Оружие</b><span>{hud.weapon}</span></div>
            <div style={styles.stat}><b>Измерение</b><span>{hud.dimensionLeft > 0 ? `${hud.dimension} ${hud.dimensionLeft}с` : hud.dimension}</span></div>
            <div style={styles.stat}><b>Хлоддев</b><span>{hud.teleport > 0 ? `${hud.teleport}с` : 'готов'}</span></div>
            <div style={styles.stat}><b>{hud.event || 'Ивент'}</b><span>{hud.event ? `${hud.eventLeft}с` : `${hud.nextEvent}с`}</span></div>
            <button type="button" onClick={askGeminiHint} disabled={aiThinking} style={styles.aiButton}>
              {aiThinking ? 'Gemini...' : 'Gemini 2.5'}
            </button>
            <div style={styles.hint}>{hud.hint}</div>
          </div>

          <div style={{ ...styles.questPanel, ...(isMobile ? styles.questPanelMobile : null) }}>
            <QuestArrow label="Ключ" done={hud.hasKey} nav={hud.keyNav} />
            <QuestArrow label="Код" done={hud.hasCode} nav={hud.codeNav} />
            {!hud.coordsBought && <QuestArrow label="Торговец" done={false} nav={hud.traderNav} />}
            {hud.coordsBought && !hud.companionRecruited && <QuestArrow label="Дом Саята" done={false} nav={hud.companionNav} />}
            {hud.reviveVisible && <QuestArrow label="Сыворотка" done={false} nav={hud.reviveNav} />}
            {hud.companionRecruited && <div style={styles.fortressDistance}>Саят: {hud.companionAlive ? 'в строю' : 'ранен'}</div>}
            <div style={styles.fortressDistance}>Крепость: {hud.distance}% пути</div>
          </div>

          {!isMobile && <InventoryPanel items={hud.inventory} selectedSlot={hud.selectedSlot} />}
          {isMobile && (
            <div style={styles.mobileControls}>
              <div style={styles.mobileMovePad}>
                <button type="button" style={{ ...styles.mobilePadButton, gridColumn: 2 }} {...virtualKeyProps('w')}>↑</button>
                <button type="button" style={{ ...styles.mobilePadButton, gridColumn: 1, gridRow: 2 }} {...virtualKeyProps('a')}>←</button>
                <button type="button" style={{ ...styles.mobilePadButton, gridColumn: 2, gridRow: 2 }} {...virtualKeyProps('s')}>↓</button>
                <button type="button" style={{ ...styles.mobilePadButton, gridColumn: 3, gridRow: 2 }} {...virtualKeyProps('d')}>→</button>
              </div>
              <div style={styles.mobileActionPad}>
                <button type="button" style={styles.mobileActionButton} {...tapActionProps(() => virtualAttackRef.current())}>Удар</button>
                <button type="button" style={styles.mobileActionButton} {...virtualKeyProps('shift')}>Бег</button>
                <button type="button" style={styles.mobileActionButton} {...tapActionProps(() => virtualUseItemRef.current())}>Предмет</button>
                <button type="button" style={styles.mobileActionButtonAccent} {...tapActionProps(() => virtualTeleportRef.current())}>Хлоддев</button>
              </div>
            </div>
          )}

          {taunt && <div style={styles.taunt}>{taunt}</div>}
          {dialog && <DialogPanel dialog={dialog} onChoose={handleDialogChoice} />}
          {jumpscare && <ZombieScreamer />}
          {vision && <div style={{ ...styles.vision, ...(vision === 'bloodmoon' ? styles.visionBlood : vision === 'echo' ? styles.visionEcho : styles.visionWhite) }} />}
        </>
      )}

      {phase !== 'playing' && (
        <section style={panelStyle}>
          <p style={styles.eyebrow}>QASQYR 3D</p>
          <h2 style={styles.title}>
            {phase === 'won' ? 'Крепость открыта' : phase === 'lost' ? 'Степь тебя остановила' : '3D survival в степи'}
          </h2>
          <p style={styles.text}>
            {phase === 'won'
              ? `Победа. Ты нашел ключ и код. Итог: ${hud.score} очков.`
              : phase === 'lost'
                ? `Поражение. Итог: ${hud.score} очков.`
                : 'Найди ключ и код от крепости, собирай оружие и аптечки, отбивайся от плотных волн врагов. Стрелки покажут путь к квестовым предметам.'}
          </p>
          {ending && <p style={styles.endingText}>{ending}</p>}
          {phase === 'intro' && (
            <>
              <div style={styles.menuTabs}>
                {([
                  ['modes', 'Режимы'],
                  ['skins', 'Скины'],
                  ['shop', 'Магазин'],
                ] as [MenuTab, string][]).map(([tab, label]) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setActiveMenuTab(tab)}
                    style={activeMenuTab === tab ? styles.menuTabActive : styles.menuTab}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {activeMenuTab === 'modes' && (
                <div style={{ ...styles.difficultyGrid, ...(isMobile ? styles.difficultyGridMobile : null) }}>
                  {(['story', 'survival', 'nightmare'] as Difficulty[]).map((level) => (
                    <button
                      key={level}
                      type="button"
                      onClick={() => {
                        setDifficulty(level);
                        setSavedGameState(null);
                      }}
                      style={difficulty === level ? styles.difficultySelected : styles.difficultyButton}
                    >
                      <b>{DIFFICULTY[level].label}</b>
                      <span>{MODE_DESCRIPTIONS[level]}</span>
                    </button>
                  ))}
                </div>
              )}

              {activeMenuTab === 'skins' && (
                <div style={{ ...styles.skinGrid, ...(isMobile ? styles.skinGridMobile : null) }}>
                  {KNIFE_SKINS.map((skin) => (
                    (() => {
                      const unlocked = unlockedSkinIds.includes(skin.id);
                      return (
                    <button
                      key={skin.id}
                      type="button"
                      disabled={!unlocked}
                      onClick={() => setSelectedKnifeSkinId(skin.id)}
                      style={{
                        ...styles.skinCard,
                        borderColor: selectedKnifeSkinId === skin.id ? SKIN_RARITY_COLORS[skin.rarity] : 'rgba(255,255,255,.16)',
                        opacity: unlocked ? 1 : 0.54,
                      }}
                    >
                      <span style={{ ...styles.skinBlade, ...knifePreviewStyle(skin) }} />
                      <b>{skin.name}</b>
                      <span>{skin.shape}</span>
                      <small style={{ color: SKIN_RARITY_COLORS[skin.rarity] }}>{skin.rarity}</small>
                      <span>{unlocked ? (selectedKnifeSkinId === skin.id ? 'Выбран' : 'Разблокирован') : 'Заблокирован'}</span>
                    </button>
                      );
                    })()
                  ))}
                </div>
              )}

              {activeMenuTab === 'shop' && (
                <div style={styles.shopPanel}>
                  <div style={styles.walletRow}>
                    <span>Золото: <b>{wallet.gold}</b></span>
                    <span>Алмазы: <b>{wallet.premium}</b></span>
                  </div>
                  <div style={{ ...styles.shopGrid, ...(isMobile ? styles.shopGridMobile : null) }}>
                    <button type="button" onClick={() => BuyCase('Steppe Case', false)} style={styles.shopButton}>
                      <b>Steppe Case</b>
                      <span>{CASE_PRICES.gold} золота</span>
                    </button>
                    <button type="button" onClick={() => BuyCase('Relic Case', true)} style={styles.shopButtonPremium}>
                      <b>Relic Case</b>
                      <span>{CASE_PRICES.premium} алмазов</span>
                    </button>
                  </div>
                  {caseOpening && (
                    <div key={caseOpening.nonce} style={styles.caseStage}>
                      <div
                        style={{
                          ...styles.caseGlow,
                          background: `radial-gradient(circle, ${SKIN_RARITY_COLORS[caseOpening.rarity]} 0%, rgba(255,255,255,0) 68%)`,
                        }}
                      />
                      <div style={styles.caseLid} />
                      <div style={styles.caseBox}>
                        <span style={styles.caseLock}>{caseOpening.isPremium ? '◆' : '●'}</span>
                        <b>{caseOpening.caseType}</b>
                      </div>
                      <div style={{ ...styles.caseReward, borderColor: SKIN_RARITY_COLORS[caseOpening.rarity] }}>
                        <span style={styles.caseRewardBlade} />
                        <b>{caseOpening.rewardName}</b>
                        <small style={{ color: SKIN_RARITY_COLORS[caseOpening.rarity] }}>{caseOpening.rarity}</small>
                      </div>
                    </div>
                  )}
                  <p style={styles.shopLog}>{caseLog}</p>
                </div>
              )}
            </>
          )}
          {phase === 'tutorial' && (
            <div style={{ ...styles.tutorialPanel, ...(isMobile ? styles.tutorialPanelMobile : null) }}>
              <div style={styles.tutorialItem}>
                <b>Цель</b>
                <span>Найди ключ и код, поговори с выжившими и доберись до крепости.</span>
              </div>
              <div style={styles.tutorialItem}>
                <b>Выживание</b>
                <span>Собирай аптечки, оружие и кристаллы. Стрелки ведут к важным точкам.</span>
              </div>
              <div style={styles.tutorialItem}>
                <b>Экономика</b>
                <span>Успешные диалоги дают 50 золота и 5 алмазов, неудачные дают 10 золота и 1 алмаз.</span>
              </div>
              <div style={styles.tutorialItem}>
                <b>Прогресс</b>
                <span>{userId ? 'Аккаунт сохраняет место, кошелек, ножи и квесты автоматически.' : 'Гость играет без облачного сохранения аккаунта.'}</span>
              </div>
            </div>
          )}
          <div style={styles.controls}>{isMobile ? 'На телефоне используй экранные кнопки: движение, удар, бег, предмет и Хлоддев.' : 'WASD - движение · мышь - прицел · клик - удар · Space - Хлоддев · Esc - выход'}</div>
          <button type="button" onClick={handleMainPlay} disabled={!canStartGame} style={{ ...styles.play, ...(isMobile ? styles.playMobile : null) }}>
            {!progressLoaded ? 'Загрузка...' : !preloadDone ? `Загрузка моделей ${preloadProgress}%` : phase === 'intro' ? (savedGameState ? 'Продолжить' : 'Играть') : phase === 'tutorial' ? 'Старт' : 'Заново'}
          </button>
        </section>
      )}
    </div>
  );
}

function QuestArrow({ label, done, nav }: { label: string; done: boolean; nav: { distance: number; angle: number } }) {
  return (
    <div style={{ ...styles.questRow, opacity: done ? 0.55 : 1 }}>
      <span style={{ ...styles.arrow, transform: `rotate(${nav.angle}deg)` }}>▲</span>
      <span>{label}</span>
      <b>{done ? 'найдено' : `${nav.distance} м`}</b>
    </div>
  );
}

function InventoryPanel({ items, selectedSlot }: { items: InventoryEntry[]; selectedSlot: number }) {
  const slots = Array.from({ length: 9 }, (_, index) => items[index] ?? null);
  return (
    <div style={styles.inventoryPanel}>
      <div style={styles.inventoryTitle}>Инвентарь</div>
      <div style={styles.inventoryGrid}>
        {slots.map((item, index) => (
          <div key={item?.kind ?? `empty-${index}`} style={{ ...styles.inventorySlot, opacity: item ? 1 : 0.5 }} title={item ? ITEM_LABELS[item.kind] : 'Пустой слот'}>
            <span style={index === selectedSlot ? styles.slotNumberSelected : styles.slotNumber}>{index + 1}</span>
            {item ? (
              <>
                <span style={styles.inventoryIcon}>{ITEM_ICONS[item.kind]}</span>
                <span style={styles.inventoryName}>{ITEM_LABELS[item.kind]}</span>
                <b style={styles.inventoryCount}>x{item.count}</b>
              </>
            ) : (
              <span style={styles.emptySlot}>пусто</span>
            )}
          </div>
        ))}
      </div>
      <div style={styles.inventoryHint}>H - аптечка</div>
    </div>
  );
}

function ZombieCongratsPhoto({ score }: { score: number }) {
  return (
    <div style={styles.congratsPhoto}>
      <div style={styles.congratsSky} />
      <div style={styles.congratsFrame}>
        <div style={styles.congratsFlash}>QASQYR PHOTO 1873</div>
        <div style={styles.congratsPeople}>
          {[0, 1, 2, 3, 4].map((index) => (
            <div key={index} style={{ ...styles.congratsZombie, transform: `translateY(${index % 2 === 0 ? 0 : 18}px) rotate(${(index - 2) * 3}deg)` }}>
              <div style={styles.congratsHead}>
                <span style={styles.congratsEyeLeft} />
                <span style={styles.congratsEyeRight} />
                <span style={styles.congratsSmile} />
              </div>
              <div style={styles.congratsBody} />
              <div style={styles.congratsArmLeft} />
              <div style={styles.congratsArmRight} />
              <div style={styles.congratsHeart}>♥</div>
            </div>
          ))}
        </div>
        <div style={styles.congratsCaption}>
          <h2 style={styles.congratsTitle}>Зомби поздравляют тебя!</h2>
          <p style={styles.congratsText}>Ты собрал истории степи, открыл крепость и доказал, что даже зараженные умеют радоваться хорошему финалу.</p>
          <b style={styles.congratsScore}>Счет: {score}</b>
        </div>
      </div>
    </div>
  );
}

function ZombieScreamer() {
  return (
    <div style={styles.screamer}>
      <div style={styles.screamerFace}>
        <div style={styles.screamerEyeLeft} />
        <div style={styles.screamerEyeRight} />
        <div style={styles.screamerMouth} />
        <div style={styles.screamerTeethTop} />
        <div style={styles.screamerTeethBottom} />
      </div>
      <div style={styles.screamerText}>ЗАРАЖЕННЫЙ ДОБРАЛСЯ ДО ТЕБЯ</div>
    </div>
  );
}

function npcLoreThread(npc: HouseNpc) {
  if (npc.mood === 'good') return 'Линия лора: иммунитет двух друзей связан не только с кумысом, а с древней закваской рода Каскыр. Союзники начинают понимать: вирус можно не просто уничтожить, а переучить.';
  if (npc.mood === 'evil') return 'Линия лора: не все злодеи заражены. Некоторые услышали голос северной крепости и кормят ее страхом, чтобы управлять зомби.';
  return 'Линия лора: волки были первыми носителями, но кто-то направил стаю к аулам именно в ночь, когда над степью погасли звезды.';
}

function dialogStepChoices(npc: HouseNpc, step: number): NpcChoice[] {
  if (npc.id === TRADER_NPC_ID && step === 0) {
    return [
      { text: 'Купить координаты за 5 аптечек', reply: 'Жанат считает аптечки и рисует на обрывке карты дом Саята. На компасе появилась новая стрелка.', effect: 'trade' },
      ...npc.choices,
    ];
  }
  if (npc.id === COMPANION_HOUSE.id) {
    return npc.choices;
  }
  if (step === 0) {
    return [
      { text: 'Спросить, что случилось в первую ночь', reply: `${npc.name} говорит тише: в ту ночь волки не выли, а будто повторяли чужой приказ. Вирус шел за звуком, как за дудкой.`, effect: 'story' },
      { text: 'Спросить про кумысный иммунитет', reply: `${npc.name} вспоминает старую легенду: кислый кумыс удерживает человека за имя, когда зараза пытается стереть память.`, effect: 'story' },
    ];
  }
  if (step === 1) {
    return [
      { text: 'Уточнить про северную крепость', reply: `${npc.name} шепчет: крепость не просто стены. Под ней спит колодец, где заражение учится говорить человеческими голосами.`, effect: 'story' },
      { text: 'Спросить, почему зомби не входят в дом', reply: `${npc.name} показывает порог: на нем соль, зола и кумысная закваска. Зараженные забывают дорогу, пока дверь закрыта.`, effect: 'story' },
    ];
  }
  return npc.choices;
}

function DialogPanel({ dialog, onChoose }: { dialog: DialogState; onChoose: (choice: NpcChoice) => void }) {
  const { npc, step, lastReply } = dialog;
  const [talkFrame, setTalkFrame] = useState(0);
  useEffect(() => {
    const timer = window.setInterval(() => setTalkFrame((frame) => frame + 1), 170);
    return () => window.clearInterval(timer);
  }, []);

  const bob = Math.sin(talkFrame * 0.7);
  const mouthOpen = 8 + Math.abs(Math.sin(talkFrame * 1.15)) * 12;
  const portraitColor = npc.mood === 'good' ? '#b78355' : npc.mood === 'evil' ? '#8c7a65' : '#ad8762';
  const eyeColor = npc.mood === 'evil' ? '#ff6969' : npc.mood === 'good' ? '#d7ffe0' : '#f6f2e9';
  const browTilt = npc.mood === 'evil' ? 18 : npc.mood === 'good' ? -8 : 0;
  const choices = dialogStepChoices(npc, step);

  const moodLabel = npc.mood === 'good' ? 'союзник' : npc.mood === 'evil' ? 'опасный' : 'нейтральный';
  return (
    <div style={styles.dialogBackdrop}>
      <section style={styles.dialogPanel}>
        <div style={{ ...styles.npcPortrait, transform: `translateY(${bob * 4}px)` }}>
          <div style={{ ...styles.npcBody, background: npc.mood === 'evil' ? '#2a2521' : npc.mood === 'good' ? '#3f5b48' : '#4b4239' }} />
          <div style={{ ...styles.npcHandLeft, transform: `rotate(${bob * 18 - 18}deg)` }} />
          <div style={{ ...styles.npcHandRight, transform: `rotate(${bob * -18 + 18}deg)` }} />
          <div style={{ ...styles.npcHead, background: portraitColor }}>
            <div style={{ ...styles.npcBrowLeft, transform: `rotate(${browTilt}deg)` }} />
            <div style={{ ...styles.npcBrowRight, transform: `rotate(${-browTilt}deg)` }} />
            <div style={{ ...styles.npcEyeLeft, background: eyeColor }} />
            <div style={{ ...styles.npcEyeRight, background: eyeColor }} />
            <div style={{ ...styles.npcMouth, height: mouthOpen, borderRadius: npc.mood === 'good' ? '0 0 18px 18px' : 18 }} />
          </div>
        </div>
        <div style={styles.dialogMeta}>{npc.title} · {moodLabel}</div>
        <h3 style={styles.dialogName}>{npc.name}</h3>
        <p style={styles.dialogText}>{npc.story}</p>
        <p style={styles.dialogLore}>{npcLoreThread(npc)}</p>
        {lastReply && <p style={styles.dialogReply}>{lastReply}</p>}
        <div style={styles.dialogProgress}>Реплика {Math.min(step + 1, 3)} / 3</div>
        <div style={styles.dialogChoices}>
          {choices.map((choice) => (
            <button key={choice.text} type="button" onClick={() => onChoose(choice)} style={styles.dialogButton}>
              {choice.text}
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  root: {
    position: 'fixed',
    inset: 0,
    zIndex: 9999,
    overflow: 'hidden',
    background: '#101419',
    color: '#f6f2e9',
    fontFamily: 'Inter, system-ui, sans-serif',
  },
  rootMobileMenu: {
    position: 'relative',
    inset: 'auto',
    minHeight: '100dvh',
    overflowY: 'auto',
    overflowX: 'hidden',
    padding: '18px 14px 28px',
    WebkitOverflowScrolling: 'touch',
  },
  rootMobilePlaying: {
    width: '100dvw',
    height: '100dvh',
    overflow: 'hidden',
    touchAction: 'none',
  },
  mount: { position: 'absolute', inset: 0 },
  cinematicGrade: {
    position: 'absolute',
    inset: 0,
    zIndex: 1,
    pointerEvents: 'none',
    background:
      'radial-gradient(circle at 52% 42%, transparent 0 48%, rgba(0,0,0,.28) 78%, rgba(0,0,0,.55) 100%), linear-gradient(180deg, rgba(255,188,92,.08), transparent 38%, rgba(7,10,14,.2))',
    mixBlendMode: 'multiply',
  },
  menuBackdrop: {
    position: 'fixed',
    inset: 0,
    zIndex: 0,
    background:
      'linear-gradient(90deg, rgba(6,8,7,.86), rgba(6,8,7,.42) 52%, rgba(6,8,7,.78)), linear-gradient(180deg, rgba(6,8,7,.18), rgba(6,8,7,.86)), url("/presentation/qasqyr-gameplay-3d.png") center / cover no-repeat',
    filter: 'saturate(1.16) contrast(1.08)',
  },
  orientationOverlay: {
    position: 'absolute',
    inset: 0,
    zIndex: 90,
    display: 'grid',
    placeContent: 'center',
    justifyItems: 'center',
    gap: 12,
    padding: 24,
    background: 'rgba(5,8,7,.9)',
    color: '#f6f2e9',
    textAlign: 'center',
    pointerEvents: 'none',
  },
  orientationPhone: {
    width: 84,
    height: 54,
    display: 'grid',
    placeItems: 'center',
    border: '2px solid rgba(112,214,255,.7)',
    borderRadius: 10,
    color: '#70d6ff',
    fontSize: 32,
    fontWeight: 1000,
    transform: 'rotate(90deg)',
    boxShadow: '0 0 30px rgba(112,214,255,.22)',
  },
  loadingOverlay: {
    position: 'absolute',
    inset: 0,
    zIndex: 80,
    display: 'grid',
    placeItems: 'center',
    background: 'rgba(5,8,7,.76)',
    backdropFilter: 'blur(6px)',
  },
  loadingPanel: {
    width: 'min(440px, calc(100vw - 34px))',
    display: 'grid',
    gap: 12,
    padding: 18,
    border: '1px solid rgba(255,255,255,.18)',
    borderRadius: 8,
    background: 'rgba(10,14,12,.92)',
    boxShadow: '0 18px 44px rgba(0,0,0,.38)',
    textAlign: 'center',
    color: '#f6f2e9',
  },
  loadingTrack: {
    width: '100%',
    height: 10,
    overflow: 'hidden',
    borderRadius: 999,
    background: 'rgba(255,255,255,.14)',
  },
  loadingFill: {
    display: 'block',
    height: '100%',
    borderRadius: 999,
    background: 'linear-gradient(90deg, #70d6ff, #ffd37b)',
    transition: 'width .24s ease',
  },
  exit: {
    position: 'absolute',
    top: 16,
    right: 16,
    zIndex: 3,
    border: '1px solid rgba(255,255,255,.28)',
    background: 'rgba(13,17,22,.74)',
    color: '#fff',
    borderRadius: 8,
    padding: '10px 14px',
  },
  focusControl: {
    position: 'absolute',
    top: 64,
    right: 16,
    zIndex: 3,
    border: '1px solid rgba(112,214,255,.42)',
    background: 'rgba(8,22,28,.78)',
    color: '#d9f7ff',
    borderRadius: 8,
    padding: '10px 14px',
    fontSize: 13,
    fontWeight: 900,
    cursor: 'pointer',
    pointerEvents: 'auto',
  },
  hud: {
    position: 'absolute',
    left: 18,
    right: 18,
    bottom: 18,
    zIndex: 2,
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(82px, 1fr))',
    gap: 10,
    alignItems: 'stretch',
    pointerEvents: 'none',
  },
  hudMobile: {
    left: 'auto',
    right: 10,
    top: 10,
    bottom: 'auto',
    width: 'min(52vw, 470px)',
    gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
    gap: 6,
    fontSize: 11,
  },
  stat: {
    minHeight: 58,
    border: '1px solid rgba(255,255,255,.18)',
    background: 'rgba(8,12,16,.72)',
    borderRadius: 8,
    padding: '9px 12px',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
  },
  aiButton: {
    minHeight: 58,
    border: '1px solid rgba(112,214,255,.46)',
    background: 'rgba(12,38,48,.82)',
    color: '#d9f7ff',
    borderRadius: 8,
    padding: '9px 12px',
    fontWeight: 900,
    cursor: 'pointer',
    pointerEvents: 'auto',
  },
  hint: {
    gridColumn: '1 / -1',
    minHeight: 58,
    border: '1px solid rgba(255,255,255,.18)',
    background: 'rgba(8,12,16,.72)',
    borderRadius: 8,
    padding: '18px 16px',
    fontWeight: 700,
  },
  questPanel: {
    position: 'absolute',
    top: 18,
    left: 18,
    zIndex: 3,
    display: 'grid',
    gap: 8,
    width: 210,
    pointerEvents: 'none',
  },
  questPanelMobile: {
    top: 10,
    left: 10,
    width: 'min(210px, 32vw)',
    gap: 6,
    fontSize: 12,
  },
  questRow: {
    display: 'grid',
    gridTemplateColumns: '26px 1fr auto',
    alignItems: 'center',
    gap: 8,
    minHeight: 38,
    border: '1px solid rgba(255,255,255,.18)',
    background: 'rgba(8,12,16,.72)',
    borderRadius: 8,
    padding: '7px 10px',
    fontSize: 14,
  },
  arrow: {
    display: 'inline-grid',
    placeItems: 'center',
    width: 24,
    height: 24,
    color: '#ffd34d',
    fontSize: 19,
    transformOrigin: '50% 50%',
  },
  fortressDistance: {
    minHeight: 34,
    border: '1px solid rgba(255,255,255,.14)',
    background: 'rgba(8,12,16,.58)',
    borderRadius: 8,
    padding: '8px 10px',
    color: '#d8d1c3',
    fontSize: 13,
  },
  inventoryPanel: {
    position: 'absolute',
    top: 18,
    right: 18,
    zIndex: 3,
    width: 260,
    border: '1px solid rgba(255,255,255,.18)',
    background: 'rgba(8,12,16,.72)',
    borderRadius: 8,
    padding: 10,
    pointerEvents: 'none',
  },
  inventoryTitle: {
    fontSize: 13,
    fontWeight: 900,
    color: '#ffd37b',
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  inventoryGrid: {
    display: 'grid',
    gap: 6,
    maxHeight: 330,
    overflow: 'hidden',
  },
  inventorySlot: {
    display: 'grid',
    gridTemplateColumns: '20px 28px 1fr auto',
    alignItems: 'center',
    gap: 7,
    minHeight: 34,
    border: '1px solid rgba(255,255,255,.12)',
    background: 'rgba(255,255,255,.06)',
    borderRadius: 6,
    padding: '5px 7px',
    fontSize: 13,
  },
  slotNumber: {
    color: '#7f8c84',
    fontSize: 11,
    fontWeight: 900,
  },
  slotNumberSelected: {
    display: 'grid',
    placeItems: 'center',
    width: 20,
    height: 24,
    borderRadius: 4,
    background: '#ffd34d',
    color: '#141007',
    fontSize: 11,
    fontWeight: 1000,
  },
  inventoryIcon: {
    display: 'grid',
    placeItems: 'center',
    width: 24,
    height: 24,
    borderRadius: 4,
    background: 'rgba(255,211,77,.16)',
    color: '#ffd34d',
    fontWeight: 900,
  },
  inventoryName: {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  inventoryCount: {
    color: '#f6f2e9',
    fontSize: 12,
  },
  emptyInventory: {
    color: '#aeb8be',
    fontSize: 13,
    padding: '8px 0',
  },
  emptySlot: {
    gridColumn: '2 / -1',
    color: '#758078',
    fontSize: 12,
  },
  inventoryHint: {
    marginTop: 8,
    color: '#aeb8be',
    fontSize: 12,
  },
  congratsPhoto: {
    position: 'fixed',
    inset: 0,
    zIndex: 28,
    display: 'grid',
    placeItems: 'center',
    overflow: 'hidden',
    background: 'linear-gradient(180deg, #88b7c8 0%, #e8d29c 58%, #6f7b42 100%)',
    color: '#241914',
  },
  congratsSky: {
    position: 'absolute',
    inset: 0,
    background: 'radial-gradient(circle at 50% 20%, rgba(255,255,230,.9), rgba(255,255,255,0) 24%), linear-gradient(90deg, rgba(255,255,255,.18), rgba(0,0,0,.08))',
  },
  congratsFrame: {
    position: 'relative',
    width: 'min(980px, calc(100vw - 30px))',
    height: 'min(650px, calc(100vh - 30px))',
    border: '14px solid #f3ead8',
    outline: '1px solid rgba(0,0,0,.3)',
    borderRadius: 8,
    background: 'linear-gradient(180deg, rgba(143,188,197,.9), rgba(117,128,70,.95))',
    boxShadow: '0 28px 100px rgba(0,0,0,.58), inset 0 0 80px rgba(255,255,255,.2)',
    overflow: 'hidden',
  },
  congratsFlash: {
    position: 'absolute',
    top: 16,
    left: 18,
    color: 'rgba(36,25,20,.62)',
    fontWeight: 1000,
    letterSpacing: 3,
    fontSize: 12,
  },
  congratsPeople: {
    position: 'absolute',
    left: '6%',
    right: '6%',
    bottom: '20%',
    height: '52%',
    display: 'flex',
    justifyContent: 'space-around',
    alignItems: 'flex-end',
  },
  congratsZombie: {
    position: 'relative',
    width: 120,
    height: 245,
  },
  congratsHead: {
    position: 'absolute',
    left: 26,
    top: 0,
    width: 68,
    height: 78,
    borderRadius: '46% 48% 42% 45%',
    background: '#9aa879',
    border: '3px solid #394230',
    boxShadow: 'inset 0 -14px 18px rgba(0,0,0,.2)',
  },
  congratsEyeLeft: {
    position: 'absolute',
    left: 17,
    top: 28,
    width: 10,
    height: 10,
    borderRadius: '50%',
    background: '#fff6bb',
    boxShadow: '0 0 12px #fff6bb',
  },
  congratsEyeRight: {
    position: 'absolute',
    right: 17,
    top: 28,
    width: 10,
    height: 10,
    borderRadius: '50%',
    background: '#fff6bb',
    boxShadow: '0 0 12px #fff6bb',
  },
  congratsSmile: {
    position: 'absolute',
    left: 22,
    bottom: 17,
    width: 24,
    height: 10,
    borderBottom: '4px solid #351412',
    borderRadius: '0 0 20px 20px',
  },
  congratsBody: {
    position: 'absolute',
    left: 24,
    top: 76,
    width: 72,
    height: 126,
    borderRadius: '26px 26px 8px 8px',
    background: '#3f5138',
    border: '2px solid rgba(0,0,0,.22)',
  },
  congratsArmLeft: {
    position: 'absolute',
    left: 0,
    top: 98,
    width: 56,
    height: 14,
    borderRadius: 999,
    background: '#8f9c70',
    transform: 'rotate(-28deg)',
  },
  congratsArmRight: {
    position: 'absolute',
    right: 0,
    top: 98,
    width: 56,
    height: 14,
    borderRadius: 999,
    background: '#8f9c70',
    transform: 'rotate(28deg)',
  },
  congratsHeart: {
    position: 'absolute',
    left: 37,
    top: 104,
    width: 48,
    height: 48,
    display: 'grid',
    placeItems: 'center',
    color: '#e34262',
    fontSize: 46,
    lineHeight: 1,
    textShadow: '0 4px 0 rgba(0,0,0,.18), 0 0 18px rgba(255,80,120,.65)',
  },
  congratsCaption: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    minHeight: 138,
    padding: '22px 28px',
    background: 'rgba(243,234,216,.92)',
    textAlign: 'center',
  },
  congratsTitle: {
    margin: '0 0 8px',
    fontFamily: 'Georgia, serif',
    fontSize: 'clamp(30px, 5vw, 56px)',
    lineHeight: 1,
  },
  congratsText: {
    margin: '0 auto 10px',
    maxWidth: 760,
    fontSize: 16,
    lineHeight: 1.45,
    fontWeight: 700,
  },
  congratsScore: {
    fontSize: 18,
    color: '#7a2f28',
  },
  screamer: {
    position: 'fixed',
    inset: 0,
    zIndex: 20,
    display: 'grid',
    placeItems: 'center',
    background: 'radial-gradient(circle at 50% 45%, rgba(120,0,0,.42), rgba(0,0,0,.98) 58%)',
    pointerEvents: 'none',
  },
  screamerFace: {
    position: 'relative',
    width: 'min(78vw, 620px)',
    height: 'min(78vw, 620px)',
    borderRadius: '42% 45% 48% 46%',
    background: 'linear-gradient(180deg, #7f8b62, #34402f 42%, #141812)',
    border: '10px solid #080909',
    boxShadow: '0 0 90px rgba(190,0,0,.85), inset 0 0 80px rgba(0,0,0,.9)',
    transform: 'scale(1.08) rotate(-2deg)',
  },
  screamerEyeLeft: {
    position: 'absolute',
    left: '22%',
    top: '26%',
    width: '20%',
    height: '17%',
    borderRadius: '50%',
    background: '#fff8c9',
    boxShadow: '0 0 28px #fff2a0',
  },
  screamerEyeRight: {
    position: 'absolute',
    right: '22%',
    top: '24%',
    width: '20%',
    height: '18%',
    borderRadius: '50%',
    background: '#fff8c9',
    boxShadow: '0 0 28px #fff2a0',
  },
  screamerMouth: {
    position: 'absolute',
    left: '24%',
    top: '54%',
    width: '52%',
    height: '28%',
    borderRadius: '0 0 48% 48%',
    background: '#050202',
    border: '6px solid #2b0505',
    boxShadow: 'inset 0 0 30px #000',
  },
  screamerTeethTop: {
    position: 'absolute',
    left: '31%',
    top: '55%',
    width: '38%',
    height: '7%',
    background: 'repeating-linear-gradient(90deg, #e7dfc9 0 13px, transparent 13px 23px)',
  },
  screamerTeethBottom: {
    position: 'absolute',
    left: '34%',
    top: '75%',
    width: '32%',
    height: '7%',
    background: 'repeating-linear-gradient(90deg, #d8cfb8 0 12px, transparent 12px 22px)',
  },
  screamerText: {
    position: 'absolute',
    bottom: 36,
    left: 20,
    right: 20,
    textAlign: 'center',
    color: '#ffdddd',
    fontSize: 'clamp(18px, 4vw, 46px)',
    fontWeight: 1000,
    letterSpacing: 3,
    textShadow: '0 0 18px #d00000, 0 4px 0 #000',
  },
  dialogBackdrop: {
    position: 'absolute',
    inset: 0,
    zIndex: 6,
    display: 'grid',
    placeItems: 'center',
    background: 'rgba(0,0,0,.36)',
    pointerEvents: 'auto',
  },
  dialogPanel: {
    width: 'min(620px, calc(100vw - 32px))',
    border: '1px solid rgba(255,211,77,.32)',
    background: 'rgba(9,13,12,.94)',
    borderRadius: 8,
    padding: 22,
    boxShadow: '0 24px 90px rgba(0,0,0,.62)',
    color: '#f6f2e9',
  },
  npcPortrait: {
    position: 'relative',
    float: 'left',
    width: 118,
    height: 152,
    margin: '0 18px 10px 0',
  },
  npcBody: {
    position: 'absolute',
    left: 26,
    bottom: 0,
    width: 66,
    height: 76,
    borderRadius: '22px 22px 8px 8px',
    border: '1px solid rgba(255,255,255,.12)',
  },
  npcHead: {
    position: 'absolute',
    left: 28,
    top: 10,
    width: 62,
    height: 68,
    borderRadius: '48% 48% 44% 44%',
    border: '2px solid rgba(30,18,10,.42)',
    boxShadow: 'inset 0 -10px 16px rgba(0,0,0,.18)',
  },
  npcEyeLeft: {
    position: 'absolute',
    left: 15,
    top: 29,
    width: 10,
    height: 8,
    borderRadius: '50%',
    boxShadow: '0 0 10px currentColor',
  },
  npcEyeRight: {
    position: 'absolute',
    right: 15,
    top: 29,
    width: 10,
    height: 8,
    borderRadius: '50%',
    boxShadow: '0 0 10px currentColor',
  },
  npcBrowLeft: {
    position: 'absolute',
    left: 10,
    top: 22,
    width: 18,
    height: 3,
    background: '#2b1a12',
    transformOrigin: '100% 50%',
  },
  npcBrowRight: {
    position: 'absolute',
    right: 10,
    top: 22,
    width: 18,
    height: 3,
    background: '#2b1a12',
    transformOrigin: '0 50%',
  },
  npcMouth: {
    position: 'absolute',
    left: 23,
    top: 46,
    width: 16,
    background: '#1b0505',
    border: '2px solid rgba(0,0,0,.35)',
    transition: 'height .12s linear',
  },
  npcHandLeft: {
    position: 'absolute',
    left: 8,
    bottom: 34,
    width: 42,
    height: 11,
    borderRadius: 999,
    background: '#9a7657',
    transformOrigin: '100% 50%',
  },
  npcHandRight: {
    position: 'absolute',
    right: 8,
    bottom: 34,
    width: 42,
    height: 11,
    borderRadius: 999,
    background: '#9a7657',
    transformOrigin: '0 50%',
  },
  dialogMeta: {
    color: '#79a978',
    fontSize: 12,
    fontWeight: 900,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  dialogName: {
    margin: '8px 0 10px',
    fontSize: 28,
    lineHeight: 1.05,
    fontFamily: 'Georgia, serif',
  },
  dialogText: {
    margin: '0 0 18px',
    color: '#d8d1c3',
    fontSize: 15,
    lineHeight: 1.55,
  },
  dialogLore: {
    margin: '0 0 18px',
    color: '#ffd37b',
    fontSize: 14,
    lineHeight: 1.55,
    fontWeight: 800,
  },
  dialogReply: {
    margin: '0 0 16px',
    borderLeft: '3px solid #79a978',
    padding: '10px 12px',
    background: 'rgba(121,169,120,.12)',
    color: '#f6f2e9',
    fontSize: 14,
    lineHeight: 1.5,
    fontWeight: 700,
  },
  dialogProgress: {
    margin: '0 0 10px',
    color: '#aeb8be',
    fontSize: 12,
    fontWeight: 900,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  dialogChoices: {
    display: 'grid',
    gap: 10,
  },
  dialogButton: {
    border: '1px solid rgba(255,255,255,.2)',
    background: 'rgba(255,255,255,.06)',
    color: '#f6f2e9',
    borderRadius: 6,
    padding: '12px 14px',
    textAlign: 'left',
    fontWeight: 800,
    cursor: 'pointer',
  },
  taunt: {
    position: 'absolute',
    left: '50%',
    top: 86,
    transform: 'translateX(-50%)',
    zIndex: 4,
    width: 'min(720px, calc(100vw - 32px))',
    border: '1px solid rgba(255,210,120,.48)',
    background: 'rgba(22,12,8,.88)',
    color: '#ffd37b',
    borderRadius: 8,
    padding: '16px 20px',
    textAlign: 'center',
    fontSize: 18,
    fontWeight: 900,
    boxShadow: '0 18px 50px rgba(0,0,0,.45)',
    pointerEvents: 'none',
  },
  panel: {
    position: 'absolute',
    left: '50%',
    top: '50%',
    transform: 'translate(-50%, -50%)',
    zIndex: 1,
    width: 'min(680px, calc(100vw - 32px))',
    border: '1px solid rgba(255,255,255,.18)',
    background: 'linear-gradient(180deg, rgba(21,27,33,.9), rgba(8,12,10,.94))',
    borderRadius: 8,
    padding: 28,
    boxShadow: '0 24px 90px rgba(0,0,0,.55)',
    textAlign: 'center',
  },
  panelMobile: {
    position: 'relative',
    left: 'auto',
    top: 'auto',
    transform: 'none',
    width: '100%',
    margin: '0 auto',
    padding: 18,
    textAlign: 'left',
    maxHeight: 'none',
    overflow: 'visible',
  },
  eyebrow: { margin: 0, color: '#70d6ff', fontSize: 13, fontWeight: 900, letterSpacing: 2 },
  title: { margin: '8px 0 10px', fontSize: 36, lineHeight: 1.05 },
  text: { margin: '0 auto 18px', color: '#d8d1c3', lineHeight: 1.5, maxWidth: 480 },
  controls: {
    margin: '0 0 20px',
    color: '#aeb8be',
    fontSize: 14,
    lineHeight: 1.5,
  },
  menuTabs: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
    gap: 8,
    margin: '0 0 14px',
  },
  menuTab: {
    border: '1px solid rgba(255,255,255,.16)',
    borderRadius: 8,
    padding: '10px 8px',
    background: 'rgba(255,255,255,.05)',
    color: '#d8d1c3',
    fontWeight: 900,
    cursor: 'pointer',
  },
  menuTabActive: {
    border: '1px solid rgba(112,214,255,.58)',
    borderRadius: 8,
    padding: '10px 8px',
    background: 'rgba(112,214,255,.14)',
    color: '#d9f7ff',
    fontWeight: 1000,
    cursor: 'pointer',
  },
  difficultyGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
    gap: 8,
    margin: '0 0 18px',
  },
  difficultyGridMobile: {
    gridTemplateColumns: '1fr',
    gap: 10,
  },
  difficultyButton: {
    border: '1px solid rgba(255,255,255,.18)',
    borderRadius: 8,
    padding: '10px 8px',
    background: 'rgba(255,255,255,.06)',
    color: '#d8d1c3',
    fontWeight: 900,
    minHeight: 104,
    display: 'flex',
    flexDirection: 'column',
    gap: 7,
    justifyContent: 'center',
    cursor: 'pointer',
  },
  difficultySelected: {
    border: '1px solid rgba(255,211,77,.72)',
    borderRadius: 8,
    padding: '10px 8px',
    background: 'rgba(255,211,77,.18)',
    color: '#ffd37b',
    fontWeight: 1000,
    minHeight: 104,
    display: 'flex',
    flexDirection: 'column',
    gap: 7,
    justifyContent: 'center',
    cursor: 'pointer',
  },
  skinGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
    gap: 10,
    margin: '0 0 18px',
  },
  skinGridMobile: {
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  },
  skinCard: {
    minHeight: 132,
    border: '1px solid rgba(255,255,255,.16)',
    borderRadius: 8,
    background: 'rgba(255,255,255,.055)',
    color: '#f6f2e9',
    padding: 10,
    display: 'grid',
    justifyItems: 'center',
    alignContent: 'center',
    gap: 6,
    cursor: 'pointer',
  },
  skinBlade: {
    width: 58,
    height: 12,
    borderRadius: '12px 2px 2px 12px',
    background: 'linear-gradient(90deg, #15191d 0 18%, #d8dde4 18% 78%, #8fa3b2 78%)',
    boxShadow: '0 0 18px rgba(112,214,255,.14)',
    transform: 'rotate(-18deg)',
  },
  shopPanel: {
    display: 'grid',
    gap: 10,
    margin: '0 0 18px',
  },
  walletRow: {
    display: 'flex',
    justifyContent: 'center',
    gap: 18,
    color: '#d8d1c3',
    fontWeight: 800,
  },
  shopGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: 10,
  },
  shopGridMobile: {
    gridTemplateColumns: '1fr',
  },
  shopButton: {
    border: '1px solid rgba(255,211,77,.34)',
    borderRadius: 8,
    background: 'rgba(255,211,77,.1)',
    color: '#ffd37b',
    padding: '14px 12px',
    display: 'grid',
    gap: 6,
    fontWeight: 900,
    cursor: 'pointer',
  },
  shopButtonPremium: {
    border: '1px solid rgba(112,214,255,.42)',
    borderRadius: 8,
    background: 'rgba(112,214,255,.12)',
    color: '#d9f7ff',
    padding: '14px 12px',
    display: 'grid',
    gap: 6,
    fontWeight: 900,
    cursor: 'pointer',
  },
  assetPackPanel: {
    display: 'grid',
    gap: 8,
    margin: '0 0 18px',
    padding: 12,
    border: '1px solid rgba(255,255,255,.14)',
    borderRadius: 8,
    background: 'rgba(0,0,0,.16)',
    color: '#d8d1c3',
    textAlign: 'left',
  },
  assetPackGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: 6,
    maxHeight: 112,
    overflow: 'auto',
  },
  assetPackItem: {
    display: 'block',
    padding: '6px 8px',
    borderRadius: 6,
    background: 'rgba(255,255,255,.06)',
    color: '#f6f2e9',
    overflowWrap: 'anywhere',
  },
  caseStage: {
    position: 'relative',
    minHeight: 178,
    display: 'grid',
    placeItems: 'center',
    overflow: 'hidden',
    border: '1px solid rgba(255,255,255,.13)',
    borderRadius: 8,
    background: 'linear-gradient(180deg, rgba(18,21,22,.74), rgba(7,8,9,.36))',
  },
  caseGlow: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: '50%',
    filter: 'blur(8px)',
    animation: 'qasqyrCaseGlow .95s ease-out both',
  },
  caseLid: {
    position: 'absolute',
    left: '50%',
    top: 44,
    width: 132,
    height: 26,
    border: '1px solid rgba(255,211,123,.48)',
    borderRadius: '8px 8px 3px 3px',
    background: 'linear-gradient(180deg, #826235, #2f2418)',
    boxShadow: '0 12px 22px rgba(0,0,0,.32)',
    transformOrigin: 'center bottom',
    animation: 'qasqyrCaseLid .95s ease-out both',
  },
  caseBox: {
    width: 150,
    minHeight: 82,
    display: 'grid',
    placeItems: 'center',
    gap: 5,
    border: '1px solid rgba(255,211,123,.34)',
    borderRadius: 8,
    background: 'linear-gradient(180deg, #5c4528, #1d1915)',
    color: '#ffd37b',
    boxShadow: '0 18px 42px rgba(0,0,0,.34)',
    animation: 'qasqyrCaseShake .7s ease-in-out both',
  },
  caseLock: {
    width: 30,
    height: 30,
    display: 'grid',
    placeItems: 'center',
    borderRadius: '50%',
    background: 'rgba(255,255,255,.12)',
    color: '#f7e0a3',
  },
  caseReward: {
    position: 'absolute',
    bottom: 13,
    left: '50%',
    width: 'min(88%, 260px)',
    minHeight: 52,
    transform: 'translateX(-50%)',
    display: 'grid',
    gridTemplateColumns: '54px 1fr auto',
    alignItems: 'center',
    gap: 9,
    padding: '8px 10px',
    border: '1px solid',
    borderRadius: 8,
    background: 'rgba(8,10,11,.86)',
    color: '#f5efe1',
    boxShadow: '0 14px 28px rgba(0,0,0,.32)',
    animation: 'qasqyrRewardPop 1.05s ease-out both',
  },
  caseRewardBlade: {
    width: 48,
    height: 10,
    borderRadius: '12px 2px 2px 12px',
    background: 'linear-gradient(90deg, #1a1e20 0 20%, #f6f3e9 20% 76%, #9fb2bf 76%)',
    transform: 'rotate(-17deg)',
    boxShadow: '0 0 14px rgba(255,255,255,.16)',
  },
  shopLog: {
    minHeight: 40,
    margin: 0,
    padding: '10px 12px',
    border: '1px solid rgba(255,255,255,.14)',
    borderRadius: 8,
    background: 'rgba(0,0,0,.16)',
    color: '#d8d1c3',
    fontSize: 13,
    lineHeight: 1.35,
  },
  endingText: {
    margin: '0 0 18px',
    padding: '12px 14px',
    border: '1px solid rgba(255,211,77,.28)',
    borderRadius: 8,
    background: 'rgba(255,211,77,.08)',
    color: '#ffd37b',
    lineHeight: 1.5,
    fontWeight: 800,
  },
  tutorialPanel: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: 10,
    margin: '0 0 18px',
  },
  tutorialPanelMobile: {
    gridTemplateColumns: '1fr',
  },
  tutorialItem: {
    minHeight: 96,
    display: 'grid',
    alignContent: 'start',
    gap: 8,
    padding: '13px 14px',
    border: '1px solid rgba(255,255,255,.14)',
    borderRadius: 8,
    background: 'rgba(0,0,0,.18)',
    color: '#d8d1c3',
    lineHeight: 1.4,
  },
  mobileControls: {
    position: 'absolute',
    left: 10,
    right: 10,
    bottom: 12,
    zIndex: 5,
    display: 'flex',
    justifyContent: 'space-between',
    gap: 12,
    alignItems: 'end',
    pointerEvents: 'auto',
  },
  mobileMovePad: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 42px)',
    gridTemplateRows: 'repeat(2, 42px)',
    gap: 6,
    justifyContent: 'start',
  },
  mobilePadButton: {
    width: 42,
    height: 42,
    border: '1px solid rgba(255,255,255,.26)',
    borderRadius: 8,
    background: 'rgba(8,12,16,.76)',
    color: '#f6f2e9',
    fontSize: 19,
    fontWeight: 1000,
    touchAction: 'none',
    userSelect: 'none',
  },
  mobileActionPad: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: 8,
    width: 'min(330px, 42vw)',
  },
  mobileActionButton: {
    minHeight: 42,
    border: '1px solid rgba(255,255,255,.24)',
    borderRadius: 8,
    background: 'rgba(8,12,16,.78)',
    color: '#f6f2e9',
    fontSize: 13,
    fontWeight: 900,
    touchAction: 'none',
    userSelect: 'none',
  },
  mobileActionButtonAccent: {
    minHeight: 42,
    border: '1px solid rgba(112,214,255,.5)',
    borderRadius: 8,
    background: 'rgba(112,214,255,.18)',
    color: '#d9f7ff',
    fontSize: 13,
    fontWeight: 1000,
    touchAction: 'none',
    userSelect: 'none',
  },
  vision: {
    position: 'fixed',
    inset: 0,
    zIndex: 5,
    pointerEvents: 'none',
    mixBlendMode: 'screen',
  },
  visionBlood: {
    background: 'radial-gradient(circle at 50% 35%, rgba(190,32,32,.12), rgba(80,0,0,.34) 70%)',
  },
  visionEcho: {
    background: 'radial-gradient(circle at 48% 42%, rgba(140,255,210,.2), rgba(0,70,60,.18) 72%)',
  },
  visionWhite: {
    background: 'rgba(232,237,240,.24)',
  },
  play: {
    border: 0,
    borderRadius: 8,
    padding: '13px 30px',
    background: '#d36a3d',
    color: '#fff',
    fontWeight: 900,
    fontSize: 17,
  },
  playMobile: {
    width: '100%',
    minHeight: 52,
    fontSize: 18,
  },
};
