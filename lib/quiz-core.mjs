import { createHmac, randomInt, randomUUID, timingSafeEqual, createHash } from 'node:crypto';

export const QUIZ_SIZE = 30;
export const TOKEN_TTL = 24 * 60 * 60 * 1000;
export class QuizError extends Error {}

export function validateBank(bank) {
  if (!Array.isArray(bank)) throw new QuizError('Ngân hàng câu hỏi không hợp lệ.');
  const ids = new Set();
  for (const question of bank) {
    if (!question || typeof question.id !== 'string' || !question.id || ids.has(question.id)
      || !Number.isInteger(question.sourceNumber) || question.sourceNumber < 1
      || typeof question.prompt !== 'string' || !question.prompt.trim()
      || typeof question.explanation !== 'string' || !question.explanation.trim()
      || typeof question.active !== 'boolean' || !['A', 'B', 'C', 'D'].includes(question.correctKey)
      || !Array.isArray(question.options) || question.options.length !== 4
      || question.options.some((option, index) => !option || option.key !== 'ABCD'[index] || typeof option.text !== 'string' || !option.text.trim())) {
      throw new QuizError('Ngân hàng có câu hỏi thiếu hoặc sai định dạng.');
    }
    ids.add(question.id);
  }
  return bank;
}

export function sampleQuestions(bank, count = QUIZ_SIZE) {
  const questions = bank.filter((question) => question.active);
  if (questions.length < count) throw new QuizError(`Cần ít nhất ${count} câu hợp lệ để tạo đề.`);
  for (let index = questions.length - 1; index > 0; index--) {
    const swap = randomInt(index + 1);
    [questions[index], questions[swap]] = [questions[swap], questions[index]];
  }
  return questions.slice(0, count);
}

export function publicQuestion(question) {
  return { id: question.id, sourceNumber: question.sourceNumber, prompt: question.prompt, options: question.options };
}

export function bankVersion(bank) {
  return createHash('sha256').update(JSON.stringify(bank)).digest('hex');
}

export function signAttempt(ids, version, secret, now = Date.now()) {
  const payload = Buffer.from(JSON.stringify({ id: randomUUID(), ids, version, expires: now + TOKEN_TTL })).toString('base64url');
  const signature = createHmac('sha256', secret).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}

export function verifyAttempt(token, bank, secret, now = Date.now()) {
  if (typeof token !== 'string' || token.length > 8192) throw new QuizError('Mã bài làm không hợp lệ.');
  const [payload, signature, extra] = token.split('.');
  if (!payload || !signature || extra) throw new QuizError('Mã bài làm không hợp lệ.');
  const expected = createHmac('sha256', secret).update(payload).digest();
  const actual = Buffer.from(signature, 'base64url');
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) throw new QuizError('Mã bài làm không hợp lệ.');
  let attempt;
  try { attempt = JSON.parse(Buffer.from(payload, 'base64url').toString()); }
  catch { throw new QuizError('Mã bài làm không hợp lệ.'); }
  if (!Number.isFinite(attempt.expires) || attempt.expires <= now) throw new QuizError('Bài làm hết hạn. Hãy tạo đề mới.');
  if (attempt.version !== bankVersion(bank)) throw new QuizError('Ngân hàng câu hỏi đã cập nhật. Hãy tạo đề mới.');
  if (typeof attempt.id !== 'string' || !Array.isArray(attempt.ids) || attempt.ids.length !== QUIZ_SIZE || new Set(attempt.ids).size !== QUIZ_SIZE) throw new QuizError('Đề thi không hợp lệ.');
  const questions = attempt.ids.map((id) => bank.find((question) => question.id === id && question.active));
  if (questions.some((question) => !question)) throw new QuizError('Câu hỏi trong đề không còn khả dụng.');
  return { id: attempt.id, questions };
}

export function gradeQuestions(questions, answers) {
  if (!answers || typeof answers !== 'object' || Array.isArray(answers)) throw new QuizError('Câu trả lời không hợp lệ.');
  const ids = new Set(questions.map((question) => question.id));
  for (const [id, key] of Object.entries(answers)) {
    if (!ids.has(id) || !['A', 'B', 'C', 'D'].includes(key)) throw new QuizError('Câu trả lời ngoài đề hoặc lựa chọn không hợp lệ.');
  }
  const review = questions.map((question) => ({ ...publicQuestion(question), selectedKey: answers[question.id] ?? null,
    correctKey: question.correctKey, explanation: question.explanation, isCorrect: answers[question.id] === question.correctKey }));
  const correct = review.filter((item) => item.isCorrect).length;
  const skipped = review.filter((item) => item.selectedKey === null).length;
  return { total: questions.length, correct, wrong: questions.length - correct - skipped, skipped, review };
}
