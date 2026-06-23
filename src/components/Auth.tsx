import { useState, type CSSProperties } from 'react';
import { supabase } from '../lib/supabase';

type AuthScreen = 'home' | 'user';

type AuthProps = {
  onPlayAsGuest?: () => void;
  onAuthStarted?: () => void;
};

export function Auth({ onPlayAsGuest, onAuthStarted }: AuthProps) {
  const [screen, setScreen] = useState<AuthScreen>('home');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  async function signInWithGoogle() {
    setBusy(true);
    setMessage('');
    onAuthStarted?.();

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
      },
    });

    if (error) {
      setMessage(error.message);
      setBusy(false);
    }
  }

  return (
    <div style={styles.screen}>
      <div style={styles.backdrop} />
      <div style={styles.noise} />

      <section style={styles.hero}>
        <p style={styles.eyebrow}>QASQYR 3D</p>
        <h1 style={styles.title}>Кумыс против зараженной степи</h1>
        <p style={styles.story}>
          Казахстан, 1873 год. После нападения зараженных волков аулы пустеют, люди превращаются
          в зомби, а северная крепость молчит. Выжили только двое друзей со странным иммунитетом
          от кумыса. Твоя цель: найти ключ и код, пройти степь, договориться с выжившими и раскрыть
          источник заражения.
        </p>

        <div style={styles.features}>
          <span>3D survival</span>
          <span>Story / Survival / Nightmare</span>
          <span>Ножи, скины, торговец и Gemini-напарник</span>
        </div>

        {screen === 'home' ? (
          <div style={styles.actions}>
            <button type="button" onClick={() => setScreen('user')} style={styles.primaryButton}>
              Зарегистрироваться как пользователь
            </button>
            <button type="button" onClick={onPlayAsGuest} style={styles.secondaryButton}>
              Играть как гость
            </button>
          </div>
        ) : (
          <div style={styles.authCard}>
            <button type="button" onClick={() => setScreen('home')} style={styles.backButton}>
              Назад
            </button>
            <h2 style={styles.authTitle}>Вход через Gmail</h2>
            <p style={styles.authText}>
              Нажми кнопку ниже, зарегистрируйся через Google, и после входа ты вернешься
              на экран игрока с кнопкой запуска.
            </p>
            <button type="button" onClick={signInWithGoogle} disabled={busy} style={styles.googleButton}>
              {busy ? 'Открываем Google...' : 'Продолжить с Gmail'}
            </button>
            {message && <p style={styles.error}>{message}</p>}
          </div>
        )}
      </section>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  screen: {
    position: 'fixed',
    inset: 0,
    zIndex: 100,
    overflow: 'hidden',
    color: '#f6f2e9',
    fontFamily: 'Inter, system-ui, sans-serif',
    background: '#07100d',
  },
  backdrop: {
    position: 'absolute',
    inset: 0,
    background:
      'radial-gradient(circle at 52% 35%, rgba(83,112,66,.45), transparent 28%), linear-gradient(180deg, #101812 0%, #07100d 48%, #030504 100%)',
  },
  noise: {
    position: 'absolute',
    inset: 0,
    opacity: 0.7,
    background:
      'linear-gradient(90deg, rgba(255,255,255,.04) 1px, transparent 1px), linear-gradient(rgba(255,255,255,.035) 1px, transparent 1px)',
    backgroundSize: '48px 48px',
    maskImage: 'radial-gradient(circle at 50% 45%, black, transparent 78%)',
  },
  hero: {
    position: 'relative',
    zIndex: 1,
    width: 'min(760px, calc(100vw - 32px))',
    minHeight: '100vh',
    margin: '0 auto',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    textAlign: 'center',
    padding: '48px 0',
  },
  eyebrow: {
    margin: '0 0 10px',
    color: '#70d6ff',
    fontSize: 13,
    fontWeight: 900,
    letterSpacing: 3,
  },
  title: {
    margin: '0 0 18px',
    fontFamily: 'Georgia, serif',
    fontSize: 'clamp(38px, 8vw, 78px)',
    lineHeight: 0.95,
  },
  story: {
    maxWidth: 680,
    margin: '0 0 22px',
    color: '#d8d1c3',
    fontSize: 'clamp(15px, 2vw, 18px)',
    lineHeight: 1.65,
  },
  features: {
    display: 'flex',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 28,
  },
  actions: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: 12,
    width: 'min(560px, 100%)',
  },
  primaryButton: {
    border: '1px solid rgba(255,211,77,.58)',
    borderRadius: 8,
    background: 'rgba(255,211,77,.18)',
    color: '#ffd37b',
    padding: '15px 16px',
    fontWeight: 900,
    cursor: 'pointer',
  },
  secondaryButton: {
    border: '1px solid rgba(255,255,255,.22)',
    borderRadius: 8,
    background: 'rgba(255,255,255,.07)',
    color: '#f6f2e9',
    padding: '15px 16px',
    fontWeight: 900,
    cursor: 'pointer',
  },
  authCard: {
    width: 'min(420px, 100%)',
    border: '1px solid rgba(255,255,255,.18)',
    borderRadius: 8,
    background: 'rgba(8,12,10,.78)',
    padding: 18,
    display: 'grid',
    gap: 12,
  },
  backButton: {
    justifySelf: 'start',
    border: 0,
    background: 'transparent',
    color: '#aeb8be',
    cursor: 'pointer',
    fontWeight: 800,
  },
  authTitle: {
    margin: 0,
    fontSize: 26,
  },
  authText: {
    margin: 0,
    color: '#d8d1c3',
    lineHeight: 1.5,
  },
  googleButton: {
    border: '1px solid rgba(112,214,255,.52)',
    borderRadius: 8,
    background: 'rgba(112,214,255,.14)',
    color: '#d9f7ff',
    padding: '14px 16px',
    fontWeight: 900,
    cursor: 'pointer',
  },
  error: {
    margin: 0,
    color: '#ff9b9b',
    fontSize: 13,
  },
};
