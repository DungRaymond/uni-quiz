import { loadEnvFile } from 'node:process';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { parseQuestions, source, root } from './import-questions.mjs';
import { loadBank, supabaseRequest } from '../lib/supabase.mjs';

try { loadEnvFile(path.join(root, '.env.local')); } catch (error) { if (error.code !== 'ENOENT') throw error; }
try {
  const questions = parseQuestions(await readFile(source, 'utf8'));
  if (questions.filter((question) => question.active).length < 30) throw new Error('Cần ít nhất 30 câu hợp lệ.');
  const response = await supabaseRequest('rpc/import_question_bank', {
    method: 'POST', body: JSON.stringify({ p_questions: questions }),
  });
  const imported = await response.json();
  const bank = await loadBank();
  for (const expected of questions) {
    const actual = bank.find((question) => question.id === expected.id);
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
      // Compare fields independently because JSON object key order has no semantic meaning.
      if (!actual || Object.keys(expected).some((key) => JSON.stringify(actual[key]) !== JSON.stringify(expected[key]))) {
        throw new Error(`Dữ liệu sau import không khớp: ${expected.id}`);
      }
    }
  }
  console.log(`Đã upsert và đối chiếu ${imported.imported} câu; ${imported.active} câu hợp lệ. Không xóa câu ngoài nguồn.`);
} catch (error) {
  console.error(error.message);
  console.error('Nếu thiếu bảng hoặc RPC, chạy migrations/001_quiz_schema.sql và 002_import_question_bank.sql trong Supabase SQL Editor trước.');
  process.exitCode = 1;
}
