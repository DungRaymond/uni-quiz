import { NextResponse } from 'next/server';
import { loadBank, signingSecret } from '../../../lib/bank';
import { bankVersion, publicQuestion, sampleQuestions, signAttempt } from '../../../lib/quiz-core.mjs';

export const runtime = 'nodejs';
export async function POST() {
  try {
    const bank = await loadBank();
    const questions = sampleQuestions(bank);
    const token = signAttempt(questions.map((question) => question.id), bankVersion(bank), signingSecret());
    return NextResponse.json({ token, questions: questions.map(publicQuestion) }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('Create quiz:', error);
    return NextResponse.json({ error: 'Không tạo được đề. Kiểm tra cấu hình server hoặc thử lại sau.' }, { status: 503 });
  }
}
