import { useEffect, useState, type CSSProperties } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './lib/supabase';
import { Auth } from './components/Auth';
import { Reviews } from './components/Reviews';
import { PresentationPage } from './components/Presentation';
import { Flappy3DGame } from './game/Flappy3DGame';
import { QasqyrGame } from './game/QasqyrGame';
import { useGameAssetPreload } from './lib/assetPreload';

export default function App() {
  const path = window.location.pathname;
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [guestEntered, setGuestEntered] = useState(false);
  const preload = useGameAssetPreload();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      window.localStorage.removeItem('qasqyr-open-mode-select');
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      window.localStorage.removeItem('qasqyr-open-mode-select');
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  if (path === '/presentation') {
    return <PresentationPage />;
  }

  if (path === '/flappy3d') {
    return <Flappy3DGame />;
  }

  if (path === '/mobile') {
    return (
      <QasqyrGame
        userId={session?.user.id}
        preloadProgress={preload.progress}
        preloadDone={preload.done}
        onExit={() => window.location.assign('/')}
      />
    );
  }

  if (loading) {
    return (
      <main className="container">
        <p>Загрузка...</p>
      </main>
    );
  }

  return (
    <main className="container">
      <header className="header">
        <h1>{playing ? 'QASQYR 3D' : 'Мой проект'}</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="ghost" onClick={() => setPlaying((p) => (p ? false : preload.done))} disabled={!playing && !preload.done}>
            {playing ? 'Назад' : 'Играть'}
          </button>
          <button className="ghost" onClick={() => window.location.assign('/flappy3d')}>
            Flappy 3D
          </button>
          {session && (
            <button className="ghost" onClick={() => supabase.auth.signOut()}>
              Выйти
            </button>
          )}
        </div>
      </header>

      {playing ? (
        <QasqyrGame
          userId={session?.user.id}
          preloadProgress={preload.progress}
          preloadDone={preload.done}
          onExit={() => setPlaying(false)}
        />
      ) : !session ? (
        guestEntered ? (
          <AccountHome
            userEmail="Гость"
            preloadProgress={preload.progress}
            preloadDone={preload.done}
            preloadFailed={preload.failed}
            onPlay={() => setPlaying(true)}
            onBack={() => setGuestEntered(false)}
          />
        ) : (
          <Auth onPlayAsGuest={() => setGuestEntered(true)} />
        )
      ) : (
        <AccountHome
          userEmail={session.user.email ?? ''}
          preloadProgress={preload.progress}
          preloadDone={preload.done}
          preloadFailed={preload.failed}
          onPlay={() => setPlaying(true)}
          onBack={() => supabase.auth.signOut()}
        />
      )}
      {!playing && <Reviews />}
    </main>
  );
}

function AccountHome({
  userEmail,
  preloadProgress,
  preloadDone,
  preloadFailed,
  onPlay,
  onBack,
}: {
  userEmail: string;
  preloadProgress: number;
  preloadDone: boolean;
  preloadFailed: number;
  onPlay: () => void;
  onBack: () => void;
}) {
  return (
    <section style={accountStyles.screen}>
      <div style={accountStyles.backdrop} />
      <div style={accountStyles.sideLabelLeft}>QASQYR</div>
      <div style={accountStyles.sideLabelRight}>QASQYR</div>
      <div style={accountStyles.card}>
        <p style={accountStyles.eyebrow}>QASQYR 3D</p>
        <h2 style={accountStyles.title}>Аккаунт готов</h2>
        <p style={accountStyles.text}>{userEmail}</p>
        <div style={accountStyles.preloadBox}>
          <b>
            {preloadDone
              ? preloadFailed > 0
                ? 'Модели загружены, часть необязательных ассетов пропущена'
                : 'Модели, анимации и текстуры загружены'
              : 'Загрузка моделей, анимаций и текстур...'}
          </b>
          <span>{preloadProgress}%</span>
          <div style={accountStyles.track}>
            <span style={{ ...accountStyles.fill, width: `${preloadProgress}%` }} />
          </div>
        </div>
        <div style={accountStyles.actions}>
          <button type="button" onClick={onPlay} disabled={!preloadDone} style={{ ...accountStyles.primaryButton, ...(!preloadDone ? accountStyles.disabledButton : null) }}>
            {preloadDone ? 'Играть' : 'Загрузка'}
          </button>
          <button type="button" onClick={onBack} style={accountStyles.secondaryButton}>
            Назад
          </button>
        </div>
      </div>
    </section>
  );
}

const accountStyles: Record<string, CSSProperties> = {
  screen: {
    position: 'fixed',
    inset: 0,
    zIndex: 100,
    display: 'grid',
    placeItems: 'center',
    overflow: 'hidden',
    color: '#f6f2e9',
    fontFamily: 'Inter, system-ui, sans-serif',
    background: '#07100d',
  },
  backdrop: {
    position: 'absolute',
    inset: 0,
    background: 'radial-gradient(circle at 50% 34%, rgba(83,112,66,.45), transparent 28%), linear-gradient(180deg, #101812 0%, #07100d 52%, #030504 100%)',
  },
  sideLabelLeft: {
    position: 'absolute',
    left: 22,
    top: '50%',
    transform: 'translateY(-50%) rotate(-90deg)',
    transformOrigin: 'center',
    color: 'rgba(255,211,123,.18)',
    fontSize: 'clamp(42px, 8vw, 108px)',
    fontWeight: 950,
    letterSpacing: 10,
    userSelect: 'none',
    pointerEvents: 'none',
  },
  sideLabelRight: {
    position: 'absolute',
    right: 22,
    top: '50%',
    transform: 'translateY(-50%) rotate(90deg)',
    transformOrigin: 'center',
    color: 'rgba(112,214,255,.16)',
    fontSize: 'clamp(42px, 8vw, 108px)',
    fontWeight: 950,
    letterSpacing: 10,
    userSelect: 'none',
    pointerEvents: 'none',
  },
  card: {
    position: 'relative',
    zIndex: 1,
    width: 'min(460px, calc(100vw - 34px))',
    display: 'grid',
    gap: 14,
    padding: 20,
    border: '1px solid rgba(255,255,255,.18)',
    borderRadius: 8,
    background: 'rgba(8,12,10,.82)',
    textAlign: 'center',
  },
  eyebrow: {
    margin: 0,
    color: '#70d6ff',
    fontSize: 13,
    fontWeight: 900,
    letterSpacing: 3,
  },
  title: {
    margin: 0,
    fontSize: 34,
  },
  text: {
    margin: 0,
    color: '#d8d1c3',
  },
  preloadBox: {
    display: 'grid',
    gap: 8,
    padding: 12,
    border: '1px solid rgba(255,255,255,.14)',
    borderRadius: 8,
    background: 'rgba(0,0,0,.16)',
  },
  track: {
    height: 9,
    overflow: 'hidden',
    borderRadius: 999,
    background: 'rgba(255,255,255,.14)',
  },
  fill: {
    display: 'block',
    height: '100%',
    borderRadius: 999,
    background: 'linear-gradient(90deg, #70d6ff, #ffd37b)',
    transition: 'width .25s ease',
  },
  actions: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: 10,
  },
  primaryButton: {
    border: '1px solid rgba(255,211,77,.58)',
    borderRadius: 8,
    background: 'rgba(255,211,77,.18)',
    color: '#ffd37b',
    padding: '14px 16px',
    fontWeight: 900,
    cursor: 'pointer',
  },
  disabledButton: {
    opacity: 0.55,
    cursor: 'wait',
  },
  secondaryButton: {
    border: '1px solid rgba(255,255,255,.22)',
    borderRadius: 8,
    background: 'rgba(255,255,255,.07)',
    color: '#f6f2e9',
    padding: '14px 16px',
    fontWeight: 900,
    cursor: 'pointer',
  },
};
