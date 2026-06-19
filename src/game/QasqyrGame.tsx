import { useEffect, useRef, useState, type CSSProperties } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js';

type WeaponKind = 'knife' | 'club' | 'sabre' | 'rifle';
type PickupKind = 'medkit' | 'crystal' | 'key' | 'code' | WeaponKind;
type EventKind = 'ambush' | 'storm' | 'rage' | 'starvation';
type GamePhase = 'intro' | 'playing' | 'won' | 'lost';
type Dimension = 'steppe' | 'hloddev';
type NpcMood = 'neutral' | 'evil' | 'good';
type DialogEffect = 'story' | 'heal' | 'medkit' | 'weapon' | 'damage' | 'steal' | 'ambush';
type Difficulty = 'story' | 'survival' | 'nightmare';
type VisionKind = '' | 'bloodmoon' | 'echo' | 'whiteout';
type DayPhase = 'dawn' | 'day' | 'dusk' | 'night';
type WalkMode = 'walk' | 'sneak' | 'sprint' | 'tired';

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
type MedievalPropKind = 'wagon' | 'crate' | 'woodFence' | 'metalFence' | 'roundDoor' | 'roundRoof' | 'vine';

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
const CHUNK_RADIUS = 2;
const FAR_WORLD_LIMIT = 100000;
const DAY_LENGTH = 210;
const STAMINA_MAX = 100;
const OUTFIT_URLS: Record<OutfitKind, string> = {
  maleRanger: '/models/outfits/fantasy/Male_Ranger.gltf',
  femaleRanger: '/models/outfits/fantasy/Female_Ranger.gltf',
  malePeasant: '/models/outfits/fantasy/Male_Peasant.gltf',
  femalePeasant: '/models/outfits/fantasy/Female_Peasant.gltf',
};
const ANIMATION_LIBRARY_URL = '/models/animations/ual2-standard.glb';
const MEDIEVAL_PROP_URLS: Record<MedievalPropKind, string> = {
  wagon: '/models/medieval/Prop_Wagon.gltf',
  crate: '/models/medieval/Prop_Crate.gltf',
  woodFence: '/models/medieval/Prop_WoodenFence_Single.gltf',
  metalFence: '/models/medieval/Prop_MetalFence_Simple.gltf',
  roundDoor: '/models/medieval/Door_1_Round.gltf',
  roundRoof: '/models/medieval/Roof_2x4_RoundTile.gltf',
  vine: '/models/medieval/Prop_Vine1.gltf',
};

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
  story: { label: 'Story', hp: 125, enemyHp: 0.82, enemySpeed: 0.88, enemyDamage: 0.72, spawn: 1.28, eventInterval: 78, score: 0.85 },
  survival: { label: 'Survival', hp: 100, enemyHp: 1, enemySpeed: 1, enemyDamage: 1, spawn: 1, eventInterval: 60, score: 1 },
  nightmare: { label: 'Nightmare', hp: 82, enemyHp: 1.32, enemySpeed: 1.22, enemyDamage: 1.36, spawn: 0.72, eventInterval: 42, score: 1.35 },
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
  return null;
}

function createCharacterAnimator(root: THREE.Object3D, clips: THREE.AnimationClip[], zombie = false): CharacterAnimator | null {
  const idle = findAnimationClip(clips, zombie ? ['Zombie_Idle_Loop', 'Idle_No_Loop'] : ['Idle_Lantern_Loop', 'Idle_FoldArms_Loop', 'Idle_No_Loop']);
  const walk = findAnimationClip(clips, zombie ? ['Zombie_Walk_Fwd_Loop', 'Walk_Carry_Loop'] : ['Walk_Carry_Loop', 'Zombie_Walk_Fwd_Loop']);
  const attack = findAnimationClip(clips, zombie ? ['Zombie_Scratch', 'Melee_Hook'] : ['Sword_Regular_A', 'Melee_Hook']);
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

function cloneMaterial(material: THREE.Material | THREE.Material[]) {
  return Array.isArray(material) ? material.map((entry) => entry.clone()) : material.clone();
}

function makeOutfitInstance(template: THREE.Group, role: OutfitRole) {
  const outfit = cloneSkeleton(template) as THREE.Group;
  outfit.traverse((part) => {
    if (!(part instanceof THREE.Mesh)) return;
    part.castShadow = true;
    part.receiveShadow = true;
    part.material = cloneMaterial(part.material);
    const materials = Array.isArray(part.material) ? part.material : [part.material];
    for (const material of materials) {
      if (role === 'enemy' && material instanceof THREE.MeshStandardMaterial) {
        material.color.multiplyScalar(0.58);
        material.emissive.setHex(0x25120f);
        material.emissiveIntensity = 0.18;
        material.roughness = Math.min(1, material.roughness + 0.16);
      } else if (role === 'npc' && material instanceof THREE.MeshStandardMaterial) {
        material.color.multiplyScalar(1.08);
        material.roughness = Math.min(1, material.roughness + 0.08);
      }
    }
  });
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
  const metal = new THREE.MeshStandardMaterial({ color: 0xd8dde4, metalness: 0.45, roughness: 0.28 });
  const darkMetal = new THREE.MeshStandardMaterial({ color: 0x252422, metalness: 0.32, roughness: 0.42 });
  const leather = new THREE.MeshStandardMaterial({ color: 0x4a2f22, roughness: 0.82 });
  const wood = new THREE.MeshStandardMaterial({ color: 0x6a4428, roughness: 0.8 });

  if (kind === 'medkit') {
    const bag = new THREE.Mesh(new THREE.BoxGeometry(1.28, 0.68, 0.95), new THREE.MeshStandardMaterial({ color: 0xf0eee8, roughness: 0.55 }));
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
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 2.1, 12), darkMetal);
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
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.05, 0.92), metal);
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
  const mat = new THREE.MeshStandardMaterial({ color: 0x77746a, roughness: 0.96 });
  const count = 3 + Math.floor(Math.random() * 4);
  for (let i = 0; i < count; i++) {
    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(randomRange(0.35, 1.1), 0), mat);
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
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5a4634, roughness: 0.94 });
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
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x4d3425, roughness: 0.92 });
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x2f6b3f, roughness: 0.88 });
  const darkLeafMat = new THREE.MeshStandardMaterial({ color: 0x244f34, roughness: 0.9 });
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
  return group;
}

function makeMountain() {
  const group = new THREE.Group();
  const rockMat = new THREE.MeshStandardMaterial({ color: 0x6f746f, roughness: 0.98, flatShading: true });
  const snowMat = new THREE.MeshStandardMaterial({ color: 0xd9e5e2, roughness: 0.82, flatShading: true });
  const height = randomRange(9, 18);
  const base = randomRange(7, 14);
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
    const shoulder = new THREE.Mesh(new THREE.ConeGeometry(base * randomRange(0.35, 0.62), height * randomRange(0.35, 0.58), 5), rockMat);
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

  const shoreMat = new THREE.MeshStandardMaterial({ color: 0x827852, roughness: 0.98 });
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
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uSeed: { value: seed },
      uFogNear: { value: 95 },
      uFogFar: { value: 340 },
      uFogColor: { value: new THREE.Color(0x9fb7c9) },
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
        vec3 grass = vec3(0.29, 0.42, 0.22);
        vec3 dry = vec3(0.56, 0.49, 0.30);
        vec3 damp = vec3(0.18, 0.28, 0.22);
        vec3 rock = vec3(0.38, 0.39, 0.34);
        vec3 color = mix(dry, grass, smoothstep(0.22, 0.78, n));
        color = mix(color, damp, smoothstep(0.72, 0.95, fine) * 0.38);
        color = mix(color, rock, smoothstep(0.58, 1.05, abs(vHeight)));
        float light = 0.78 + 0.22 * smoothstep(-0.35, 0.55, vHeight);
        color *= light;
        float dist = length(cameraPosition.xz - vWorld.xz);
        float fog = smoothstep(uFogNear, uFogFar, dist);
        gl_FragColor = vec4(mix(color, uFogColor, fog * 0.72), 1.0);
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
        float shine = smoothstep(0.68, 0.98, ripple);
        vec3 deep = vec3(0.08, 0.32, 0.38);
        vec3 shallow = vec3(0.18, 0.56, 0.65);
        vec3 color = mix(deep, shallow, vUv.y);
        color += shine * vec3(0.45, 0.72, 0.78);
        float dist = length(cameraPosition.xz - vWorld.xz);
        float fog = smoothstep(120.0, 360.0, dist);
        gl_FragColor = vec4(mix(color, uFogColor, fog * 0.52), 0.78);
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
        uTop: { value: new THREE.Color(0x5f8aa8) },
        uHorizon: { value: new THREE.Color(0xd8c89b) },
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
  const stone = new THREE.MeshStandardMaterial({ color: 0x817a6d, roughness: 0.98 });
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
  const wood = new THREE.MeshStandardMaterial({ color: 0x593821, roughness: 0.88 });
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

function makeHouse(mood: NpcMood) {
  const group = new THREE.Group();
  const wallColor = mood === 'good' ? 0x6f7f63 : mood === 'evil' ? 0x4f3a35 : 0x746957;
  const wall = new THREE.Mesh(
    new THREE.BoxGeometry(8, 4.2, 7),
    new THREE.MeshStandardMaterial({ color: wallColor, roughness: 0.9 }),
  );
  wall.position.y = 2.1;
  wall.castShadow = true;
  wall.receiveShadow = true;

  const roof = new THREE.Mesh(
    new THREE.ConeGeometry(6.2, 3, 4),
    new THREE.MeshStandardMaterial({ color: mood === 'evil' ? 0x2b1715 : 0x3f2b1f, roughness: 0.85 }),
  );
  roof.position.y = 5.3;
  roof.rotation.y = Math.PI / 4;
  roof.castShadow = true;

  const door = new THREE.Mesh(
    new THREE.BoxGeometry(1.6, 2.4, 0.18),
    new THREE.MeshStandardMaterial({ color: 0x24160f, roughness: 0.8 }),
  );
  door.position.set(0, 1.2, -3.6);

  const windowMat = new THREE.MeshBasicMaterial({ color: mood === 'evil' ? 0x9a332d : 0xf0c66a });
  const windowA = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.75, 0.12), windowMat);
  const windowB = windowA.clone();
  windowA.position.set(-2.4, 2.35, -3.64);
  windowB.position.set(2.4, 2.35, -3.64);

  group.add(wall, roof, door, windowA, windowB);
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

function makeWorldChunk(cx: number, cz: number) {
  const group = new THREE.Group();
  group.position.set(cx * CHUNK_SIZE, 0, cz * CHUNK_SIZE);
  const obstacles: Omit<PhysicsObstacle, 'key'>[] = [];

  const seed = hash2(cx, cz, 9) * 1000;
  const terrainRoll = hash2(cx, cz, 1);
  const groundColor = terrainRoll > 0.72 ? 0x59633d : terrainRoll > 0.44 ? 0x6f7d48 : 0x7f884d;
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(CHUNK_SIZE + 2, CHUNK_SIZE + 2, 8, 8),
    makeGroundShaderMaterial(seed + groundColor * 0.000001),
  );
  ground.userData.shader = 'ground';
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = 0.006;
  ground.receiveShadow = true;
  group.add(ground);

  const riverBand = Math.abs(Math.sin(cx * 0.62 + cz * 0.38)) < 0.18;
  if (riverBand) {
    const river = makeRiverSegment(CHUNK_SIZE);
    river.rotation.y = Math.sin((cx + cz) * 0.7) * 0.65;
    group.add(river);
    obstacles.push({ x: 0, z: 0, radius: CHUNK_SIZE * 0.54, kind: 'water' });
  }

  if (terrainRoll > 0.76) {
    const count = 2 + Math.floor(hash2(cx, cz, 3) * 3);
    for (let i = 0; i < count; i++) {
      const mountain = makeMountain();
      mountain.position.set(chunkRandom(cx, cz, i + 10, -32, 32), 0, chunkRandom(cx, cz, i + 20, -32, 32));
      const scale = chunkRandom(cx, cz, i + 30, 0.7, 1.45);
      mountain.scale.setScalar(scale);
      obstacles.push({ x: mountain.position.x, z: mountain.position.z, radius: 4.8 * scale, kind: 'solid' });
      group.add(mountain);
    }
  } else if (terrainRoll > 0.38) {
    const count = 11 + Math.floor(hash2(cx, cz, 4) * 18);
    for (let i = 0; i < count; i++) {
      const tree = makeForestTree();
      tree.position.set(chunkRandom(cx, cz, i + 40, -40, 40), 0, chunkRandom(cx, cz, i + 90, -40, 40));
      tree.rotation.y = chunkRandom(cx, cz, i + 140, 0, Math.PI * 2);
      const scale = chunkRandom(cx, cz, i + 180, 0.72, 1.38);
      tree.scale.setScalar(scale);
      obstacles.push({ x: tree.position.x, z: tree.position.z, radius: 0.72 * scale, kind: 'solid' });
      group.add(tree);
    }
  } else {
    const count = 4 + Math.floor(hash2(cx, cz, 5) * 8);
    for (let i = 0; i < count; i++) {
      const rocks = makeRockCluster();
      rocks.position.set(chunkRandom(cx, cz, i + 220, -40, 40), 0, chunkRandom(cx, cz, i + 260, -40, 40));
      const scale = chunkRandom(cx, cz, i + 300, 0.6, 1.55);
      rocks.scale.setScalar(scale);
      obstacles.push({ x: rocks.position.x, z: rocks.position.z, radius: 1.8 * scale, kind: 'solid' });
      group.add(rocks);
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

function addInventoryItem(items: InventoryEntry[], kind: PickupKind) {
  const existing = items.find((item) => item.kind === kind);
  if (existing) existing.count += 1;
  else if (items.length < 9) items.push({ kind, count: 1 });
  return [...items];
}

function isWeapon(kind: PickupKind): kind is WeaponKind {
  return kind === 'knife' || kind === 'club' || kind === 'sabre' || kind === 'rifle';
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
  if (phase === 'dawn') return 'Dawn';
  if (phase === 'day') return 'Day';
  if (phase === 'dusk') return 'Dusk';
  return 'Night';
}

function walkModeLabel(mode: WalkMode) {
  if (mode === 'sneak') return 'Silent';
  if (mode === 'sprint') return 'Sprint';
  if (mode === 'tired') return 'Tired';
  return 'Walk';
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

function heldItemColor(kind: PickupKind) {
  if (isWeapon(kind)) return WEAPONS[kind].color;
  if (kind === 'medkit') return 0xf4f1e8;
  if (kind === 'crystal') return 0x79e6ff;
  if (kind === 'key') return 0xffc857;
  return 0xd2b48c;
}

function heldItemScale(kind: PickupKind) {
  if (kind === 'rifle') return { x: 1, y: 1, z: 1.55 };
  if (kind === 'sabre') return { x: 0.72, y: 0.8, z: 1.25 };
  if (kind === 'club') return { x: 1.15, y: 1.15, z: 1 };
  if (kind === 'medkit') return { x: 2.5, y: 2.1, z: 0.34 };
  if (kind === 'crystal') return { x: 1.4, y: 1.4, z: 0.52 };
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

export function QasqyrGame({ onExit }: { onExit?: () => void }) {
  const mountRef = useRef<HTMLDivElement>(null);
  const keysRef = useRef(new Set<string>());
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
  const keyRef = useRef<QuestItem>(randomQuestPoint());
  const codeRef = useRef<QuestItem>(randomQuestPoint());
  const hpRef = useRef(100);
  const scoreRef = useRef(0);
  const dayTimeRef = useRef(0.24);
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
  const [vision, setVision] = useState<VisionKind>('');
  const [ending, setEnding] = useState('');
  const [taunt, setTaunt] = useState('');
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [jumpscare, setJumpscare] = useState(false);
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
    keyNav: questNav(playerRef.current, keyRef.current),
    codeNav: questNav(playerRef.current, codeRef.current),
    inventory: [] as InventoryEntry[],
    hint: hintRef.current,
  });

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
    const balance = DIFFICULTY[difficultyRef.current];

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x9fb7c9);
    scene.fog = new THREE.Fog(0x9fb7c9, 55, 410);

    const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 900);
    const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.92;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
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

    const hemi = new THREE.HemisphereLight(0xd7e8ff, 0x3a432d, 0.74);
    scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xffd09a, 4.35);
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
    const rimLight = new THREE.DirectionalLight(0x8ccfff, 0.95);
    rimLight.position.set(38, 26, -42);
    scene.add(rimLight);

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

    const path = new THREE.Mesh(
      new THREE.PlaneGeometry(22, START_Z - FINISH_Z + 80),
      new THREE.MeshStandardMaterial({ color: 0x6d7440, roughness: 0.96 }),
    );
    path.rotation.x = -Math.PI / 2;
    path.position.set(0, 0.02, (START_Z + FINISH_Z) / 2 - 10);
    scene.add(path);

    const dustMat = new THREE.MeshStandardMaterial({ color: 0x8a7a4c, roughness: 0.98 });
    for (let i = 0; i < 18; i++) {
      const patch = new THREE.Mesh(new THREE.CircleGeometry(randomRange(4, 11), 18), dustMat);
      patch.rotation.x = -Math.PI / 2;
      patch.position.set(randomRange(-WORLD_HALF + 18, WORLD_HALF - 18), 0.035, randomRange(FINISH_Z + 35, START_Z - 20));
      patch.scale.x = randomRange(1.0, 2.4);
      patch.scale.y = randomRange(0.55, 1.2);
      patch.rotation.z = randomRange(0, Math.PI);
      scene.add(patch);
    }

    const grassMat = new THREE.MeshStandardMaterial({ color: 0x4d5e36, roughness: 0.95 });
    const strawMat = new THREE.MeshStandardMaterial({ color: 0xb0a35a, roughness: 0.98 });
    for (let i = 0; i < 280; i++) {
      const tuft = new THREE.Mesh(new THREE.ConeGeometry(0.18 + (i % 3) * 0.08, 0.9 + (i % 5) * 0.24, 5), i % 4 === 0 ? strawMat : grassMat);
      tuft.position.set(randomRange(-WORLD_HALF, WORLD_HALF), 0.6, randomRange(FINISH_Z + 20, START_Z + 4));
      tuft.rotation.y = i * 0.71;
      tuft.castShadow = true;
      scene.add(tuft);
    }

    for (let i = 0; i < 38; i++) {
      placeScenery(scene, makeRockCluster(), randomRange(-WORLD_HALF + 8, WORLD_HALF - 8), randomRange(FINISH_Z + 28, START_Z - 18), randomRange(0.7, 1.8));
    }
    for (let i = 0; i < 24; i++) {
      placeScenery(scene, makeDryTree(), randomRange(-WORLD_HALF + 12, WORLD_HALF - 12), randomRange(FINISH_Z + 42, START_Z - 28), randomRange(0.75, 1.4));
    }
    for (let i = 0; i < 9; i++) {
      placeScenery(scene, makeRuin(), randomRange(-WORLD_HALF + 28, WORLD_HALF - 28), randomRange(FINISH_Z + 70, START_Z - 60), randomRange(0.7, 1.35));
    }
    for (let i = 0; i < 7; i++) {
      placeScenery(scene, makeCampDebris(), randomRange(-WORLD_HALF + 24, WORLD_HALF - 24), randomRange(FINISH_Z + 55, START_Z - 50), randomRange(0.8, 1.3));
    }

    const physicsObstacles: PhysicsObstacle[] = [];
    const npcFigures: { npc: HouseNpc; mesh: THREE.Group; animator?: CharacterAnimator }[] = [];
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
      scene.add(house);
      addObstacle({ key: `house-${npc.id}`, x: npc.x, z: npc.z, radius: 5.2, kind: 'solid' });

      const figure = makeNpcFigure(npc.mood);
      figure.position.set(npc.x, 0, npc.z - 4.8);
      scene.add(figure);
      npcFigures.push({ npc, mesh: figure });
    }

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
    const blade = new THREE.Mesh(
      new THREE.BoxGeometry(0.16, 0.15, 2.15),
      new THREE.MeshStandardMaterial({ color: WEAPONS.knife.color, metalness: 0.35, roughness: 0.22 }),
    );
    blade.position.set(0.82, 1.45, -0.8);
    player.add(playerBody, shirtFront, playerHead, hair, nose, leftEye, rightEye, mouth, hat, belt, pack, scarf, hloodAura, blade);
    scene.add(player);
    const gltfLoader = new GLTFLoader();
    const assetMixers: THREE.AnimationMixer[] = [];
    const outfitTemplates: Partial<Record<OutfitKind, THREE.Group>> = {};
    const medievalPropTemplates: Partial<Record<MedievalPropKind, THREE.Group>> = {};
    let outfitModel: THREE.Group | null = null;
    let animationClips: THREE.AnimationClip[] = [];
    let playerAnimator: CharacterAnimator | null = null;
    let animationGuide: THREE.Group | null = null;
    let stopped = false;

    const attachPlayerAnimator = () => {
      if (!outfitModel || playerAnimator || animationClips.length === 0) return;
      playerAnimator = createCharacterAnimator(outfitModel, animationClips);
      if (playerAnimator) {
        assetMixers.push(playerAnimator.mixer);
        playCharacterAnimation(playerAnimator, 'idle', 0);
      }
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
      if (!template) return { mesh: makeEnemy(), animator: undefined };

      const mesh = new THREE.Group();
      const outfit = makeOutfitInstance(template, 'enemy');
      outfit.position.set(0, -0.08, 0.04);
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
      if (!template) return { mesh: makeNpcFigure(npc.mood), animator: undefined };
      const mesh = new THREE.Group();
      const outfit = makeOutfitInstance(template, 'npc');
      outfit.position.set(0, -0.08, 0.04);
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
    const addMedievalProp = (kind: MedievalPropKind, x: number, z: number, scale: number, rotation = 0) => {
      const template = medievalPropTemplates[kind];
      if (!template) return;
      const prop = makeAssetInstance(template);
      prop.position.set(x, terrainHeightAt(x, z), z);
      prop.rotation.y = rotation;
      prop.scale.setScalar(scale);
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
        if (kind === 'roundDoor') addMedievalProp(kind, npc.x, npc.z - 3.82, 1.1, npc.x < 0 ? -0.28 : 0.28);
        if (kind === 'roundRoof' && npc.id % 2 === 1) addMedievalProp(kind, npc.x, npc.z, 1.15, Math.PI / 2 + (npc.x < 0 ? -0.28 : 0.28));
        if (kind === 'vine' && npc.mood !== 'evil') addMedievalProp(kind, npc.x + side * 3.8, npc.z - 3.95, 1.5, side * 0.2);
      }

      for (const fake of fakeFortressesRef.current) {
        if (kind === 'metalFence') {
          addMedievalProp(kind, fake.x - 8, fake.z + 7, 1.8, Math.PI / 2);
          addMedievalProp(kind, fake.x + 8, fake.z + 7, 1.8, Math.PI / 2);
        }
        if (kind === 'crate') addMedievalProp(kind, fake.x + 5, fake.z + 5, 1.1, fake.id * 0.4);
      }
    };

    for (const [kind, url] of Object.entries(OUTFIT_URLS) as [OutfitKind, string][]) {
      gltfLoader.load(
        url,
        (gltf) => {
          if (stopped) return;
          const template = gltf.scene;
          fitAssetHeight(template, 3.05);
          enableAssetShadows(template);
          outfitTemplates[kind] = template;

          if (kind === 'maleRanger' && !outfitModel) {
            outfitModel = makeOutfitInstance(template, 'player');
            outfitModel.position.set(0, -0.08, 0.04);
            outfitModel.rotation.y = Math.PI;
            player.add(outfitModel);
            attachPlayerAnimator();

            for (const part of player.children) {
              if (part !== outfitModel && part !== hloodAura && part !== blade) part.visible = false;
            }
          }

          replaceFallbackEnemies();
          replaceFallbackNpcs();
        },
        undefined,
        () => {
          hintRef.current = 'Не удалось загрузить один из fantasy outfit ассетов. Игра использует fallback-модель.';
          setHud((h) => ({ ...h, hint: hintRef.current }));
        },
      );
    }

    for (const [kind, url] of Object.entries(MEDIEVAL_PROP_URLS) as [MedievalPropKind, string][]) {
      gltfLoader.load(
        url,
        (gltf) => {
          if (stopped) return;
          const template = gltf.scene;
          enableAssetShadows(template);
          medievalPropTemplates[kind] = template;
          placeMedievalDecor(kind);
        },
        undefined,
        () => {
          hintRef.current = 'Не удалось загрузить часть Medieval Village декора.';
          setHud((h) => ({ ...h, hint: hintRef.current }));
        },
      );
    }

    gltfLoader.load(
      ANIMATION_LIBRARY_URL,
      (gltf) => {
        if (stopped) return;
        animationClips = gltf.animations;
        attachPlayerAnimator();
        replaceFallbackEnemies();
        animationGuide = gltf.scene;
        animationGuide.name = 'Universal Animation Library Guide';
        fitAssetHeight(animationGuide, 2.95);
        enableAssetShadows(animationGuide);
        scene.add(animationGuide);
        animationGuide.visible = false;

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
      undefined,
      () => {
        hintRef.current = 'РќРµ СѓРґР°Р»РѕСЃСЊ Р·Р°РіСЂСѓР·РёС‚СЊ Universal Animation Library.';
        setHud((h) => ({ ...h, hint: hintRef.current }));
      },
    );
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
    for (let i = 0; i < 22; i++) addEnemy(false);

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

    void useMedkit;

    const keyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
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
      const key = e.key.toLowerCase();
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
    const pointerDown = () => attack();

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
      }

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
      const heldScale = heldItemScale(heldItemRef.current);
      blade.scale.set(heldScale.x, heldScale.y, heldScale.z);
      const bladeMat = blade.material;
      if (bladeMat instanceof THREE.MeshStandardMaterial) bladeMat.color.setHex(heldItemColor(heldItemRef.current));
      const heldWeapon = isWeapon(heldItemRef.current) ? WEAPONS[heldItemRef.current] : null;
      blade.rotation.x = heldWeapon && attackCdRef.current > heldWeapon.cooldown * 0.55 ? -0.9 : -0.25;

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
      const dayAngle = dayTimeRef.current * Math.PI * 2 - Math.PI * 0.5;
      const sunLift = Math.max(0, Math.sin(dayAngle));
      const moonLift = Math.max(0, -Math.sin(dayAngle));
      const daylight = clamp(0.12 + sunLift * 0.88, 0.12, 1);
      renderer.toneMappingExposure = inHloddev ? 0.86 : 0.58 + daylight * 0.5;
      hemi.intensity = inHloddev ? 0.72 : 0.22 + daylight * 0.72;
      sun.intensity = inHloddev ? 2.7 : 0.45 + daylight * 4.3;
      rimLight.intensity = inHloddev ? 1.05 : 0.42 + moonLift * 1.15;
      const fogColor = activeVision === 'bloodmoon'
        ? 0x6f2428
        : activeVision === 'echo'
          ? 0x9fd7bd
          : activeVision === 'whiteout'
            ? 0xe8edf0
            : inHloddev ? 0x86dff2 : dayPhase === 'night' ? 0x182238 : dayPhase === 'dusk' ? 0x8e6b63 : dayPhase === 'dawn' ? 0xb08f76 : 0x9fb7c9;
      scene.background = new THREE.Color(fogColor);
      scene.fog = new THREE.Fog(
        fogColor,
        activeVision === 'whiteout' ? 8 : inHloddev ? 12 : activeEvent === 'storm' ? 20 : 42,
        activeVision === 'bloodmoon' ? 150 : activeVision === 'echo' ? 118 : activeVision === 'whiteout' ? 70 : inHloddev ? 92 : activeEvent === 'storm' ? 82 : 245,
      );
      const shaderTime = performance.now() * 0.001;
      for (const material of shaderMaterials) {
        if (material.uniforms.uTime) material.uniforms.uTime.value = shaderTime;
        if (material.uniforms.uFogColor) material.uniforms.uFogColor.value.setHex(fogColor);
        if (material.uniforms.uMix) material.uniforms.uMix.value = activeVision ? 0.48 : inHloddev ? 0.62 : activeEvent === 'storm' ? 0.28 : 0.04;
        if (material.uniforms.uFogNear) material.uniforms.uFogNear.value = activeVision === 'whiteout' ? 18 : inHloddev ? 40 : activeEvent === 'storm' ? 35 : 120;
        if (material.uniforms.uFogFar) material.uniforms.uFogFar.value = activeVision ? 120 : inHloddev ? 130 : activeEvent === 'storm' ? 125 : 380;
      }

      const cameraTarget = playerRef.current.clone();
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
      const shoulder = inHloddev ? 1.45 : 1.15;
      const cameraDistance = inHloddev ? 11.5 : activeEvent === 'storm' ? 12.5 : 13.8;
      const cameraHeight = inHloddev ? 6.7 : activeEvent === 'storm' ? 6.4 : 7.4;
      const desiredCamera = cameraTarget
        .clone()
        .addScaledVector(followForward, -cameraDistance - speedSway * 1.35)
        .addScaledVector(followRight, shoulder)
        .add(new THREE.Vector3(0, cameraHeight + camBob, 0));
      camera.position.lerp(
        desiredCamera,
        clamp(dt * 5.2, 0.04, 0.16),
      );
      const lookAhead = cameraTarget.clone().addScaledVector(followForward, 7.2 + speedSway * 3.2);
      camera.lookAt(lookAhead.x, lookAhead.y + 1.6 + cameraPitch * 5.6, lookAhead.z);

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
      renderer.dispose();
      mount.innerHTML = '';
    };
  }, [phase, onExit]);

  const start = () => {
    reset();
    setPhase('playing');
  };

  const exit = () => {
    setPhase('intro');
    onExit?.();
  };

  const handleDialogChoice = (choice: NpcChoice) => {
    if (dialog && dialog.step < 2) {
      storyFlagsRef.current.lore += 1;
      scoreRef.current += 3;
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
    if (choice.effect === 'heal') {
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

    if (activeNpcId !== undefined) {
      const npc = houseNpcsRef.current.find((item) => item.id === activeNpcId);
      if (npc) npc.visited = true;
    }
    if (choice.effect !== 'ambush') exitHouseBurstRef.current = 4 + Math.floor(Math.random() * 5);
    insideHouseRef.current = null;
    hintRef.current = choice.reply;
    setTaunt(choice.reply);
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
      hint: hintRef.current,
    }));
  };

  return (
    <div style={styles.root}>
      {phase === 'playing' && <div ref={mountRef} style={styles.mount} />}
      {phase === 'won' && <ZombieCongratsPhoto score={hud.score} />}

      <button type="button" onClick={exit} style={styles.exit}>Выйти</button>

      {phase === 'playing' && (
        <>
          <div style={styles.hud}>
            <div style={styles.stat}><b>HP</b><span>{hud.hp}</span></div>
            <div style={styles.stat}><b>Time</b><span>{hud.timeOfDay}</span></div>
            <div style={styles.stat}><b>Move</b><span>{hud.walkMode}</span></div>
            <div style={styles.stat}><b>Stamina</b><span>{hud.stamina}</span></div>
            <div style={styles.stat}><b>Difficulty</b><span>{hud.difficulty}</span></div>
            <div style={styles.stat}><b>Story</b><span>{hud.story}</span></div>
            <div style={styles.stat}><b>Очки</b><span>{hud.score}</span></div>
            <div style={styles.stat}><b>Оружие</b><span>{hud.weapon}</span></div>
            <div style={styles.stat}><b>Измерение</b><span>{hud.dimensionLeft > 0 ? `${hud.dimension} ${hud.dimensionLeft}с` : hud.dimension}</span></div>
            <div style={styles.stat}><b>Space</b><span>{hud.teleport > 0 ? `${hud.teleport}с` : 'Хлоддев'}</span></div>
            <div style={styles.stat}><b>{hud.event || 'Ивент'}</b><span>{hud.event ? `${hud.eventLeft}с` : `${hud.nextEvent}с`}</span></div>
            <div style={styles.hint}>{hud.hint}</div>
          </div>

          <div style={styles.questPanel}>
            <QuestArrow label="Ключ" done={hud.hasKey} nav={hud.keyNav} />
            <QuestArrow label="Код" done={hud.hasCode} nav={hud.codeNav} />
            <div style={styles.fortressDistance}>Крепость: {hud.distance}% пути</div>
          </div>

          <InventoryPanel items={hud.inventory} selectedSlot={hud.selectedSlot} />

          {taunt && <div style={styles.taunt}>{taunt}</div>}
          {dialog && <DialogPanel dialog={dialog} onChoose={handleDialogChoice} />}
          {jumpscare && <ZombieScreamer />}
          {vision && <div style={{ ...styles.vision, ...(vision === 'bloodmoon' ? styles.visionBlood : vision === 'echo' ? styles.visionEcho : styles.visionWhite) }} />}
        </>
      )}

      {phase !== 'playing' && (
        <section style={styles.panel}>
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
            <div style={styles.difficultyGrid}>
              {(['story', 'survival', 'nightmare'] as Difficulty[]).map((level) => (
                <button
                  key={level}
                  type="button"
                  onClick={() => setDifficulty(level)}
                  style={difficulty === level ? styles.difficultySelected : styles.difficultyButton}
                >
                  {DIFFICULTY[level].label}
                </button>
              ))}
            </div>
          )}
          <div style={styles.controls}>WASD - движение · мышь - прицел · клик - удар · Space - Хлоддев · Esc - выход</div>
          <button type="button" onClick={start} style={styles.play}>
            {phase === 'intro' ? 'Играть' : 'Еще раз'}
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
  mount: { position: 'absolute', inset: 0 },
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
    width: 'min(560px, calc(100vw - 32px))',
    border: '1px solid rgba(255,255,255,.18)',
    background: 'linear-gradient(180deg, rgba(21,27,33,.96), rgba(12,15,18,.96))',
    borderRadius: 8,
    padding: 28,
    boxShadow: '0 24px 90px rgba(0,0,0,.55)',
    textAlign: 'center',
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
  difficultyGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
    gap: 8,
    margin: '0 0 18px',
  },
  difficultyButton: {
    border: '1px solid rgba(255,255,255,.18)',
    borderRadius: 8,
    padding: '10px 8px',
    background: 'rgba(255,255,255,.06)',
    color: '#d8d1c3',
    fontWeight: 900,
  },
  difficultySelected: {
    border: '1px solid rgba(255,211,77,.72)',
    borderRadius: 8,
    padding: '10px 8px',
    background: 'rgba(255,211,77,.18)',
    color: '#ffd37b',
    fontWeight: 1000,
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
};
