import { GoogleGenAI, Type, Schema } from "@google/genai";
import { SKKNInput, AnalysisResult } from "../types";

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
   - Thay đổi từ vựng (học sinh → người học, giáo viên → nhà giáo)
   - Đổi cấu trúc câu (chủ động ↔ bị động)
   - Thêm trạng từ/tính từ học thuật
3. **Cấu trúc**: Tăng độ phức tạp câu, thêm mệnh đề
4. **Từ vựng**: Bổ sung từ chuyên ngành (hiện thực hóa, tối ưu hóa, cá nhân hóa...)
5. **Số liệu**: Nếu thấy số tròn (50%, 60%), thay bằng số lẻ (47.3%, 62.8%)

## NỘI DUNG SKKN GỐC:
${originalContent}

## YÊU CẦU ĐẦU RA:
Trả về JSON với format:
{
  "fixedContent": "Toàn bộ nội dung SKKN đã sửa (giữ nguyên định dạng)",
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
