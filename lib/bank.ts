import 'server-only';
import questions from '../data/questions.json';
import type { BankQuestion } from './types';
import { validateBank } from './quiz-core.mjs';

export function dataMode() {
  return process.env.SUPABASE_URL ? 'supabase' : 'local';
}

function credentials() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key || !url.startsWith('https://')) throw new Error('Cần cấu hình SUPABASE_URL và SUPABASE_SERVICE_ROLE_KEY hợp lệ.');
  return { url: url.replace(/\/$/, ''), key };
}

async function supabase(path: string, init?: RequestInit) {
  const { url, key } = credentials();
  const response = await fetch(`${url}/rest/v1/${path}`, {
    ...init, cache: 'no-store', signal: AbortSignal.timeout(15000),
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', ...init?.headers },
  });
  if (!response.ok) throw new Error(`Supabase trả lỗi HTTP ${response.status}.`);
  return response;
}

export async function loadBank(): Promise<BankQuestion[]> {
  if (dataMode() === 'local') return validateBank(questions);
  type Row = { id: string; data: Pick<BankQuestion, 'sourceNumber' | 'prompt' | 'options'>; active: boolean; exclusion_reason: string | null; question_answer_keys: { correct_key: BankQuestion['correctKey']; explanation: string } };
  const rows: Row[] = [];
  // Fetch every page; PostgREST limits each response to the project's row cap.
  for (let offset = 0; ; ) {
    const response = await supabase(`questions?select=id,data,active,exclusion_reason,question_answer_keys!inner(correct_key,explanation)&order=id&offset=${offset}&limit=1000`);
    const page = await response.json() as Row[];
    if (!Array.isArray(page)) throw new Error('Dữ liệu Supabase không hợp lệ.');
    rows.push(...page);
    if (page.length === 0) break;
    offset += page.length;
  }
  return validateBank(rows.map((row) => ({ id: row.id, ...row.data, active: row.active, exclusionReason: row.exclusion_reason,
    correctKey: row.question_answer_keys.correct_key, explanation: row.question_answer_keys.explanation })));
}

export async function saveResult(id: string, result: unknown) {
  if (dataMode() === 'local') return;
  await supabase('quiz_attempts?on_conflict=id', {
    method: 'POST', headers: { Prefer: 'resolution=ignore-duplicates,return=minimal' },
    body: JSON.stringify({ id, result }),
  });
}

export function signingSecret() {
  const secret = process.env.QUIZ_SIGNING_SECRET;
  if (secret && Buffer.byteLength(secret) >= 32) return secret;
  if (process.env.NODE_ENV === 'production') throw new Error('QUIZ_SIGNING_SECRET phải có ít nhất 32 byte.');
  // shortcut: local development only; production always requires a private secret.
  return 'uni-quiz-local-development-secret-not-for-production';
}
