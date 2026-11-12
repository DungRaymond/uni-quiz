import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parseQuestions, source } from '../scripts/import-questions.mjs';
import { CACHE_KEY, validateCache, readCache, writeCache, refreshCache, sampleCachedQuestions } from '../lib/question-cache.mjs';
const questions = parseQuestions(await readFile(source, 'utf8'));
const bank = { version: 'a'.repeat(64), excluded: 0, questions };
function storage() {
  let text = null;
  return { getItem: () => text, setItem: (key, value) => { assert.equal(key, CACHE_KEY); text = value; } };
}
test('persists questions and explanations on this device for self-study', () => {
  const disk = storage();
  writeCache(disk, bank);
  const cache = readCache(disk);
  assert.equal(cache.questions.length, 71);
  assert.ok(cache.questions.every((q) => q.correctKey && q.explanation));
});
test('rejects corrupt cache and tolerates blocked storage', () => {
  assert.equal(readCache({ getItem: () => '{' }), null);
  assert.equal(readCache({ getItem: () => { throw Error('blocked'); } }), null);
  assert.doesNotThrow(() => writeCache({ setItem: () => { throw Error('quota'); } }, bank));
  assert.throws(() => validateCache({ ...bank, questions: [questions[0]] }));
  assert.throws(() => validateCache({ ...bank, questions: [...questions, questions[0]] }));
  const legacy = { ...bank, questions: bank.questions.map(({ correctKey, explanation, ...question }) => question) };
  assert.throws(() => validateCache(legacy));
});
test('unchanged background response refreshes answer data without rewriting cache', async () => {
  const cache = validateCache(bank);
  let writes = 0;
  const next = await refreshCache(cache, { setItem: () => { writes++; } }, async (url, init) => {
    assert.equal(url, '/api/quiz/bank');
    return Response.json({ version: cache.version, excluded: 0,
      questions: cache.questions.map(({ correctKey, explanation, ...item }) => item),
      answerKeys: cache.questions.map((item) => ({ id: item.id, correctKey: item.correctKey, explanation: item.explanation })) });
  });
  assert.equal(next.version, cache.version);
  assert.equal(writes, 0);
});
test('changed background response updates cache; failed refresh never erases it', async () => {
  const disk = storage();
  const original = validateCache(bank);
  writeCache(disk, original);
  const changed = { ...bank, version: 'c'.repeat(64) };
  const updated = await refreshCache(original, disk, async () => Response.json({ version: changed.version, excluded: changed.excluded,
    questions: changed.questions.map(({ correctKey, explanation, ...item }) => item),
    answerKeys: changed.questions.map((item) => ({ id: item.id, correctKey: item.correctKey, explanation: item.explanation })) }));
  assert.equal(updated.version, changed.version);
  assert.equal(readCache(disk).version, changed.version);
  await assert.rejects(() => refreshCache(updated, disk, async () => { throw Error('offline'); }), /offline/);
  assert.equal(readCache(disk).version, changed.version);
  await assert.rejects(() => refreshCache(updated, disk, async () => Response.json({ error: 'bad' }, { status: 503 })));
  assert.equal(readCache(disk).version, changed.version);
});
test('local sampling makes no requests and returns 30 unique questions each attempt', () => {
  const cache = validateCache(bank);
  const before = JSON.stringify(cache);
  const samples = Array.from({ length: 10 }, () => sampleCachedQuestions(cache));
  for (const sample of samples) {
    assert.equal(sample.length, 30);
    assert.equal(new Set(sample.map((q) => q.id)).size, 30);
  }
  assert.ok(new Set(samples.map((sample) => sample.map((q) => q.id).join(','))).size > 1);
  assert.equal(JSON.stringify(cache), before);
});
