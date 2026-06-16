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
    // 1) текущая сессия при загрузке
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    // 2) подписка на вход/выход
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  if (loading) return <main className="container"><p>Загрузка…</p></main>;

  return (
    <main className="container">
      <header className="header">
        <h1>{playing ? 'QASQYR 🐺' : 'Мой проект 🚀'}</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="ghost" onClick={() => setPlaying((p) => !p)}>
            {playing ? '← Назад' : '🎮 Играть'}
          </button>
          {session && (
            <button className="ghost" onClick={() => supabase.auth.signOut()}>
              Выйти
            </button>
          )}
        </div>
      </header>

      {/* Игра — полноэкранный оверлей поверх всего. Иначе — обычный поток входа/приложения. */}
      {playing && <QasqyrGame onExit={() => setPlaying(false)} />}
      {!session ? <Auth /> : <Entries userEmail={session.user.email ?? ''} />}
    </main>
  );
}
