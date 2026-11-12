import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import katex from 'katex';
import { parseQuestions, source } from '../scripts/import-questions.mjs';
import { sampleCachedQuestions, validateCache } from '../lib/question-cache.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const bank = parseQuestions(await readFile(source, 'utf8'));
const port = Number(process.env.SMOKE_PORT || 3107);
const base = `http://127.0.0.1:${port}`;
const server = spawn(process.execPath, ['--import', './tests/supabase-mock.mjs', 'node_modules/next/dist/bin/next', 'start', '-p', String(port)], {
  cwd: root, env: { ...process.env, QUIZ_TEST_MOCK: '1', SUPABASE_URL: 'https://quiz-test.invalid', NEXT_PUBLIC_SUPABASE_URL: 'https://quiz-test.invalid', SUPABASE_SERVICE_ROLE_KEY: 'test-only-key' },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let logs = '';
server.stdout.on('data', (chunk) => { logs += chunk; });
server.stderr.on('data', (chunk) => { logs += chunk; });
try {
  let ready = false;
  for (let count = 0; count < 60; count++) {
    if (server.exitCode !== null) throw new Error(logs);
    try {
      const response = await fetch(base, { signal: AbortSignal.timeout(1000) });
      if (response.ok) { ready = true; break; }
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  assert.ok(ready, `Production server failed to start: ${logs}`);
  const html = await (await fetch(base)).text();
  assert.ok(html.includes('Bắt đầu luyện'));
  const bankResponse = await fetch(base + '/api/quiz/bank');
  assert.equal(bankResponse.status, 200);
  const bankPayload = await bankResponse.json();
  assert.equal(bankPayload.questions.length, 71);
  assert.equal(bankPayload.answerKeys.length, 71);
  assert.ok(bankPayload.answerKeys.every((item) => item.correctKey && item.explanation));
  const cachedBank = validateCache({ ...bankPayload, questions: bankPayload.questions.map((question) => ({ ...question, ...bankPayload.answerKeys.find((item) => item.id === question.id) })) });
  assert.equal(cachedBank.questions.length, 71);
  assert.equal(cachedBank.excluded, 0);
  assert.ok(cachedBank.questions.every((q) => q.correctKey && q.explanation));
  const cachedQuestions = sampleCachedQuestions(cachedBank);
  assert.ok(!html.includes(bank[0].explanation), 'SSR must not expose cached bank contents.');
  assert.equal((await fetch(base + '/api/quiz', { method: 'POST' })).status, 404);
  assert.equal((await fetch(base + '/api/quiz/submit', { method: 'POST', body: '{}' })).status, 404);
  // Check bundled client code, not only API responses, for accidental bank imports.
  const staticDir = path.join(root, '.next/static');
  const files = await readdir(staticDir, { recursive: true });
  for (const name of files.filter((name) => name.endsWith('.js'))) {
    const code = await readFile(path.join(staticDir, name), 'utf8');
    assert.ok(!code.includes(bank[0].explanation), `Answer bank leaked into client bundle: ${name}`);
  }
  for (const question of bank) {
    const texts = [question.prompt, question.explanation, ...question.options.map((option) => option.text)];
    for (const text of texts) {
      for (const [, formula] of text.matchAll(/\$([^$\n]+)\$/g)) katex.renderToString(formula, { throwOnError: true, trust: false, strict: 'ignore' });
    }
  }
  console.log('PASS: production SSR, private answer bank, local quiz flow, removed exam APIs, all math formulas.');
} catch (error) {
  console.error(logs);
  throw error;
} finally {
  server.kill();
}
