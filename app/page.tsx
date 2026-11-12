import Quiz from './quiz';
import { dataMode, loadBank } from '../lib/bank';
export const dynamic = 'force-dynamic';

export default async function Page() {
  try {
    const bank = await loadBank();
    return <Quiz bankSize={bank.filter((question) => question.active).length} excluded={bank.filter((question) => !question.active).length} mode={dataMode()} />;
  } catch (error) {
    console.error('Load bank:', error);
    return <Quiz bankSize={0} excluded={0} mode={dataMode()} initialError="Không tải được ngân hàng câu hỏi. Kiểm tra cấu hình Supabase rồi tải lại trang." />;
  }
}
