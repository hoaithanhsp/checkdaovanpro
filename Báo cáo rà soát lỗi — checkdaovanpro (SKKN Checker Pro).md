# Báo cáo rà soát lỗi — checkdaovanpro (SKKN Checker Pro)

**Repo:** [https://github.com/hoaithanhsp/checkdaovanpro](https://github.com/hoaithanhsp/checkdaovanpro) · **Nhánh:** `main` · **Deploy khai báo:** [https://ktskknpro.vercel.app](https://ktskknpro.vercel.app) **Hình thức:** Repository công khai, không phải fork, ngôn ngữ chính TypeScript. **Thời điểm rà soát:** 25/10/2026. **Phương pháp:** đọc tĩnh toàn bộ mã nguồn qua GitHub REST API + raw content. Không chạy `npm ci`, không build, không gọi Gemini API thật, không mở trình duyệt kiểm thử deployment.

## Kết luận trong một đoạn

Đây là bản có kỹ thuật tốt nhất trong chuỗi sản phẩm cùng tác giả: đã tách service, có schema JSON cho phản hồi AI, có `ErrorBoundary`, có `vercel.json` với security header cơ bản, có ý thức giữ lại file Word gốc để bảo toàn định dạng. Nhưng ba rủi ro lớn nhất vẫn nguyên vẹn: **toàn bộ tài khoản giáo viên và mật khẩu nằm dạng plaintext trong repo public**, **đăng nhập chỉ là một khóa **<strong>`localStorage`</strong>, và **chức năng "kiểm tra đạo văn" thực chất là mô hình ngôn ngữ tự nghĩ ra nguồn và phần trăm tương đồng** — trong khi giao diện trình bày như một báo cáo thẩm định. Thêm vào đó, tính năng "Giảm độ AI" đặt mục tiêu số học rõ ràng cho việc né bộ phát hiện AI, đây là vấn đề liêm chính học thuật chứ không còn là vấn đề kỹ thuật.

---

## 1. Chân dung kỹ thuật

| Hạng mục | Thực tế trong repo |
| --- | --- |
| Stack | React 19 + TypeScript 5.8 + Vite 6, `@google/genai`, `docx`, `mammoth`, `pdfjs-dist`, `recharts` |
| Script build | `dev`, `build` = `vite build`, `preview` — **không có **<strong>`tsc`</strong>**, không có lint, không có test** |
| Xác thực | `data/accounts.ts` so khớp chuỗi ở client, session bằng `localStorage` |
| Gọi AI | Trực tiếp từ trình duyệt bằng API key người dùng dán vào, lưu `localStorage` |
| Provider | `gemini` và `agent-platform` \(Vertex AI routing\) |
| Triển khai | Vercel SPA rewrite + 4 header bảo mật |
| Tồn kho thừa | `dist/` đã commit với 10 bundle JS + CSS + file xác minh Google |

Kiến trúc thư mục khá gọn: `services/` \(apiKey, gemini, file, history, export, wordInjection, textNormalizer\), `components/` \(LoginPage, InputForm, FileUpload, ApiKeyModal, ResultsDashboard, AnalysisDashboard, AIReductionPanel, AutoFixPanel, TitleAnalysisPanel, ErrorBoundary\), `data/` \(accounts, improvementDatabase\), các file `.txt` chứa quy tắc chấm và giọng văn.

---

## 2. P0 — Phải xử lý ngay, có thể gây thiệt hại thật

### P0.1 — Toàn bộ danh sách tài khoản giáo viên kèm mật khẩu nằm trong repo public

`data/accounts.ts` là một bảng credentials phẳng:

```typescript
export const TRIAL_ACCOUNT: VIPAccount = {
    username: "TRANHOAITHANH",
    password: "SKKN123",
    displayName: "Dùng Thử",
    isTrial: true
};

export const VIP_ACCOUNTS: VIPAccount[] = [
    TRIAL_ACCOUNT,
    { username: "admin", password: "admin123", displayName: "Quản trị viên" },
    { username: "ntphucthao@gmail.com", password: "SKKN100", name: "GV" },
    { username: "trannguyenyennhi19@gmail.com", password: "SKKN100", name: "GV" },
    // … khoảng 250 dòng tiếp theo, gần như toàn bộ dùng chung mật khẩu "SKKN100"
    { username: "hanh.tran@ngs.edu.vn", password: "123456", displayName: "GV" }
];

export const authenticateUser = (username: string, password: string): VIPAccount | null => {
    const account = VIP_ACCOUNTS.find(
        acc => acc.username === username && acc.password === password
    );
    return account || null;
};
```

Đây không phải rò rỉ giả định. Repo công khai, ai cũng `git clone` hoặc mở DevTools trên bản deploy là thấy. Vì đa số dùng chung `SKKN100`, một người biết quy tắc đặt mật khẩu có thể thử lần lượt theo danh sách email — và danh sách email đó chính là tài liệu để thử. Ngoài ra còn lộ danh tính nghề nghiệp, đơn vị công tác \(ví dụ `nongthtu.c3bache@quangninh.edu.vn`, `vananh.thcsvinhtuyhbt@gmail.com`\).

**Việc phải làm, theo thứ tự:** thu hồi và đặt lại toàn bộ mật khẩu \(coi như đã bị lộ vĩnh viễn\); xóa `data/accounts.ts` khỏi HEAD **và** purge khỏi lịch sử Git — `git rm` đơn thuần không có tác dụng vì commit cũ vẫn còn; chuyển xác thực sang server \(Supabase Auth, Firebase Auth, Clerk hoặc một serverless function + hash Argon2/bcrypt\).

### P0.2 — Đăng nhập có thể giả mạo bằng một dòng trong Console

`data/accounts.ts`:

```typescript
export const saveLoginState = (account: VIPAccount) => {
    localStorage.setItem('vip_user', JSON.stringify({
        username: account.username,
        displayName: account.displayName || account.username,
        loginTime: new Date().toISOString()
    }));
};

export const getLoggedInUser = (): { username: string; displayName: string } | null => {
    const data = localStorage.getItem('vip_user');
    if (data) { try { return JSON.parse(data); } catch { return null; } }
    return null;
};
```

`App.tsx` chỉ hỏi "có `vip_user` không" rồi bật `setIsLoggedIn(true)`. Không chữ ký, không token, không hạn, không đối chiếu máy chủ. Bất kỳ ai mở Console và gõ:

```javascript
localStorage.setItem('vip_user', JSON.stringify({ username: 'admin', displayName: 'Quản trị viên' }));
```

…sẽ vào được toàn bộ giao diện, gồm cả khu vực được quảng bá là dành cho VIP. Cùng cơ chế đó, `isTrial` và `trial_used` chỉ là cờ phía client: xóa `localStorage` là dùng lại lượt dùng thử vô hạn, sửa state là bỏ mọi giới hạn tính năng trả phí.

Hệ quả thực tế: mọi giới hạn "chỉ VIP mới dùng" hiện tại **không tồn tại**. Nếu mô hình kinh doanh dựa vào đó thì đây là lỗ hổng doanh thu, không chỉ là lỗi bảo mật.

### P0.3 — API key nằm plaintext trong `localStorage` và có thể bị đóng gói vào bundle

`services/apiKeyService.ts`:

```typescript
const STORAGE_KEY = 'skkn-gemini-api-key';
const AGENT_PLATFORM_STORAGE_KEY = 'skkn-agent-platform-api-key';

export const saveApiKey = (key: string): void => {
  localStorage.setItem(STORAGE_KEY, sanitizeApiKey(key));
  currentFallbackIndex = -1;
  exhaustedKeys.clear();
};

const getEnvApiKeys = (): string[] => {
  const raw = import.meta.env.VITE_GEMINI_API_KEYS || '';
  if (!raw) return [];
  return raw.split(',').map((k: string) => sanitizeApiKey(k)).filter(k => k.length > 0);
};

export const ENV_API_KEYS: string[] = getEnvApiKeys();
```

Có hai đường rò rỉ độc lập. Thứ nhất, key người dùng dán vào được lưu thẳng vào `localStorage` — bất kỳ extension, XSS, hay người dùng kế tiếp trên cùng máy đều đọc được. Thứ hai, và nghiêm trọng hơn: *\*mọi biến \`VITE\_*`đều bị Vite nhúng vào bundle tại thời điểm build**. Nếu trên Vercel có đặt`VITE_GEMINI_API_KEYS` , các key đó đang nằm trong  `dist/assets/\*.js\` và ai tải trang cũng tải được. Gọi chúng là "biến môi trường" không biến chúng thành secret.

Cần phân biệt hai mô hình: nếu key là của người dùng tự cấp \(BYOK\) thì rủi ro thuộc về người dùng và phải nói rõ; nếu key là của chủ sản phẩm đặt trong env thì đó là key bị lộ và phải thu hồi ngay, đồng thời chuyển toàn bộ lời gọi Gemini sang một serverless proxy có kiểm soát quota và rate limit.

### P0.4 — `dist/` được commit dù `.gitignore` đã loại trừ

`.gitignore` có dòng `dist/`, nhưng Git tree vẫn chứa `dist/index.html`, `dist/assets/index-BROCYT_R.js`, `index-B_s7U_H-.js`, `index-BcK-d7_G.js`, `index-Bqz_pzUU.js`, `index-C2oGtrWo.js`, `index-CS1tnts_.js`, `index-Jjt_aG9a.js`, `index-ezRXxjGC.js`, `index-iKcMgy7u.js`, `index-Cf1XSrMt.css` và các file xác minh Google. Đây là dấu hiệu của việc `git add -f` hoặc thêm `dist` trước khi có `.gitignore`.

Hậu quả kép. Về bảo mật: mỗi bundle là một ảnh chụp cũ của toàn bộ logic client, gồm cả bảng tài khoản — nên kể cả sau khi xóa `accounts.ts` khỏi source, credentials vẫn đọc được từ bundle cũ. Về vận hành: có 10 bundle của nhiều thế hệ build nằm cạnh nhau, không ai biết bản nào đang được Vercel phục vụ, và rất dễ deploy nhầm bản cũ.

Xử lý: `git rm -r --cached dist`, thêm bước CI chặn commit vào `dist/`, purge lịch sử nếu bundle từng chứa key thật.

---

## 3. P1 — Sai bản chất nội dung và liêm chính học thuật

Đây là nhóm quan trọng nhất với người dùng cuối, vì nó không làm app hỏng mà làm app **nói những điều không đúng**.

### P1.1 — "Giảm độ AI" là tính năng tối ưu để né bộ phát hiện AI

`services/geminiService.ts`, prompt của luồng giảm AI:

> Áp dụng 10 KỸ THUẬT VƯỢT AI DETECTION sau để sửa lại văn bản, **mục tiêu đưa AI score xuống dưới 15%**:
>
> 1. PERPLEXITY INJECTION: Thay 15-20% từ ngữ thông dụng bằng từ đồng nghĩa học thuật ít gặp hơn…
>
> 2. BURSTINESS CONTROL: Đảm bảo có câu ngắn \(\<15 từ\) xen kẽ câu dài \(\>40 từ\)…

`AIReductionPanel.tsx` biến mục tiêu đó thành ba mức chọn được: Nhẹ \(AI \< 30%\), Trung bình \(AI \< 20%\), Mạnh \(AI \< 15%\).

Điều này khác về bản chất so với "biên tập văn phong". Sửa câu cho rõ nghĩa là hợp pháp và hợp đạo; tối ưu phân bố độ dài câu để một bộ phân loại thống kê cho ra con số thấp hơn là **dạy người dùng che dấu nguồn gốc văn bản**. Với đối tượng là giáo viên nộp sáng kiến cho hội đồng thi đua, đây là rủi ro kỷ luật trực tiếp, và nó đặt nhà phát triển vào vị trí cung cấp công cụ gian lận học thuật.

Hướng thay thế phù hợp: đổi thành "Biên tập minh bạch" — chỉ sửa lỗi chính tả, ngắt câu, làm rõ lập luận; **hiển thị diff** để tác giả thấy mình đã đổi gì; yêu cầu tick xác nhận "tôi đã kiểm chứng nội dung"; bỏ hoàn toàn mục tiêu phần trăm.

### P1.2 — Kết quả "kiểm tra đạo văn" là do mô hình tự nghĩ ra

Schema yêu cầu Gemini trả về cấu trúc sau:

```typescript
plagiarismSegments: {
  type: Type.ARRAY,
  items: { type: Type.OBJECT, properties: {
    segment: { type: Type.STRING, description: "Đoạn văn bị nghi ngờ" },
    source:  { type: Type.STRING, description: "Nguồn gốc hoặc văn bản gốc tương tự (VD: Wikipedia, 123doc, SKKN mẫu, sách giáo khoa...)" },
    similarity: { type: Type.NUMBER, description: "Phần trăm giống nhau (0-100)" },
    violatedRule: { type: Type.STRING, ... },
    advice: { type: Type.STRING, ... },
  }}
}
```

Giao diện hiển thị thẳng `Tương đồng: {seg.similarity}%` và `Nguồn: {seg.source}`. Nhưng trong toàn bộ `analyzeSKKNWithGemini()` không có một lệnh truy vấn nào tới cơ sở dữ liệu văn bản, không Google Search grounding, không API Turnitin hay Kiểm Tra Tài Liệu, không kho tham chiếu nội bộ, không độ đo so khớp chuỗi. Tất cả `source` và `similarity` là **văn bản do mô hình sinh ra theo yêu cầu của schema**.

Chính `SYSTEM_INSTRUCTION` tự thừa nhận điều này:

> Hãy **mô phỏng** quá trình kiểm tra một cách CHẶT CHẼ và CHUYÊN NGHIỆP nhất.

Và tiêu chí loại trừ lại viện dẫn những công cụ không hề được tích hợp:

> Đạo văn \> 30% \(**theo Turnitin hoặc Kiểm Tra Tài Liệu**\)

Với người dùng, "Nguồn: Wikipedia — 78%" trông y như kết quả thật. Với hội đồng, một giáo viên có thể bị buộc tội dựa trên con số không có bằng chứng nào đứng sau. Đây là dạng sai lệch nguy hiểm nhất trong toàn bộ báo cáo: không phải app không hoạt động, mà app **đưa ra kết luận có hệ quả pháp lý/kỷ luật từ dữ liệu bịa**.

Bắt buộc sửa: đổi nhãn thành "đoạn có dấu hiệu trùng lặp do AI ước lượng — không phải kết quả kiểm tra đạo văn"; **không hiển thị phần trăm** khi chưa có so khớp xác định; bỏ trường `source` hoặc đổi thành "nguồn cần tự kiểm chứng"; thêm disclaimer chặn ở đầu báo cáo. Muốn có số thật thì phải tích hợp công cụ thật \(Turnitin/iThenticate API, Copyscape, hoặc kho văn bản số hóa + so khớp shingle/MinHash\) — và khi đó mới được nói tới phần trăm.

### P1.3 — "Điểm AI" là heuristic tự chế nhưng được trình bày như phép đo chính xác

`computeTextMetrics()` tính `burstiness`, `patternDensity`, `sentenceUniformity` từ độ dài câu và một danh sách cụm từ, rồi:

```typescript
const estimatedAIScore = Math.min(100, Math.max(0, Math.round(
  patternDensity * 0.40 + burstiScore * 0.35 + sentenceUniformity * 0.25
)));
```

Sau đó trộn với điểm của Gemini: `clientMetrics.estimatedAIScore * 0.6 + geminiAIScore * 0.4`.

Ba vấn đề nối tiếp nhau. Thứ nhất, trọng số 40/35/25 không dựa trên nghiên cứu nào; nó là con số chọn tay. Thứ hai, prompt gửi cho mô hình lại tự tin thái quá:

> 📊 DỮ LIỆU AI DETECTION TÍNH TOÁN TỪ HỆ THỐNG \(**deterministic, đã được đo lường chính xác**\) ⚠️ … Điểm AI cuối cùng của bạn nên **KHÔNG CHÊNH QUÁ ±15 điểm** so với Estimated AI Score…

Câu này vừa khẳng định độ chính xác không có thật, vừa **ép** mô hình hội tụ về con số heuristic — nghĩa là phần "Gemini đánh giá độc lập" thực chất bị neo vào một công thức đếm từ. Thứ ba, các "mẫu câu AI" trong văn bản giáo dục Việt Nam \("trong bối cảnh hiện nay", "tuy nhiên", "do đó"\) xuất hiện tự nhiên trong bài của người viết thật; phạt chúng là phạt văn phong hành chính, không phải phạt AI.

Cần đổi tên thành "chỉ báo phong cách tham khảo", bỏ ngưỡng ±15, bỏ việc trộn 60/40 như thể hai nguồn độc lập cùng đo một đại lượng, và tuyệt đối không dùng con số này làm căn cứ kết luận.

### P1.4 — Prompt chỉ dẫn AI "làm cho số liệu trông thật"

Trong `autoFixSKKN()`:

> Viết theo giọng văn giáo viên thực tế: **Dùng số liệu thực tế số lẻ \(vd: 31/45 em, tránh số tròn trịa\)**, diễn đạt tự nhiên, xen kẽ quan sát cá nhân và thừa nhận các khó khăn/hạn chế khi thực hiện.

Prompt có yêu cầu giữ nguyên thông tin tác giả ở đoạn khác, nhưng chỉ dẫn trên là một lời mời trực tiếp: nếu bản gốc thiếu số liệu, mô hình có động cơ sinh ra số lẻ để "trông thật". Một con số `31/45` bịa ra trông đáng tin hơn hẳn `30/45`, và đó chính là điều nguy hiểm — nó tạo bằng chứng giả khó bị phát hiện.

Sửa thành quy tắc âm: **không tự tạo, không tự làm tròn, không tự điều chỉnh bất kỳ số liệu nào**; nếu thiếu thì chèn `[CẦN BỔ SUNG DỮ LIỆU THẬT]`; nếu buộc phải đổi thì liệt kê từng thay đổi ở cuối để tác giả duyệt.

### P1.5 — Prompt ép điểm tăng theo lịch sử chấm

```typescript
historyPrompt = `
⚠️ QUY ĐỊNH CHẤM ĐIỂM BẢN CẬP NHẬT:
… Điểm lần chấm trước là: ${prevScore} điểm.
YÊU CẦU BẮT BUỘC: Nếu bản văn này đã có sự cải thiện, bạn PHẢI cho tổng điểm cao hơn bản trước 1-2 điểm (nếu chưa đạt tối đa). Hãy tính toán cẩn thận để đảm bảo điểm tổng mới > ${prevScore}.
`;
```

Một thang điểm bị ràng buộc bởi lần chấm trước thì không còn là thang điểm. Tệ hơn, nó tạo vòng lặp tự thưởng: người dùng sửa một dấu phẩy cũng có thể nhận +1 điểm, và sau vài vòng bản kém vẫn đạt điểm cao. Cần bỏ hẳn; nếu muốn so sánh phiên bản thì làm bảng đối chiếu theo từng tiêu chí, mỗi tiêu chí chấm độc lập và được phép giảm.

### P1.6 — Hai thang điểm mâu thuẫn trong cùng một prompt

`SYSTEM_INSTRUCTION` mở đầu bằng một rubric chi tiết:

- A. Nội dung 70 điểm = cấp thiết & mới 15 + cơ sở lý luận/thực tiễn 10 + giải pháp 25 + kết quả 20

- B. Hình thức 30 điểm = bố cục 15 + ngôn ngữ 15

Rồi ngay sau đó, cùng một prompt:

> ## 🛠️ CHẤM ĐIỂM THEO 4 TIÊU CHÍ CHÍNH
>
> 1. **Tính Mới \(30đ\)** 2. **Khả Thi \(40đ\)** 3. **Khoa Học \(20đ\)** 4. **Hình Thức \(10đ\)**

Và schema thì cố định theo hệ thứ hai:

```typescript
innovation:    { description: "Điểm tính mới (max 30)" },
feasibility:   { description: "Điểm khả thi (max 40)" },
scientific:    { description: "Điểm khoa học (max 20)" },
presentation:  { description: "Điểm hình thức (max 10)" },
```

Ba hệ quả: mô hình có thể chấm theo nhóm A/B nhưng phải nhồi vào bốn trường 30/40/20/10; "Tính mới" vừa là 15 điểm vừa là 30 điểm; và người đọc không biết căn cứ nào đúng. Cần chọn **một** rubric, ghi thành hằng số dùng chung cho cả prompt và UI, và validate `total == innovation + feasibility + scientific + presentation` ở client trước khi hiển thị.

Trong cùng rubric còn một chi tiết dễ gây tranh cãi: "Tối đa 15 trang \(không tính phụ lục\)" được đặt làm tiêu chí hình thức, trong khi nhiều hội đồng cấp tỉnh không quy định cứng như vậy — nên ghi rõ "theo quy định của đơn vị" thay vì khẳng định.

### P1.7 — Gợi ý tài liệu tham khảo không có cơ chế xác minh

`suggestReferences()` yêu cầu mô hình sinh 6–8 tài liệu \(văn bản pháp quy, sách chuyên môn, bài báo khoa học, SKKN mẫu, tài liệu điện tử\) và trả về `title / author / year / type / description / citation` theo APA. Không có tra cứu, không kiểm tra DOI/URL, không đối chiếu số hiệu văn bản pháp quy, không bắt buộc đường dẫn gốc.

Kết quả là những trích dẫn **đúng hình thức APA nhưng có thể không tồn tại** — dạng lỗi khó bị phát hiện nhất khi đọc nhanh, và khi bị hội đồng phát hiện thì toàn bộ sáng kiến mất giá trị. Tối thiểu phải: yêu cầu trả kèm URL/DOI và đánh dấu `verified: false`; với văn bản pháp quy thì chỉ cho phép chọn từ danh sách số hiệu có thật do bạn tự nhập; và hiển thị cảnh báo "phải tự kiểm chứng trước khi trích dẫn".

---

## 4. P2 — Rủi ro cao về dữ liệu và độ bền

### P2.1 — AutoFix cắt im lặng ở 50.000 ký tự

```typescript
const MAX_CONTENT_LENGTH = 50000;
const wasContentTruncated = originalContent.length > MAX_CONTENT_LENGTH;
const truncatedContent = wasContentTruncated ? originalContent.substring(0, MAX_CONTENT_LENGTH) : originalContent;
```

Prompt lại yêu cầu `fixedContent` chứa **toàn bộ** nội dung gốc. Với SKKN có phụ lục, phần bị cắt thường rơi đúng vào kết luận — tài liệu tham khảo — phụ lục, tức phần quyết định điểm. Biến `wasContentTruncated` đã có nhưng không thấy cơ chế chặn cứng: phải hiện hộp thoại "nội dung vượt 50.000 ký tự, phần sau sẽ không được xử lý" và yêu cầu xác nhận, hoặc chia lô theo chương.

### P2.2 — Vá phần bị mất bằng `indexOf()` có thể nối sai chỗ

`AIReductionPanel.tsx`:

```typescript
if (ratio < 0.8 && originalContent.length > 5000) {
  const lastChunk = cleanFixed.substring(cleanFixed.length - 100).trim();
  const lastChunkIdx = originalContent.indexOf(lastChunk.substring(0, 50));
  res.fixedContent += '\n' + originalContent.substring(appendFromIdx);
}
```

`indexOf` trả về vị trí **đầu tiên**, nên với văn bản có câu lặp \(rất phổ biến trong SKKN: tiêu đề mục, câu chuyển ý\) thì đoạn nối vào sai vị trí; tệ hơn, không có gì bảo đảm phần nối không trùng với phần đã có. Cách duy nhất đúng là buộc mô hình trả về theo cấu trúc đoạn có chỉ số, hoặc đối chiếu bằng diff và báo lỗi thay vì tự vá.

### P2.3 — Ghi XML trực tiếp vào `word/document.xml` có thể phá định dạng

`services/wordInjectionService.ts` đọc `<w:t>` bằng regex, dựng lại cả `<w:p>` khi thay, và có `fallbackReplaceBody()` xóa trắng `<w:body>` rồi tạo lại paragraph đơn giản \(chỉ giữ `sectPr`\).

Ba nhóm rủi ro: regex không xử lý hết namespace/CDATA/field phức tạp; dựng lại paragraph làm mất run properties riêng, bookmark, hyperlink, comment, drawing anchor; và `modifiedXml.replace(element, result)` thay **lần xuất hiện đầu tiên**, nên nếu hai đoạn cùng nội dung thì có thể thay nhầm chỗ. Nghiêm trọng nhất là fallback: khi kích hoạt, toàn bộ bảng, hình, công thức và style trong body biến mất — trong khi phần giới thiệu sản phẩm cam kết "giữ nguyên hình ảnh, bảng, công thức, OLE/MathType". Đây là chỗ cam kết và thực thi lệch nhau rõ nhất.

Nên chuyển sang thao tác theo `w:r`/`w:t` trong đúng paragraph index \(đếm paragraph một lần, ánh xạ 1-1\), hoặc dùng một thư viện xử lý OOXML thực thụ. Và fallback phá nội dung thì phải **từ chối xuất file**, không được xuất file hỏng.

### P2.4 — Xuất Word mới không đạt chuẩn trình bày mà app tự đặt ra

`AIReductionPanel.tsx` tạo `new DocClass({ sections: [{ properties: {}, children }] })` với `font: 'Times New Roman'`, `size: 26`. Nhưng `properties: {}` nghĩa là không khổ A4, không lề trên 2 / dưới 2 / trái 3 / phải 2 cm, không số trang, không footer — tức vi phạm đúng tiêu chí "Bố cục và trình bày \(15 điểm\)" mà chính app dùng để chấm. Markdown bị strip bằng regex và nội dung chỉ tách theo dòng, nên bảng và heading mất cấu trúc.

### P2.5 — Upload file không giới hạn kích thước hay số trang

`FileUpload.tsx` nhận file đầu tiên, không kiểm tra dung lượng, số trang PDF, số ký tự sau trích xuất, hay MIME thực tế. `fileService.ts` đọc toàn bộ PDF phía client rồi nối chuỗi:

```typescript
fullText += pageText + '\n\n';
```

Một PDF scan 300 trang có thể treo tab; một DOCX nén bất thường có thể làm cạn bộ nhớ. Cần chặn ở ngưỡng hợp lý \(ví dụ 15 MB / 60 trang / 200.000 ký tự\), báo rõ khi cắt, và kiểm tra magic bytes thay vì tin phần mở rộng.

### P2.6 — PDF.js worker tải từ CDN bên ngoài

```typescript
pdfjsLib.GlobalWorkerOptions.workerSrc =
  `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
```

Phụ thuộc một CDN không kiểm soát, không có SRI. Nếu unpkg chậm, bị chặn ở mạng trường học, hoặc đổi phiên bản thì đọc PDF hỏng mà không rõ nguyên nhân. Nên bundle worker qua Vite \(`?url` import\) để phiên bản luôn khớp.

### P2.7 — Lưu toàn bộ nội dung SKKN vào `localStorage`

`historyService.ts` giữ 20 bản gần nhất \(`skkn_check_history`\), mỗi bản gồm `input.content` và `result`. `App.tsx` lưu thêm `skkn_checker_session`. Không mã hóa, không hết hạn, không có nút "xóa toàn bộ dữ liệu" rõ ràng, và khi lưu lỗi chỉ `console.warn` — người dùng tưởng đã lưu nhưng thực ra mất.

Riêng `SKKNInput.originalDocx` chứa `arrayBuffer: ArrayBuffer`. Đưa nó vào `JSON.stringify` sẽ sinh ra object khổng lồ và khi khôi phục **không còn là **<strong>`ArrayBuffer`</strong>, nên tính năng ghi XML vào file gốc sau khi restore sẽ thất bại. Cần loại `originalDocx` khỏi dữ liệu lưu, hoặc lưu bằng IndexedDB \(hỗ trợ Blob/ArrayBuffer đúng cách\).

Dữ liệu SKKN chứa tên giáo viên, trường, tên học sinh, số liệu lớp — nên thông điệp "chỉ lưu cục bộ" cần đi kèm cảnh báo "máy dùng chung thì người khác đọc được".

### P2.8 — Race condition khi kết thúc phân tích

```typescript
setTimeout(() => {
  setResult(analysis);
  setStatus(AnalysisStatus.SUCCESS);
  saveToHistory(data, analysis);
}, 500);
```

`progressInterval` được clear nhưng `setTimeout` không được lưu handle và không bị clear khi reset/unmount. Submit hai lần nhanh có thể để callback cũ ghi đè kết quả mới. Đồng thời `InputForm` được truyền `isLoading={false}` cố định, nên nút "KIỂM TRA NGAY" không phản ánh trạng thái loading thật của App.

### P2.9 — Thanh tiến trình mô tả bốn bước không tồn tại

`App.tsx` chạy `setInterval` 1 giây và đổi nhãn tuần tự: "Đang đọc nội dung" → "Đối chiếu dữ liệu đạo văn" → "Đánh giá tiêu chí" → "Tổng hợp báo cáo". Thực tế chỉ có một request duy nhất. Chữ "đối chiếu dữ liệu đạo văn" đặc biệt gây hiểu nhầm vì nó khẳng định một bước đối chiếu không hề xảy ra. Đổi thành thanh tiến trình vô định hoặc ghi "ước tính".

### P2.10 — Thông điệp bảo mật vượt quá sự thật

Giao diện tuyên bố:

> APP ĐẢM BẢO BẢO MẬT NỘI DUNG SKKN CỦA THẦY CÔ, CHỈ LƯU CỤC BỘ TRÊN MÁY THẦY CÔ, KHÔNG CÓ HỆ THỐNG LƯU TRỮ NÀO KHÁC…

Trong khi: toàn văn nội dung được gửi tới Google Gemini / Agent Platform; API key nằm trong `localStorage`; trang tải Tailwind CDN, Google Fonts, `esm.sh`, favicon từ Wikimedia. "Không có hệ thống lưu trữ nào khác" là câu không thể chứng minh và không đúng về mặt dữ liệu rời khỏi máy. Cần viết lại thành một đoạn minh bạch: dữ liệu được gửi tới nhà cung cấp AI nào, để làm gì, lưu gì ở máy, lưu bao lâu, và cách xóa.

### P2.11 — Danh sách model không thống nhất và chưa được xác minh

| Nơi khai báo | Chuỗi model |
| --- | --- |
| `apiKeyService.ts` \(Gemini\) | `gemini-3.6-flash`, `gemini-3.5-flash`, `gemini-3.5-flash-lite`, `gemini-3.1-flash-lite`, `gemini-2.5-flash` |
| `apiKeyService.ts` \(Agent Platform\) | `gemini-2.5-flash`, `gemini-2.5-flash-lite` |
| UI Agent Platform | thêm `gemini-2.5-pro`, `gemini-3.1-pro-preview` |
| `textNormalizerService.ts` | bộ riêng: `gemini-3.6-flash`, `gemini-3.5-flash`, `gemini-3.5-flash-lite`, `gemini-2.5-flash` |
| `AI_INSTRUCTIONS.md` | `gemini-3-flash-preview`, `gemini-3-pro-preview`, `gemini-2.5-flash` |
| `LỆNH.md` | `gemini-2.5-flash`, `gemini-3-flash-preview`, `gemini-2.5-flash-lite`, `gemini-2.5-pro` |

Bốn bộ danh sách khác nhau và không có bước verify nào. Nếu một ID không tồn tại, fallback sẽ lần lượt nhận 404 rồi mới tới model dùng được — nghĩa là mỗi lần chạy đốt thêm request vô ích. Nên có một nguồn duy nhất, và một script kiểm tra ID bằng `models.list` trước khi phát hành.

### P2.12 — Fallback không có timeout, có thể treo UI vô hạn

Vòng `callWithFallback` không dùng `AbortController` và không đặt timeout cho `generateContent`. Khi mạng chập chờn, request có thể treo rất lâu, giao diện kẹt ở trạng thái loading và người dùng mất quyền hủy. Thêm timeout 60–120 giây cho mỗi lần thử, cộng nút Hủy thật sự.

### P2.13 — `textNormalizerService.ts` là module chết và đang hỏng

```typescript
import { getSelectedModel, isInvalidKeyError, createGoogleAiClient, getModelsToTry as getServiceModelsToTry } from './apiKeyService';
```

Hai lỗi cùng lúc: `getModelsToTry` **không tồn tại** trong `apiKeyService.ts` \(tên thật là `getOrderedModels`\), và

```typescript
export const getAICorrectionDecisions = async (words, context, apiKey: string) => {
    const ai = createGoogleAiClient();
```

trong khi chữ ký thật là `createGoogleAiClient(apiKey: string, provider: AiProvider)`. Cả hai đều là lỗi biên dịch, và nếu vô tình chạy được thì client sẽ được tạo không có key → lỗi ngay lần gọi đầu. Hàm nhận `apiKey` nhưng **không dùng**.

Điều này chỉ lọt qua được vì `package.json` không có `tsc --noEmit` và module này hiện không được `import` ở đâu \(đã kiểm tra `InputForm.tsx` — không tham chiếu\). Tức là: tính năng sửa chính tả theo ngữ cảnh **không hoạt động**, và bộ build hiện tại không đủ năng lực phát hiện điều đó. Đây là bằng chứng cụ thể nhất cho việc thiếu typecheck.

Ngoài ra, kể cả khi sửa xong, phần thay thế còn một lỗi tiềm ẩn:

```typescript
const regex = new RegExp(`\\b${original}\\b`, 'g');
content = content.replace(regex, decision.corrected);
```

`\b` dựa trên `\w` \(ASCII\), nên với tiếng Việt có dấu biên từ không xác định đúng — có thể thay vào giữa từ. Và heuristic viết hoa trong `processLine` sẽ hạ chữ thường nhiều tên riêng, tên phương pháp, địa danh không nằm trong whitelist, tức là **làm hỏng văn bản trước khi gửi AI**.

---

## 5. P3 — Vệ sinh repo và tài liệu

**Header còn thiếu.** `vercel.json` đã có `X-Content-Type-Options`, `X-Frame-Options: DENY`, `X-XSS-Protection`, `Referrer-Policy` — tốt hơn các repo trước. Nhưng thiếu `Content-Security-Policy` \(quan trọng nhất, đặc biệt khi tải script từ `esm.sh`, unpkg, Tailwind CDN\), `Permissions-Policy`, `Strict-Transport-Security`, `Cross-Origin-Opener-Policy`. Riêng `X-XSS-Protection` đã lỗi thời và trong một số trình duyệt cũ có thể gây hại; nên bỏ.

**Hai hệ module cùng tồn tại.** `package.json` khai báo React, `@google/genai`, `recharts`, `lucide-react` như dependency npm, nhưng `index.html` lại có importmap trỏ `esm.sh` cho đúng những thư viện đó. Kết quả là hai nguồn module với phiên bản có thể khác nhau, phụ thuộc mạng ngoài khi chạy production, và CSP gần như không thể siết. Chọn một: hoặc Vite bundle hết, hoặc importmap — không trộn.

<strong>`README.md`</strong>** vẫn là template AI Studio** \("Set the `GEMINI_API_KEY` in `.env.local`"\), trong khi mã thật dùng `VITE_GEMINI_API_KEYS`, có màn hình login, có Agent Platform, có PDF/DOCX, có Vercel rewrite. Người mới clone về sẽ không dựng được môi trường.

**Prompt và quy tắc nội bộ nằm trong repo public.** `AI_INSTRUCTIONS.md`, `LỆNH.md`, `bổ sung quy tắc check skkn.txt`, `giọng văn tự nhiên.txt`, `loi chinh ta.txt` chứa chiến lược chấm điểm, hướng dẫn vận hành và cả nội dung liên quan "humanize". Không có lý do kỹ thuật nào để public; nên chuyển sang tài liệu riêng.

**Không có test, không có CI.** Không có một file test nào, không GitHub Actions, không pre-commit. Với một app có ba đường ghi dữ liệu nguy hiểm \(XML injection, export DOCX, localStorage\) thì đây là thiếu sót cấu trúc, không phải chi tiết.

---

## 6. Điểm mạnh nên giữ

Cần ghi nhận rõ để không phá những gì đang tốt: kiến trúc service tách bạch rõ ràng hơn hẳn các repo trước; có `ErrorBoundary`; `vercel.json` có SPA rewrite và đã có ý thức về security header; schema JSON cho phản hồi AI khá chi tiết và có `required`; có validation điểm tổng theo nhóm; có phân loại lỗi API khá kỹ \(429 / 401 / 403 / 404 / 400 / 500 / 503 / 504 tách riêng, và `isModelOverloadedError` không đánh dấu key là hỏng — chi tiết này nhiều codebase làm sai\); có phân biệt `gemini` và `agent-platform` với cờ `vertexai`; có `sanitizeApiKey` xử lý ký tự Unicode ẩn; có cảnh báo rằng điểm AI chỉ là dự đoán; có lưu bản gốc DOCX để cố giữ định dạng; có bỏ qua paragraph chứa OLE; có giới hạn lịch sử 20 bản; có báo lỗi rõ khi PDF scan không có text.

---

## 7. Thứ tự khắc phục đề xuất

**Trong 48 giờ — chặn thiệt hại**

1. Thu hồi/đặt lại toàn bộ mật khẩu trong `data/accounts.ts`; thông báo cho các giáo viên trong danh sách.

2. Xóa `data/accounts.ts` và `dist/` khỏi HEAD; purge Git history; coi mọi key từng nằm trong bundle là đã lộ.

3. Gỡ ngay mục tiêu phần trăm trong "Giảm độ AI"; đổi mục tiêu thành "biên tập minh bạch có diff".

4. Đổi nhãn kết quả đạo văn thành "ước lượng, không phải kết quả kiểm tra"; ẩn phần trăm; thêm disclaimer.

5. Sửa thông điệp "không có hệ thống lưu trữ nào khác".

**Trong 2 tuần — sửa kiến trúc**

6. Chuyển auth + giới hạn VIP sang server \(hoặc Supabase/Firebase Auth\); thay `localStorage` bằng session token có hạn.

7. Chuyển lời gọi Gemini sang serverless proxy; bỏ `VITE_*` cho key; giữ BYOK như lựa chọn có cảnh báo rõ.

8. Thêm `tsc --noEmit` + ESLint + một bộ test tối thiểu vào `npm run build` và CI; sửa `textNormalizerService.ts` hoặc xóa hẳn.

9. Hợp nhất một rubric duy nhất, validate tổng điểm ở client.

10. Bỏ `historyPrompt` ép tăng điểm; sửa prompt số liệu thành quy tắc âm.

**Trong 1 tháng — hoàn thiện**

11. Rà lại toàn bộ luồng ghi XML và export DOCX; đặt khổ A4 + lề + số trang; fallback phá nội dung thì từ chối xuất.

12. Thêm giới hạn file/trang/ký tự; bundle PDF worker; loại `originalDocx` khỏi localStorage.

13. Thêm CSP, Permissions-Policy, HSTS; bỏ `X-XSS-Protection`.

14. Viết lại README; đồng bộ một danh sách model; thêm timeout + AbortController.

15. Nếu muốn giữ tên "kiểm tra đạo văn": tích hợp công cụ so khớp thật trước khi hiển thị bất kỳ con số nào.

---

## 8. Phần chưa kiểm chứng

Báo cáo này là rà soát tĩnh. Những điểm sau cần môi trường chạy để xác nhận, nên đừng coi là đã an toàn hay đã hỏng:

- Chưa chạy `npm ci`, `npx tsc --noEmit`, `npm run build` — kết luận về `textNormalizerService.ts` dựa trên đọc chữ ký hàm, chưa dựa trên output trình biên dịch.

- Chưa kiểm tra `dist/assets/*.js` xem có API key thật nhúng trong đó hay không. **Đây là việc nên làm ngay** — `grep -o 'AIzaSy[A-Za-z0-9_-]\{33\}' dist/assets/*.js`.

- Chưa mở `https://ktskknpro.vercel.app` để xác nhận bundle đang phục vụ khớp với source `main`.

- Chưa gọi Gemini thật nên chưa xác minh các model ID và chất lượng phản hồi JSON thực tế.

- Chưa chạy thử upload PDF/DOCX, AutoFix, AI reduction, ghi XML, export DOCX rồi mở bằng Microsoft Word.

- Chưa đối chiếu lịch sử Git để xác định credentials và key được commit từ thời điểm nào, phạm vi bao nhiêu commit.

- Chưa kiểm chứng nội dung các văn bản pháp lý được viện dẫn trong prompt \(Thông tư 27/2020, 18/2013, 20/2018\) có đúng phạm vi áp dụng cho SKKN cấp phổ thông hay không — điểm này nên nhờ người có chuyên môn pháp chế giáo dục xác nhận trước khi dùng làm căn cứ chấm.