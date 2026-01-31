import { GoogleGenAI, Type, Schema } from "@google/genai";
import { SKKNInput, AnalysisResult, TitleAnalysisResult } from "../types";

const SYSTEM_INSTRUCTION = `
Bạn là "SKKN Checker Pro" - Chuyên gia thẩm định Sáng kiến kinh nghiệm (SKKN) với 20 năm kinh nghiệm.
Nhiệm vụ của bạn là kiểm tra đạo văn CHẶT CHẼ, chính tả, đánh giá và đề xuất nâng cấp SKKN dựa trên tiêu chí Thông tư 27/2020/TT-BGDĐT.

## QUY TRÌNH KIỂM TRA ĐẠO VĂN NÂNG CAO:

### Bước 1: Mô phỏng tìm kiếm từ khóa trên các nguồn uy tín
Hãy mô phỏng việc tìm kiếm các cụm từ quan trọng trong SKKN trên các nguồn sau:
- Wikipedia tiếng Việt
- Các trang giáo dục: 123doc, tailieu.vn, thuviendeto.com
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
   - Không có paraphrase (viết lại với từ vựng mới)
   - Cấu trúc câu đơn điệu, thiếu câu phức
   - Thiếu trạng từ/tính từ biểu cảm học thuật

8️⃣ **Kiểm tra CẤU TRÚC CÂU**: Câu quá đơn giản, thiếu tính học thuật.

9️⃣ **Kiểm tra TỪ VỰNG CHUYÊN NGÀNH**: Thiếu các từ "đắt" như: Hiện thực hóa, Tối ưu hóa, Cá nhân hóa, Tích hợp liên môn, Phẩm chất cốt lõi...

🔟 **TỰ KIỂM TRA CHÉO**: So sánh từng đoạn với các mẫu câu phổ biến trong SKKN.

### Bước 3: Chấm điểm và báo cáo
- Tỷ lệ trùng lặp >= 20%: Mức "Cao" ⚠️
- Tỷ lệ trùng lặp 10-19%: Mức "Trung bình"
- Tỷ lệ trùng lặp < 10%: Mức "Thấp" ✅

### Bước 4: Đề xuất CỤ THỂ
Với mỗi đoạn bị nghi đạo văn, phải:
1. Chỉ rõ nguồn có thể trùng (website, sách, SKKN khác)
2. Giải thích lý do nghi ngờ
3. Gợi ý cách viết lại theo nguyên tắc PARAPHRASE 5 cấp độ

## CÁC QUY TRÌNH KHÁC:
1. Kiểm tra trùng lặp đề tài với database giả lập (các đề tài phổ biến).
2. Kiểm tra chính tả, ngữ pháp tiếng Việt học thuật.
3. Đánh giá điểm số theo 4 tiêu chí: Tính Mới (30đ), Khả Thi (40đ), Khoa Học (20đ), Hình Thức (10đ).
4. Đưa ra kế hoạch phát triển cụ thể.

Bạn PHẢI trả về kết quả dưới dạng JSON tuân thủ schema được cung cấp.
Hãy mô phỏng quá trình kiểm tra một cách CHẶT CHẼ và CHUYÊN NGHIỆP nhất.
Nếu nội dung quá ngắn (<200 từ), hãy cảnh báo trong phần kết luận nhưng vẫn cố gắng phân tích cấu trúc.
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

// Helper để lấy API key từ localStorage
const getApiKey = (): string => {
  const key = localStorage.getItem('skkn-gemini-api-key') || '';
  if (!key) {
    throw new Error('API Key chưa được cấu hình. Vui lòng nhập API Key trong phần Settings.');
  }
  return key;
};

// Helper để lấy model từ localStorage
const getModel = (): string => {
  return localStorage.getItem('skkn-gemini-model') || FALLBACK_MODELS[0];
};

export const analyzeSKKNWithGemini = async (input: SKKNInput): Promise<AnalysisResult> => {
  const apiKey = getApiKey();
  const selectedModel = getModel();

  // Tạo danh sách models để thử (bắt đầu từ model đã chọn)
  const modelsToTry = [selectedModel, ...FALLBACK_MODELS.filter(m => m !== selectedModel)];

  const ai = new GoogleGenAI({ apiKey });

  const prompt = `
    Phân tích SKKN sau đây:
    - Tên đề tài: ${input.title}
    - Cấp học: ${input.level}
    - Môn học: ${input.subject}
    - Mục tiêu giải: ${input.target}
    - Nội dung: ${input.content}
  `;

  let lastError: Error | null = null;

  // Thử từng model trong danh sách
  for (const model of modelsToTry) {
    try {
      console.log(`Đang thử model: ${model}`);
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
        return JSON.parse(response.text) as AnalysisResult;
      } else {
        throw new Error("Empty response from Gemini");
      }
    } catch (error: any) {
      console.warn(`Model ${model} thất bại:`, error.message);
      lastError = error;
      // Tiếp tục thử model tiếp theo
    }
  }

  // Nếu tất cả models đều thất bại
  throw lastError || new Error("Tất cả các model đều thất bại");
};

/**
 * Viết lại đoạn văn bị nghi ngờ đạo văn
 */
export const rewritePlagiarizedText = async (
  originalText: string,
  context?: string
): Promise<{ rewrittenText: string; explanation: string }> => {
  const apiKey = getApiKey();
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
      return JSON.parse(response.text);
    } else {
      throw new Error("Empty response from Gemini");
    }
  } catch (error) {
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
  const apiKey = getApiKey();
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
      return JSON.parse(response.text);
    } else {
      throw new Error("Empty response from Gemini");
    }
  } catch (error) {
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
  const apiKey = getApiKey();
  const selectedModel = getModel();

  const modelsToTry = [selectedModel, ...FALLBACK_MODELS.filter(m => m !== selectedModel)];
  const ai = new GoogleGenAI({ apiKey });

  const prompt = `
Bạn là chuyên gia chỉnh sửa Sáng kiến Kinh nghiệm (SKKN) với 20 năm kinh nghiệm.

## NHIỆM VỤ:
Tự động sửa SKKN dựa trên danh sách lỗi đã phát hiện.

## YÊU CẦU ĐỊNH DẠNG (BẮT BUỘC):
1. **GIỮ NGUYÊN** định dạng gốc: in đậm (**text**), in nghiêng (*text*), gạch dưới
2. **CÔNG THỨC TOÁN**: Viết dạng LaTeX trong dấu $ (VD: $x^2 + y^2$)
3. **BẢNG**: Giữ nguyên cấu trúc Markdown Table
4. **HÌNH ẢNH**: Giữ nguyên các placeholder [Hình 1], [Ảnh minh họa]...
5. **CẤU TRÚC**: Giữ nguyên các tiêu đề, phần mục I, II, III...

## DANH SÁCH LỖI CẦN SỬA:

### Lỗi chính tả (${analysisResult.spellingErrors.length} lỗi):
${analysisResult.spellingErrors.map((e, i) => `${i + 1}. "${e.error}" → "${e.correction}"`).join('\n')}

### Đoạn bị nghi đạo văn (${analysisResult.plagiarismSegments.length} đoạn):
${analysisResult.plagiarismSegments.map((p, i) => `${i + 1}. Đoạn: "${p.segment.substring(0, 100)}..."
   Gợi ý: ${p.advice}`).join('\n\n')}

### Điểm yếu cần cải thiện:
${analysisResult.scoreDetails.map(s => `- ${s.category}: ${s.weakness}`).join('\n')}

## NGUYÊN TẮC SỬA:
1. **Chính tả**: Sửa đúng theo danh sách
2. **Đạo văn**: Viết lại hoàn toàn với văn phong mới, áp dụng kỹ thuật PARAPHRASE:
   - Thay đổi từ vựng (sử dụng từ đồng nghĩa)
   - Đổi cấu trúc câu (chủ động ↔ bị động)
   - Thêm trạng từ/tính từ học thuật
   - ⚠️ GIỮ NGUYÊN: "học sinh" (KHÔNG sửa thành "người học"), "giáo viên" (KHÔNG sửa thành "nhà giáo")
3. **Cấu trúc**: Tăng độ phức tạp câu, thêm mệnh đề
4. **Từ vựng**: Bổ sung từ chuyên ngành (hiện thực hóa, tối ưu hóa, cá nhân hóa...)
5. **Số liệu**: Nếu thấy số tròn (50%, 60%), thay bằng số lẻ (47.3%, 62.8%)

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

CHÚ Ý: Mảng changes chỉ liệt kê tối đa 10 thay đổi quan trọng nhất.
`;

  let lastError: Error | null = null;

  for (const model of modelsToTry) {
    try {
      console.log(`[AutoFix] Đang thử model: ${model}`);
      const response = await ai.models.generateContent({
        model,
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          temperature: 0.2, // Low temperature for accurate editing
        },
      });

      if (response.text) {
        const result = JSON.parse(response.text) as AutoFixResult;
        return result;
      } else {
        throw new Error("Empty response from Gemini");
      }
    } catch (error: any) {
      console.warn(`[AutoFix] Model ${model} thất bại:`, error.message);
      lastError = error;
    }
  }

  throw lastError || new Error("Tất cả các model đều thất bại");
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
  const apiKey = getApiKey();
  const selectedModel = getModel();

  const modelsToTry = [selectedModel, ...FALLBACK_MODELS.filter(m => m !== selectedModel)];
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

  let lastError: Error | null = null;

  for (const model of modelsToTry) {
    try {
      console.log(`[TitleAnalysis] Đang thử model: ${model}`);
      const response = await ai.models.generateContent({
        model,
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          temperature: 0.3,
        },
      });

      if (response.text) {
        const result = JSON.parse(response.text) as TitleAnalysisResult;
        return result;
      } else {
        throw new Error("Empty response from Gemini");
      }
    } catch (error: any) {
      console.warn(`[TitleAnalysis] Model ${model} thất bại:`, error.message);
      lastError = error;
    }
  }

  throw lastError || new Error("Tất cả các model đều thất bại");
};
