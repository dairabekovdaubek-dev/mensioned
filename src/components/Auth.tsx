import { useState } from 'react';
import { supabase } from '../lib/supabase';

export function Auth({ onPlayAsGuest }: { onPlayAsGuest?: () => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage('');
    try {
      const fn =
        mode === 'signup'
          ? supabase.auth.signUp({ email, password })
          : supabase.auth.signInWithPassword({ email, password });
      const { error } = await fn;
      if (error) setMessage(error.message);
      else if (mode === 'signup') setMessage('Готово! Проверь почту, если нужна подтверждалка.');
    } catch {
      setMessage('Что-то пошло не так. Попробуй еще раз.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 100,
      background: '#050807',
      display: 'flex', flexDirection: 'column',
      overflow: 'hidden', color: '#e8e6e1',
    }}>
      <div style={{ flex: '1 1 0', minHeight: 0, position: 'relative', overflow: 'hidden' }}>
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(180deg, #040706 0%, #07110c 40%, #0c1a10 70%, #040706 100%)',
        }} />
        <div style={{
          position: 'absolute', inset: 0, zIndex: 1,
          background: 'radial-gradient(ellipse 85% 75% at 50% 38%, transparent 20%, rgba(0,0,0,0.75) 100%)',
        }} />
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0, height: '48%', zIndex: 2,
          background: 'linear-gradient(to top, rgba(4,6,5,0.98) 0%, transparent 100%)',
        }} />

        <svg viewBox="0 0 500 680" style={{
          position: 'relative', zIndex: 3,
          height: '100%', width: '100%',
          display: 'block',
          filter: 'drop-shadow(0 8px 50px rgba(0,0,0,0.98))',
        }} preserveAspectRatio="xMidYMid meet">
          <g fill="#060d08" opacity="0.9">
            <path d="M22 680 Q15 555 8 445 Q11 441 14 445 Q22 555 28 680Z" />
            <path d="M46 680 Q53 580 63 472 Q66 469 69 472 Q62 580 65 680Z" />
            <path d="M8 680 Q2 615 -4 505 Q-2 502 1 505 Q8 615 12 680Z" />
            <path d="M465 680 Q473 555 481 445 Q484 441 487 445 Q481 555 485 680Z" />
            <path d="M448 680 Q441 580 429 472 Q426 469 423 472 Q430 580 433 680Z" />
            <path d="M480 680 Q486 615 494 505 Q496 502 499 505 Q494 615 489 680Z" />
          </g>
          <g stroke="#081009" strokeWidth="3.5" fill="none" opacity="0.5">
            <path d="M76 0 Q83 85 79 172 Q75 230 83 298" />
            <path d="M81 124 Q63 154 47 144" />
            <path d="M80 177 Q97 200 112 190" />
            <path d="M418 0 Q411 90 415 188 Q419 248 411 312" />
            <path d="M413 140 Q431 164 447 154" />
            <path d="M412 202 Q395 224 379 214" />
          </g>

          <g fill="#0b0d0b">
            <ellipse cx="295" cy="112" rx="32" ry="36" />
            <path d="M274 146 Q275 167 295 167 Q315 167 316 146Z" />
            <path d="M242 172 Q232 244 228 344 Q224 444 228 574 L272 574 Q276 506 283 448 Q289 400 295 377 Q301 400 307 448 Q314 506 318 574 L362 574 Q366 444 362 344 Q358 244 348 172 Q321 162 295 159 Q269 162 242 172Z" />
            <path d="M242 184 L195 350 L182 346 L179 366 L210 374 L225 356 L254 198Z" />
            <path d="M348 184 L386 320 L374 324 L345 198Z" />
            <path d="M240 570 L228 680 L254 680 L269 622 L282 680 L306 680 L319 622 L333 680 L360 680 L348 570Z" />
          </g>

          <g fill="#0f120f">
            <ellipse cx="178" cy="196" rx="24" ry="27" transform="rotate(-2 178 196)" />
            <path d="M155 219 Q157 236 178 238 Q199 236 201 219 Q189 226 178 226 Q167 226 155 219Z" />
            <path d="M166 223 Q166 241 178 241 Q190 241 190 223Z" />
            <path d="M144 245 Q137 311 135 400 Q133 489 137 594 L165 594 Q168 534 173 481 Q177 444 181 424 Q185 444 189 481 Q194 534 198 594 L226 594 Q230 489 228 400 Q226 311 219 245 Q200 237 181 234 Q162 237 144 245Z" />
            <path d="M144 257 L112 382 L123 386 L153 271Z" />
            <path d="M219 257 L248 362 L258 357 L229 271Z" />
            <path d="M146 590 L137 680 L160 680 L174 626 L188 680 L212 680 L223 590Z" />
          </g>

          <defs>
            <linearGradient id="fog" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#040706" stopOpacity="0" />
              <stop offset="100%" stopColor="#040706" stopOpacity="0.95" />
            </linearGradient>
          </defs>
          <rect x="0" y="430" width="500" height="250" fill="url(#fog)" />

          <text x="250" y="600" textAnchor="middle" fill="#ede9e2"
            fontSize="84" fontWeight="900"
            fontFamily="Georgia, 'Times New Roman', serif" letterSpacing="8">
            ҚАС
          </text>
          <text x="250" y="678" textAnchor="middle" fill="#ede9e2"
            fontSize="84" fontWeight="900"
            fontFamily="Georgia, 'Times New Roman', serif" letterSpacing="8">
            ҚЫР
          </text>
        </svg>

        <div style={{
          position: 'absolute', top: 18, left: 0, right: 0, zIndex: 4,
          textAlign: 'center',
          fontSize: 'clamp(9px, 1.4vw, 12px)',
          letterSpacing: '0.4em',
          color: '#4a7a52',
          fontFamily: 'Georgia, serif',
          textTransform: 'uppercase',
        }}>
          Казахский постапокалипсис · 1873
        </div>
      </div>

      <div style={{
        flexShrink: 0,
        background: 'rgba(4,6,5,0.96)',
        borderTop: '1px solid #1a221a',
        padding: '14px 20px 24px',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0,
      }}>
        <section style={{
          width: 'min(560px, 92vw)',
          margin: '0 0 14px',
          border: '1px solid #1f2c21',
          borderRadius: 6,
          background: 'rgba(9,15,11,0.78)',
          padding: '12px 14px',
          textAlign: 'center',
          boxShadow: '0 10px 30px rgba(0,0,0,0.28)',
        }}>
          <p style={{
            margin: '0 0 7px',
            color: '#6ea16f',
            fontFamily: 'Georgia, serif',
            fontSize: 12,
            letterSpacing: '0.28em',
            textTransform: 'uppercase',
          }}>
            История
          </p>
          <p style={{
            margin: 0,
            color: '#c8c4bc',
            fontSize: 14,
            lineHeight: 1.55,
            fontFamily: 'system-ui',
          }}>
            В XIX веке на казахскую степь напали зараженные волки. После укусов вирус
            разошелся по аулам, и почти все люди превратились в зомби. Выжили только два
            немного туповатых друга: их спас странный иммунитет от кумыса. Теперь им надо
            добраться до крепости, раскрыть тайну заражения и, если повезет, спасти мир.
          </p>
        </section>

        <p style={{
          margin: '0 0 14px', fontSize: 10, letterSpacing: '0.28em',
          textTransform: 'uppercase', opacity: 0.45,
          fontFamily: 'system-ui', fontWeight: 700, color: '#c8c4bc',
        }}>
          - {mode === 'signin' ? 'Вход в систему' : 'Регистрация'} -
        </p>

        <form onSubmit={handleSubmit} style={{
          display: 'flex', flexDirection: 'column', gap: 8,
          width: 'min(320px, 90vw)',
        }}>
          <input
            type="email"
            placeholder="Электронная почта"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={{
              background: '#0d120e', border: '1px solid #253025',
              borderRadius: 6, padding: '10px 14px',
              color: '#e8e6e1', fontSize: 14, fontFamily: 'system-ui',
              outline: 'none',
            }}
          />
          <input
            type="password"
            placeholder="Пароль (6+ символов)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={6}
            required
            style={{
              background: '#0d120e', border: '1px solid #253025',
              borderRadius: 6, padding: '10px 14px',
              color: '#e8e6e1', fontSize: 14, fontFamily: 'system-ui',
              outline: 'none',
            }}
          />
          <button type="submit" disabled={busy} style={{
            marginTop: 4,
            background: 'transparent', color: '#ede9e2',
            border: '2px solid #4a7a4e', borderRadius: 4,
            padding: '11px 0', fontSize: 13, fontWeight: 800,
            letterSpacing: '0.3em', cursor: busy ? 'default' : 'pointer',
            textTransform: 'uppercase', fontFamily: 'system-ui',
            opacity: busy ? 0.6 : 1,
          }}>
            {busy ? '...' : mode === 'signin' ? '▶  Войти' : '▶  Создать аккаунт'}
          </button>
        </form>

        {message && (
          <p style={{
            marginTop: 10, fontSize: 12, color: message.startsWith('Готово') ? '#7ab87e' : '#c97070',
            fontFamily: 'system-ui', textAlign: 'center', maxWidth: 300,
          }}>
            {message}
          </p>
        )}

        <button onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setMessage(''); }}
          style={{
            marginTop: 10,
            background: 'transparent', border: 'none',
            color: '#5a7a5e', fontSize: 12, cursor: 'pointer',
            fontFamily: 'system-ui', textDecoration: 'underline',
          }}>
          {mode === 'signin' ? 'Нет аккаунта? Зарегистрируйся' : 'Уже есть аккаунт? Войти'}
        </button>

        <div style={{ margin: '14px 0 2px', width: 'min(320px,90vw)', borderTop: '1px solid #1a221a' }} />

        <button onClick={onPlayAsGuest} style={{
          background: 'transparent', color: '#a09a90',
          border: '1px solid #2a3028', borderRadius: 4,
          padding: '10px 0', fontSize: 12, fontWeight: 700,
          letterSpacing: '0.22em', cursor: 'pointer',
          textTransform: 'uppercase', fontFamily: 'system-ui',
          width: 'min(320px,90vw)',
        }}>
          Играть без входа
        </button>
      </div>
    </div>
  );
}
