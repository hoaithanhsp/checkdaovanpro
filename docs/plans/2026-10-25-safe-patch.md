# Safe Patch Implementation Plan

> **REQUIRED:** Follow TDD for every task. No production code without failing test first.

**Goal:** Vá các lỗi gây kết luận sai, mất dữ liệu và treo trình duyệt trong app SKKN hiện tại mà không yêu cầu backend mới.
**Stack:** React 19 + TypeScript + Vite + Gemini API client-side
**Passing score target:** Không áp dụng — đây là app thẩm định, không phải quiz.

## Scope

- [ ] Thay đổi thông điệp AI/đạo văn thành chỉ báo tham khảo, không khẳng định đo lường thật.
- [ ] Bỏ ép điểm tăng theo lịch sử và cấm tự tạo số liệu trong AutoFix.
- [ ] Đổi “Giảm độ AI” thành biên tập minh bạch, bỏ mục tiêu phần trăm né detector.
- [ ] Giới hạn file theo dung lượng, số trang và ký tự; báo rõ khi vượt ngưỡng.
- [ ] Hủy timer cũ khi reset/unmount và truyền đúng trạng thái loading.
- [ ] Không tự nối nội dung AutoFix bị cắt; từ chối xuất DOCX fallback phá định dạng.
- [ ] Chuẩn hóa rubric theo 30/40/20/10 và thêm typecheck vào build.

## Verification

- [ ] `npm run typecheck` — TypeScript không còn lỗi.
- [ ] `npm run build` — Vite build thành công.
- [ ] Kiểm tra diff để bảo đảm không còn mục tiêu AI `< 15%`, không còn prompt ép tăng điểm, không còn fallback tự xóa body DOCX.

## TDD note

Repo hiện chưa có test runner. Với các thay đổi bảo vệ dữ liệu và prompt, dùng kiểm tra tĩnh + typecheck/build trong đợt vá này; không thêm test giả chỉ để làm xanh pipeline.
