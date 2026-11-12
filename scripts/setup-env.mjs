import { readFile, appendFile } from 'node:fs/promises';
import { parseEnv } from 'node:util';
import { randomBytes } from 'node:crypto';
import path from 'node:path';
import { root } from './import-questions.mjs';
const file = path.join(root, '.env.local');
const text = await readFile(file, 'utf8');
const env = parseEnv(text);
if (env.QUIZ_SIGNING_SECRET && Buffer.byteLength(env.QUIZ_SIGNING_SECRET) >= 32) {
  console.log('QUIZ_SIGNING_SECRET đã hợp lệ; giữ nguyên.');
} else if (Object.hasOwn(env, 'QUIZ_SIGNING_SECRET')) {
  throw new Error('QUIZ_SIGNING_SECRET đã khai báo nhưng quá ngắn; sửa thủ công để tránh thay khóa bài đang làm.');
} else {
  await appendFile(file, `\n# Server-only quiz token signature\nQUIZ_SIGNING_SECRET=${randomBytes(32).toString('hex')}\n`);
  console.log('Đã thêm QUIZ_SIGNING_SECRET ngẫu nhiên; không hiển thị giá trị.');
}
