import type { BankQuestion, Result } from './types';
export function credentials(): { url: string; key: string };
export function supabaseRequest(path: string, init?: RequestInit): Promise<Response>;
export function loadBank(): Promise<BankQuestion[]>;
export function saveResult(id: string, result: Result): Promise<Result>;
