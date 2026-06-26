import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

type Slide = {
  id: number;
  label: string;
  content: JSX.Element;
};

type Feature = {
  title: string;
  text: string;
};

type GalleryShot = {
  title: string;
  src: string;
  text: string;
};

const APP_NAME = 'QASQYR 3D';
const MOBILE_GAME_URL = 'https://mensioned.vercel.app/mobile?v=graphics-20260624';
const GAMEPLAY_VIDEO_SRC = '/presentation/qasqyr-gameplay-cinematic.webm';
const GAMEPLAY_VIDEO_POSTER = '/presentation/qasqyr-gameplay-cinematic-poster.png';

const galleryShots: GalleryShot[] = [
  {
    title: 'Атмосфера мира',
    src: '/presentation/qasqyr-game-shot-01.png',
    text: 'Степь, вода, горы, деревня и опасные маршруты для выживания.',
  },
  {
    title: 'Сражение',
    src: '/presentation/qasqyr-game-shot-02.png',
    text: 'Игрок сражается с врагами и защищает путь вместе с AI-напарником.',
  },
  {
    title: 'Скины и прогресс',
    src: '/presentation/qasqyr-game-shot-03.png',
    text: 'Ножи, кейсы, золото, алмазы и визуальные награды за прохождение.',
  },
];

const features: Feature[] = [
  {
    title: '3D survival',
    text: 'Игрок исследует опасный мир, двигается по карте, сражается и ищет ресурсы.',
  },
  {
    title: 'AI-напарник',
    text: 'В игре есть история со спасением напарника и совместным прохождением.',
  },
  {
    title: 'Мобильная версия',
    text: 'Телефонная сборка легче по графике, чтобы запускалась стабильнее.',
  },
];

export function PresentationPage() {
  const [activeSlide, setActiveSlide] = useState(0);
  const [demoPlaying, setDemoPlaying] = useState(false);
  const mobileUrl = useMemo(() => MOBILE_GAME_URL, []);
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=360x360&margin=16&data=${encodeURIComponent(mobileUrl)}`;

  const slides: Slide[] = [
    {
      id: 1,
      label: 'Обложка',
      content: (
        <section className="porcelain-slide porcelain-hero">
          <div className="porcelain-landscape" />
          <div className="hero-copy">
            <p className="eyebrow">nFactorial Teens project</p>
            <h1>{APP_NAME}</h1>
            <p>Атмосферная 3D survival-игра про выживание, бой, скины и AI-напарника.</p>
          </div>
        </section>
      ),
    },
    {
      id: 2,
      label: 'О проекте',
      content: (
        <section className="porcelain-slide split-slide">
          <div className="soft-panel">
            <p className="eyebrow">Идея игры</p>
            <h2>Выжить в красивом, но опасном мире</h2>
            <p>
              QASQYR 3D соединяет исследование карты, сражения с зомби, сбор наград,
              магазин скинов и сюжет с AI-напарником. Игрок не просто смотрит на мир,
              а проходит испытания и развивается.
            </p>
          </div>
          <figure className="image-note">
            <img src="/presentation/qasqyr-generated-vista.png" alt="Атмосферный мир QASQYR 3D" />
            <figcaption>Мир игры: горы, вода, деревня и путь героя</figcaption>
          </figure>
        </section>
      ),
    },
    {
      id: 3,
      label: 'Содержание',
      content: (
        <section className="porcelain-slide contents-slide">
          <p className="eyebrow">Table of contents</p>
          <h2>Что есть в QASQYR 3D</h2>
          <div className="contents-list">
            {features.map((feature, index) => (
              <article key={feature.title} className="contents-row">
                <span>{index + 1}</span>
                <div>
                  <b>{feature.title}</b>
                  <p>{feature.text}</p>
                </div>
              </article>
            ))}
          </div>
        </section>
      ),
    },
    {
      id: 4,
      label: 'Визуал',
      content: (
        <section className="porcelain-slide gallery-slide">
          <div className="slide-heading">
            <p className="eyebrow">Visual world</p>
            <h2>Кадры игры</h2>
          </div>
          <div className="gallery-grid">
            {galleryShots.map((shot) => (
              <figure key={shot.title} className="gallery-card">
                <img src={shot.src} alt={shot.title} />
                <figcaption>
                  <b>{shot.title}</b>
                  <span>{shot.text}</span>
                </figcaption>
              </figure>
            ))}
          </div>
        </section>
      ),
    },
    {
      id: 5,
      label: 'Демо',
      content: (
        <section className="porcelain-slide demo-slide">
          <div className="demo-copy">
            <p className="eyebrow">Gameplay video</p>
            <h2>Видео с геймплеем</h2>
            <p>
              В ролике показан мир игры и легкий фрагмент реального геймплея:
              движение по карте, взаимодействие с окружением и атмосфера survival-проекта.
            </p>
          </div>
          <div className="video-frame">
            <video
              key={demoPlaying ? 'gameplay-playing' : 'gameplay-paused'}
              src={GAMEPLAY_VIDEO_SRC}
              poster={GAMEPLAY_VIDEO_POSTER}
              controls={false}
              autoPlay={demoPlaying}
              muted={!demoPlaying}
              loop
              playsInline
            />
            <div className="cinema-grade" />
            <ModelOverlay src="/models/outfits/fantasy/Male_Ranger.gltf" className="model-left" />
            <ModelOverlay src="/models/outfits/fantasy/Female_Ranger.gltf" className="model-right" />
            {!demoPlaying && (
              <button type="button" className="play-button" onClick={() => setDemoPlaying(true)} aria-label="Запустить видео">
                Play
              </button>
            )}
          </div>
        </section>
      ),
    },
    {
      id: 6,
      label: 'QR',
      content: (
        <section className="porcelain-slide qr-slide">
          <div className="soft-panel">
            <p className="eyebrow">Mobile link</p>
            <h2>Попробуй игру</h2>
            <p>
              Отсканируй QR-код и запусти мобильную версию QASQYR 3D. Она легче по графике,
              поэтому лучше подходит для телефона.
            </p>
            <a href={mobileUrl}>{mobileUrl}</a>
          </div>
          <div className="qr-box">
            <img src={qrUrl} alt="QR-код на мобильную версию QASQYR 3D" />
            <span>Ссылка ведет на мобильную версию игры</span>
          </div>
        </section>
      ),
    },
  ];

  const current = slides[activeSlide];

  return (
    <main className="presentation-shell">
      <PresentationStyles />
      <nav className="presentation-nav">
        <b>{APP_NAME}</b>
        <div className="nav-buttons">
          {slides.map((slide, index) => (
            <button
              key={slide.id}
              type="button"
              onClick={() => setActiveSlide(index)}
              className={index === activeSlide ? 'is-active' : ''}
              aria-label={`Слайд ${slide.id}: ${slide.label}`}
            >
              {slide.id}
            </button>
          ))}
        </div>
      </nav>

      <article className="deck">
        <div className="slide-meta">Slide {current.id} / {slides.length} · {current.label}</div>
        {current.content}
      </article>

      <footer className="presentation-footer">
        <button type="button" onClick={() => setActiveSlide((value) => Math.max(0, value - 1))}>
          Назад
        </button>
        <button type="button" className="primary" onClick={() => setActiveSlide((value) => Math.min(slides.length - 1, value + 1))}>
          Дальше
        </button>
      </footer>
    </main>
  );
}

function ModelOverlay({ src, className }: { src: string; className: string }) {
  const mountRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return undefined;

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 100);
    camera.position.set(0, 1.25, 4.6);

    scene.add(new THREE.HemisphereLight(0xdff6ff, 0x1f1711, 2.2));
    const keyLight = new THREE.DirectionalLight(0xffdf9a, 3.4);
    keyLight.position.set(2.8, 4.2, 3.2);
    scene.add(keyLight);
    const rimLight = new THREE.DirectionalLight(0x70d6ff, 2);
    rimLight.position.set(-3, 2.5, -2);
    scene.add(rimLight);

    const root = new THREE.Group();
    scene.add(root);

    const resize = () => {
      const rect = mount.getBoundingClientRect();
      const width = Math.max(1, Math.round(rect.width));
      const height = Math.max(1, Math.round(rect.height));
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };

    let frame = 0;
    let disposed = false;

    new GLTFLoader().load(src, (gltf) => {
      if (disposed) return;
      const model = gltf.scene;
      const box = new THREE.Box3().setFromObject(model);
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());
      const maxAxis = Math.max(size.x, size.y, size.z) || 1;
      model.position.sub(center);
      model.scale.setScalar(2.45 / maxAxis);
      model.rotation.y = -0.45;
      root.add(model);
    });

    const animate = () => {
      if (disposed) return;
      root.rotation.y += 0.006;
      renderer.render(scene, camera);
      frame = window.requestAnimationFrame(animate);
    };

    resize();
    animate();
    window.addEventListener('resize', resize);

    return () => {
      disposed = true;
      window.cancelAnimationFrame(frame);
      window.removeEventListener('resize', resize);
      root.traverse((object) => {
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
  }, [src]);

  return <div ref={mountRef} className={`model-stage ${className}`} aria-hidden="true" />;
}

function PresentationStyles() {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@500;700;900&family=Inter:wght@500;700;900&display=swap');

      .presentation-shell {
        min-height: 100vh;
        display: grid;
        grid-template-rows: auto 1fr auto;
        gap: 16px;
        padding: 22px;
        background: #171b21;
        color: #27313a;
        font-family: Inter, system-ui, sans-serif;
      }

      .presentation-shell button {
        min-height: 42px;
        border: 1px solid rgba(61, 86, 111, .28);
        border-radius: 8px;
        cursor: pointer;
        font: inherit;
        font-weight: 900;
      }

      .presentation-nav,
      .presentation-footer {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        color: #eef4f6;
      }

      .presentation-nav b {
        font-family: Cinzel, Georgia, serif;
        font-size: clamp(18px, 2vw, 28px);
      }

      .nav-buttons {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
        justify-content: flex-end;
      }

      .nav-buttons button {
        width: 42px;
        padding: 0;
        background: #eef1e4;
        color: #4a6175;
      }

      .nav-buttons button.is-active,
      .presentation-footer .primary {
        background: #6d8fb0;
        color: #fffaf0;
        border-color: rgba(255, 255, 255, .42);
      }

      .presentation-footer {
        justify-content: flex-end;
      }

      .presentation-footer button {
        padding: 0 18px;
        background: #eef1e4;
        color: #4a6175;
      }

      .deck {
        position: relative;
        min-height: 0;
        overflow: hidden;
        padding: clamp(14px, 2.2vw, 28px);
        border: 1px solid rgba(255, 255, 255, .18);
        border-radius: 8px;
        background:
          linear-gradient(180deg, rgba(255,255,255,.06), rgba(255,255,255,0)),
          #20252b;
        box-shadow: 0 30px 80px rgba(0, 0, 0, .32);
      }

      .slide-meta {
        position: relative;
        z-index: 3;
        margin-bottom: 12px;
        color: #d8e4ea;
        font-size: 13px;
        font-weight: 900;
        text-transform: uppercase;
      }

      .porcelain-slide {
        position: relative;
        min-height: min(68vh, 760px);
        overflow: hidden;
        border-radius: 8px;
        padding: clamp(24px, 5vw, 62px);
        background:
          radial-gradient(circle at 15% 18%, rgba(101, 138, 170, .2), transparent 22%),
          radial-gradient(circle at 88% 16%, rgba(101, 138, 170, .22), transparent 24%),
          linear-gradient(180deg, rgba(253, 248, 229, .94), rgba(242, 237, 217, .98));
        color: #27313a;
        box-shadow: inset 0 0 0 1px rgba(68, 91, 111, .2);
      }

      .porcelain-slide::before,
      .porcelain-slide::after {
        content: "";
        position: absolute;
        inset: 0;
        pointer-events: none;
      }

      .porcelain-slide::before {
        background:
          linear-gradient(180deg, rgba(255,255,255,.44), transparent 18%, transparent 76%, rgba(72,95,116,.18)),
          radial-gradient(circle at 10% 83%, rgba(78, 111, 145, .18), transparent 24%),
          radial-gradient(circle at 90% 82%, rgba(78, 111, 145, .2), transparent 26%);
      }

      .porcelain-slide::after {
        border: 16px solid rgba(53, 84, 112, .18);
        box-shadow: inset 0 0 0 1px rgba(255, 255, 255, .5);
      }

      .porcelain-landscape {
        position: absolute;
        inset: 0;
        opacity: .78;
        background:
          linear-gradient(rgba(246, 243, 224, .22), rgba(246, 243, 224, .38)),
          url('/presentation/qasqyr-generated-vista.png') center / cover;
        filter: grayscale(.62) sepia(.08) hue-rotate(168deg) saturate(.7) brightness(1.18);
      }

      .hero-copy,
      .soft-panel,
      .image-note,
      .contents-slide > *,
      .gallery-slide > *,
      .demo-slide > *,
      .qr-slide > * {
        position: relative;
        z-index: 2;
      }

      .porcelain-hero {
        display: grid;
        place-items: center;
        text-align: center;
      }

      .hero-copy {
        width: min(900px, 100%);
        padding: clamp(18px, 3vw, 34px);
        background: rgba(255, 255, 255, .2);
        backdrop-filter: blur(2px);
        border-radius: 8px;
      }

      .eyebrow {
        margin: 0 0 10px;
        color: #496d91;
        font-size: clamp(12px, 1.4vw, 16px);
        font-weight: 900;
        text-transform: uppercase;
      }

      h1,
      h2 {
        margin: 0;
        font-family: Cinzel, Georgia, serif;
        color: #25303a;
        text-shadow: 0 2px 0 rgba(255,255,255,.76), 0 10px 18px rgba(43,62,82,.16);
      }

      h1 {
        font-size: clamp(58px, 10vw, 134px);
        line-height: .9;
      }

      h2 {
        font-size: clamp(34px, 6vw, 76px);
        line-height: 1;
      }

      p {
        margin: 0;
      }

      .hero-copy p:last-child,
      .soft-panel p,
      .demo-copy p,
      .contents-row p {
        color: #3b4854;
        font-size: clamp(18px, 2.2vw, 28px);
        line-height: 1.35;
      }

      .split-slide,
      .demo-slide,
      .qr-slide {
        display: grid;
        grid-template-columns: minmax(0, .95fr) minmax(320px, 1.05fr);
        align-items: center;
        gap: clamp(20px, 4vw, 48px);
      }

      .soft-panel {
        display: grid;
        gap: 18px;
        padding: clamp(20px, 3.2vw, 42px);
        border-radius: 8px;
        background: rgba(255, 255, 255, .28);
        border: 1px solid rgba(67, 96, 124, .22);
      }

      .image-note,
      .gallery-card {
        margin: 0;
        overflow: hidden;
        border-radius: 8px;
        background: rgba(255, 255, 255, .34);
        border: 1px solid rgba(67, 96, 124, .24);
        box-shadow: 0 18px 36px rgba(76, 97, 115, .18);
      }

      .image-note img,
      .gallery-card img {
        width: 100%;
        height: 320px;
        object-fit: cover;
        display: block;
        filter: saturate(.82) contrast(.96) brightness(1.05);
      }

      .image-note figcaption,
      .gallery-card figcaption {
        display: grid;
        gap: 6px;
        padding: 14px 16px;
        color: #334554;
        font-weight: 700;
      }

      .image-note figcaption b,
      .gallery-card figcaption b,
      .contents-row b {
        font-family: Cinzel, Georgia, serif;
        font-size: 24px;
        color: #31475c;
      }

      .contents-slide {
        display: grid;
        align-content: center;
        gap: 22px;
      }

      .contents-list {
        display: grid;
        gap: 14px;
        max-width: 980px;
      }

      .contents-row {
        display: grid;
        grid-template-columns: 58px minmax(0, 1fr);
        gap: 16px;
        align-items: center;
        padding: 14px 18px;
        border-radius: 8px;
        background: linear-gradient(90deg, rgba(89, 125, 158, .24), rgba(255,255,255,.18));
        border: 1px solid rgba(67, 96, 124, .2);
      }

      .contents-row > span {
        width: 48px;
        height: 48px;
        display: grid;
        place-items: center;
        border-radius: 50%;
        background: #6f8fae;
        color: #fffaf0;
        font-weight: 900;
      }

      .gallery-slide {
        display: grid;
        align-content: center;
        gap: 22px;
      }

      .slide-heading {
        display: grid;
        gap: 8px;
      }

      .gallery-grid {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 16px;
      }

      .gallery-card img {
        height: 260px;
      }

      .gallery-card figcaption span {
        font-size: 15px;
        line-height: 1.35;
      }

      .demo-copy {
        display: grid;
        gap: 18px;
      }

      .video-frame {
        position: relative;
        overflow: hidden;
        aspect-ratio: 16 / 9;
        border-radius: 8px;
        border: 10px solid rgba(26, 42, 57, .42);
        background: #0d1218;
        box-shadow: 0 24px 58px rgba(15, 24, 31, .38), 0 0 0 1px rgba(255, 245, 205, .2);
      }

      .video-frame video {
        width: 100%;
        height: 100%;
        object-fit: cover;
        display: block;
      }

      .cinema-grade {
        position: absolute;
        inset: 0;
        z-index: 2;
        pointer-events: none;
        background:
          linear-gradient(180deg, rgba(0,0,0,.56) 0 9%, transparent 20% 78%, rgba(0,0,0,.62) 91% 100%),
          radial-gradient(circle at 18% 18%, rgba(112, 214, 255, .18), transparent 30%),
          radial-gradient(circle at 78% 26%, rgba(255, 211, 123, .2), transparent 24%),
          linear-gradient(90deg, rgba(4,9,13,.35), transparent 20% 74%, rgba(4,9,13,.42));
        mix-blend-mode: soft-light;
      }

      .model-stage {
        position: absolute;
        z-index: 3;
        bottom: -9%;
        width: 22%;
        height: 54%;
        pointer-events: none;
        filter: drop-shadow(0 18px 24px rgba(0,0,0,.46)) saturate(1.08);
      }

      .model-stage canvas {
        width: 100% !important;
        height: 100% !important;
        display: block;
      }

      .model-left {
        left: -3%;
      }

      .model-right {
        right: -2%;
        transform: scaleX(-1);
      }

      .play-button {
        position: absolute;
        z-index: 4;
        left: 50%;
        top: 50%;
        transform: translate(-50%, -50%);
        padding: 0 28px;
        background: rgba(245, 241, 222, .92);
        color: #3c5a76;
        box-shadow: 0 12px 28px rgba(0,0,0,.22);
      }

      .qr-box {
        display: grid;
        justify-items: center;
        gap: 12px;
        padding: 18px;
        border-radius: 8px;
        background: rgba(255, 255, 255, .5);
        border: 1px solid rgba(67, 96, 124, .22);
        color: #31475c;
        font-weight: 900;
        text-align: center;
      }

      .qr-box img {
        width: min(320px, 100%);
        aspect-ratio: 1 / 1;
        border-radius: 8px;
      }

      .qr-slide a {
        color: #426b91;
        font-weight: 900;
        word-break: break-all;
      }

      @media (max-width: 900px) {
        .presentation-shell {
          padding: 14px;
        }

        .presentation-nav,
        .presentation-footer {
          align-items: stretch;
        }

        .split-slide,
        .demo-slide,
        .qr-slide,
        .gallery-grid {
          grid-template-columns: 1fr;
        }

        .porcelain-slide {
          min-height: auto;
          padding: 22px;
        }

        .porcelain-slide::after {
          border-width: 10px;
        }

        .image-note img,
        .gallery-card img {
          height: 220px;
        }

        .model-stage {
          display: none;
        }

        h1 {
          font-size: clamp(46px, 14vw, 84px);
        }
      }
    `}</style>
  );
}
