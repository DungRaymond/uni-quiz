import type { BankQuestion, Question, Result, OptionKey } from './types';
export const QUIZ_SIZE: number;
export const TOKEN_TTL: number;
export class QuizError extends Error {}
export function validateBank(bank: unknown): BankQuestion[];
export function sampleQuestions(bank: BankQuestion[], count?: number): BankQuestion[];
export function publicQuestion(question: BankQuestion): Question;
export function bankVersion(bank: BankQuestion[]): string;
export function signAttempt(ids: string[], version: string, secret: string, now?: number): string;
export function verifyAttempt(token: unknown, bank: BankQuestion[], secret: string, now?: number): { id: string; questions: BankQuestion[] };
export function signBankVersion(version: string, secret: string): string;
export function verifyCachedAttempt(body: { attemptId?: unknown; ids?: unknown; version?: unknown; bankToken?: unknown; startedAt?: unknown; completedAt?: unknown }, bank: BankQuestion[], secret: string, now?: number): { id: string; questions: BankQuestion[] };
export function gradeQuestions(questions: Question[], answers: Record<string, OptionKey>): Result;
