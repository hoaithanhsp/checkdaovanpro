import { GoogleGenAI, Type, Schema } from "@google/genai";
import { SKKNInput, AnalysisResult, TitleAnalysisResult } from "../types";
import {
  getNextAvailableKey,
  markKeyError,
  resetKeyError,
  isQuotaOrRateLimitError,
  isInvalidKeyError,
  hasAnyKey,
  ApiKeyEntry,
} from './apiKeyService';

const SYSTEM_INSTRUCTION = `
Bạn là "SKKN Checker Pro" - Chuyên gia thẩm định Sáng kiến kinh nghiệm (SKKN) với 20 năm kinh nghiệm.
Nhiệm vụ của bạn là kiểm tra đạo văn CHẶT CHẼ, chính tả, đánh giá và đề xuất nâng cấp SKKN dựa trên tiêu chí Thông tư 27/2020/TT-BGDĐT và các văn bản pháp lý liên quan (Thông tư 18/2013/TT-BKHCN, Thông tư 20/2018/TT-BGDĐT).

## 📊 TIÊU CHUẨN THẨM ĐỊNH SKKN NGHIÊM NGẶT (100 ĐIỂM)

### A. TIÊU CHUẨN NỘI DUNG (70 ĐIỂM)

#### 1. Tính cấp thiết và mới (15 điểm)
- **TỐT (13-15đ)**: Vấn đề bức xúc, cấp thiết; có tính mới tại đơn vị; có khảo sát thực trạng trước khi viết
- **KHÁ (10-12đ)**: Vấn đề cấp thiết nhưng chưa rõ; tính mới chưa nổi bật
- **ĐẠT (7-9đ)**: Vấn đề tồn tại nhưng không quá cấp thiết; tính mới thấp
- **KHÔNG ĐẠT (<7đ)**: Vấn đề không rõ ràng; không có tính mới; không có khảo sát

#### 2. Cơ sở lý luận và thực tiễn (10 điểm)
- **TỐT (9-10đ)**: Tổng quan đầy đủ, có hệ thống; phân tích thực trạng với số liệu định lượng; trích dẫn chính xác
- **KHÁ (7-8đ)**: Tổng quan đủ nhưng chưa hệ thống; số liệu chưa chi tiết
- **ĐẠT (5-6đ)**: Tổng quan sơ sài; thực trạng mô tả chung chung
- **KHÔNG ĐẠT (<5đ)**: Không có tổng quan; không phân tích thực trạng; đạo văn

#### 3. Giải pháp và biện pháp (25 điểm)
- **TỐT (22-25đ)**: 3-5 giải pháp cụ thể; mỗi giải pháp có: mục đích, các bước thực hiện, điều kiện, dự kiến kết quả; khả thi và sáng tạo
- **KHÁ (18-21đ)**: 3-5 giải pháp nhưng chưa chi tiết; khả thi nhưng chưa tối ưu
- **ĐẠT (13-17đ)**: Chỉ 1-2 giải pháp; mô tả chung chung
- **KHÔNG ĐẠT (<13đ)**: Không có giải pháp cụ thể; sao chép từ nguồn khác

#### 4. Kết quả và hiệu quả (20 điểm)
- **TỐT (18-20đ)**: Số liệu cụ thể trước/sau; kết quả định lượng rõ (%, điểm số); có bảng biểu, biểu đồ; nhận xét từ đồng nghiệp/lãnh đạo; có thể nhân rộng
- **KHÁ (15-17đ)**: Có số liệu nhưng chưa đầy đủ; kết quả định tính nhiều hơn định lượng
- **ĐẠT (11-14đ)**: Mô tả kết quả chung chung; không có số liệu cụ thể
- **KHÔNG ĐẠT (<11đ)**: Không có kết quả; không chứng minh được hiệu quả

### B. TIÊU CHUẨN HÌNH THỨC (30 ĐIỂM)

#### 1. Bố cục và trình bày (15 điểm)
- Đúng khổ A4, font Times New Roman 13-14
- Lề: Trên 2cm, Dưới 2cm, Trái 3cm, Phải 2cm
- Cách dòng 1.2 lines; Tối đa 15 trang (không tính phụ lục)
- Cấu trúc: Trang bìa, Mục lục, Mở đầu, Nội dung, Kết luận, Tài liệu tham khảo, Phụ lục

#### 2. Ngôn ngữ và chính tả (15 điểm)
- **TỐT (13-15đ)**: Không lỗi chính tả/ngữ pháp; ngôn ngữ khoa học; thuật ngữ chính xác
- **KHÁ (10-12đ)**: 1-3 lỗi chính tả nhỏ
- **ĐẠT (7-9đ)**: 4-10 lỗi chính tả
- **KHÔNG ĐẠT (<7đ)**: >10 lỗi chính tả; ngôn ngữ lủng củng

### C. TIÊU CHUẨN LOẠI TRỪ (Không đạt ngay lập tức) ❌
1. Đạo văn > 30% (theo Turnitin hoặc Kiểm Tra Tài Liệu)
2. Trùng lặp với SKKN đã công bố trước đó
3. Không có kết quả thực tế (chỉ lý thuyết suông)
4. Giả mạo số liệu, kết quả
5. Không đúng chuyên môn của tác giả
6. Vi phạm đạo đức nghề nghiệp
7. Sao chép từ dịch vụ viết thuê (phát hiện qua phong cách viết)

### D. THANG ĐIỂM XẾP LOẠI
- 🏆 **Xuất sắc**: 90-100 điểm
- 🥇 **Giỏi**: 80-89 điểm
- 🥈 **Khá**: 70-79 điểm
- 🥉 **Đạt**: 60-69 điểm
- ❌ **Không đạt**: < 60 điểm

## 📐 QUY TRÌNH KIỂM TRA ĐẠO VĂN NÂNG CAO

### Bước 1: Mô phỏng tìm kiếm từ khóa trên các nguồn uy tín
- Wikipedia tiếng Việt
- Các trang giáo dục: 123doc, tailieu.vn, thuviendeto.com, kiemtratailieu.vn
- Sách giáo khoa, sách giáo viên
- Các SKKN đã công bố trước đó
- Văn bản pháp luật: Thông tư, Nghị quyết, Công văn Bộ GD&ĐT

### Bước 2: Áp dụng 10 NGUYÊN TẮC VÀNG phát hiện đạo văn

1️⃣ **Phát hiện SAO CHÉP TRỰC TIẾP**: Nhận diện các đoạn copy nguyên văn từ định nghĩa, sách giáo khoa, Wikipedia.

2️⃣ **Phát hiện CÂU SÁO RỖNG**: Đánh dấu các câu chung chung như:
   - "Giáo dục là quốc sách hàng đầu"
   - "Thầy cô là người lái đò"
   - "Trong thời đại công nghệ 4.0"
   - Các câu xuất hiện phổ biến trong nhiều SKKN khác

3️⃣ **Kiểm tra LÝ THUYẾT GIÁO DỤC**: Phát hiện viện dẫn lý thuyết (Piaget, Vygotsky, Bloom...) một cách máy móc, không có liên hệ cụ thể với đề tài.

4️⃣ **Kiểm tra TRÍCH DẪN VĂN BẢN PHÁP LUẬT**: Phát hiện sao chép nguyên văn các Điều, Khoản thay vì tóm tắt tinh thần.

5️⃣ **Kiểm tra SỐ LIỆU**: 
   - Số liệu quá tròn (50%, 60%, 80%) - khả năng bịa
   - Tổng % không bằng 100%
   - Số liệu trước/sau tác động phi logic

6️⃣ **Kiểm tra TÊN GIẢI PHÁP**: Giải pháp chung chung như "Đổi mới phương pháp dạy học" thay vì cụ thể.

7️⃣ **Phân tích KỸ THUẬT VIẾT**:
   - Phong cách viết thay đổi đột ngột giữa các đoạn (dấu hiệu đạo văn)
   - Không có paraphrase (viết lại với từ vựng mới)
   - Thuật ngữ quá cao cấp không phù hợp với trình độ tác giả
   - Cấu trúc câu đơn điệu, thiếu câu phức

8️⃣ **Kiểm tra CẤU TRÚC CÂU**: Câu quá đơn giản, thiếu tính học thuật.

9️⃣ **Kiểm tra TỪ VỰNG CHUYÊN NGÀNH**: Thiếu các từ "đắt" như: Hiện thực hóa, Tối ưu hóa, Cá nhân hóa, Tích hợp liên môn, Phẩm chất cốt lõi...

🔟 **TỰ KIỂM TRA CHÉO**: So sánh từng đoạn với các mẫu câu phổ biến trong SKKN.

### Bước 3: Phân loại đạo văn và hướng sửa
**Loại 1 - Trích dẫn hợp lệ thiếu nguồn**: Bổ sung trích dẫn đúng chuẩn
**Loại 2 - Sao chép nguyên văn**: Paraphrase + Trích dẫn nguồn gốc
**Loại 3 - Sao chép ý tưởng**: Ghi nhận nguồn gốc ý tưởng

### Bước 4: Chấm điểm và báo cáo
- Tỷ lệ trùng lặp >= 30%: ❌ LOẠI NGAY (tiêu chuẩn loại trừ)
- Tỷ lệ trùng lặp 20-30%: ⚠️ Mức "Cao" - Cần xem xét kỹ
- Tỷ lệ trùng lặp 10-19%: Mức "Trung bình"
- Tỷ lệ trùng lặp < 10%: ✅ Mức "Thấp"

### Bước 5: Đề xuất CỤ THỂ
Với mỗi đoạn bị nghi đạo văn, phải:
1. Chỉ rõ nguồn có thể trùng (website, sách, SKKN khác)
2. Giải thích lý do nghi ngờ
3. Gợi ý cách viết lại theo nguyên tắc PARAPHRASE 5 cấp độ:
   - Thay đổi từ vựng (từ đồng nghĩa)
   - Đổi cấu trúc câu (chủ động ↔ bị động)
   - Thêm trạng từ/tính từ học thuật
   - Kết hợp hoặc tách câu
   - Viết lại hoàn toàn với ý tưởng gốc

## 🔍 PHÁT HIỆN SKKN SƠ SÀI (TRỪ ĐIỂM NẶNG)
**Dấu hiệu nhận biết SKKN sơ sài:**
- Không có số liệu cụ thể, chỉ nói chung chung
- Giải pháp chỉ có tên mà không có nội dung chi tiết bên trong
- Mỗi giải pháp chỉ được viết 1-2 đoạn ngắn (< 200 từ/giải pháp = SƠ SÀI)
- Không có ví dụ minh họa thực tế từ lớp/trường
- Không có bảng biểu, biểu đồ so sánh
- Kết quả viết kiểu "học sinh tiến bộ rõ rệt" mà không có con số cụ thể
- Thiếu nhận xét từ đồng nghiệp, lãnh đạo
- Dưới 10 trang nội dung

**Hình phạt cho SKKN sơ sài:**
- Giải pháp < 200 từ/giải pháp: TRỪ 10-15 điểm mục Giải pháp
- Không có số liệu trước/sau: TRỪ 15 điểm mục Kết quả
- Chỉ mô tả chung chung: TRỪ 10 điểm mục Cơ sở lý luận
- KHÔNG BAO GIỜ cho điểm > 70 nếu nội dung sơ sài

## 🤖 PHÁT HIỆN SKKN DO AI VIẾT (LOẠI TRỪ NGAY)
**Dấu hiệu SKKN viết bằng ChatGPT/Gemini:**
1. Văn phong quá "hoàn hảo", trau chuốt, không có nét cá nhân
2. Câu văn dài, phức tạp nhưng nội dung rỗng
3. Sử dụng nhiều từ ngữ hoa mỹ: "mang lại hiệu quả vượt trội", "góp phần không nhỏ", "tạo bước đột phá"
4. Cấu trúc quá đều đặn: mỗi phần có độ dài tương tự
5. Thiếu chi tiết thực tế: không có tên trường/lớp cụ thể, không có số liệu thực
6. Số liệu quá "đẹp": 85.5%, 92.3% (AI hay sinh số lẻ để tạo cảm giác thực)
7. Không có "khuyết điểm": AI thường viết toàn ưu điểm
8. Thiếu ngữ cảnh địa phương: không đề cập đặc thù vùng miền, trường học

**Nếu nghi ngờ AI viết:**
- Đặt plagiarismRisk = "Rất cao"
- Ghi rõ trong overallConclusion: "Nghi ngờ SKKN được viết bằng AI"
- Điểm tối đa = 50/100 (Không đạt)

## ✅ CHECKLIST PHÂN TÍCH NỘI DUNG CHI TIẾT (BẮT BUỘC)

### Khi chấm điểm GIẢI PHÁP, phải kiểm tra TỪNG giải pháp:
- [ ] Có mục đích rõ ràng không? (Tại sao cần giải pháp này?)
- [ ] Có các bước thực hiện chi tiết không? (Bước 1, 2, 3... cụ thể)
- [ ] Có ví dụ minh họa từ thực tế giảng dạy không?
- [ ] Có điều kiện thực hiện không? (Cần gì để triển khai?)
- [ ] Mỗi giải pháp có ít nhất 300 từ không?
- [ ] Nếu chỉ có TÊN giải pháp mà không có NỘI DUNG → Điểm giải pháp = 0

### Khi chấm điểm KẾT QUẢ, phải kiểm tra:
- [ ] Có bảng so sánh trước/sau với số liệu CỤ THỂ không?
- [ ] Số liệu có logic không? (VD: điểm TB không thể từ 5.0 lên 9.0)
- [ ] Có biểu đồ/hình ảnh minh họa kết quả không?
- [ ] Có nhận xét từ đồng nghiệp/HS/phụ huynh không?
- [ ] Thời gian áp dụng có đủ dài không? (< 1 tháng = không tin cậy)

### Khi chấm điểm CƠ SỞ LÝ LUẬN, phải kiểm tra:
- [ ] Có trích dẫn nguồn tham khảo cụ thể không?
- [ ] Có phân tích thực trạng TẠI ĐƠN VỊ không? (Không chỉ nói chung cả nước)
- [ ] Có số liệu khảo sát thực tế không?

## 🛠️ NGUYÊN TẮC CHẤM ĐIỂM NGHIÊM NGẶT

### KHÔNG DỄ DÃI - Điểm số phải phản ánh ĐÚNG chất lượng:
- **90-100 điểm (Xuất sắc)**: CHỈ dành cho SKKN có đầy đủ số liệu, ví dụ thực tế, bảng biểu, đã được áp dụng và có kết quả rõ ràng
- **80-89 điểm (Giỏi)**: SKKN có nội dung tốt nhưng thiếu 1-2 yếu tố (VD: thiếu biểu đồ hoặc thiếu nhận xét đồng nghiệp)
- **70-79 điểm (Khá)**: SKKN có ý tưởng hay nhưng nội dung chưa đủ chi tiết
- **60-69 điểm (Đạt)**: SKKN sơ sài, cần bổ sung nhiều
- **< 60 điểm (Không đạt)**: SKKN quá sơ sài, nghi ngờ đạo văn, hoặc do AI viết

### QUY TẮC VÀNG:
1. **Đọc KỸ từng đoạn** - Không chỉ nhìn tiêu đề/tên giải pháp
2. **Đếm số liệu** - SKKN tốt phải có ít nhất 5-10 con số cụ thể
3. **Tìm ví dụ thực tế** - Phải có tên lớp, tên bài, tình huống cụ thể
4. **Kiểm tra độ dài** - Mỗi giải pháp < 200 từ = Sơ sài
5. **Nghi ngờ điểm cao** - Nếu định cho > 80 điểm, hãy kiểm tra lại 2 lần

## 🛠️ CHẤM ĐIỂM THEO 4 TIÊU CHÍ CHÍNH
1. **Tính Mới (30đ)**: Đề tài mới, sáng tạo, chưa ai làm tại đơn vị
2. **Khả Thi (40đ)**: Thực thi được, có điều kiện, có kết quả minh chứng CỤ THỂ
3. **Khoa Học (20đ)**: Cơ sở lý luận vững, phương pháp nghiên cứu đúng
4. **Hình Thức (10đ)**: Trình bày đẹp, đúng quy định, không lỗi chính tả

Bạn PHẢI trả về kết quả dưới dạng JSON tuân thủ schema được cung cấp.
Hãy mô phỏng quá trình kiểm tra một cách CHẶT CHẼ và CHUYÊN NGHIỆP nhất.
Nếu nội dung quá ngắn (<200 từ), hãy cảnh báo trong phần kết luận nhưng vẫn cố gắng phân tích cấu trúc.
Nếu phát hiện tiêu chuẩn loại trừ, PHẢI ghi rõ trong overallConclusion và đặt plagiarismRisk = "Rất cao".

⚠️ CẢNH BÁO CUỐI: Bạn là giám khảo NGHIÊM KHẮC, không phải người khích lệ. Nếu SKKN sơ sài, hãy chấm điểm THẤP và giải thích rõ lý do. Điểm 90-100 là CỰC KỲ HIẾM - chỉ dành cho SKKN thực sự xuất sắc với đầy đủ minh chứng.
`;

const RESPONSE_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    duplicateLevel: { type: Type.STRING, enum: ["Thấp", "Trung bình", "Cao"], description: "Mức độ trùng lặp đề tài" },
    duplicateDetails: { type: Type.STRING, description: "Chi tiết về việc trùng lặp tên hoặc nội dung" },
    spellingErrors: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          line: { type: Type.STRING, description: "Vị trí dòng hoặc đoạn chứa lỗi" },
          error: { type: Type.STRING, description: "Từ/Cụm từ bị lỗi" },
          correction: { type: Type.STRING, description: "Từ sửa lại cho đúng" },
          type: { type: Type.STRING, enum: ["Chính tả", "Ngữ pháp", "Diễn đạt"], description: "Loại lỗi" },
        },
      },
    },
    plagiarismRisk: { type: Type.STRING, enum: ["Thấp", "Trung bình", "Cao", "Rất cao"], description: "Nguy cơ đạo văn" },
    plagiarismSegments: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          segment: { type: Type.STRING, description: "Đoạn văn bị nghi ngờ" },
          source: { type: Type.STRING, description: "Nguồn gốc hoặc văn bản gốc tương tự (VD: Wikipedia, 123doc, SKKN mẫu, sách giáo khoa...)" },
          similarity: { type: Type.NUMBER, description: "Phần trăm giống nhau (0-100)" },
          violatedRule: { type: Type.STRING, description: "Nguyên tắc bị vi phạm (VD: Sao chép trực tiếp, Câu sáo rỗng, Trích dẫn văn bản, Số liệu phi logic...)" },
          advice: { type: Type.STRING, description: "Lời khuyên sửa đổi cụ thể theo nguyên tắc PARAPHRASE 5 cấp độ" },
        },
      },
    },
    scores: {
      type: Type.OBJECT,
      properties: {
        innovation: { type: Type.NUMBER, description: "Điểm tính mới (max 30)" },
        feasibility: { type: Type.NUMBER, description: "Điểm khả thi (max 40)" },
        scientific: { type: Type.NUMBER, description: "Điểm khoa học (max 20)" },
        presentation: { type: Type.NUMBER, description: "Điểm hình thức (max 10)" },
        total: { type: Type.NUMBER, description: "Tổng điểm" },
      },
    },
    scoreDetails: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          category: { type: Type.STRING, description: "Tên tiêu chí (Tính mới, Khả thi...)" },
          strength: { type: Type.STRING, description: "Điểm mạnh" },
          weakness: { type: Type.STRING, description: "Điểm yếu" },
        },
      },
    },
    developmentPlan: {
      type: Type.OBJECT,
      properties: {
        shortTerm: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Kế hoạch ngắn hạn (1-2 tuần)" },
        mediumTerm: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Kế hoạch trung hạn (1 tháng)" },
        longTerm: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Kế hoạch dài hạn (2-3 tháng)" },
      },
    },
    overallConclusion: { type: Type.STRING, description: "Kết luận tổng quan và lời khuyên cuối cùng" },
  },
  required: ["duplicateLevel", "duplicateDetails", "spellingErrors", "plagiarismRisk", "plagiarismSegments", "scores", "scoreDetails", "developmentPlan", "overallConclusion"],
};

// Fallback models theo thứ tự ưu tiên
const FALLBACK_MODELS = [
  'gemini-3-flash-preview',
  'gemini-3-pro-preview',
  'gemini-2.5-flash'
];

// Helper để lấy API key với xoay vòng
const getApiKeyWithRotation = (): { key: string; entry: ApiKeyEntry } => {
  if (!hasAnyKey()) {
    throw new Error('Chưa có API Key nào được cấu hình. Vui lòng thêm API Key trong phần Settings.');
  }

  const entry = getNextAvailableKey();
  if (!entry) {
    throw new Error('Tất cả API Key đều đang bị giới hạn (rate limit/quota). Vui lòng thêm key mới hoặc đợi 1 phút.');
  }

  return { key: entry.key, entry };
};

// Helper để lấy model từ localStorage
const getModel = (): string => {
  return localStorage.getItem('skkn-gemini-model') || FALLBACK_MODELS[0];
};

// Số lần thử tối đa khi xoay vòng key
const MAX_KEY_RETRIES = 3;

export const analyzeSKKNWithGemini = async (input: SKKNInput): Promise<AnalysisResult> => {
  const selectedModel = getModel();
  const modelsToTry = [selectedModel, ...FALLBACK_MODELS.filter(m => m !== selectedModel)];

  const prompt = `
    Phân tích SKKN sau đây:
    - Tên đề tài: ${input.title}
    - Cấp học: ${input.level}
    - Môn học: ${input.subject}
    - Mục tiêu giải: ${input.target}
    - Nội dung: ${input.content}
  `;

  let lastError: Error | null = null;
  let keyRetries = 0;

  // Xoay vòng key khi gặp lỗi quota
  while (keyRetries < MAX_KEY_RETRIES) {
    const { key: apiKey, entry: currentKey } = getApiKeyWithRotation();
    const ai = new GoogleGenAI({ apiKey });

    // Thử từng model trong danh sách
    for (const model of modelsToTry) {
      try {
        console.log(`[analyzeSKKN] Đang thử model: ${model} với key: ${currentKey.name}`);
        const response = await ai.models.generateContent({
          model,
          contents: prompt,
          config: {
            systemInstruction: SYSTEM_INSTRUCTION,
            responseMimeType: "application/json",
            responseSchema: RESPONSE_SCHEMA,
          },
        });

        if (response.text) {
          // Thành công - reset trạng thái lỗi của key
          resetKeyError(currentKey.id);
          return JSON.parse(response.text) as AnalysisResult;
        } else {
          throw new Error("Empty response from Gemini");
        }
      } catch (error: any) {
        console.warn(`Model ${model} thất bại:`, error.message);
        lastError = error;

        // Nếu là lỗi quota/rate limit, đánh dấu key và thử key khác
        if (isQuotaOrRateLimitError(error)) {
          markKeyError(currentKey.id, error.message);
          console.log(`[analyzeSKKN] Key ${currentKey.name} bị giới hạn, chuyển sang key tiếp theo...`);
          keyRetries++;
          break; // Thoát vòng lặp model, thử key mới
        }

        // Nếu key không hợp lệ, vô hiệu hóa và thử key khác
        if (isInvalidKeyError(error)) {
          markKeyError(currentKey.id, 'API Key không hợp lệ');
          keyRetries++;
          break;
        }

        // Lỗi khác - tiếp tục thử model khác
      }
    }

    // Nếu không phải lỗi cần xoay key, thoát
    if (!isQuotaOrRateLimitError(lastError) && !isInvalidKeyError(lastError)) {
      break;
    }
  }

  // Nếu tất cả đều thất bại
  throw lastError || new Error("Tất cả các model và key đều thất bại");
};

/**
 * Viết lại đoạn văn bị nghi ngờ đạo văn
 */
export const rewritePlagiarizedText = async (
  originalText: string,
  context?: string
): Promise<{ rewrittenText: string; explanation: string }> => {
  const { key: apiKey, entry: currentKey } = getApiKeyWithRotation();
  const model = getModel();

  const ai = new GoogleGenAI({ apiKey });

  const prompt = `
Bạn là chuyên gia viết lại văn bản học thuật tiếng Việt.

ĐOẠN VĂN GỐC (bị nghi ngờ đạo văn):
"${originalText}"

${context ? `NGỮ CẢNH: ${context}` : ''}

YÊU CẦU:
1. Viết lại đoạn văn trên với văn phong hoàn toàn mới
2. Giữ nguyên ý nghĩa và thông tin cốt lõi
3. Sử dụng từ ngữ, cấu trúc câu khác biệt
4. Đảm bảo tính học thuật và chuyên nghiệp
5. Phù hợp với văn phong SKKN giáo dục

Trả về JSON với format:
{
  "rewrittenText": "Đoạn văn đã viết lại",
  "explanation": "Giải thích ngắn gọn về những thay đổi đã thực hiện"
}
`;

  try {
    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
      },
    });

    if (response.text) {
      resetKeyError(currentKey.id);
      return JSON.parse(response.text);
    } else {
      throw new Error("Empty response from Gemini");
    }
  } catch (error: any) {
    if (isQuotaOrRateLimitError(error) || isInvalidKeyError(error)) {
      markKeyError(currentKey.id, error.message);
    }
    console.error("Rewrite Error:", error);
    throw error;
  }
};

/**
 * Interface cho tài liệu tham khảo
 */
export interface ReferenceItem {
  title: string;
  author: string;
  year: string;
  type: 'book' | 'article' | 'thesis' | 'website' | 'regulation';
  description: string;
  citation: string;
}

/**
 * Gợi ý tài liệu tham khảo cho SKKN
 */
export const suggestReferences = async (
  title: string,
  subject: string,
  content: string
): Promise<ReferenceItem[]> => {
  const { key: apiKey, entry: currentKey } = getApiKeyWithRotation();
  const model = getModel();

  const ai = new GoogleGenAI({ apiKey });

  const prompt = `
Bạn là chuyên gia tư vấn tài liệu tham khảo cho SKKN giáo dục Việt Nam.

THÔNG TIN ĐỀ TÀI SKKN:
- Tên đề tài: ${title}
- Môn học/Lĩnh vực: ${subject}
- Nội dung tóm tắt: ${content.substring(0, 500)}...

YÊU CẦU:
Gợi ý 6-8 tài liệu tham khảo phù hợp để trích dẫn trong SKKN, bao gồm:
1. Các văn bản pháp quy liên quan (Thông tư, Nghị quyết của Bộ GD&ĐT)
2. Sách chuyên môn, giáo trình
3. Các bài báo khoa học, nghiên cứu
4. SKKN mẫu hoặc luận văn liên quan
5. Tài liệu điện tử uy tín

Trả về JSON array với format:
[
  {
    "title": "Tên tài liệu",
    "author": "Tác giả hoặc Cơ quan ban hành",
    "year": "Năm xuất bản (vd: 2020)",
    "type": "book|article|thesis|website|regulation",
    "description": "Mô tả ngắn về nội dung và lý do liên quan",
    "citation": "Trích dẫn đúng chuẩn APA tiếng Việt"
  }
]
`;

  try {
    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
      },
    });

    if (response.text) {
      resetKeyError(currentKey.id);
      return JSON.parse(response.text);
    } else {
      throw new Error("Empty response from Gemini");
    }
  } catch (error: any) {
    if (isQuotaOrRateLimitError(error) || isInvalidKeyError(error)) {
      markKeyError(currentKey.id, error.message);
    }
    console.error("Reference Suggestion Error:", error);
    throw error;
  }
};

/**
 * Interface cho kết quả Auto-Fix SKKN
 */
export interface AutoFixResult {
  fixedContent: string;
  summary: {
    spellingFixed: number;
    plagiarismRewritten: number;
    structureImproved: number;
    vocabularyEnhanced: number;
  };
  changes: Array<{
    type: 'spelling' | 'plagiarism' | 'structure' | 'vocabulary';
    original: string;
    fixed: string;
    reason: string;
  }>;
}

/**
 * Tự động sửa SKKN dựa trên kết quả phân tích
 * Giữ nguyên định dạng gốc (bold, italic, công thức toán, bảng)
 */
export const autoFixSKKN = async (
  originalContent: string,
  analysisResult: {
    spellingErrors: Array<{ error: string; correction: string }>;
    plagiarismSegments: Array<{ segment: string; advice: string }>;
    scoreDetails: Array<{ category: string; weakness: string }>;
  }
): Promise<AutoFixResult> => {
  const selectedModel = getModel();
  const modelsToTry = [selectedModel, ...FALLBACK_MODELS.filter(m => m !== selectedModel)];

  let lastError: Error | null = null;
  let keyRetries = 0;

  while (keyRetries < MAX_KEY_RETRIES) {
    const { key: apiKey, entry: currentKey } = getApiKeyWithRotation();
    const ai = new GoogleGenAI({ apiKey });

    const prompt = `
Bạn là chuyên gia chỉnh sửa Sáng kiến Kinh nghiệm (SKKN) với 20 năm kinh nghiệm.

## NHIỆM VỤ:
Tự động sửa SKKN dựa trên danh sách lỗi đã phát hiện.

## YÊU CẦU ĐỌNH DẠNG (BẮT BUỘC):
1. **GIỮ NGUYÊN** định dạng gốc: in đậm (**text**), in nghiêng (*text*), gạch dưới
2. **CÔNG THỨC TOÁN**: Viết dạng LaTeX trong dấu $ (VD: $x^2 + y^2$)
3. **BẢNG**: Giữ nguyên cấu trúc Markdown Table
4. **HÌNH ẢNH**: Giữ nguyên các placeholder [Hình 1], [Ảnh minh họa]...
5. **CẤU TRÚC**: Giữ nguyên các tiêu đề, phần mục I, II, III...

## DANH SÁCH LỖI CẦN SỬa:

### Lỗi chính tả (${analysisResult.spellingErrors.length} lỗi):
${analysisResult.spellingErrors.map((e, i) => `${i + 1}. "${e.error}" → "${e.correction}"`).join('\n')}

### Đoạn bị nghi đạo văn (${analysisResult.plagiarismSegments.length} đoạn):
${analysisResult.plagiarismSegments.map((p, i) => `${i + 1}. Đoạn: "${p.segment.substring(0, 100)}..."
   Gợi ý: ${p.advice}`).join('\n\n')}

### Điểm yếu cần cải thiện:
${analysisResult.scoreDetails.map(s => `- ${s.category}: ${s.weakness}`).join('\n')}

## NGUYÊN TẮC SỬa:
1. **Chính tả tiếng Việt**: Sửa theo các quy tắc:
   - Lỗi sa/xa, s/x: "xa cách" vs "sa sút", "sung sướng" vs "xung đột"
   - Lỗi tr/ch: "trong" vs "chong chóng", "trí tuệ" vs "chi tiết"
   - Lỗi d/gi/r: "giáo" vs "dao", "rộng" vs "dòng"
   - Lỗi hỏi/ngã: "mỹ" vs "mỉ", "sửa" vs "sủa", "kỹ năng" vs "kỉ niệm"
   - Lỗi dấu thanh đặt sai vị trí: "hoá" → "hóa", "thuỷ" → "thủy"
   - Lỗi thiếu/thừa ký tự: "người" → "người", "đạo tao" → "đào tạo"
2. **Chuẩn hóa viết hoa**:
   - Viết hoa đầu câu sau dấu chấm
   - "KHông" → "Không", "BÁO CÁO" → "Báo cáo" (trừ tiêu đề)
   - GIỮ NGUYÊN: THPT, UBND, SKKN, GV, HS (từ viết tắt)
3. **Đạo văn** - Sử dụng kỹ thuật PARAPHRASE MỨC 3 (AN TOÀN NHẤT):
   
   ❌ Mức 1 (RỦI RO CAO): Chỉ thay từ đồng nghĩa
   ❌ Mức 2 (RỦI RO TB): Đổi cấu trúc câu
   ✅ Mức 3 (AN TOÀN): Paraphrase sâu + Tích hợp ngữ cảnh
   
   VÍ DỤ MỨC 3:
   Gốc: "Phương pháp dạy học tích cực giúp học sinh chủ động trong việc tiếp thu kiến thức"
   
   Viết lại: "Khi áp dụng các hoạt động học tập lấy học sinh làm trung tâm, tôi nhận thấy học sinh lớp 10A3 tiếp thu kiến thức nhanh hơn và dám đưa ra ý kiến riêng."
   
   NGUYÊN TẮC PARAPHRASE AN TOÀN:
   - Chuyển từ định nghĩa chung → mô tả cụ thể trong ngữ cảnh riêng
   - Giữ nguyên ý nghĩa, nhưng viết như GIÁO VIÊN THỰC SỰ KỂ CHUYỆN
   - Thêm bối cảnh cụ thể (tên lớp, tình huống thực tế)
   - GIỮ NGUYÊN: "học sinh", "giáo viên", "dạy học" (từ phổ thông)

## ⛔ TUYỆT ĐỐI KHÔNG LÀM (Sẽ làm giảm điểm SKKN):
1. ❌ KHÔNG thay đổi số liệu! Giữ nguyên 50%, 60%, 80% - đừng đổi thành 47.3%, 62.8%
2. ❌ KHÔNG thêm từ ngữ hoa mỹ: "mang lại hiệu quả vượt trội", "góp phần không nhỏ", "tạo bước đột phá"
3. ❌ KHÔNG thêm từ chuyên ngành cao cấp: "hiện thực hóa", "tối ưu hóa", "cá nhân hóa"
4. ❌ KHÔNG làm câu văn dài và phức tạp hơn
5. ❌ KHÔNG thay đổi cấu trúc bài viết gốc
6. ❌ KHÔNG thêm nội dung mới mà tác giả chưa viết
7. ❌ KHÔNG viết lại toàn bộ đoạn văn - chỉ sửa phần cần thiết
8. ❌ KHÔNG mở đầu bằng "Trong bối cảnh đổi mới giáo dục hiện nay..."

## ✅ CHỈ ĐƯỢC LÀM:
1. ✅ Sửa lỗi chính tả rõ ràng
2. ✅ Sửa lỗi ngữ pháp cơ bản
3. ✅ Viết lại đoạn bị đạo văn theo MỨC 3 - có ngữ cảnh cụ thể
4. ✅ Giữ nguyên phong cách viết cá nhân của tác giả
5. ✅ Bảo toàn tất cả số liệu, tên trường/lớp, chi tiết thực tế
6. ✅ Xen kẽ số liệu với quan sát cá nhân (như giáo viên thật viết)

## NỘI DUNG SKKN GỐC:
${originalContent}

## YÊU CẦU ĐẦU RA:
Trả về JSON với format:
{
  "fixedContent": "Toàn bộ nội dung SKKN đã sửa, VỚI CÁC CHỖ SỬA ĐƯỢC BÔI ĐỎ bằng thẻ <red>nội dung đã sửa</red>",
  "summary": {
    "spellingFixed": <số lỗi chính tả đã sửa>,
    "plagiarismRewritten": <số đoạn đạo văn đã viết lại>,
    "structureImproved": <số câu đã cải thiện cấu trúc>,
    "vocabularyEnhanced": <số từ/cụm từ đã nâng cấp>
  },
  "changes": [
    {
      "type": "spelling|plagiarism|structure|vocabulary",
      "original": "đoạn gốc ngắn",
      "fixed": "đoạn đã sửa",
      "reason": "lý do sửa"
    }
  ]
}

QUAN TRỌNG - BÔI ĐỎ CÁC CHỖ SỬA:
- Trong fixedContent, mọi chỗ đã sửa/thay đổi phải được bọc trong thẻ <red>...</red>
- Ví dụ: "Hiệu <red>quả</red> của phương <red>pháp</red> này..." (sửa "qủa" thành "quả", "páp" thành "pháp")
- Giúp người đọc dễ dàng nhận biết các thay đổi

CHÚ Ý: 
- Mảng changes chỉ liệt kê tối đa 10 thay đổi quan trọng nhất.
- SỬA CÀN TỐI THIỂU - Chỉ sửa những gì thực sự cần thiết để SKKN không bị phát hiện là AI viết.
`;

    for (const model of modelsToTry) {
      try {
        console.log(`[AutoFix] Đang thử model: ${model} với key: ${currentKey.name}`);
        const response = await ai.models.generateContent({
          model,
          contents: prompt,
          config: {
            responseMimeType: "application/json",
            temperature: 0.2, // Low temperature for accurate editing
          },
        });

        if (response.text) {
          resetKeyError(currentKey.id);
          const result = JSON.parse(response.text) as AutoFixResult;
          return result;
        } else {
          throw new Error("Empty response from Gemini");
        }
      } catch (error: any) {
        console.warn(`[AutoFix] Model ${model} thất bại:`, error.message);
        lastError = error;

        if (isQuotaOrRateLimitError(error) || isInvalidKeyError(error)) {
          markKeyError(currentKey.id, error.message);
          keyRetries++;
          break;
        }
      }
    }

    if (!isQuotaOrRateLimitError(lastError) && !isInvalidKeyError(lastError)) {
      break;
    }
  }

  throw lastError || new Error("Tất cả các model và key đều thất bại");
};

/**
 * Phân tích tên đề tài SKKN
 * Kiểm tra trùng lặp, đánh giá độ khả thi, tính mới và đề xuất tên thay thế
 */
export const analyzeTitleSKKN = async (
  title: string,
  subject?: string,
  level?: string
): Promise<TitleAnalysisResult> => {
  const selectedModel = getModel();
  const modelsToTry = [selectedModel, ...FALLBACK_MODELS.filter(m => m !== selectedModel)];

  let lastError: Error | null = null;
  let keyRetries = 0;

  while (keyRetries < MAX_KEY_RETRIES) {
    const { key: apiKey, entry: currentKey } = getApiKeyWithRotation();
    const ai = new GoogleGenAI({ apiKey });

    const prompt = `
Bạn là chuyên gia phân tích tên đề tài Sáng kiến kinh nghiệm (SKKN) với 20 năm kinh nghiệm.

## THÔNG TIN ĐỀ TÀI CẦN PHÂN TÍCH:
- Tên đề tài: "${title}"
${subject ? `- Môn học/Lĩnh vực: ${subject}` : ''}
${level ? `- Cấp học: ${level}` : ''}

## QUY TRÌNH PHÂN TÍCH (5 BƯỚC):

### BƯỚC 1: PHÂN TÍCH CẤU TRÚC
Tên đề tài SKKN chuẩn: [Hành động] + [Đối tượng/Nội dung] + [Phương tiện/Công cụ] + [Mục đích] + [Phạm vi]
- Xác định từng thành phần có/không trong tên đề tài

### BƯỚC 2: KIỂM TRA TRÙNG LẶP
So sánh với database đề tài phổ biến:

🔴 TRÙNG LẶP CAO (80-90%):
- "Ứng dụng AI trong dạy học môn [X]"
- "Sử dụng ChatGPT hỗ trợ [công việc Y]"
- "Ứng dụng Canva thiết kế bài giảng"
- "Sử dụng Kahoot/Quizizz tăng tính tương tác"
- "Dạy học trực tuyến qua Google Meet/Zoom"
- "Ứng dụng Google Classroom quản lý lớp học"

🟡 TRÙNG LẶP TRUNG BÌNH (60-70%):
- "Dạy học theo dự án (PBL) môn [X]"
- "Phương pháp dạy học tích cực môn [X]"
- "Dạy học theo nhóm hiệu quả"
- "Phát triển năng lực tự học của học sinh"

🟢 TRÙNG LẶP THẤP (20-40%):
- "Kết hợp AI và PBL trong dạy STEM lớp 8"
- Các đề tài kết hợp nhiều phương pháp
- Đề tài có đối tượng đặc biệt (HS khuyết tật, vùng cao)

### BƯỚC 3: CHẤM ĐIỂM (TỔNG 100 ĐIỂM)

1. **Độ cụ thể (max 25đ)**:
   - 25: Có đầy đủ: môn học, cấp học, công cụ, phạm vi cụ thể
   - 20: Có 3/4 yếu tố
   - 15: Có 2/4 yếu tố
   - 10: Chỉ có 1 yếu tố cụ thể
   - 5: Quá chung chung

2. **Tính mới (max 30đ)**:
   - 30: Chưa ai làm, hoàn toàn mới
   - 25: Kết hợp 2-3 yếu tố mới
   - 20: Có 1 điểm mới rõ ràng
   - 15: Cải tiến từ đề tài cũ
   - 10: Đã có nhiều người làm
   - 5: Trùng lặp hoàn toàn

3. **Tính khả thi (max 25đ)**:
   - 25: Rất dễ thực hiện, nguồn lực sẵn có
   - 20: Khả thi, cần chuẩn bị ít
   - 15: Khả thi nhưng cần thời gian/chi phí
   - 10: Khó khăn, cần nhiều nguồn lực
   - 5: Không khả thi

4. **Độ rõ ràng (max 20đ)**:
   - 20: Tên ngắn gọn, dễ hiểu, có từ khóa rõ
   - 15: Rõ ràng nhưng hơi dài
   - 10: Có thể hiểu nhưng chưa tối ưu
   - 5: Khó hiểu, rườm rà

### BƯỚC 4: PHÁT HIỆN VẤN ĐỀ
Cảnh báo nếu có:
- Từ ngữ chung chung: "ứng dụng công nghệ", "nâng cao chất lượng", "một số biện pháp"
- Từ quá tham vọng: "toàn diện", "cách mạng hóa", "đột phá"
- Công cụ lỗi thời: "băng hình", "đĩa CD", "máy chiếu overhead"
- Công cụ quá phổ biến: "ChatGPT", "Kahoot", "Google Classroom"

### BƯỚC 5: ĐỀ XUẤT 5 TÊN THAY THẾ (Áp dụng công thức)
- Công thức 1: Cụ thể hóa - Thêm [Cấp học] + [Bối cảnh đặc biệt]
- Công thức 2: Kết hợp - [Công nghệ A] + [Phương pháp B] + [Môn học C]
- Công thức 3: Đối tượng đặc biệt - [Phương pháp] + [HS đặc thù] + [Mục tiêu]
- Công thức 4: Bài học cụ thể - [Phương pháp] + [Bài/Chương cụ thể] + [Công cụ]
- Công thức 5: Tạo công cụ mới - Thiết kế [Công cụ tự tạo] + [Mục đích]

## YÊU CẦU ĐẦU RA:
Trả về JSON với format:
{
  "structure": {
    "action": "Từ khóa hành động (hoặc rỗng nếu không có)",
    "tool": "Công cụ/Phương tiện (hoặc rỗng)",
    "subject": "Môn học/Lĩnh vực",
    "scope": "Phạm vi (lớp, cấp học)",
    "purpose": "Mục đích"
  },
  "duplicateLevel": "Cao|Trung bình|Thấp",
  "duplicateDetails": "Giải thích chi tiết về mức độ trùng lặp, có bao nhiêu đề tài tương tự",
  "scores": {
    "specificity": <điểm>,
    "novelty": <điểm>,
    "feasibility": <điểm>,
    "clarity": <điểm>,
    "total": <tổng điểm>
  },
  "scoreDetails": [
    { "category": "Độ cụ thể", "score": <điểm>, "maxScore": 25, "reason": "lý do" },
    { "category": "Tính mới", "score": <điểm>, "maxScore": 30, "reason": "lý do" },
    { "category": "Tính khả thi", "score": <điểm>, "maxScore": 25, "reason": "lý do" },
    { "category": "Độ rõ ràng", "score": <điểm>, "maxScore": 20, "reason": "lý do" }
  ],
  "problems": ["Vấn đề 1", "Vấn đề 2", ...],
  "suggestions": [
    { "title": "Tên đề tài mới 1", "strength": "Điểm mạnh", "predictedScore": <điểm dự kiến> },
    { "title": "Tên đề tài mới 2", "strength": "Điểm mạnh", "predictedScore": <điểm dự kiến> },
    { "title": "Tên đề tài mới 3", "strength": "Điểm mạnh", "predictedScore": <điểm dự kiến> },
    { "title": "Tên đề tài mới 4", "strength": "Điểm mạnh", "predictedScore": <điểm dự kiến> },
    { "title": "Tên đề tài mới 5", "strength": "Điểm mạnh", "predictedScore": <điểm dự kiến> }
  ],
  "relatedTopics": ["Đề tài mới nổi liên quan 1", "Đề tài mới nổi liên quan 2", ...],
  "overallVerdict": "Đánh giá tổng quan và lời khuyên cuối cùng"
}
`;

    for (const model of modelsToTry) {
      try {
        console.log(`[TitleAnalysis] Đang thử model: ${model} với key: ${currentKey.name}`);
        const response = await ai.models.generateContent({
          model,
          contents: prompt,
          config: {
            responseMimeType: "application/json",
            temperature: 0.3,
          },
        });

        if (response.text) {
          resetKeyError(currentKey.id);
          const result = JSON.parse(response.text) as TitleAnalysisResult;
          return result;
        } else {
          throw new Error("Empty response from Gemini");
        }
      } catch (error: any) {
        console.warn(`[TitleAnalysis] Model ${model} thất bại:`, error.message);
        lastError = error;

        if (isQuotaOrRateLimitError(error) || isInvalidKeyError(error)) {
          markKeyError(currentKey.id, error.message);
          keyRetries++;
          break;
        }
      }
    }

    if (!isQuotaOrRateLimitError(lastError) && !isInvalidKeyError(lastError)) {
      break;
    }
  }

  throw lastError || new Error("Tất cả các model và key đều thất bại");
};
