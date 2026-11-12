import { loadEnvFile } from 'node:process';
import path from 'node:path';
import { root } from './import-questions.mjs';
import { credentials, loadBank, supabaseRequest } from '../lib/supabase.mjs';
try { loadEnvFile(path.join(root, '.env.local')); } catch (error) { if (error.code !== 'ENOENT') throw error; }
try {
  const { url } = credentials();
  console.log(`Project: ${new URL(url).hostname}`);
  for (const table of ['questions', 'question_answer_keys', 'quiz_attempts']) {
    const response = await supabaseRequest(`${table}?select=*&limit=0`, { headers: { Prefer: 'count=exact' } });
    console.log(`${table}: accessible, count ${response.headers.get('content-range')?.split('/')[1] ?? 'unknown'}`);
  }
  const bank = await loadBank();
  const active = bank.filter((question) => question.active).length;
  if (active < 30) throw new Error(`Chỉ có ${active} câu hợp lệ. Chạy npm run sync:supabase sau migration.`);
  console.log(`Ngân hàng hợp lệ: ${bank.length} câu, ${active} câu dùng được.`);
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!anon) throw new Error('Thiếu NEXT_PUBLIC_SUPABASE_ANON_KEY để xác minh quyền truy cập ẩn danh.');
  for (const table of ['questions', 'question_answer_keys', 'quiz_attempts']) {
    const response = await fetch(`${url}/rest/v1/${table}?select=*&limit=1`, {
      headers: { apikey: anon, Authorization: `Bearer ${anon}` }, signal: AbortSignal.timeout(15000),
    });
    if (response.status === 401 || response.status === 403) {
      console.log(`${table}: anon blocked`);
    } else if (response.ok && (await response.json()).length === 0) {
      console.log(`${table}: anon cannot read rows (RLS)`);
    } else {
      throw new Error(`Chưa xác minh được bảo vệ dữ liệu ${table}; HTTP ${response.status}.`);
    }
  }
} catch (error) { console.error(error.message); process.exitCode = 1; }
