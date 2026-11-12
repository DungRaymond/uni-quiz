import 'server-only';
export { loadBank, saveResult } from './supabase.mjs';

export function signingSecret() {
  const secret = process.env.QUIZ_SIGNING_SECRET;
  if (!secret || Buffer.byteLength(secret) < 32) throw new Error('QUIZ_SIGNING_SECRET phải có ít nhất 32 byte.');
  return secret;
}
