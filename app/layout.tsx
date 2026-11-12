import type { Metadata } from 'next';
import 'katex/dist/katex.min.css';
import './globals.css';

export const metadata: Metadata = {
  title: 'Uni · Luyện tập Lý – Dược',
  description: 'Luyện tập 30 câu hỏi Vật lý – Lý sinh Dược ngẫu nhiên. Xem đáp án và giải thích sau khi nộp bài.',
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="vi"><body>{children}</body></html>;
}
