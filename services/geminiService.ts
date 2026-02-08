import { GoogleGenAI, Type, Schema } from "@google/genai";
import { SKKNInput, AnalysisResult, TitleAnalysisResult } from "../types";
import {
  getApiKey,
  hasAnyKey,
  isQuotaOrRateLimitError,
  isInvalidKeyError,
  getVietnameseErrorMessage,
  getSelectedModel,
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

// Model mặc định
const DEFAULT_MODEL = 'gemini-3-pro-preview';

// Helper để lấy API key (đơn giản, 1 key)
const getApiKeyOrThrow = (): string => {
  if (!hasAnyKey()) {
    throw new Error('Chưa có API Key. Vui lòng nhập API Key trong phần Cài đặt.');
  }

  const key = getApiKey();
  if (!key) {
    throw new Error('Chưa có API Key. Vui lòng nhập API Key trong phần Cài đặt.');
  }

  return key;
};

// Helper để lấy model từ localStorage
const getModel = (): string => {
  return getSelectedModel() || DEFAULT_MODEL;
};

export const analyzeSKKNWithGemini = async (input: SKKNInput): Promise<AnalysisResult> => {
  const apiKey = getApiKeyOrThrow();
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

  const ai = new GoogleGenAI({ apiKey });
  let lastError: Error | null = null;

  // Thử từng model trong danh sách
  for (const model of modelsToTry) {
    try {
      console.log(`[analyzeSKKN] Đang thử model: ${model}`);
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

      // Nếu là lỗi quota/rate limit hoặc key không hợp lệ, throw ngay với message tiếng Việt
      if (isQuotaOrRateLimitError(error) || isInvalidKeyError(error)) {
        throw new Error(getVietnameseErrorMessage(error));
      }
      // Lỗi khác - tiếp tục thử model khác
    }
  }

  // Nếu tất cả đều thất bại
  throw lastError || new Error("Tất cả các model đều thất bại. Vui lòng thử lại sau.");
};

/**
 * Viết lại đoạn văn bị nghi ngờ đạo văn
 */
export const rewritePlagiarizedText = async (
  originalText: string,
  context?: string
): Promise<{ rewrittenText: string; explanation: string }> => {
  const apiKey = getApiKeyOrThrow();
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
  } catch (error: any) {
    if (isQuotaOrRateLimitError(error) || isInvalidKeyError(error)) {
      throw new Error(getVietnameseErrorMessage(error));
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
  const apiKey = getApiKeyOrThrow();
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
  } catch (error: any) {
    if (isQuotaOrRateLimitError(error) || isInvalidKeyError(error)) {
      throw new Error(getVietnameseErrorMessage(error));
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
  const apiKey = getApiKeyOrThrow();
  const selectedModel = getModel();
  const modelsToTry = [selectedModel, ...FALLBACK_MODELS.filter(m => m !== selectedModel)];

  const ai = new GoogleGenAI({ apiKey });

  // Giới hạn nội dung để tránh tốn quá nhiều token
  const MAX_CONTENT_LENGTH = 15000; // ~15k ký tự
  const MAX_SPELLING_ERRORS = 20;
  const MAX_PLAGIARISM_SEGMENTS = 5;

  const truncatedContent = originalContent.length > MAX_CONTENT_LENGTH
    ? originalContent.substring(0, MAX_CONTENT_LENGTH) + '\n\n[... NỘI DUNG BỊ CẮT BỚT ...]'
    : originalContent;

  const limitedSpellingErrors = analysisResult.spellingErrors.slice(0, MAX_SPELLING_ERRORS);
  const limitedPlagiarismSegments = analysisResult.plagiarismSegments.slice(0, MAX_PLAGIARISM_SEGMENTS);

  const prompt = `
Sửa SKKN theo danh sách lỗi. GIỮ NGUYÊN định dạng gốc (bold, italic, bảng, công thức).

## LỖI CẦN SỬA:

### Chính tả (${limitedSpellingErrors.length} lỗi):
${limitedSpellingErrors.map((e, i) => `${i + 1}. "${e.error}" → "${e.correction}"`).join('\n')}

### Đoạn đạo văn (${limitedPlagiarismSegments.length} đoạn):
${limitedPlagiarismSegments.map((p, i) => `${i + 1}. "${p.segment.substring(0, 80)}..." → ${p.advice}`).join('\n')}

## NỘI DUNG GỐC:
${truncatedContent}

## OUTPUT JSON:
{
  "fixedContent": "Nội dung đã sửa, bọc chỗ sửa trong <red>...</red>",
  "summary": {"spellingFixed": N, "plagiarismRewritten": N, "structureImproved": N, "vocabularyEnhanced": N},
  "changes": [{"type": "spelling|plagiarism", "original": "gốc", "fixed": "sửa", "reason": "lý do"}]
}
Chỉ liệt kê tối đa 10 changes quan trọng nhất.
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
          temperature: 0.2,
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

      if (isQuotaOrRateLimitError(error) || isInvalidKeyError(error)) {
        throw new Error(getVietnameseErrorMessage(error));
      }
    }
  }

  throw lastError || new Error("Tất cả các model đều thất bại. Vui lòng thử lại sau.");
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
  const apiKey = getApiKeyOrThrow();
  const selectedModel = getModel();
  const modelsToTry = [selectedModel, ...FALLBACK_MODELS.filter(m => m !== selectedModel)];

  const ai = new GoogleGenAI({ apiKey });

  const prompt = `
Bạn là chuyên gia phân tích tên đề tài Sáng kiến kinh nghiệm (SKKN) với 20 năm kinh nghiệm.

## THÔNG TIN ĐỀ TÀI CẦN PHÂN TÍCH:
- Tên đề tài: "${title}"
${subject ? `- Môn học/Lĩnh vực: ${subject}` : ''}
${level ? `- Cấp học: ${level}` : ''}

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
  "duplicateDetails": "Giải thích chi tiết về mức độ trùng lặp",
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
  "problems": ["Vấn đề 1", "Vấn đề 2"],
  "suggestions": [
    { "title": "Tên đề tài mới 1", "strength": "Điểm mạnh", "predictedScore": <điểm dự kiến> },
    { "title": "Tên đề tài mới 2", "strength": "Điểm mạnh", "predictedScore": <điểm dự kiến> },
    { "title": "Tên đề tài mới 3", "strength": "Điểm mạnh", "predictedScore": <điểm dự kiến> }
  ],
  "relatedTopics": ["Đề tài mới nổi liên quan 1", "Đề tài mới nổi liên quan 2"],
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

      if (isQuotaOrRateLimitError(error) || isInvalidKeyError(error)) {
        throw new Error(getVietnameseErrorMessage(error));
      }
    }
  }

  throw lastError || new Error("Tất cả các model đều thất bại. Vui lòng thử lại sau.");
};
