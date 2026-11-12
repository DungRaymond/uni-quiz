'use client';
import { useEffect, useRef, useState } from 'react';
import type { Attempt, OptionKey } from '../lib/types';
import RichText from './rich-text';
import Home from './home';
import { readCache, refreshCache, sampleCachedQuestions, type CachedBank } from '../lib/question-cache.mjs';

export default function Quiz() {
  const [bank, setBank] = useState<CachedBank | null>(null);
  const bankSize = bank?.questions.length ?? 0;
  const [screen, setScreen] = useState<'home' | 'exam'>('home');
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [answers, setAnswers] = useState<Record<string, OptionKey>>({});
  const [index, setIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const errorRef = useRef('');
  const lock = useRef(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const answered = Object.keys(answers).length;
  const question = attempt?.questions[index];
  useEffect(() => {
    let mounted = true;
    let storage: Storage;
    try { storage = window.localStorage; }
    catch { storage = { getItem: () => null, setItem: () => {} } as unknown as Storage; }
    let current = readCache(storage);
    if (current) { setBank(current); setError(''); }
    let refreshing = false;
    const refresh = async () => {
      if (refreshing) return;
      refreshing = true;
      try {
        const updated = await refreshCache(current, storage);
        current = updated;
        if (mounted) { setBank(updated); setError(''); errorRef.current = ''; }
      } catch (error) {
        if (mounted && !current) { const message = error instanceof Error ? error.message : 'Không tải được ngân hàng câu hỏi.'; setError(message); errorRef.current = message; }
      } finally { refreshing = false; }
    };
    void refresh();
    const interval = window.setInterval(() => { if (document.visibilityState === 'visible') void refresh(); }, 5 * 60 * 1000);
    window.addEventListener('online', refresh);
    return () => { mounted = false; window.clearInterval(interval); window.removeEventListener('online', refresh); };
  }, []);
  useEffect(() => { heading.current?.focus(); }, [screen, index]);
  useEffect(() => {
    if (screen !== 'exam') return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [screen]);
  async function start() {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError('');
    try {
      if (!bank) throw new Error(errorRef.current || 'Ngân hàng câu hỏi đang tải. Hãy thử lại.');
      const next: Attempt = { token: crypto.randomUUID(), questions: sampleCachedQuestions(bank) };
      setAttempt(next); setAnswers({}); setIndex(0); setScreen('exam');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (error) { setError(error instanceof Error ? error.message : 'Không tạo được đề.'); }
    finally { lock.current = false; setBusy(false); }
  }
  const changeQuestion = (next: number) => { setIndex(next); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const selectedIsWrong = Boolean(question && answers[question.id] && answers[question.id] !== question.correctKey);
  return <>
    <a href="#main" className="skip-link">Đến nội dung chính</a>
    <header className="header container"><a className="brand" href="/" aria-label="Uni, trang chủ"><span className="brand-mark">u<span>.</span></span><span className="brand-name">uni<span>Lý – Dược</span></span></a></header>
    <main id="main" className="container"><div className="error-box" role="alert" hidden={!error}>{error}</div><span className="sr-only" role="status">{busy ? 'Đang xử lý, vui lòng chờ.' : ''}</span>
      {screen === 'home' && <><Home bankSize={bankSize} busy={busy} start={start} />{error && <p className="error-message" role="alert">{error}</p>}</>}
      {screen === 'exam' && question && <>
        <div className="page-heading"><div><p className="eyebrow">LUYỆN TẬP</p><h1>Tự chọn đáp án, xem giải thích ngay.</h1></div><span className="quiet-badge">30 câu · Không giới hạn giờ</span></div>
        <div className="exam-layout"><section className="card question-card" aria-labelledby="question-title"><div className="question-meta"><span>CÂU {String(index + 1).padStart(2, '0')} / 30</span><span>Một đáp án đúng</span></div><h2 id="question-title" ref={heading} tabIndex={-1}><RichText text={question.prompt} /></h2><fieldset className="options" disabled={busy}><legend className="sr-only">Chọn một đáp án</legend>{question.options.map((option) => <label key={option.key} className={`option ${answers[question.id] === option.key ? 'selected' : ''} ${answers[question.id] === option.key ? (option.key === question.correctKey ? 'correct-option' : 'wrong-option') : ''}`}><input type="radio" name={question.id} value={option.key} checked={answers[question.id] === option.key} onChange={() => setAnswers((current) => ({ ...current, [question.id]: option.key }))} /><span className="option-key">{option.key}</span><span className="option-text"><RichText text={option.text} /></span><span className="option-check" aria-hidden="true">{answers[question.id] === option.key ? (option.key === question.correctKey ? '✓' : '×') : ''}</span></label>)}</fieldset>{answers[question.id] && <div className={`explanation ${selectedIsWrong ? 'explanation-wrong' : 'explanation-correct'}`} role="status"><strong>{selectedIsWrong ? `CHƯA ĐÚNG · ĐÁP ÁN ${question.correctKey}` : 'CHÍNH XÁC'}</strong><p><RichText text={question.explanation} /></p></div>}<div className="question-bottom"><button className="button secondary" disabled={index === 0 || busy} onClick={() => changeQuestion(index - 1)}>Câu trước</button><span className="muted small">Bạn có thể đổi đáp án bất cứ lúc nào</span><button className="button primary" disabled={busy} onClick={() => changeQuestion((index + 1) % 30)}>Câu {index === 29 ? 'đầu' : 'tiếp'} <span aria-hidden="true">→</span></button></div></section>
          <aside className="card navigator"><h2>Tiến độ</h2><div className="progress-copy"><span role="status" aria-live="polite">Đã thử <strong>{answered}</strong></span><span>/ 30 câu</span></div><progress value={answered} max={30} aria-label="Số câu đã thử" /><div className="question-grid">{attempt!.questions.map((item, position) => <button key={item.id} disabled={busy} className={`${answers[item.id] ? 'answered' : ''} ${position === index ? 'current' : ''}`} onClick={() => changeQuestion(position)} aria-label={`Câu ${position + 1}, ${answers[item.id] ? 'đã thử' : 'chưa thử'}`} aria-current={position === index ? 'step' : undefined}>{position + 1}</button>)}</div><div className="grid-legend"><span><i className="filled" />Đã thử</span><span><i />Chưa thử</span></div><button className="button secondary full" onClick={start} disabled={busy}>Đề mới</button><p className="muted small navigator-note">Không giới hạn giờ. Bạn có thể đổi câu trả lời.</p></aside>
        </div>
      </>}
    </main>
    <footer className="container footer"><span>Uni · Lý – Dược</span></footer>
  </>;
}
