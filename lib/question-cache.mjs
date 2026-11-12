export const CACHE_KEY = 'uni-quiz-bank-v2';

export function validateCache(value) {
  if (!value || typeof value.version !== 'string' || !/^[a-f0-9]{64}$/.test(value.version)
    || !Number.isInteger(value.excluded) || value.excluded < 0 || !Array.isArray(value.questions)
    || value.questions.length < 30) throw new Error('Cache ngân hàng không hợp lệ.');
  const ids = new Set();
  const questions = value.questions.map((question) => {
    if (!question || typeof question.id !== 'string' || !question.id || ids.has(question.id)
      || !Number.isInteger(question.sourceNumber) || question.sourceNumber < 1
      || typeof question.prompt !== 'string' || !question.prompt.trim()
      || !Array.isArray(question.options) || question.options.length !== 4
      || question.options.some((option, index) => !option || option.key !== 'ABCD'[index] || typeof option.text !== 'string' || !option.text.trim())) {
      throw new Error('Cache câu hỏi không hợp lệ.');
    }
    ids.add(question.id);
    const correctKey = question.correctKey ?? question.answerKey ?? question.correct_key ?? question.question_answer_keys?.correct_key;
    const explanation = question.explanation ?? question.answerExplanation ?? question.answer_explanation ?? question.question_answer_keys?.explanation;
    if (!['A', 'B', 'C', 'D'].includes(correctKey) || typeof explanation !== 'string' || !explanation.trim()) throw new Error('Cache đáp án không hợp lệ.');
    // This is a personal study app: keep answers on this device for instant review.
    return { id: question.id, sourceNumber: question.sourceNumber, prompt: question.prompt,
      options: question.options.map(({ key, text }) => ({ key, text })), correctKey, explanation };
  });
  return { version: value.version, excluded: value.excluded, questions };
}

export function readCache(storage) {
  try { return validateCache(JSON.parse(storage.getItem(CACHE_KEY))); }
  catch { return null; }
}
export function writeCache(storage, bank) {
  try { storage.setItem(CACHE_KEY, JSON.stringify(validateCache(bank))); } catch { /* Storage blocked/full: keep in-memory bank. */ }
}
export async function refreshCache(current, storage, fetcher = fetch) {
  const response = await fetcher('/api/quiz/bank', {
    cache: 'no-store', headers: {},
    signal: AbortSignal.timeout(30000),
  });
  if (!response.ok) throw new Error('Không tải được ngân hàng câu hỏi. Hãy thử lại.');
  const payload = await response.json();
  const keyMap = new Map((payload.answerKeys ?? []).map((row) => [row.id, row]));
  const bank = validateCache({ ...payload, questions: (payload.questions ?? []).map((question) => {
    const key = keyMap.get(question.id);
    return { ...question, correctKey: key?.correctKey ?? key?.correct_key, explanation: key?.explanation };
  }) });
  if (bank.version !== current?.version || !current) writeCache(storage, bank);
  return bank;
}
export function sampleCachedQuestions(bank) {
  const questions = [...bank.questions];
  const randomInt = (max) => {
    const limit = 0x100000000 - (0x100000000 % max);
    const value = new Uint32Array(1);
    do { crypto.getRandomValues(value); } while (value[0] >= limit);
    return value[0] % max;
  };
  for (let index = questions.length - 1; index > 0; index--) {
    const swap = randomInt(index + 1);
    [questions[index], questions[swap]] = [questions[swap], questions[index]];
  }
  return questions.slice(0, 30);
}
