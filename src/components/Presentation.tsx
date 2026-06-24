import { useMemo, useState, type CSSProperties } from 'react';

type Slide = {
  id: number;
  label: string;
  content: JSX.Element;
};

const APP_NAME = 'QASQYR 3D';
const MOBILE_GAME_URL = 'https://mensioned.vercel.app/mobile';

export function PresentationPage() {
  const [activeSlide, setActiveSlide] = useState(0);
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
          <p style={styles.heroText}>Маленький факт: я делаю 3D-игру с режимами, скинами, отзывами и AI-напарником.</p>
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
            Это атмосферная 3D survival-игра, где игрок проходит Story, Survival и Nightmare, исследует мир,
            открывает скины и оставляет отзывы.
          </p>
        </section>
      ),
    },
    {
      id: 3,
      label: 'Скриншоты',
      content: (
        <section style={styles.screenshotSlide}>
          <div>
            <p style={styles.kicker}>Screenshots</p>
            <h2 style={styles.title}>Что есть в игре</h2>
          </div>
          <div style={styles.screenshotGrid}>
            <AppScreenshot title="Главное меню" accent="#70d6ff" lines={['Играть как гость', 'Регистрация', 'Отзывы']} />
            <AppScreenshot title="Режимы" accent="#ffd37b" lines={['Story', 'Survival', 'Nightmare']} />
            <AppScreenshot title="3D мир" accent="#8fd694" lines={['Горы и вода', 'Деревья и трава', 'Модели и анимации']} />
          </div>
        </section>
      ),
    },
    {
      id: 4,
      label: 'Demo',
      content: (
        <section style={styles.demoSlide}>
          <div>
            <p style={styles.kicker}>Video-demo</p>
            <h2 style={styles.title}>Короткий демо-показ</h2>
            <p style={styles.text}>Открой игру, выбери режим и покажи движение по карте, магазин скинов, отзывы и AI-подсказку.</p>
          </div>
          <div style={styles.videoFrame}>
            <div style={styles.videoSky} />
            <div style={styles.videoRoad} />
            <div style={styles.videoPlayer} />
            <div style={styles.videoHud}>
              <span>HP 100</span>
              <span>Story</span>
              <span>QASQYR</span>
            </div>
            <div style={styles.playCircle}>▶</div>
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

function AppScreenshot({ title, accent, lines }: { title: string; accent: string; lines: string[] }) {
  return (
    <div style={styles.screenshot}>
      <div style={{ ...styles.screenshotTop, background: accent }} />
      <h3 style={styles.screenshotTitle}>{title}</h3>
      <div style={styles.screenshotScene}>
        <span style={{ ...styles.sun, background: accent }} />
        <span style={styles.mountainLeft} />
        <span style={styles.mountainRight} />
        <span style={styles.water} />
      </div>
      <div style={styles.screenshotLines}>
        {lines.map((line) => (
          <span key={line}>{line}</span>
        ))}
      </div>
    </div>
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
    padding: 'clamp(22px, 4vw, 48px)',
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
    maxWidth: 900,
  },
  screenshotSlide: {
    display: 'grid',
    alignContent: 'center',
    gap: 24,
    minHeight: '60vh',
  },
  demoSlide: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, .85fr) minmax(280px, 1.15fr)',
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
    fontSize: 'clamp(36px, 7vw, 82px)',
    lineHeight: 1,
  },
  heroText: {
    margin: 0,
    maxWidth: 720,
    color: '#ded7c8',
    fontSize: 'clamp(18px, 2.4vw, 28px)',
    lineHeight: 1.35,
  },
  bigSentence: {
    margin: 0,
    maxWidth: 880,
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
  screenshotGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
    gap: 16,
  },
  screenshot: {
    minHeight: 310,
    borderRadius: 8,
    border: '1px solid rgba(255,255,255,.16)',
    background: '#111915',
    overflow: 'hidden',
    display: 'grid',
    gridTemplateRows: '8px auto 1fr auto',
  },
  screenshotTop: {
    height: 8,
  },
  screenshotTitle: {
    margin: 0,
    padding: 16,
    fontSize: 22,
  },
  screenshotScene: {
    position: 'relative',
    minHeight: 150,
    background: 'linear-gradient(180deg, #24382d 0%, #1b2b26 54%, #1a352f 100%)',
    overflow: 'hidden',
  },
  sun: {
    position: 'absolute',
    width: 36,
    height: 36,
    right: 24,
    top: 22,
    borderRadius: '50%',
  },
  mountainLeft: {
    position: 'absolute',
    left: -28,
    bottom: 32,
    width: 180,
    height: 110,
    background: '#536444',
    clipPath: 'polygon(0 100%, 50% 0, 100% 100%)',
  },
  mountainRight: {
    position: 'absolute',
    right: -20,
    bottom: 28,
    width: 190,
    height: 130,
    background: '#6b7452',
    clipPath: 'polygon(0 100%, 54% 0, 100% 100%)',
  },
  water: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 38,
    background: '#315b67',
  },
  screenshotLines: {
    display: 'grid',
    gap: 8,
    padding: 16,
  },
  videoFrame: {
    position: 'relative',
    minHeight: 380,
    borderRadius: 8,
    overflow: 'hidden',
    border: '1px solid rgba(255,255,255,.18)',
    background: '#0c1110',
  },
  videoSky: {
    position: 'absolute',
    inset: 0,
    background: 'linear-gradient(180deg, #334b4a 0%, #17221b 58%, #0b1110 100%)',
  },
  videoRoad: {
    position: 'absolute',
    left: '50%',
    bottom: -20,
    width: '42%',
    height: '72%',
    transform: 'translateX(-50%) perspective(220px) rotateX(42deg)',
    background: 'linear-gradient(180deg, #6e674c, #2b2820)',
  },
  videoPlayer: {
    position: 'absolute',
    left: '50%',
    bottom: 84,
    width: 42,
    height: 78,
    transform: 'translateX(-50%)',
    borderRadius: '18px 18px 8px 8px',
    background: '#8fd694',
    boxShadow: '0 0 28px rgba(143,214,148,.32)',
  },
  videoHud: {
    position: 'absolute',
    left: 16,
    right: 16,
    top: 16,
    display: 'flex',
    justifyContent: 'space-between',
    gap: 8,
    color: '#f8f4ea',
    fontWeight: 900,
  },
  playCircle: {
    position: 'absolute',
    left: '50%',
    top: '50%',
    width: 74,
    height: 74,
    display: 'grid',
    placeItems: 'center',
    transform: 'translate(-50%, -50%)',
    borderRadius: '50%',
    background: 'rgba(255,211,123,.92)',
    color: '#17120b',
    fontSize: 28,
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
