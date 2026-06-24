import { useMemo, useState, type CSSProperties } from 'react';

type Slide = {
  id: number;
  label: string;
  content: JSX.Element;
};

type PromoShot = {
  title: string;
  src: string;
  caption: string;
};

const APP_NAME = 'QASQYR 3D';
const MOBILE_GAME_URL = 'https://mensioned.vercel.app/mobile';

const promoShots: PromoShot[] = [
  {
    title: 'Атмосфера мира',
    src: '/presentation/qasqyr-menu-3d.png',
    caption: 'Степь, вода, горы и средневековая деревня в 3D.',
  },
  {
    title: 'Скины и магазин',
    src: '/presentation/qasqyr-skins-3d.png',
    caption: 'Ножи, кейсы, золото и алмазы для прогресса.',
  },
  {
    title: 'Геймплей',
    src: '/presentation/qasqyr-gameplay-3d.png',
    caption: 'Игрок и AI-напарник проходят карту и сражаются с врагами.',
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
      label: 'Автор',
      content: (
        <section style={styles.heroSlide}>
          <p style={styles.kicker}>nFactorial Teens</p>
          <h1 style={styles.heroTitle}>Даубек Дайрабеков</h1>
          <p style={styles.heroText}>
            Маленький факт: я делаю 3D survival-игру с режимами, скинами, отзывами и AI-напарником.
          </p>
        </section>
      ),
    },
    {
      id: 2,
      label: 'Приложение',
      content: (
        <section style={styles.centerSlide}>
          <p style={styles.kicker}>Название апки</p>
          <h2 style={styles.title}>{APP_NAME}</h2>
          <p style={styles.bigSentence}>
            Это атмосферная 3D survival-игра, где игрок выбирает режим, исследует опасный мир,
            открывает скины и проходит испытания вместе с AI-напарником.
          </p>
        </section>
      ),
    },
    {
      id: 3,
      label: 'Скриншоты',
      content: (
        <section style={styles.gallerySlide}>
          <div style={styles.galleryHeader}>
            <p style={styles.kicker}>Screenshots</p>
            <h2 style={styles.title}>Готовые 3D-кадры игры</h2>
          </div>
          <div style={styles.galleryGrid}>
            {promoShots.map((shot) => (
              <figure key={shot.title} style={styles.promoCard}>
                <img src={shot.src} alt={shot.title} style={styles.promoImage} />
                <figcaption style={styles.promoCaption}>
                  <b>{shot.title}</b>
                  <span>{shot.caption}</span>
                </figcaption>
              </figure>
            ))}
          </div>
        </section>
      ),
    },
    {
      id: 4,
      label: 'Video-demo',
      content: (
        <section style={styles.demoSlide}>
          <div>
            <p style={styles.kicker}>Video-demo</p>
            <h2 style={styles.title}>Демо игры</h2>
            <p style={styles.text}>
              Нажми Play: демо показывает старт, выбор режима, движение по карте, встречу с напарником,
              магазин скинов и QR-переход на мобильную версию.
            </p>
          </div>
          <div style={styles.videoFrame} className={demoPlaying ? 'qasqyr-demo is-playing' : 'qasqyr-demo'}>
            <div className="demo-bg" />
            <div className="demo-mountains" />
            <div className="demo-water" />
            <div className="demo-road" />
            <div className="demo-village" />
            <div className="demo-player" />
            <div className="demo-companion" />
            <div className="demo-enemy demo-enemy-a" />
            <div className="demo-enemy demo-enemy-b" />
            <div className="demo-knife" />
            <div className="demo-case" />
            <div className="demo-hud">
              <span>Story</span>
              <span>AI teammate</span>
              <span>HP 100</span>
            </div>
            <div className="demo-caption">
              <span>1. Выбор режима</span>
              <span>2. Исследование карты</span>
              <span>3. Напарник помогает</span>
              <span>4. Скины и награды</span>
            </div>
            {!demoPlaying && (
              <button type="button" style={styles.playCircle} onClick={() => setDemoPlaying(true)}>
                ▶
              </button>
            )}
            {demoPlaying && (
              <button type="button" style={styles.replayButton} onClick={() => setDemoPlaying(false)}>
                Replay
              </button>
            )}
          </div>
        </section>
      ),
    },
    {
      id: 5,
      label: 'QR',
      content: (
        <section style={styles.qrSlide}>
          <div>
            <p style={styles.kicker}>Mobile link</p>
            <h2 style={styles.title}>Играй с телефона</h2>
            <p style={styles.callToAction}>Сканируй QR и попробуй выжить в QASQYR 3D прямо сейчас.</p>
            <a style={styles.mobileLink} href={mobileUrl}>{mobileUrl}</a>
          </div>
          <div style={styles.qrCard}>
            <img style={styles.qrImage} src={qrUrl} alt="QR code to QASQYR 3D mobile game" />
            <span style={styles.qrCaption}>QR ведет на мобильную версию игры</span>
          </div>
        </section>
      ),
    },
  ];

  const current = slides[activeSlide];

  return (
    <main style={styles.page}>
      <DemoAnimationStyles />
      <nav style={styles.nav}>
        <b>{APP_NAME} Presentation</b>
        <div style={styles.navButtons}>
          {slides.map((slide, index) => (
            <button
              key={slide.id}
              type="button"
              onClick={() => setActiveSlide(index)}
              style={index === activeSlide ? styles.navButtonActive : styles.navButton}
            >
              {slide.id}
            </button>
          ))}
        </div>
      </nav>
      <article style={styles.deck}>
        <div style={styles.slideMeta}>Slide {current.id} / 5 · {current.label}</div>
        {current.content}
      </article>
      <footer style={styles.footer}>
        <button type="button" style={styles.footerButton} onClick={() => setActiveSlide((value) => Math.max(0, value - 1))}>
          Назад
        </button>
        <button type="button" style={styles.footerButtonPrimary} onClick={() => setActiveSlide((value) => Math.min(slides.length - 1, value + 1))}>
          Дальше
        </button>
      </footer>
    </main>
  );
}

function DemoAnimationStyles() {
  return (
    <style>{`
      .qasqyr-demo * { box-sizing: border-box; }
      .qasqyr-demo .demo-bg {
        position: absolute;
        inset: 0;
        background:
          radial-gradient(circle at 78% 18%, rgba(255,211,123,.52), transparent 9%),
          linear-gradient(180deg, #2e4b4a 0%, #17221b 52%, #101411 100%);
      }
      .qasqyr-demo .demo-mountains {
        position: absolute;
        left: -8%;
        right: -8%;
        bottom: 35%;
        height: 42%;
        background: linear-gradient(135deg, #526a51, #2e4037);
        clip-path: polygon(0 100%, 11% 34%, 20% 78%, 32% 18%, 45% 84%, 58% 28%, 70% 76%, 83% 22%, 100% 100%);
      }
      .qasqyr-demo .demo-water {
        position: absolute;
        left: 0;
        right: 0;
        bottom: 0;
        height: 28%;
        background: linear-gradient(180deg, rgba(58,103,114,.92), rgba(19,52,61,.96));
      }
      .qasqyr-demo .demo-road {
        position: absolute;
        left: 50%;
        bottom: -18%;
        width: 44%;
        height: 70%;
        transform: translateX(-50%) perspective(240px) rotateX(48deg);
        background: linear-gradient(180deg, #817653, #2b271f);
        clip-path: polygon(42% 0, 58% 0, 100% 100%, 0 100%);
      }
      .qasqyr-demo .demo-village {
        position: absolute;
        right: 8%;
        bottom: 29%;
        width: 24%;
        height: 20%;
        background:
          linear-gradient(45deg, transparent 45%, #754b31 46% 55%, transparent 56%),
          linear-gradient(135deg, transparent 44%, #754b31 45% 56%, transparent 57%),
          linear-gradient(90deg, #493323 0 18%, transparent 18% 28%, #493323 28% 46%, transparent 46% 58%, #493323 58% 74%, transparent 74%);
        opacity: .94;
      }
      .qasqyr-demo .demo-player,
      .qasqyr-demo .demo-companion,
      .qasqyr-demo .demo-enemy {
        position: absolute;
        bottom: 18%;
        width: 34px;
        height: 68px;
        border-radius: 18px 18px 8px 8px;
        box-shadow: 0 16px 22px rgba(0,0,0,.35);
      }
      .qasqyr-demo .demo-player {
        left: 42%;
        background: linear-gradient(180deg, #9ddf9b, #41623e);
      }
      .qasqyr-demo .demo-companion {
        left: 52%;
        background: linear-gradient(180deg, #70d6ff, #26566d);
      }
      .qasqyr-demo .demo-enemy {
        width: 30px;
        height: 60px;
        background: linear-gradient(180deg, #302421, #120f0e);
      }
      .qasqyr-demo .demo-enemy-a { left: 66%; bottom: 25%; }
      .qasqyr-demo .demo-enemy-b { left: 26%; bottom: 26%; }
      .qasqyr-demo .demo-knife {
        position: absolute;
        left: 43%;
        bottom: 33%;
        width: 52px;
        height: 8px;
        border-radius: 999px;
        background: linear-gradient(90deg, #cfd6d2 0 70%, #ffd37b 70%);
        transform: rotate(-22deg);
        box-shadow: 0 0 18px rgba(255,211,123,.45);
      }
      .qasqyr-demo .demo-case {
        position: absolute;
        right: 12%;
        bottom: 12%;
        width: 88px;
        height: 56px;
        border: 2px solid rgba(255,211,123,.7);
        border-radius: 8px;
        background: linear-gradient(180deg, #4c3425, #201710);
        box-shadow: 0 0 34px rgba(255,211,123,.26);
      }
      .qasqyr-demo .demo-hud {
        position: absolute;
        left: 16px;
        right: 16px;
        top: 16px;
        display: flex;
        justify-content: space-between;
        gap: 8px;
        color: #f8f4ea;
        font-weight: 900;
      }
      .qasqyr-demo .demo-hud span,
      .qasqyr-demo .demo-caption span {
        padding: 8px 10px;
        border: 1px solid rgba(255,255,255,.16);
        border-radius: 8px;
        background: rgba(10,14,12,.7);
      }
      .qasqyr-demo .demo-caption {
        position: absolute;
        left: 16px;
        right: 16px;
        bottom: 16px;
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 8px;
        color: #f8f4ea;
        font-size: 13px;
        font-weight: 800;
        text-align: center;
      }
      .qasqyr-demo.is-playing .demo-player {
        animation: demo-player-run 9s ease-in-out infinite;
      }
      .qasqyr-demo.is-playing .demo-companion {
        animation: demo-companion-run 9s ease-in-out infinite;
      }
      .qasqyr-demo.is-playing .demo-enemy-a {
        animation: demo-enemy-a 9s ease-in-out infinite;
      }
      .qasqyr-demo.is-playing .demo-enemy-b {
        animation: demo-enemy-b 9s ease-in-out infinite;
      }
      .qasqyr-demo.is-playing .demo-knife {
        animation: demo-knife 1.1s ease-in-out infinite;
      }
      .qasqyr-demo.is-playing .demo-case {
        animation: demo-case 9s ease-in-out infinite;
      }
      .qasqyr-demo.is-playing .demo-road,
      .qasqyr-demo.is-playing .demo-water {
        animation: demo-world 4s linear infinite;
      }
      @keyframes demo-player-run {
        0%, 100% { transform: translate(0, 0) scale(1); }
        25% { transform: translate(26px, -34px) scale(.9); }
        52% { transform: translate(76px, -58px) scale(.8); }
        72% { transform: translate(18px, -20px) scale(1.05); }
      }
      @keyframes demo-companion-run {
        0%, 100% { transform: translate(0, 0) scale(1); }
        25% { transform: translate(-18px, -28px) scale(.92); }
        52% { transform: translate(38px, -54px) scale(.82); }
        72% { transform: translate(-22px, -18px) scale(1.03); }
      }
      @keyframes demo-enemy-a {
        0%, 100% { transform: translate(0, 0); opacity: 1; }
        48% { transform: translate(-76px, 16px); opacity: 1; }
        60% { transform: translate(-86px, 20px) rotate(18deg); opacity: .35; }
      }
      @keyframes demo-enemy-b {
        0%, 100% { transform: translate(0, 0); opacity: 1; }
        46% { transform: translate(62px, 12px); opacity: 1; }
        63% { transform: translate(76px, 18px) rotate(-20deg); opacity: .3; }
      }
      @keyframes demo-knife {
        0%, 100% { transform: rotate(-22deg) translate(0, 0); }
        50% { transform: rotate(24deg) translate(18px, -8px); }
      }
      @keyframes demo-case {
        0%, 42% { transform: scale(1); filter: brightness(1); }
        55%, 74% { transform: scale(1.08); filter: brightness(1.45); }
        100% { transform: scale(1); filter: brightness(1); }
      }
      @keyframes demo-world {
        0% { filter: saturate(1); }
        50% { filter: saturate(1.2) brightness(1.08); }
        100% { filter: saturate(1); }
      }
      @media (max-width: 820px) {
        .qasqyr-demo .demo-caption { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      }
    `}</style>
  );
}

const styles: Record<string, CSSProperties> = {
  page: {
    minHeight: '100vh',
    padding: 18,
    display: 'grid',
    gridTemplateRows: 'auto 1fr auto',
    gap: 14,
    background: '#101411',
    color: '#f8f4ea',
    fontFamily: 'Inter, system-ui, sans-serif',
  },
  nav: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  navButtons: {
    display: 'flex',
    gap: 8,
  },
  navButton: {
    width: 42,
    height: 42,
    padding: 0,
    borderRadius: 8,
    border: '1px solid rgba(255,255,255,.16)',
    background: 'rgba(255,255,255,.07)',
    color: '#f8f4ea',
  },
  navButtonActive: {
    width: 42,
    height: 42,
    padding: 0,
    borderRadius: 8,
    border: '1px solid rgba(255,211,123,.65)',
    background: '#ffd37b',
    color: '#1c160a',
  },
  deck: {
    minHeight: 0,
    padding: 'clamp(20px, 4vw, 48px)',
    border: '1px solid rgba(255,255,255,.14)',
    borderRadius: 8,
    background: 'linear-gradient(135deg, #17221b 0%, #1d2429 54%, #101411 100%)',
    overflow: 'hidden',
    display: 'grid',
    alignContent: 'stretch',
    gap: 16,
  },
  slideMeta: {
    color: '#ffd37b',
    fontSize: 14,
    fontWeight: 800,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  heroSlide: {
    display: 'grid',
    alignContent: 'center',
    gap: 18,
    minHeight: '60vh',
  },
  centerSlide: {
    display: 'grid',
    placeContent: 'center',
    gap: 18,
    minHeight: '60vh',
    maxWidth: 980,
  },
  gallerySlide: {
    display: 'grid',
    alignContent: 'center',
    gap: 24,
    minHeight: '60vh',
  },
  galleryHeader: {
    display: 'grid',
    gap: 10,
  },
  demoSlide: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, .82fr) minmax(320px, 1.18fr)',
    alignItems: 'center',
    gap: 28,
    minHeight: '60vh',
  },
  qrSlide: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr) minmax(240px, 360px)',
    alignItems: 'center',
    gap: 28,
    minHeight: '60vh',
  },
  kicker: {
    margin: 0,
    color: '#70d6ff',
    fontWeight: 900,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  heroTitle: {
    margin: 0,
    maxWidth: 980,
    fontSize: 'clamp(52px, 10vw, 124px)',
    lineHeight: .92,
  },
  title: {
    margin: 0,
    fontSize: 'clamp(34px, 6.2vw, 76px)',
    lineHeight: 1,
  },
  heroText: {
    margin: 0,
    maxWidth: 760,
    color: '#ded7c8',
    fontSize: 'clamp(18px, 2.4vw, 28px)',
    lineHeight: 1.35,
  },
  bigSentence: {
    margin: 0,
    maxWidth: 920,
    color: '#ded7c8',
    fontSize: 'clamp(22px, 3.2vw, 38px)',
    lineHeight: 1.22,
  },
  text: {
    margin: 0,
    color: '#ded7c8',
    fontSize: 20,
    lineHeight: 1.45,
  },
  galleryGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
    gap: 16,
  },
  promoCard: {
    margin: 0,
    minHeight: 390,
    border: '1px solid rgba(255,255,255,.16)',
    borderRadius: 8,
    overflow: 'hidden',
    background: '#0d1513',
    boxShadow: '0 22px 48px rgba(0,0,0,.24)',
  },
  promoImage: {
    width: '100%',
    height: 270,
    objectFit: 'cover',
    display: 'block',
  },
  promoCaption: {
    display: 'grid',
    gap: 8,
    padding: 16,
    color: '#ded7c8',
    lineHeight: 1.35,
  },
  videoFrame: {
    position: 'relative',
    minHeight: 420,
    borderRadius: 8,
    overflow: 'hidden',
    border: '1px solid rgba(255,255,255,.18)',
    background: '#0c1110',
    boxShadow: '0 24px 70px rgba(0,0,0,.32)',
  },
  playCircle: {
    position: 'absolute',
    left: '50%',
    top: '50%',
    width: 82,
    height: 82,
    display: 'grid',
    placeItems: 'center',
    transform: 'translate(-50%, -50%)',
    borderRadius: '50%',
    border: '1px solid rgba(255,255,255,.32)',
    background: 'rgba(255,211,123,.95)',
    color: '#17120b',
    fontSize: 30,
    boxShadow: '0 0 36px rgba(255,211,123,.36)',
  },
  replayButton: {
    position: 'absolute',
    right: 16,
    top: 64,
    borderRadius: 8,
    border: '1px solid rgba(255,255,255,.2)',
    background: 'rgba(10,14,12,.72)',
    color: '#f8f4ea',
  },
  callToAction: {
    margin: '16px 0 20px',
    maxWidth: 640,
    color: '#ded7c8',
    fontSize: 'clamp(22px, 3vw, 34px)',
    lineHeight: 1.18,
    fontWeight: 800,
  },
  mobileLink: {
    color: '#70d6ff',
    wordBreak: 'break-all',
    fontWeight: 800,
  },
  qrCard: {
    display: 'grid',
    gap: 10,
    justifyItems: 'center',
    padding: 16,
    borderRadius: 8,
    background: '#f8f4ea',
    color: '#1b1b1b',
  },
  qrImage: {
    width: '100%',
    maxWidth: 320,
    aspectRatio: '1 / 1',
  },
  qrCaption: {
    textAlign: 'center',
    fontWeight: 800,
  },
  footer: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: 10,
  },
  footerButton: {
    borderRadius: 8,
    background: 'rgba(255,255,255,.09)',
    color: '#f8f4ea',
  },
  footerButtonPrimary: {
    borderRadius: 8,
    background: '#ffd37b',
    color: '#1c160a',
  },
};
