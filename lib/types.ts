export type OptionKey = 'A' | 'B' | 'C' | 'D';
export type Question = {
  id: string;
  sourceNumber: number;
  prompt: string;
  options: { key: OptionKey; text: string }[];
};
export type BankQuestion = Question & {
  correctKey: OptionKey;
  explanation: string;
  active: boolean;
  exclusionReason: string | null;
};
export type Attempt = { token: string; questions: Question[] };
export type Result = {
  total: number;
  correct: number;
  wrong: number;
  skipped: number;
  review: (Question & { selectedKey: OptionKey | null; correctKey: OptionKey; explanation: string; isCorrect: boolean })[];
};
