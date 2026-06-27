import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

type PipePair = {
  group: THREE.Group;
  x: number;
  gapY: number;
  passed: boolean;
};

const WORLD_SPEED = 7.6;
const GRAVITY = -18;
const FLAP_FORCE = 7.4;
const PIPE_SPACING = 7.4;
const PIPE_RADIUS = 0.58;
const GAP_SIZE = 3.25;
const BIRD_RADIUS = 0.42;

export function Flappy3DGame() {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(() => Number(window.localStorage.getItem('flappy3d-best') ?? 0));
  const [state, setState] = useState<'ready' | 'playing' | 'gameover'>('ready');
  const scoreRef = useRef(0);
  const stateRef = useRef<'ready' | 'playing' | 'gameover'>('ready');
  const restartRef = useRef<() => void>(() => undefined);
  const flapRef = useRef<() => void>(() => undefined);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return undefined;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x8ee7ff);
    scene.fog = new THREE.Fog(0x8ee7ff, 16, 38);

    const camera = new THREE.PerspectiveCamera(44, 1, 0.1, 80);
    camera.position.set(0, 2.8, 11);
    camera.lookAt(0, 1.2, 0);

    const sun = new THREE.DirectionalLight(0xffffff, 3.4);
    sun.position.set(-3, 8, 6);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    scene.add(sun);
    scene.add(new THREE.HemisphereLight(0xd9fbff, 0x49a340, 2.4));

    const bird = makeBird();
    bird.position.set(-2.8, 1.25, 0);
    scene.add(bird);

    const floor = makeFloor();
    scene.add(floor);
    const sky = makeSkyDetails();
    scene.add(sky);

    const pipes: PipePair[] = [];
    let velocity = 0;
    let frame = 0;
    let lastTime = performance.now();

    const spawnPipe = (x: number) => {
      const gapY = THREE.MathUtils.randFloat(-0.7, 1.75);
      const group = makePipePair(gapY);
      group.position.x = x;
      scene.add(group);
      pipes.push({ group, x, gapY, passed: false });
    };

    const reset = () => {
      pipes.splice(0).forEach((pipe) => scene.remove(pipe.group));
      for (let i = 0; i < 5; i++) spawnPipe(4.8 + i * PIPE_SPACING);
      bird.position.set(-2.8, 1.25, 0);
      bird.rotation.set(0, 0, 0);
      velocity = 0;
      scoreRef.current = 0;
      setScore(0);
      setState('ready');
      stateRef.current = 'ready';
    };

    const flap = () => {
      if (stateRef.current === 'gameover') {
        reset();
      }
      if (stateRef.current === 'ready') {
        setState('playing');
        stateRef.current = 'playing';
      }
      velocity = FLAP_FORCE;
    };

    restartRef.current = reset;
    flapRef.current = flap;
    reset();

    const endGame = () => {
      if (stateRef.current === 'gameover') return;
      setState('gameover');
      stateRef.current = 'gameover';
      setBest((current) => {
        const next = Math.max(current, scoreRef.current);
        window.localStorage.setItem('flappy3d-best', String(next));
        return next;
      });
    };

    const resize = () => {
      const rect = mount.getBoundingClientRect();
      const width = Math.max(1, Math.round(rect.width));
      const height = Math.max(1, Math.round(rect.height));
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };

    const tick = (now: number) => {
      const dt = Math.min(0.033, (now - lastTime) / 1000);
      lastTime = now;

      if (stateRef.current === 'playing') {
        velocity += GRAVITY * dt;
        bird.position.y += velocity * dt;
        bird.rotation.z = THREE.MathUtils.clamp(velocity / 9, -0.75, 0.55);
        bird.rotation.x = Math.sin(now * 0.018) * 0.05;

        for (const pipe of pipes) {
          pipe.x -= WORLD_SPEED * dt;
          pipe.group.position.x = pipe.x;
          if (!pipe.passed && pipe.x < bird.position.x) {
            pipe.passed = true;
            scoreRef.current += 1;
            setScore(scoreRef.current);
          }
        }

        if (pipes[0]?.x < -10.5) {
          const old = pipes.shift();
          if (old) scene.remove(old.group);
          spawnPipe(pipes[pipes.length - 1].x + PIPE_SPACING);
        }

        const hitPipe = pipes.some((pipe) => {
          const dx = Math.abs(pipe.x - bird.position.x);
          const outsideGap = bird.position.y + BIRD_RADIUS > pipe.gapY + GAP_SIZE / 2 || bird.position.y - BIRD_RADIUS < pipe.gapY - GAP_SIZE / 2;
          return dx < PIPE_RADIUS + BIRD_RADIUS * 0.72 && outsideGap;
        });

        if (hitPipe || bird.position.y < -2.45 || bird.position.y > 5.7) {
          endGame();
        }
      } else {
        bird.position.y = 1.25 + Math.sin(now * 0.004) * 0.22;
        bird.rotation.z = Math.sin(now * 0.004) * 0.1;
      }

      sky.children.forEach((child, index) => {
        child.position.x -= dt * (0.7 + index * 0.05);
        if (child.position.x < -16) child.position.x = 18;
      });
      floor.position.x = ((now * 0.001 * -WORLD_SPEED) % 2.4);

      frame = window.requestAnimationFrame(tick);
      renderer.render(scene, camera);
    };

    resize();
    window.addEventListener('resize', resize);
    window.addEventListener('keydown', handleKey);
    frame = window.requestAnimationFrame(tick);

    function handleKey(event: KeyboardEvent) {
      if (event.code === 'Space' || event.code === 'ArrowUp' || event.code === 'KeyW') {
        event.preventDefault();
        flapRef.current();
      }
      if (event.code === 'KeyR') {
        restartRef.current();
      }
    }

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('resize', resize);
      window.removeEventListener('keydown', handleKey);
      scene.traverse((object) => {
        const mesh = object as THREE.Mesh;
        mesh.geometry?.dispose();
        const material = mesh.material;
        if (Array.isArray(material)) {
          material.forEach((item) => item.dispose());
        } else {
          material?.dispose();
        }
      });
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  return (
    <main className="flappy3d-shell" onPointerDown={() => flapRef.current()}>
      <div ref={mountRef} className="flappy3d-canvas" />
      <section className="flappy3d-hud" aria-live="polite">
        <div>
          <span>Score</span>
          <b>{score}</b>
        </div>
        <div>
          <span>Best</span>
          <b>{best}</b>
        </div>
      </section>
      <section className={`flappy3d-panel ${state === 'playing' ? 'is-hidden' : ''}`}>
        <p>FLAPPY 3D</p>
        <h1>{state === 'gameover' ? 'Game over' : 'Tap to fly'}</h1>
        <button
          type="button"
          onPointerDown={(event) => {
            event.stopPropagation();
            flapRef.current();
          }}
        >
          {state === 'gameover' ? 'Restart' : 'Play'}
        </button>
      </section>
      <style>{`
        .flappy3d-shell {
          position: fixed;
          inset: 0;
          overflow: hidden;
          background: #7de6ff;
          color: #103342;
          font-family: Inter, system-ui, sans-serif;
          touch-action: manipulation;
          user-select: none;
        }

        .flappy3d-canvas,
        .flappy3d-canvas canvas {
          width: 100%;
          height: 100%;
          display: block;
        }

        .flappy3d-hud {
          position: fixed;
          left: 18px;
          top: 18px;
          z-index: 2;
          display: flex;
          gap: 10px;
        }

        .flappy3d-hud div,
        .flappy3d-panel {
          border: 1px solid rgba(255,255,255,.58);
          border-radius: 8px;
          background: rgba(255, 255, 255, .74);
          box-shadow: 0 14px 36px rgba(17, 73, 79, .18);
          backdrop-filter: blur(12px);
        }

        .flappy3d-hud div {
          min-width: 92px;
          display: grid;
          gap: 2px;
          padding: 10px 12px;
        }

        .flappy3d-hud span,
        .flappy3d-panel p {
          font-size: 12px;
          font-weight: 950;
          letter-spacing: 1.8px;
          text-transform: uppercase;
          color: #20745f;
        }

        .flappy3d-hud b {
          font-size: 28px;
          line-height: 1;
        }

        .flappy3d-panel {
          position: fixed;
          left: 50%;
          top: 50%;
          z-index: 3;
          width: min(420px, calc(100vw - 34px));
          transform: translate(-50%, -50%);
          display: grid;
          justify-items: center;
          gap: 12px;
          padding: 24px;
          text-align: center;
          transition: opacity .18s ease, transform .18s ease;
        }

        .flappy3d-panel.is-hidden {
          opacity: 0;
          pointer-events: none;
          transform: translate(-50%, -48%);
        }

        .flappy3d-panel p,
        .flappy3d-panel h1 {
          margin: 0;
        }

        .flappy3d-panel h1 {
          font-size: clamp(42px, 7vw, 74px);
          line-height: .92;
          color: #123846;
        }

        .flappy3d-panel button {
          min-height: 46px;
          padding: 0 28px;
          border: 1px solid rgba(15, 89, 57, .34);
          border-radius: 8px;
          background: #51d877;
          color: #103342;
          font: inherit;
          font-weight: 950;
          cursor: pointer;
          box-shadow: inset 0 -4px 0 rgba(0,0,0,.12);
        }

        @media (max-width: 720px) {
          .flappy3d-hud {
            left: 12px;
            top: 12px;
          }

          .flappy3d-hud div {
            min-width: 74px;
            padding: 8px 10px;
          }
        }
      `}</style>
    </main>
  );
}

function makeBird() {
  const group = new THREE.Group();
  const bodyMaterial = new THREE.MeshStandardMaterial({ color: 0xffdf3d, roughness: 0.52, metalness: 0.03 });
  const wingMaterial = new THREE.MeshStandardMaterial({ color: 0xfff08a, roughness: 0.45 });
  const beakMaterial = new THREE.MeshStandardMaterial({ color: 0xf05a2a, roughness: 0.46 });
  const white = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.38 });
  const black = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.4 });

  const body = new THREE.Mesh(new THREE.SphereGeometry(0.48, 32, 24), bodyMaterial);
  body.scale.set(1.14, 0.9, 0.86);
  body.castShadow = true;
  group.add(body);

  const wing = new THREE.Mesh(new THREE.SphereGeometry(0.28, 20, 16), wingMaterial);
  wing.position.set(-0.22, -0.08, 0.43);
  wing.scale.set(1.25, 0.48, 0.2);
  wing.castShadow = true;
  group.add(wing);

  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.58, 4), beakMaterial);
  beak.position.set(0.54, -0.02, 0);
  beak.rotation.z = -Math.PI / 2;
  beak.scale.set(0.8, 1.2, 0.8);
  beak.castShadow = true;
  group.add(beak);

  for (const z of [-0.22, 0.22]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.14, 20, 16), white);
    eye.position.set(0.28, 0.27, z);
    group.add(eye);
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.052, 12, 10), black);
    pupil.position.set(0.36, 0.25, z);
    group.add(pupil);
  }

  return group;
}

function makePipePair(gapY: number) {
  const group = new THREE.Group();
  const pipeMaterial = new THREE.MeshStandardMaterial({ color: 0x34c747, roughness: 0.34, metalness: 0.02 });
  const rimMaterial = new THREE.MeshStandardMaterial({ color: 0x76ec54, roughness: 0.3 });
  const pipeHeight = 9;

  const makePipe = (y: number, flip = false) => {
    const pipe = new THREE.Mesh(new THREE.CylinderGeometry(PIPE_RADIUS, PIPE_RADIUS, pipeHeight, 32), pipeMaterial);
    pipe.position.y = y;
    pipe.castShadow = true;
    pipe.receiveShadow = true;
    group.add(pipe);

    const rim = new THREE.Mesh(new THREE.CylinderGeometry(PIPE_RADIUS * 1.22, PIPE_RADIUS * 1.22, 0.44, 32), rimMaterial);
    rim.position.y = flip ? y - pipeHeight / 2 : y + pipeHeight / 2;
    rim.castShadow = true;
    rim.receiveShadow = true;
    group.add(rim);
  };

  makePipe(gapY + GAP_SIZE / 2 + pipeHeight / 2);
  makePipe(gapY - GAP_SIZE / 2 - pipeHeight / 2, true);
  return group;
}

function makeFloor() {
  const group = new THREE.Group();
  const grass = new THREE.Mesh(
    new THREE.BoxGeometry(34, 0.42, 10),
    new THREE.MeshStandardMaterial({ color: 0x47c952, roughness: 0.72 }),
  );
  grass.position.set(0, -3, 0);
  grass.receiveShadow = true;
  group.add(grass);

  const stripeMaterial = new THREE.MeshStandardMaterial({ color: 0x2ea849, roughness: 0.8 });
  for (let i = -8; i <= 8; i++) {
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.04, 10.1), stripeMaterial);
    stripe.position.set(i * 2.4, -2.76, 0);
    group.add(stripe);
  }
  return group;
}

function makeSkyDetails() {
  const group = new THREE.Group();
  const cloudMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.86 });
  const hillMaterial = new THREE.MeshStandardMaterial({ color: 0x67c981, roughness: 0.82 });

  for (let i = 0; i < 7; i++) {
    const cloud = new THREE.Group();
    for (let j = 0; j < 4; j++) {
      const puff = new THREE.Mesh(new THREE.SphereGeometry(0.34 + j * 0.04, 16, 12), cloudMaterial);
      puff.position.set(j * 0.34, Math.sin(j) * 0.08, 0);
      cloud.add(puff);
    }
    cloud.position.set(-12 + i * 5.4, 3.6 + (i % 3) * 0.5, -5.7);
    cloud.scale.setScalar(0.9 + (i % 2) * 0.28);
    group.add(cloud);
  }

  for (let i = 0; i < 11; i++) {
    const hill = new THREE.Mesh(new THREE.ConeGeometry(1.2, 2.2 + (i % 3) * 0.5, 5), hillMaterial);
    hill.position.set(-14 + i * 2.8, -2.2, -7);
    hill.rotation.y = i * 0.7;
    group.add(hill);
  }

  return group;
}
