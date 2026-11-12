# Uni · Luyện tập Lý – Dược

Next.js App Router + TypeScript + React. CSS thuần, KaTeX hiển thị công thức. Không cần Supabase để chạy thử.

## Chạy local

Yêu cầu Node.js 22.9+ (khuyến nghị Node.js 24 LTS).

```powershell
Set-Location 'F:\uni\webapp'
npm.cmd ci
npm.cmd run import:questions
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
- Markdown mode không lưu bài làm. Supabase mode lưu snapshot bài nộp, UUID chống ghi trùng khi gửi lại.
- Chưa có tài khoản hoặc lịch sử cá nhân. Đây là ứng dụng tự học, không phải hệ thống thi chống gian lận.

## Kiểm tra và sinh dữ liệu

```powershell
npm.cmd run check:questions
npm.cmd test
npm.cmd run build
npm.cmd run typecheck
npm.cmd run test:smoke
```

`npm run import:questions` sinh `data/questions.json` và `supabase/seed.sql`.
Script báo lỗi nếu thiếu nội dung, giải thích, đáp án, lựa chọn hoặc trùng ID.
Seed chạy trong transaction, dùng upsert; import lại không nhân đôi và không xóa câu ngoài nguồn.
ID dựa trên số câu nguồn: không đánh số lại các câu đã import nếu cần giữ định danh lâu dài.
Build tự sinh lại dữ liệu. Giữ cả thư mục `lý-dược` và `webapp` khi deploy từ repo `F:\uni`.

## Supabase (khi có thông tin kết nối)

1. Chạy `F:\uni\webapp\supabase\migrations\001_quiz_schema.sql` trong Supabase SQL Editor.
2. Chạy `F:\uni\webapp\supabase\seed.sql`.
3. Tạo `.env.local` theo `.env.example`; điền `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` và `QUIZ_SIGNING_SECRET`.
4. Khởi động lại Next.js. App tự chuyển sang Supabase khi có `SUPABASE_URL`.

Bảng `questions` lưu nội dung và lựa chọn; `question_answer_keys` lưu đáp án và lời giải.
Bảng `quiz_attempts` lưu snapshot câu hỏi, đáp án đã chọn, kết quả và thời gian nộp.
RLS bật; `anon` và `authenticated` không có quyền truy cập bảng trực tiếp.
Chỉ Next.js server dùng service role qua REST API. Không cần dependency Supabase SDK.
Không đặt khóa bí mật trong biến `NEXT_PUBLIC_*`, mã client hoặc Git.
Khi Supabase lỗi, app báo lỗi thay vì âm thầm dùng dữ liệu local. Không thông báo nộp thành công nếu lưu thất bại.
Chưa chạy migration trên Supabase thật vì chưa có thông tin kết nối.

## Deploy Vercel

1. Đưa toàn bộ `F:\uni` vào Git repository; không commit `.env.local` hoặc `node_modules`.
2. Import repo trên Vercel, Framework Preset: Next.js, Root Directory: `webapp`.
3. Bật **Include source files outside of the Root Directory in the Build Step** để script đọc Markdown ở thư mục môn học.
4. Build Command: `npm run build`; Install Command: `npm ci`; Node.js: 24.x.
5. Thêm `QUIZ_SIGNING_SECRET` vào Environment Variables. Thêm hai biến Supabase nếu đã migrate.
6. Deploy. Không cần `vercel.json` hoặc static export; API routes cần Node.js runtime.

Sinh secret bằng:

```powershell
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Đặt giá trị đầu ra vào `QUIZ_SIGNING_SECRET` (ít nhất 32 byte). Production từ chối tạo bài nếu thiếu secret.
Có thể deploy Markdown mode trước; kết quả chưa lưu cloud cho đến khi cấu hình Supabase.
Font Google có fallback hệ thống nếu mạng chặn. KaTeX và font toán được bundle trong app.

## API nội bộ

- `POST /api/quiz`: trả `{ token, questions }` gồm 30 câu không kèm đáp án.
- `POST /api/quiz/submit`: nhận `{ token, answers: { [questionId]: 'A' | 'B' | 'C' | 'D' } }`, trả kết quả và lời giải.

Không có public API đọc toàn bộ đáp án, không có API xem bài người khác.
Chưa có rate limit phân tán; thêm Vercel Firewall/rate limiting trước khi quảng bá công khai rộng rãi.
Chưa chống sửa đáp án khi gửi lại token sau lần nộp đầu; snapshot Supabase chỉ giữ lần nộp đầu tiên.
