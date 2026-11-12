# Uni · Luyện tập Lý – Dược

Next.js App Router + TypeScript + React. CSS thuần, KaTeX hiển thị công thức.
**Supabase là nguồn dữ liệu:** không bundle ngân hàng hoặc dùng fallback Markdown trong runtime.
Trình duyệt lưu câu hỏi, đáp án và lời giải trong localStorage để tự học trực tiếp trên thiết bị.
Tạo đề ngẫu nhiên, chọn đáp án và xem lời giải đều thực hiện ngay trên thiết bị; không cần tài khoản, secret, chấm/lưu bài trên server hay giới hạn giờ.
Chưa có service worker: cache dữ liệu không đồng nghĩa mở được toàn bộ webapp khi offline.

## Chạy local

Yêu cầu Node.js 22.9+ (khuyến nghị Node.js 24 LTS).

```powershell
Set-Location 'F:\uni\webapp'
npm.cmd ci
# Điền .env.local theo .env.example, chạy migration và sync bên dưới trước.
npm.cmd run check:supabase
npm.cmd run dev
```

Mở http://localhost:3000. Nguồn gốc: `F:\uni\lý-dược\ngan_hang_cau_hoi_ly_duoc.md`.
71 câu được import và active. Theo yêu cầu, câu 23 và 62 cũng được dùng; nội dung/đáp án không thay đổi.
`supabase/migrations/003_activate_questions.sql` chỉ bật active cho hai câu này, không sửa trường khác.
Đáp án câu 55 được giữ theo đánh dấu giáo trình trong Markdown, không tự hiệu chỉnh chuyên môn.
Ảnh gốc là ảnh chụp đề, không đưa lên client vì có thể lộ lựa chọn; nội dung và công thức đã được chép đầy đủ.

## Luồng luyện tập

- Mỗi lượt lấy 30 câu khác nhau từ cache bằng Fisher–Yates và Web Crypto, không gọi Supabase khi tạo đề.
- Các lượt độc lập; có thể gặp lại câu đã làm.
- Chuyển câu và đổi đáp án tùy ý; đáp án đúng và lời giải hiện ngay sau khi chọn.
- Không giới hạn thời gian, không có bước nộp bài hoặc chấm/lưu kết quả tập trung.
- Tạo đề mới không giới hạn; các lượt có thể gặp lại câu đã làm.
- Cache câu hỏi gồm cả đáp án/lời giải, chỉ lưu trên thiết bị cá nhân; xóa dữ liệu trình duyệt sẽ xóa cache.

## Kiểm tra và sinh dữ liệu

```powershell
npm.cmd run check:questions
npm.cmd test
npm.cmd run build
npm.cmd run typecheck
npm.cmd run test:smoke
```

`npm run import:questions` chỉ sinh `supabase/seed.sql` để migration thủ công, không sinh JSON runtime.
Script báo lỗi nếu thiếu nội dung, giải thích, đáp án, lựa chọn hoặc trùng ID.
`npm run sync:supabase` đọc Markdown và upsert toàn bộ qua RPC trong một transaction, sau đó đối chiếu từng trường.
Seed và RPC không nhân đôi hoặc xóa câu ngoài nguồn. Không đánh số lại câu đã import.
Build không đọc Markdown và không cần source ngoài `webapp`. Test parser và sync vẫn cần thư mục `lý-dược`.
Smoke test dùng mock HTTP trong process test riêng, không đưa mock hoặc ngân hàng vào app production.

## Supabase

1. Chạy `F:\uni\webapp\supabase\migrations\001_quiz_schema.sql` trong Supabase SQL Editor.
2. Chạy `F:\uni\webapp\supabase\migrations\002_import_question_bank.sql` để tạo RPC import chỉ dành cho service role.
3. Điền `.env.local`: `NEXT_PUBLIC_SUPABASE_URL` (hoặc `SUPABASE_URL`), `SUPABASE_SERVICE_ROLE_KEY`.
4. Chạy `npm run sync:supabase`, rồi `npm run check:supabase` để đối chiếu dữ liệu và chặn truy cập ẩn danh.
5. Khởi động lại Next.js. Không có ngân hàng giả; dữ liệu thiết bị là cache từ Supabase.

Migration tạo bảng/RPC cần Supabase SQL Editor hoặc Management API; service role REST key không có quyền chạy DDL.
Có thể chạy `supabase/seed.sql` thay cho RPC nếu muốn import thủ công. Không cần Uploadcare cho app này.

Bảng `questions` lưu nội dung và lựa chọn; `question_answer_keys` lưu đáp án và lời giải.
Bảng `quiz_attempts` lưu snapshot câu hỏi, đáp án đã chọn, kết quả và thời gian nộp.
RLS bật; `anon` và `authenticated` không có quyền truy cập bảng trực tiếp.
Chỉ Next.js server dùng service role qua REST API. Không cần dependency Supabase SDK.
Không đặt khóa bí mật trong biến `NEXT_PUBLIC_*`, mã client hoặc Git.
Khi tải ngầm lỗi, app giữ cache đã tải trước. Nếu chưa có cache thì báo lỗi. Không thông báo nộp thành công nếu lưu thất bại.
Kiểm tra hiện tại: REST kết nối được, ba bảng có sẵn nhưng rỗng; RPC import chưa có. Chưa hoàn tất migration/sync thật.

## Deploy Vercel

1. Đưa toàn bộ `F:\uni` vào Git repository; không commit `.env.local` hoặc `node_modules`.
2. Import repo trên Vercel, Framework Preset: Next.js, Root Directory: `webapp`.
3. Không cần bật **Include source files outside of the Root Directory in the Build Step**; runtime chỉ đọc Supabase.
4. Build Command: `npm run build`; Install Command: `npm ci`; Node.js: 24.x.
5. Thêm `NEXT_PUBLIC_SUPABASE_URL` và `SUPABASE_SERVICE_ROLE_KEY` vào Environment Variables.
6. Deploy. Không cần `vercel.json` hoặc static export; API routes cần Node.js runtime.

Chỉ deploy khi đã migrate/import ngân hàng và xác minh quyền truy cập. `.env.local` không tự được gửi lên Vercel.
Font Google có fallback hệ thống nếu mạng chặn. KaTeX và font toán được bundle trong app.

## API nội bộ

- `GET /api/quiz/bank`: trả danh sách câu hỏi và đáp án/lời giải tách riêng cho ứng dụng tự học; response luôn mới và không cache ở CDN.
