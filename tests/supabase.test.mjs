import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parseQuestions, source } from '../scripts/import-questions.mjs';
import { credentials, loadBank, saveResult, supabaseRequest } from '../lib/supabase.mjs';
const bank = parseQuestions(await readFile(source, 'utf8'));

function stub(t, handler) {
  const fetch = globalThis.fetch;
  const before = { ...process.env };
  process.env.SUPABASE_URL = 'https://unit-test.invalid';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'private-test-service-role';
  globalThis.fetch = handler;
  t.after(() => { globalThis.fetch = fetch; process.env = before; });
}
function row(question) {
  return { id: question.id, data: { sourceNumber: question.sourceNumber, prompt: question.prompt, options: question.options },
    active: question.active, exclusion_reason: question.exclusionReason,
    question_answer_keys: { correct_key: question.correctKey, explanation: question.explanation } };
}
test('supports existing NEXT_PUBLIC URL; rejects unsafe URLs and missing service key', (t) => {
  stub(t, () => { throw new Error('Unexpected request'); });
  delete process.env.SUPABASE_URL;
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://unit-test.invalid/';
  assert.equal(credentials().url, 'https://unit-test.invalid');
  for (const value of ['http://unit-test.invalid', 'https://user:pass@unit-test.invalid', 'https://unit-test.invalid/path', 'https://unit-test.invalid/?secret=x']) {
    process.env.NEXT_PUBLIC_SUPABASE_URL = value;
    assert.throws(credentials);
  }
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://unit-test.invalid';
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  assert.throws(credentials);
});
test('loads all pages using service credentials without caching', async (t) => {
  const offsets = [];
  stub(t, async (input, init) => {
    const url = new URL(input);
    const offset = Number(url.searchParams.get('offset'));
    offsets.push(offset);
    assert.equal(init.headers.apikey, 'private-test-service-role');
    assert.equal(init.headers.Authorization, 'Bearer private-test-service-role');
    assert.equal(init.cache, 'no-store');
    return Response.json(bank.slice(offset, offset + 20).map(row));
  });
  const remote = await loadBank();
  assert.deepEqual(remote, bank);
  assert.deepEqual(offsets, [0, 20, 40, 60, 71]);
});
test('never falls back when Supabase is unavailable; error never contains response secrets', async (t) => {
  stub(t, async () => Response.json({ code: 'PGRST205', message: 'private-test-service-role' }, { status: 404 }));
  await assert.rejects(loadBank, (error) => error.message.includes('PGRST205') && !error.message.includes('private-test-service-role'));
});
test('rejects malformed remote answer data', async (t) => {
  let page = 0;
  stub(t, async () => Response.json(page++ === 0 ? [{ ...row(bank[0]), question_answer_keys: null }] : []));
  await assert.rejects(loadBank, /sai định dạng/);
});
test('returns saved first submission on retry, never overwrites previous answers', async (t) => {
  const first = { correct: 30, review: [] };
  let stored;
  let inserts = 0;
  stub(t, async (input, init) => {
    const url = new URL(input);
    if (init.method === 'POST') {
      inserts++;
      assert.equal(init.headers.Prefer, 'resolution=ignore-duplicates,return=representation');
      if (stored) return Response.json([]);
      stored = JSON.parse(init.body).result;
      return Response.json([{ result: stored }], { status: 201 });
    }
    assert.equal(url.searchParams.get('id'), 'eq.test-id');
    return Response.json([{ result: stored }]);
  });
  assert.deepEqual(await saveResult('test-id', first), first);
  assert.deepEqual(await saveResult('test-id', { correct: 0 }), first);
  assert.equal(inserts, 2);
});
test('fails if write cannot be confirmed', async (t) => {
  stub(t, async () => Response.json([]));
  await assert.rejects(() => saveResult('test-id', {}), /Chưa xác nhận/);
});
test('network failure propagates; no successful result without durable save', async (t) => {
  stub(t, async () => { throw new Error('network down'); });
  await assert.rejects(() => supabaseRequest('questions'), /network down/);
});
