import { NextResponse } from 'next/server';
import { loadBank } from '../../../../lib/bank';
import { bankVersion } from '../../../../lib/quiz-core.mjs';

export const runtime = 'nodejs';
export async function GET(request: Request) {
  try {
    const bank = await loadBank();
    const version = bankVersion(bank);
    const headers = { ETag: `"${version}"`, 'Cache-Control': 'no-store' };
    const active = bank.filter((question) => question.active);
    return NextResponse.json({ version, excluded: bank.filter((question) => !question.active).length,
      questions: active.map((question) => ({ id: question.id, sourceNumber: question.sourceNumber, prompt: question.prompt, options: question.options })),
      answerKeys: active.map((question) => ({ id: question.id, correctKey: question.correctKey, explanation: question.explanation })) }, { headers });
  } catch (error) {
    console.error('Refresh question cache:', error);
    return NextResponse.json({ error: 'Không tải được ngân hàng câu hỏi. Hãy thử lại.' }, { status: 503 });
  }
}
