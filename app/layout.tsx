import type { Metadata } from 'next';
import 'katex/dist/katex.min.css';
import './globals.css';

export const metadata: Metadata = {
  title: 'Uni · Luyện tập Lý – Dược',
  description: 'Tự luyện câu hỏi Vật lý – Lý sinh Dược, không giới hạn thời gian.',
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="vi"><body>{children}</body></html>;
}
