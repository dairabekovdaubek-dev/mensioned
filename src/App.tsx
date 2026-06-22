import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './lib/supabase';
import { Auth } from './components/Auth';
import { Entries } from './components/Entries';
import { QasqyrGame } from './game/QasqyrGame';

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (data.session && window.localStorage.getItem('qasqyr-open-mode-select') === '1') {
        window.localStorage.removeItem('qasqyr-open-mode-select');
        setPlaying(true);
      }
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      if (s && window.localStorage.getItem('qasqyr-open-mode-select') === '1') {
        window.localStorage.removeItem('qasqyr-open-mode-select');
        setPlaying(true);
      }
    });
    return () => sub.subscription.unsubscribe();
  }, []);

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
          <button className="ghost" onClick={() => setPlaying((p) => !p)}>
            {playing ? 'Назад' : 'Играть'}
          </button>
          {session && (
            <button className="ghost" onClick={() => supabase.auth.signOut()}>
              Выйти
            </button>
          )}
        </div>
      </header>

      {playing ? (
        <QasqyrGame userId={session?.user.id} onExit={() => setPlaying(false)} />
      ) : !session ? (
        <Auth
          onPlayAsGuest={() => setPlaying(true)}
          onAuthStarted={() => window.localStorage.setItem('qasqyr-open-mode-select', '1')}
        />
      ) : (
        <Entries userEmail={session.user.email ?? ''} />
      )}
    </main>
  );
}
