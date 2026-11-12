import { validateBank } from './quiz-core.mjs';

export function credentials() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  let parsed;
  try { parsed = new URL(url); } catch { throw new Error('Thiếu URL Supabase hợp lệ.'); }
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.pathname !== '/' || parsed.search || parsed.hash || !key) {
    throw new Error('Cần URL Supabase HTTPS và SUPABASE_SERVICE_ROLE_KEY hợp lệ.');
  }
  return { url: parsed.origin, key };
}

export async function supabaseRequest(path, init = {}) {
  const { url, key } = credentials();
  const response = await fetch(`${url}/rest/v1/${path}`, {
    ...init, cache: 'no-store', signal: AbortSignal.timeout(15000),
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', ...init.headers },
  });
  if (!response.ok) {
    // Only log safe PostgREST codes, never response bodies or credentials.
    const body = await response.json().catch(() => ({}));
    const code = typeof body.code === 'string' && /^[A-Z0-9]+$/.test(body.code) ? ` (${body.code})` : '';
    throw new Error(`Supabase HTTP ${response.status}${code}. Kiểm tra migration, quyền truy cập và cấu hình.`);
  }
  return response;
}

export async function loadBank() {
  const rows = [];
  for (let offset = 0; ; ) {
    const response = await supabaseRequest(`questions?select=id,data,active,exclusion_reason,question_answer_keys!inner(correct_key,explanation)&order=id&offset=${offset}&limit=1000`);
    const page = await response.json();
    if (!Array.isArray(page)) throw new Error('Dữ liệu Supabase không hợp lệ.');
    rows.push(...page);
    if (page.length === 0) break;
    offset += page.length;
  }
  return validateBank(rows.map((row) => ({ id: row.id, ...row.data, active: row.active, exclusionReason: row.exclusion_reason,
    correctKey: row.question_answer_keys?.correct_key, explanation: row.question_answer_keys?.explanation })));
}

export async function saveResult(id, result) {
  const response = await supabaseRequest('quiz_attempts?on_conflict=id&select=result', {
    method: 'POST', headers: { Prefer: 'resolution=ignore-duplicates,return=representation' },
    body: JSON.stringify({ id, result }),
  });
  const inserted = await response.json();
  if (inserted[0]?.result) return inserted[0].result;
  const existing = await supabaseRequest(`quiz_attempts?id=eq.${encodeURIComponent(id)}&select=result`);
  const rows = await existing.json();
  if (!rows[0]?.result) throw new Error('Chưa xác nhận được kết quả đã lưu. Hãy nộp lại.');
  return rows[0].result;
}
