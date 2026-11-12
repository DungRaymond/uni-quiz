// Test process only. Production never imports this file or the Markdown bank.
import { readFile } from 'node:fs/promises';
import { parseQuestions, source } from '../scripts/import-questions.mjs';
if (process.env.QUIZ_TEST_MOCK !== '1') throw new Error('Mock chỉ được chạy trong test riêng biệt.');
const bank = parseQuestions(await readFile(source, 'utf8'));
const saved = new Map();
const original = globalThis.fetch;
globalThis.fetch = async (input, init) => {
  const url = new URL(typeof input === 'string' ? input : input.url ?? String(input));
  if (url.origin !== 'https://quiz-test.invalid') return original(input, init);
  if (url.pathname === '/rest/v1/questions') {
    const offset = Number(url.searchParams.get('offset') || 0);
    // Small pages test that the client paginates instead of trusting limit=1000.
    return Response.json(bank.slice(offset, offset + 25).map((question) => ({ id: question.id,
      data: { sourceNumber: question.sourceNumber, prompt: question.prompt, options: question.options },
      active: question.active, exclusion_reason: question.exclusionReason,
      question_answer_keys: { correct_key: question.correctKey, explanation: question.explanation } })));
  }
  if (url.pathname === '/rest/v1/quiz_attempts') {
    if (init?.method === 'POST') {
      const row = JSON.parse(init.body);
      if (saved.has(row.id)) return Response.json([]);
      saved.set(row.id, row.result);
      return Response.json([{ result: row.result }], { status: 201 });
    }
    const id = url.searchParams.get('id')?.replace(/^eq\./, '');
    return Response.json(saved.has(id) ? [{ result: saved.get(id) }] : []);
  }
  return Response.json({ code: 'PGRST205' }, { status: 404 });
};
