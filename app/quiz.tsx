'use client';
import { useEffect, useRef, useState } from 'react';
import type { Attempt, OptionKey, Result } from '../lib/types';
import RichText from './rich-text';
import Home from './home';
import Results from './results';

type Props = { bankSize: number; excluded: number; mode: string; initialError?: string };
export default function Quiz({ bankSize, excluded, mode, initialError = '' }: Props) {
  const [screen, setScreen] = useState<'home' | 'exam' | 'result'>('home');
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [answers, setAnswers] = useState<Record<string, OptionKey>>({});
  const [index, setIndex] = useState(0);
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(initialError);
  const lock = useRef(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const answered = Object.keys(answers).length;
  const question = attempt?.questions[index];
  useEffect(() => { heading.current?.focus(); }, [screen, index]);
  useEffect(() => {
    if (screen !== 'exam') return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [screen]);
  async function request<T>(url: string, body?: unknown): Promise<T> {
    const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(30000) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Yêu cầu thất bại. Hãy thử lại.');
    return data;
  }
  async function start() {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError('');
    try {
      const next = await request<Attempt>('/api/quiz');
      setAttempt(next); setAnswers({}); setIndex(0); setResult(null); setScreen('exam');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (error) { setError(error instanceof Error ? error.message : 'Không tạo được đề.'); }
    finally { lock.current = false; setBusy(false); }
  }
  async function submit() {
    if (!attempt || lock.current) return;
    lock.current = true; setBusy(true); setError(''); dialog.current?.close();
    try {
      const graded = await request<Result>('/api/quiz/submit', { token: attempt.token, answers });
      setResult(graded); setScreen('result'); window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (error) { setError(error instanceof Error ? error.message : 'Chưa thể nộp bài. Hãy thử lại.'); }
    finally { lock.current = false; setBusy(false); }
  }
  const changeQuestion = (next: number) => { setIndex(next); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  return <>
    <a href="#main" className="skip-link">Đến nội dung chính</a>
    <header className="header container"><a className="brand" href="/" aria-label="Uni, trang chủ"><span className="brand-mark">u<span>.</span></span><span className="brand-name">uni<span>không gian tự học</span></span></a><div className="header-right"><span className="subject-badge"><span className="dot" /> Vật lý – Lý sinh Dược</span><span className="header-caption">Học vững, tiến xa.</span></div></header>
    <main id="main" className="container"><div className="source-note"><span className="source-label">{mode === 'local' ? 'NGUỒN MARKDOWN' : 'SUPABASE'}</span><span>{mode === 'local' ? 'Đang dùng ngân hàng gốc. Bài làm chưa lưu lên cloud.' : 'Câu hỏi và kết quả bài làm được lưu trên Supabase.'}</span></div>{error && <div className="error-box" role="alert">{error}</div>}<span className="sr-only" role="status">{busy ? 'Đang xử lý, vui lòng chờ.' : ''}</span>
      {screen === 'home' && <Home bankSize={bankSize} excluded={excluded} busy={busy} start={start} />}
      {screen === 'result' && result && <Results result={result} busy={busy} start={start} home={() => { setScreen('home'); setError(''); }} />}
      {screen === 'exam' && question && <>
        <div className="page-heading"><div><p className="eyebrow">PHIÊN LUYỆN TẬP</p><h1>Từng câu một, thật vững vàng.</h1></div><span className="quiet-badge">30 câu · Không giới hạn giờ</span></div>
        <div className="exam-layout"><section className="card question-card" aria-labelledby="question-title"><div className="question-meta"><span>CÂU {String(index + 1).padStart(2, '0')} / 30</span><span>Một đáp án đúng</span></div><h2 id="question-title" ref={heading} tabIndex={-1}><RichText text={question.prompt} /></h2><fieldset className="options" disabled={busy}><legend className="sr-only">Chọn một đáp án</legend>{question.options.map((option) => <label key={option.key} className={`option ${answers[question.id] === option.key ? 'selected' : ''}`}><input type="radio" name={question.id} value={option.key} checked={answers[question.id] === option.key} onChange={() => setAnswers((current) => ({ ...current, [question.id]: option.key }))} /><span className="option-key">{option.key}</span><span className="option-text"><RichText text={option.text} /></span><span className="option-check" aria-hidden="true">{answers[question.id] === option.key ? '✓' : ''}</span></label>)}</fieldset><div className="question-bottom"><button className="button secondary" disabled={index === 0 || busy} onClick={() => changeQuestion(index - 1)}>Câu trước</button><span className="muted small">Có thể đổi đáp án trước khi nộp</span>{index < 29 ? <button className="button primary" disabled={busy} onClick={() => changeQuestion(index + 1)}>Câu tiếp <span aria-hidden="true">→</span></button> : <button className="button primary" disabled={busy} onClick={() => dialog.current?.showModal()}>Nộp bài</button>}</div></section>
          <aside className="card navigator"><h2>Tiến độ của bạn</h2><div className="progress-copy"><span role="status" aria-live="polite">Đã trả lời <strong>{answered}</strong></span><span>/ 30 câu</span></div><progress value={answered} max={30} aria-label="Số câu đã trả lời" /><div className="question-grid">{attempt!.questions.map((item, position) => <button key={item.id} disabled={busy} className={`${answers[item.id] ? 'answered' : ''} ${position === index ? 'current' : ''}`} onClick={() => changeQuestion(position)} aria-label={`Câu ${position + 1}, ${answers[item.id] ? 'đã trả lời' : 'chưa trả lời'}`} aria-current={position === index ? 'step' : undefined}>{position + 1}</button>)}</div><div className="grid-legend"><span><i className="filled" />Đã trả lời</span><span><i />Chưa trả lời</span></div><button className="button primary full" onClick={() => dialog.current?.showModal()} disabled={busy}>{busy ? 'Đang chấm bài…' : 'Nộp bài luyện tập'}</button><p className="muted small navigator-note">Bài làm có hiệu lực 24 giờ. Tải lại hoặc rời trang sẽ mất tiến độ hiện tại.</p></aside>
        </div>
      </>}
    </main>
    <footer className="container footer"><span><strong>uni.</strong> Học để hiểu, không chỉ để nhớ.</span><span>Lý – Dược · Không gian tự học</span></footer>
    <dialog ref={dialog} className="submit-dialog" aria-labelledby="dialog-title" aria-describedby="dialog-description"><p className="eyebrow">KIỂM TRA LẦN CUỐI</p><h2 id="dialog-title">Sẵn sàng nộp bài?</h2><p id="dialog-description">{answered < 30 ? `Bạn còn ${30 - answered} câu chưa trả lời. Các câu này không được tính điểm.` : 'Bạn đã trả lời đủ 30 câu.'} Sau khi nộp, bạn không thể đổi đáp án.</p><div className="dialog-actions"><button className="button secondary" autoFocus onClick={() => dialog.current?.close()}>Làm tiếp</button><button className="button primary" disabled={busy} onClick={submit}>Xác nhận nộp</button></div></dialog>
  </>;
}
