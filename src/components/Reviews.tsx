import { useEffect, useState, type CSSProperties } from 'react';
import { supabase } from '../lib/supabase';

type Review = {
  id: string;
  author_name: string;
  text: string;
  rating: number;
  created_at: string;
};

export function Reviews() {
  const [open, setOpen] = useState(false);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [authorName, setAuthorName] = useState('Гость');
  const [text, setText] = useState('');
  const [rating, setRating] = useState(5);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!open) return;
    void loadReviews();
  }, [open]);

  async function loadReviews() {
    setMessage('');
    const { data, error } = await supabase
      .from('reviews')
      .select('id, author_name, text, rating, created_at')
      .order('created_at', { ascending: false })
      .limit(40);

    if (error) {
      setMessage('Не получилось загрузить отзывы. Попробуй позже.');
      return;
    }

    setReviews(data ?? []);
  }

  async function submitReview() {
    const cleanName = authorName.trim().slice(0, 40) || 'Гость';
    const cleanText = text.trim();
    if (cleanText.length < 2) {
      setMessage('Напиши отзыв хотя бы из пары букв.');
      return;
    }

    setBusy(true);
    setMessage('');
    const { data: userData } = await supabase.auth.getUser();
    const { error } = await supabase.from('reviews').insert({
      user_id: userData.user?.id ?? null,
      author_name: cleanName,
      text: cleanText.slice(0, 600),
      rating,
    });
    setBusy(false);

    if (error) {
      setMessage('Не получилось сохранить отзыв. Возможно, миграция еще не применена.');
      return;
    }

    setText('');
    setAuthorName(cleanName);
    setMessage('Отзыв сохранен.');
    await loadReviews();
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} style={styles.openButton}>
        Отзывы
      </button>

      {open && (
        <div style={styles.overlay}>
          <section style={styles.panel}>
            <div style={styles.header}>
              <div>
                <p style={styles.eyebrow}>QASQYR</p>
                <h2 style={styles.title}>Отзывы игроков</h2>
              </div>
              <button type="button" onClick={() => setOpen(false)} style={styles.closeButton}>
                Назад
              </button>
            </div>

            <div style={styles.form}>
              <input
                value={authorName}
                onChange={(event) => setAuthorName(event.target.value)}
                maxLength={40}
                placeholder="Твое имя"
                style={styles.input}
              />
              <select value={rating} onChange={(event) => setRating(Number(event.target.value))} style={styles.input}>
                <option value={5}>5 звезд</option>
                <option value={4}>4 звезды</option>
                <option value={3}>3 звезды</option>
                <option value={2}>2 звезды</option>
                <option value={1}>1 звезда</option>
              </select>
              <textarea
                value={text}
                onChange={(event) => setText(event.target.value)}
                maxLength={600}
                placeholder="Напиши отзыв об игре"
                style={styles.textarea}
              />
              <button type="button" onClick={submitReview} disabled={busy} style={styles.submitButton}>
                {busy ? 'Сохраняем...' : 'Оставить отзыв'}
              </button>
              {message && <p style={styles.message}>{message}</p>}
            </div>

            <div style={styles.list}>
              {reviews.length === 0 ? (
                <p style={styles.empty}>Пока отзывов нет. Можешь быть первым.</p>
              ) : (
                reviews.map((review) => (
                  <article key={review.id} style={styles.review}>
                    <div style={styles.reviewTop}>
                      <b>{review.author_name}</b>
                      <span>{'★'.repeat(review.rating)}</span>
                    </div>
                    <p style={styles.reviewText}>{review.text}</p>
                  </article>
                ))
              )}
            </div>
          </section>
        </div>
      )}
    </>
  );
}

const styles: Record<string, CSSProperties> = {
  openButton: {
    position: 'fixed',
    left: 24,
    bottom: 24,
    zIndex: 180,
    minWidth: 176,
    border: '1px solid rgba(255,211,77,.72)',
    borderRadius: 8,
    background: 'rgba(255,211,77,.22)',
    color: '#ffd37b',
    padding: '18px 22px',
    fontSize: 20,
    fontWeight: 950,
    cursor: 'pointer',
    boxShadow: '0 18px 48px rgba(0,0,0,.34)',
  },
  overlay: {
    position: 'fixed',
    inset: 0,
    zIndex: 220,
    display: 'grid',
    placeItems: 'center',
    padding: 18,
    background: 'rgba(2,5,4,.76)',
    color: '#f6f2e9',
    fontFamily: 'Inter, system-ui, sans-serif',
  },
  panel: {
    width: 'min(760px, calc(100vw - 28px))',
    maxHeight: 'min(760px, calc(100vh - 28px))',
    overflow: 'auto',
    display: 'grid',
    gap: 16,
    border: '1px solid rgba(255,255,255,.18)',
    borderRadius: 8,
    background: 'linear-gradient(180deg, rgba(16,24,18,.98), rgba(7,12,10,.98))',
    padding: 18,
  },
  header: {
    display: 'flex',
    alignItems: 'start',
    justifyContent: 'space-between',
    gap: 16,
  },
  eyebrow: {
    margin: '0 0 6px',
    color: '#70d6ff',
    fontSize: 12,
    fontWeight: 900,
    letterSpacing: 3,
  },
  title: {
    margin: 0,
    fontSize: 30,
  },
  closeButton: {
    border: '1px solid rgba(255,255,255,.2)',
    borderRadius: 8,
    background: 'rgba(255,255,255,.06)',
    color: '#f6f2e9',
    padding: '10px 14px',
    fontWeight: 900,
    cursor: 'pointer',
  },
  form: {
    display: 'grid',
    gridTemplateColumns: '1fr 150px',
    gap: 10,
  },
  input: {
    minWidth: 0,
    border: '1px solid rgba(255,255,255,.18)',
    borderRadius: 8,
    background: 'rgba(0,0,0,.22)',
    color: '#f6f2e9',
    padding: '12px 13px',
    font: 'inherit',
  },
  textarea: {
    gridColumn: '1 / -1',
    minHeight: 92,
    resize: 'vertical',
    border: '1px solid rgba(255,255,255,.18)',
    borderRadius: 8,
    background: 'rgba(0,0,0,.22)',
    color: '#f6f2e9',
    padding: '12px 13px',
    font: 'inherit',
  },
  submitButton: {
    gridColumn: '1 / -1',
    border: '1px solid rgba(112,214,255,.52)',
    borderRadius: 8,
    background: 'rgba(112,214,255,.14)',
    color: '#d9f7ff',
    padding: '13px 16px',
    fontWeight: 950,
    cursor: 'pointer',
  },
  message: {
    gridColumn: '1 / -1',
    margin: 0,
    color: '#ffd37b',
    fontSize: 13,
  },
  list: {
    display: 'grid',
    gap: 10,
  },
  empty: {
    margin: 0,
    color: '#d8d1c3',
  },
  review: {
    display: 'grid',
    gap: 8,
    border: '1px solid rgba(255,255,255,.13)',
    borderRadius: 8,
    background: 'rgba(255,255,255,.055)',
    padding: 12,
  },
  reviewTop: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: 12,
    color: '#ffd37b',
  },
  reviewText: {
    margin: 0,
    color: '#e7dfd1',
    lineHeight: 1.5,
    whiteSpace: 'pre-wrap',
    overflowWrap: 'anywhere',
  },
};
