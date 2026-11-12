import Quiz from './quiz';
import { loadBank } from '../lib/bank';
export const dynamic = 'force-dynamic';

export default async function Page() {
  try {
    const bank = await loadBank();
    return <Quiz bankSize={bank.filter((question) => question.active).length} excluded={bank.filter((question) => !question.active).length} />;
  } catch (error) {
    console.error('Load bank:', error);
    return <Quiz bankSize={0} excluded={0} initialError="Không tải được ngân hàng câu hỏi. Kiểm tra cấu hình Supabase và migration rồi tải lại trang." />;
  }
}
