# Uni · Luyện tập Lý – Dược

Next.js App Router + TypeScript + React. CSS thuần, KaTeX hiển thị công thức.
**Chỉ dùng Supabase:** không còn dữ liệu JSON tạm, ngân hàng bundle hoặc fallback Markdown trong runtime.

## Chạy local

Yêu cầu Node.js 22.9+ (khuyến nghị Node.js 24 LTS).

```powershell
Set-Location 'F:\uni\webapp'
npm.cmd ci
# Điền .env.local theo .env.example, chạy migration và sync bên dưới trước.
node scripts/setup-env.mjs
npm.cmd run check:supabase
npm.cmd run dev
```

Mở http://localhost:3000. Nguồn gốc: `F:\uni\lý-dược\ngan_hang_cau_hoi_ly_duoc.md`.
71 câu được import; 69 câu được dùng. Câu 23 ghép sai đề; câu 62 chỉ có đáp án tạm, cần hỏi giảng viên.
Hai câu này được lưu inactive; không tự sửa đáp án nguồn.
Đáp án câu 55 được giữ theo đánh dấu giáo trình trong Markdown, không tự hiệu chỉnh chuyên môn.
Ảnh gốc là ảnh chụp đề, không đưa lên client vì có thể lộ lựa chọn; nội dung và công thức đã được chép đầy đủ.

## Luồng luyện tập

- Mỗi lượt lấy 30 câu khác nhau bằng Fisher–Yates và `crypto.randomInt` trên server.
- Các lượt độc lập; có thể gặp lại câu đã làm.
- Chuyển câu, đổi đáp án trước khi nộp; cảnh báo câu bỏ trống.
- Nộp bài xem số đúng, sai, bỏ trống; xem lời giải và lọc câu cần ôn lại.
- Tạo đề mới không giới hạn. Không có timer.
- Tải lại/rời trang mất bài đang làm. Trình duyệt cảnh báo khi rời bài.
- Token bài làm có chữ ký HMAC, hiệu lực 24 giờ. Không chứa đáp án.
- API tạo đề không trả đáp án hoặc giải thích. Chấm điểm trên server.
- Supabase lưu snapshot bài nộp; gửi lại cùng token luôn trả kết quả lần nộp đầu tiên, không thay đáp án đã lưu.
- Chưa có tài khoản hoặc lịch sử cá nhân. Đây là ứng dụng tự học, không phải hệ thống thi chống gian lận.

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
3. Điền `.env.local`: `NEXT_PUBLIC_SUPABASE_URL` (hoặc `SUPABASE_URL`), `SUPABASE_SERVICE_ROLE_KEY`. Chạy `node scripts/setup-env.mjs` để sinh secret còn thiếu.
4. Chạy `npm run sync:supabase`, rồi `npm run check:supabase` để đối chiếu dữ liệu và chặn truy cập ẩn danh.
5. Khởi động lại Next.js. Không có chế độ dữ liệu local.

Migration tạo bảng/RPC cần Supabase SQL Editor hoặc Management API; service role REST key không có quyền chạy DDL.
Có thể chạy `supabase/seed.sql` thay cho RPC nếu muốn import thủ công. Không cần Uploadcare cho app này.

Bảng `questions` lưu nội dung và lựa chọn; `question_answer_keys` lưu đáp án và lời giải.
Bảng `quiz_attempts` lưu snapshot câu hỏi, đáp án đã chọn, kết quả và thời gian nộp.
RLS bật; `anon` và `authenticated` không có quyền truy cập bảng trực tiếp.
Chỉ Next.js server dùng service role qua REST API. Không cần dependency Supabase SDK.
Không đặt khóa bí mật trong biến `NEXT_PUBLIC_*`, mã client hoặc Git.
Khi Supabase lỗi, app báo lỗi thay vì âm thầm dùng dữ liệu local. Không thông báo nộp thành công nếu lưu thất bại.
Kiểm tra hiện tại: REST kết nối được, ba bảng có sẵn nhưng rỗng; RPC import chưa có. Chưa hoàn tất migration/sync thật.

## Deploy Vercel

1. Đưa toàn bộ `F:\uni` vào Git repository; không commit `.env.local` hoặc `node_modules`.
2. Import repo trên Vercel, Framework Preset: Next.js, Root Directory: `webapp`.
3. Không cần bật **Include source files outside of the Root Directory in the Build Step**; runtime chỉ đọc Supabase.
4. Build Command: `npm run build`; Install Command: `npm ci`; Node.js: 24.x.
5. Thêm `QUIZ_SIGNING_SECRET`, `NEXT_PUBLIC_SUPABASE_URL` và `SUPABASE_SERVICE_ROLE_KEY` vào Environment Variables.
6. Deploy. Không cần `vercel.json` hoặc static export; API routes cần Node.js runtime.

Sinh secret bằng:

```powershell
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Đặt giá trị đầu ra vào `QUIZ_SIGNING_SECRET` (ít nhất 32 byte). Production từ chối tạo bài nếu thiếu secret.
Chỉ deploy khi đã migrate/import ngân hàng và xác minh quyền truy cập. `.env.local` không tự được gửi lên Vercel.
Font Google có fallback hệ thống nếu mạng chặn. KaTeX và font toán được bundle trong app.

## API nội bộ

- `POST /api/quiz`: trả `{ token, questions }` gồm 30 câu không kèm đáp án.
- `POST /api/quiz/submit`: nhận `{ token, answers: { [questionId]: 'A' | 'B' | 'C' | 'D' } }`, trả kết quả và lời giải.

Không có public API đọc toàn bộ đáp án, không có API xem bài người khác.
Chưa có rate limit phân tán; thêm Vercel Firewall/rate limiting trước khi quảng bá công khai rộng rãi.
Gửi lại cùng token trả kết quả đã lưu lần đầu. Không có API sửa bài đã nộp.
