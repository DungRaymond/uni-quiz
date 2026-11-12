import type { BankQuestion } from './types';
export type CachedBank = { version: string; excluded: number; questions: BankQuestion[] };
export const CACHE_KEY: string;
export function validateCache(value: unknown): CachedBank;
export function readCache(storage: Pick<Storage, 'getItem'>): CachedBank | null;
export function writeCache(storage: Pick<Storage, 'setItem'>, bank: CachedBank): void;
export function refreshCache(current: CachedBank | null, storage: Pick<Storage, 'setItem'>, fetcher?: typeof fetch): Promise<CachedBank>;
export function sampleCachedQuestions(bank: CachedBank): Question[];
