import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import katex from 'katex';
import { parseQuestions, source } from '../scripts/import-questions.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const bank = parseQuestions(await readFile(source, 'utf8'));
const port = Number(process.env.SMOKE_PORT || 3107);
const base = `http://127.0.0.1:${port}`;
const server = spawn(process.execPath, ['--import', './tests/supabase-mock.mjs', 'node_modules/next/dist/bin/next', 'start', '-p', String(port)], {
  cwd: root, env: { ...process.env, QUIZ_TEST_MOCK: '1', SUPABASE_URL: 'https://quiz-test.invalid', NEXT_PUBLIC_SUPABASE_URL: 'https://quiz-test.invalid', SUPABASE_SERVICE_ROLE_KEY: 'test-only-key', QUIZ_SIGNING_SECRET: randomBytes(32).toString('hex') },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let logs = '';
server.stdout.on('data', (chunk) => { logs += chunk; });
server.stderr.on('data', (chunk) => { logs += chunk; });
async function post(route, body) {
  const response = await fetch(base + route, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(15000) });
  return { status: response.status, data: await response.json() };
}
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
  assert.ok(html.includes('69') && html.includes('Bắt đầu luyện tập'));
  assert.ok(!html.includes(bank[0].explanation), 'SSR must not expose explanations');
  const first = await post('/api/quiz');
  assert.equal(first.status, 200);
  assert.equal(first.data.questions.length, 30);
  assert.equal(new Set(first.data.questions.map((question) => question.id)).size, 30);
  assert.ok(first.data.questions.every((question) => !('correctKey' in question) && !('explanation' in question)));
  const second = await post('/api/quiz');
  assert.equal(second.status, 200);
  assert.notEqual(first.data.token, second.data.token);
  const answers = Object.fromEntries(first.data.questions.map((question) => [question.id, bank.find((item) => item.id === question.id).correctKey]));
  const result = await post('/api/quiz/submit', { token: first.data.token, answers });
  assert.equal(result.status, 200);
  assert.equal(result.data.correct, 30);
  assert.equal(result.data.review.length, 30);
  const resubmitted = await post('/api/quiz/submit', { token: first.data.token, answers: {} });
  assert.equal(resubmitted.status, 200);
  assert.equal(resubmitted.data.correct, 30, 'Retry must return the first saved result, not regrade changed answers');
  const blank = await post('/api/quiz/submit', { token: second.data.token, answers: {} });
  assert.equal(blank.status, 200);
  assert.equal(blank.data.skipped, 30);
  assert.equal((await post('/api/quiz/submit', { token: first.data.token + 'x', answers })).status, 400);
  assert.equal((await post('/api/quiz/submit', { token: first.data.token, answers: { unknown: 'A' } })).status, 400);
  assert.equal((await post('/api/quiz/submit', null)).status, 400);
  assert.equal((await fetch(base + '/api/quiz/submit', { method: 'POST', body: '{' })).status, 400);
  assert.equal((await fetch(base + '/api/quiz/submit', { method: 'POST', body: ' '.repeat(16001) })).status, 413);
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
  console.log('PASS: production SSR, random quiz, server grading, skipped answers, invalid requests, private bank, all math formulas.');
} catch (error) {
  console.error(logs);
  throw error;
} finally {
  server.kill();
}
