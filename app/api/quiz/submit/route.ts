import { NextResponse } from 'next/server';
import { loadBank, saveResult, signingSecret } from '../../../../lib/bank';
import { gradeQuestions, QuizError, verifyAttempt } from '../../../../lib/quiz-core.mjs';

export const runtime = 'nodejs';
export async function POST(request: Request) {
  try {
    const text = await request.text();
    if (Buffer.byteLength(text) > 16000) return NextResponse.json({ error: 'Bài gửi quá lớn.' }, { status: 413 });
    let body;
    try { body = JSON.parse(text); } catch { throw new QuizError('Dữ liệu gửi lên không phải JSON hợp lệ.'); }
    if (!body || typeof body !== 'object') throw new QuizError('Dữ liệu bài làm không hợp lệ.');
    const attempt = verifyAttempt(body.token, await loadBank(), signingSecret());
    const result = gradeQuestions(attempt.questions, body.answers);
    const saved = await saveResult(attempt.id, result);
    return NextResponse.json(saved, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    if (error instanceof QuizError) return NextResponse.json({ error: error.message }, { status: 400 });
    console.error('Submit quiz:', error);
    return NextResponse.json({ error: 'Chưa thể chấm và lưu bài. Đáp án của bạn vẫn giữ nguyên; hãy thử lại.' }, { status: 503 });
  }
}
