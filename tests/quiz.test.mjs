import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parseQuestions, createSeed, source } from '../scripts/import-questions.mjs';
import { validateBank, sampleQuestions, publicQuestion, bankVersion, signAttempt, verifyAttempt, signBankVersion, verifyCachedAttempt, gradeQuestions, TOKEN_TTL } from '../lib/quiz-core.mjs';

const markdown = await readFile(source, 'utf8');
const bank = parseQuestions(markdown);
const secret = 'test-secret-at-least-thirty-two-characters';

test('parses actual bank, preserves formulas and activates every source question', () => {
  assert.equal(bank.length, 71);
  assert.equal(bank.filter((question) => question.active).length, 71);
  assert.equal(bank.find((question) => question.sourceNumber === 62).active, true);
  assert.equal(bank.find((question) => question.sourceNumber === 23).active, true);
  assert.equal(bank[0].correctKey, 'C');
  assert.ok(bank[3].options[3].text.includes('\\Delta U'));
  assert.ok(bank[70].explanation.includes('Na⁺'));
  assert.ok(bank.every((question) => question.options.length === 4 && question.explanation));
});
test('rejects missing answers, duplicate ids and missing options', () => {
  assert.throws(() => parseQuestions(markdown.replace('*(Đáp án đúng)*', '')), /đúng một đáp án/);
  assert.throws(() => parseQuestions(markdown.replace('### Câu 2\n', '### Câu 1\n')), /trùng/);
  assert.throws(() => parseQuestions(markdown.replace('  * B. Phân giải glycogen', '')), /bốn lựa chọn/);
});
test('validates remote bank data at the trust boundary', () => {
  assert.equal(validateBank(bank), bank);
  assert.throws(() => validateBank(null), /không hợp lệ/);
  assert.throws(() => validateBank([...bank, bank[0]]), /sai định dạng/);
  assert.throws(() => validateBank([{ ...bank[0], correctKey: 'E' }]), /sai định dạng/);
  assert.throws(() => validateBank([{ ...bank[0], options: [] }]), /sai định dạng/);
});
test('seed is deterministic, transactional, escaped and idempotent', () => {
  const special = structuredClone(bank[0]);
  special.explanation = "O'Brien";
  const sql = createSeed([special]);
  assert.ok(sql.includes("O''Brien"));
  assert.ok(sql.includes('on conflict'));
  assert.ok(sql.includes('begin;'));
  assert.ok(sql.endsWith('commit;\n'));
  assert.equal(createSeed(bank), createSeed(bank));
});
test('samples 30 unique active questions without mutating bank; varies between attempts', () => {
  const before = JSON.stringify(bank);
  const samples = Array.from({ length: 15 }, () => sampleQuestions(bank));
  for (const sample of samples) {
    assert.equal(sample.length, 30);
    assert.equal(new Set(sample.map((question) => question.id)).size, 30);
    assert.ok(sample.every((question) => question.active));
  }
  assert.ok(new Set(samples.map((sample) => sample.map((question) => question.id).join(','))).size > 1);
  assert.equal(JSON.stringify(bank), before);
  assert.throws(() => sampleQuestions(bank.slice(0, 29)), /ít nhất/);
});
test('question response never exposes answer keys or explanation', () => {
  for (const question of bank) {
    const publicData = publicQuestion(question);
    assert.deepEqual(Object.keys(publicData), ['id', 'sourceNumber', 'prompt', 'options']);
  }
});
test('legacy signed-attempt validation rejects tampering, expiry and bank updates', () => {
  const ids = sampleQuestions(bank).map((question) => question.id);
  const token = signAttempt(ids, bankVersion(bank), secret, 1000);
  assert.deepEqual(verifyAttempt(token, bank, secret, 2000).questions.map((question) => question.id), ids);
  assert.throws(() => verifyAttempt(token + 'x', bank, secret, 2000), /không hợp lệ/);
  assert.throws(() => verifyAttempt(token, bank, secret, 1000 + TOKEN_TTL), /hết hạn/);
  assert.throws(() => verifyAttempt(token, bank.slice(1), secret, 2000), /cập nhật/);
  assert.throws(() => verifyAttempt(signAttempt(Array(30).fill(ids[0]), bankVersion(bank), secret), bank, secret), /Đề thi/);
});
test('legacy cached-attempt validation checks attempt metadata', () => {
  const version = bankVersion(bank);
  const body = { attemptId: 'f02c3efc-6931-401b-8ae7-7d38c977b3ec', startedAt: 1000, completedAt: 2000,
    version, bankToken: signBankVersion(version, secret), ids: sampleQuestions(bank).map((q) => q.id) };
  assert.equal(verifyCachedAttempt(body, bank, secret, 2000).questions.length, 30);
  assert.throws(() => verifyCachedAttempt({ ...body, ids: Array(30).fill(body.ids[0]) }, bank, secret, 2000), /Đề thi/);
  assert.throws(() => verifyCachedAttempt({ ...body, ids: ['outside', ...body.ids.slice(1)] }, bank, secret, 2000), /khả dụng/);
  assert.throws(() => verifyCachedAttempt({ ...body, bankToken: 'x' }, bank, secret, 2000), /Chữ ký/);
  assert.throws(() => verifyCachedAttempt({ ...body, attemptId: 'invalid' }, bank, secret, 2000), /Mã bài/);
  assert.equal(verifyCachedAttempt({ ...body, completedAt: 1000 + TOKEN_TTL }, bank, secret, 1000 + TOKEN_TTL + 60000).questions.length, 30);
  assert.equal(verifyCachedAttempt({ ...body, completedAt: 1001 + TOKEN_TTL }, bank, secret, 1001 + TOKEN_TTL).questions.length, 30);
  assert.throws(() => verifyCachedAttempt({ ...body, completedAt: undefined }, bank, secret, 2000), /Thời gian nộp/);
  assert.throws(() => verifyCachedAttempt({ ...body, completedAt: 999 }, bank, secret, 2000), /Thời gian nộp/);
  assert.throws(() => verifyCachedAttempt(body, bank.slice(1), secret, 2000), /cập nhật/);
});
test('grades right, wrong, skipped; rejects unknown questions and invalid options', () => {
  const questions = sampleQuestions(bank);
  const answers = Object.fromEntries(questions.map((question) => [question.id, question.correctKey]));
  assert.equal(gradeQuestions(questions, answers).correct, 30);
  delete answers[questions[0].id];
  answers[questions[1].id] = questions[1].correctKey === 'A' ? 'B' : 'A';
  const result = gradeQuestions(questions, answers);
  assert.equal(result.correct, 28);
  assert.equal(result.wrong, 1);
  assert.equal(result.skipped, 1);
  assert.equal(gradeQuestions(questions, {}).skipped, 30);
  assert.throws(() => gradeQuestions(questions, { outside: 'A' }), /ngoài đề/);
  assert.throws(() => gradeQuestions(questions, { [questions[0].id]: 'E' }), /không hợp lệ/);
  assert.throws(() => gradeQuestions(questions, []), /không hợp lệ/);
});
