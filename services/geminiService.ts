import { Type, Schema, ThinkingLevel } from "@google/genai";
import { SKKNInput, AnalysisResult, TitleAnalysisResult, AIRiskDetails, ImprovementAnalysisResult, AutoImprovementFixResult, DetectedIssue, AIReductionResult, QuickAIDetectionResult } from "../types";
import { getHistory } from './historyService';
import {
  hasAnyKey,
  isQuotaOrRateLimitError,
  isModelOverloadedError,
  isModelNotFoundError,
  getVietnameseErrorMessage,
  getSelectedModel,
  getActiveApiKeyForProvider,
  getNextApiKey,
  markKeyExhausted,
  incrementDailyRequestCount,
  createGoogleAiClient,
  getProvider,
  getOrderedModels,
  canFallbackToNextModel,
  shouldRotateApiKey,
  parseApiError,
} from './apiKeyService';

// ======================================================================
// CLIENT-SIDE TEXT METRICS (Deterministic - luôn cho cùng kết quả)
// ======================================================================

/**
 * Tính toán các chỉ số AI detection phía client.
 * Hoàn toàn deterministic: cùng 1 nội dung → cùng 1 kết quả.
 */
function computeTextMetrics(text: string): {
  burstiness: number;
  patternDensity: number;
  sentenceUniformity: number;
  avgSentenceLength: number;
  estimatedAIScore: number;
} {
  if (!text || text.trim().length < 50) {
    return { burstiness: 50, patternDensity: 0, sentenceUniformity: 50, avgSentenceLength: 0, estimatedAIScore: 0 };
  }

  // --- 1. Tách câu ---
  const sentences = text
    .replace(/\n+/g, '. ')
    .split(/[.!?;]+/)
    .map(s => s.trim())
    .filter(s => s.length > 5);

  if (sentences.length < 3) {
    return { burstiness: 50, patternDensity: 0, sentenceUniformity: 50, avgSentenceLength: 0, estimatedAIScore: 0 };
  }

  // --- 2. Burstiness: Variance độ dài câu ---
  // AI viết câu đều đặn → burstiness thấp. Người viết → burstiness cao.
  const lengths = sentences.map(s => s.split(/\s+/).length);
  const avgLen = lengths.reduce((a, b) => a + b, 0) / lengths.length;
  const variance = lengths.reduce((sum, l) => sum + Math.pow(l - avgLen, 2), 0) / lengths.length;
  const stdDev = Math.sqrt(variance);
  const coeffOfVariation = avgLen > 0 ? (stdDev / avgLen) * 100 : 0;
  // CV < 20% → câu rất đều (nghi AI), CV > 40% → câu đa dạng (người viết)
  const burstiness = Math.min(100, Math.max(0, Math.round(coeffOfVariation * 2)));

  // --- 3. Pattern Density: Đếm mẫu câu đặc trưng AI ---
  const aiPatterns = [
    /trong bối cảnh.*hiện nay/gi,
    /theo định hướng.*chương trình/gi,
    /việc.*là (yêu cầu|vấn đề) cấp thiết/gi,
    /tuy nhiên.*thực tế cho thấy/gi,
    /không chỉ.*mà còn/gi,
    /điều này cho thấy.*rằng/gi,
    /một cách.*hiệu quả/gi,
    /đáng chú ý là/gi,
    /cần lưu ý rằng/gi,
    /do đó.*là (rất )?cần thiết/gi,
    /qua đó.*học sinh/gi,
    /nói cách khác/gi,
    /tóm lại/gi,
    /từ những phân tích trên/gi,
    /có thể (thấy|nhận thấy|khẳng định) rằng/gi,
    /điều đáng (chú ý|xem xét) là/gi,
    /một (điểm|khía cạnh) đáng (chú ý|xem xét)/gi,
  ];
  let patternCount = 0;
  for (const pattern of aiPatterns) {
    const matches = text.match(pattern);
    if (matches) patternCount += matches.length;
  }
  // Chuẩn hóa: trên 1000 từ
  const wordCount = text.split(/\s+/).length;
  const patternsPer1000 = wordCount > 0 ? (patternCount / wordCount) * 1000 : 0;
  // > 5 patterns/1000 từ → nghi AI cao
  const patternDensity = Math.min(100, Math.max(0, Math.round(patternsPer1000 * 15)));

  // --- 4. Sentence Uniformity: Đo mức đồng đều cấu trúc câu ---
  // Đếm câu bắt đầu giống nhau (cùng 2-3 từ đầu)
  const starters = sentences.map(s => s.split(/\s+/).slice(0, 3).join(' ').toLowerCase());
  const starterCounts: Record<string, number> = {};
  for (const s of starters) {
    starterCounts[s] = (starterCounts[s] || 0) + 1;
  }
  const repeatedStarters = Object.values(starterCounts).filter(c => c > 1).reduce((a, b) => a + b, 0);
  const uniformityRatio = sentences.length > 0 ? (repeatedStarters / sentences.length) * 100 : 0;
  const sentenceUniformity = Math.min(100, Math.round(uniformityRatio));

  // --- 5. Estimated AI Score (deterministic) ---
  // Trọng số: patternDensity (40%), burstiness nghịch (35%), uniformity (25%)
  const burstiScore = Math.max(0, 100 - burstiness); // burstiness thấp → nghi AI → score cao
  const estimatedAIScore = Math.min(100, Math.max(0, Math.round(
    patternDensity * 0.40 +
    burstiScore * 0.35 +
    sentenceUniformity * 0.25
  )));

  return {
    burstiness,
    patternDensity,
    sentenceUniformity,
    avgSentenceLength: Math.round(avgLen * 10) / 10,
    estimatedAIScore,
  };
}

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

## 📋 ĐÁNH GIÁ CHI TIẾT TỪNG TIÊU CHÍ (qualityCriteria) - BẮT BUỘC
Bạn PHẢI đánh giá 8-10 tiêu chí chất lượng với nhận xét chi tiết. Mỗi tiêu chí gồm:
- **criteria**: Tên tiêu chí (Tính mới, Cơ sở lý luận và thực tiễn, Giải pháp/Biện pháp, Kết quả và hiệu quả, Tính khả thi và khả năng nhân rộng, Ngôn ngữ và chính tả, Hình thức trình bày, Tính ứng dụng thực tế, v.v.)
- **score**: Điểm từ 0-10
- **comment**: NHẬN XÉT CHI TIẾT (BẮT BUỘC, KHÔNG ĐƯỢC ĐỂ TRỐNG). Viết 1-3 câu nhận xét cụ thể dựa trên nội dung SKKN đã đọc. Ví dụ: "Giải pháp ứng dụng Kahoot trong dạy học Hóa khá sáng tạo, tuy nhiên chưa có dữ liệu so sánh trước-sau để minh chứng hiệu quả" hoặc "Số liệu thống kê chi tiết với 31/45 HS đạt trên TB, có biểu đồ minh họa rõ ràng". KHÔNG viết chung chung như "Tốt" hay "Khá".

⚠️ CẢNH BÁO CUỐI: Bạn là giám khảo NGHIÊM KHẮC, không phải người khích lệ. Nếu SKKN sơ sài, hãy chấm điểm THẤP và giải thích rõ lý do. Điểm 90-100 là CỰC KỲ HIẾM - chỉ dành cho SKKN thực sự xuất sắc với đầy đủ minh chứng.

## 🤖 PHÂN TÍCH NGUY CƠ AI (AI Risk Detection)
Bạn cũng PHẢI phân tích xem SKKN có dấu hiệu được viết bởi AI hay không, dựa trên:

### Các chỉ số phân tích:
1. **Perplexity Score (0-100)**: Đánh giá mức độ "bất ngờ" của từ vựng. Văn bản AI thường có perplexity thấp (20-40). Văn bản người viết: 40-80+.
2. **Burstiness Score (0-100)**: Đánh giá biến động độ dài câu. AI viết câu đều đặn (burstiness thấp). Người viết câu ngắn dài xen kẽ.
3. **Pattern Density (0-100)**: Tỷ lệ các mẫu câu đặc trưng AI: "trong bối cảnh... hiện nay", "tuy nhiên, thực tế cho thấy", "không chỉ... mà còn", "qua đó... học sinh", "do đó... là rất cần thiết".
4. **Overall AI Percent (0-100)**: Phần trăm tổng thể khả năng văn bản do AI tạo.

### Ngưỡng đánh giá:
- **< 15%**: An toàn (Thấp) - Ít khả năng AI, hành văn tự nhiên, có cảm xúc con người.
- **15-35%**: Rủi ro thấp (Trung bình) - Có thể có một số đoạn AI hỗ trợ nhưng đã được biên tập kỹ.
- **35-60%**: Rủi ro cao (Cao) - Nhiều dấu hiệu AI rõ rệt, thiếu sự gắn kết thực tế.
- **> 60%**: Rủi ro nghiêm trọng (Rất cao) - Gần như chắc chắn 100% copy từ AI thô.

### Các mẫu câu đặc trưng AI (Raw AI) cần kiểm tra:
- ChatGPT: "trong bối cảnh... hiện nay", "theo định hướng... chương trình", "việc... là yêu cầu cấp thiết", "tuy nhiên... thực tế cho thấy", "không chỉ... mà còn"
- Gemini: "điều này cho thấy... rằng", "một cách... hiệu quả", "đáng chú ý là", "cần lưu ý rằng"
- Claude: "điều đáng chú ý là", "một điểm đáng xem xét", "có thể tranh luận rằng"

⚠️ LƯU Ý QUAN TRỌNG KHI CHẤM ĐIỂM AI:
1. KHÔNG đánh đồng "văn bản trơn tru, logic chặt chẽ" với "văn bản AI". Một người giáo viên giỏi hoàn toàn có thể viết ra một SKKN với cấu trúc xuất sắc, không lỗi chính tả.
2. Dấu hiệu cốt lõi của "AI thô" (Raw AI) là sự vô hồn, thiếu ví dụ thực tiễn sinh động mang tính cá nhân, và quá lạm dụng các từ nối mang tính chuyển ý (tuy nhiên, do đó, tóm lại, đáng chú ý là...).
3. Nếu văn bản có cấu trúc câu đa dạng (lúc ngắn lúc dài), từ vựng phong phú nhưng giản dị (không đao to búa lớn), đôi khi có cách diễn đạt hơi "đời thường" hoặc lặp từ nhẹ một cách tự nhiên -> ĐÂY LÀ NGƯỜI VIẾT (hoặc đã được humanize rất tốt) -> Chấm AI Score THẤP.
4. Chỉ cho aiRiskScore > 50% khi bạn thực sự thấy sự máy móc, lặp lại các pattern rập khuôn và thiếu chiều sâu thực tế.
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
    structure: {
      type: Type.OBJECT,
      description: "Kiểm tra cấu trúc SKKN có đầy đủ các phần không",
      properties: {
        hasIntro: { type: Type.BOOLEAN, description: "Có phần Đặt vấn đề / Mở đầu không" },
        hasTheory: { type: Type.BOOLEAN, description: "Có phần Cơ sở lý luận không" },
        hasReality: { type: Type.BOOLEAN, description: "Có phần Thực trạng không" },
        hasSolution: { type: Type.BOOLEAN, description: "Có phần Giải pháp / Biện pháp không" },
        hasResult: { type: Type.BOOLEAN, description: "Có phần Kết quả không" },
        hasConclusion: { type: Type.BOOLEAN, description: "Có phần Kết luận không" },
        missing: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Danh sách các phần bị thiếu (tiếng Anh: intro, theory, reality, solution, result, conclusion)" },
      },
    },
    qualityCriteria: {
      type: Type.ARRAY,
      description: "Điểm chi tiết từng tiêu chí chất lượng (8-10 tiêu chí), mỗi tiêu chí chấm 0-10. BẮT BUỘC phải có nhận xét chi tiết cho từng tiêu chí.",
      items: {
        type: Type.OBJECT,
        properties: {
          criteria: { type: Type.STRING, description: "Tên tiêu chí (VD: Tính mới, Cơ sở lý luận và thực tiễn, Giải pháp/Biện pháp, Kết quả và hiệu quả, Tính khả thi và khả năng nhân rộng, Ngôn ngữ và chính tả, Hình thức trình bày, Tính ứng dụng thực tế)" },
          score: { type: Type.NUMBER, description: "Điểm từ 0-10" },
          comment: { type: Type.STRING, description: "NHẬN XÉT CHI TIẾT BẮT BUỘC (1-3 câu). Phải viết nhận xét cụ thể dựa trên nội dung SKKN, chỉ rõ điểm mạnh/yếu. KHÔNG ĐƯỢC để trống hoặc viết chung chung. VD: 'Giải pháp ứng dụng CNTT khá sáng tạo nhưng thiếu số liệu so sánh trước-sau' hoặc 'Cơ sở lý luận vững chắc với 5 tài liệu tham khảo cập nhật, tuy nhiên phần thực trạng cần bổ sung khảo sát thực tế tại đơn vị'." },
        },
        required: ["criteria", "score", "comment"],
      },
    },
    aiRiskScore: { type: Type.NUMBER, description: "Điểm nguy cơ AI từ 0-100 (0 = hoàn toàn người viết, 100 = hoàn toàn AI)" },
    aiRiskLevel: { type: Type.STRING, enum: ["Thấp", "Trung bình", "Cao", "Rất cao"], description: "Mức độ nguy cơ AI" },
    aiRiskDetails: {
      type: Type.OBJECT,
      description: "Chi tiết phân tích nguy cơ AI",
      properties: {
        perplexityScore: { type: Type.NUMBER, description: "Điểm perplexity 0-100 (thấp = nghi ngờ AI)" },
        burstinessScore: { type: Type.NUMBER, description: "Điểm burstiness 0-100 (thấp = câu đều đặn, nghi AI)" },
        patternDensity: { type: Type.NUMBER, description: "Mật độ pattern AI 0-100 (cao = nhiều mẫu câu AI)" },
        overallAIPercent: { type: Type.NUMBER, description: "Phần trăm tổng thể khả năng AI 0-100" },
        suspiciousPatterns: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Danh sách các mẫu câu đặc trưng AI tìm thấy (tối đa 5)" },
        recommendations: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Gợi ý cải thiện để giảm nguy cơ AI (tối đa 3)" },
      },
    },
  },
  required: ["duplicateLevel", "duplicateDetails", "spellingErrors", "plagiarismRisk", "plagiarismSegments", "scores", "scoreDetails", "developmentPlan", "overallConclusion", "structure", "qualityCriteria", "aiRiskScore", "aiRiskLevel", "aiRiskDetails"],
};

// ═══════════ CENTRALIZED FALLBACK (api.md §II) ═══════════

// Helper để lấy API key hiện tại
const getApiKeyOrThrow = (): string => {
  if (!hasAnyKey()) {
    throw new Error('Vui lòng cấu hình API Key trước khi sử dụng tính năng này.');
  }
  const key = getActiveApiKeyForProvider();
  if (!key) {
    throw new Error('Tất cả API Key đã hết quota. Vui lòng chờ vài phút hoặc nhập key mới.');
  }
  return key;
};

const getModelsToTry = (): string[] => {
  return getOrderedModels();
};

const throwGeminiError = (error: any, fallbackMessage: string): never => {
  if (error && (shouldRotateApiKey(error) || isModelOverloadedError(error))) {
    throw new Error(getVietnameseErrorMessage(error));
  }
  throw error || new Error(fallbackMessage);
};

/**
 * Hàm fallback tập trung — mọi generateContent ĐỀU đi qua đây (api.md §II).
 * - Thử model chọn trước, sau đó chuỗi fallback.
 * - Chuyển model khi: 500, 503, 504, NOT_FOUND, overloaded, Agent Platform 403.
 * - Dừng khi: 401, 429, 400, lỗi không xác định.
 * - Xoay key Gemini khi hết quota.
 */
interface FallbackCallConfig {
  systemInstruction?: string;
  responseMimeType?: string;
  responseSchema?: Schema;
  temperature?: number;
  maxOutputTokens?: number;
  thinkingConfig?: { thinkingLevel: ThinkingLevel };
}

const callWithFallback = async <T>(
  tag: string,
  prompt: string,
  config: FallbackCallConfig,
  parseResponse: (text: string) => T,
): Promise<{ result: T; usedModel: string }> => {
  const modelsToTry = getModelsToTry();
  const provider = getProvider();
  let lastError: Error | null = null;
  let apiKey = getApiKeyOrThrow();

  while (apiKey) {
    const ai = createGoogleAiClient(apiKey, provider);

    for (const model of modelsToTry) {
      try {
        console.log(`[${tag}] Provider: ${provider} | Key ...${apiKey.slice(-6)} | Model: ${model}`);
        const response = await ai.models.generateContent({
          model,
          contents: prompt,
          config: {
            ...(config.systemInstruction ? { systemInstruction: config.systemInstruction } : {}),
            ...(config.responseMimeType ? { responseMimeType: config.responseMimeType } : {}),
            ...(config.responseSchema ? { responseSchema: config.responseSchema } : {}),
            ...(config.temperature !== undefined ? { temperature: config.temperature } : {}),
            ...(config.maxOutputTokens ? { maxOutputTokens: config.maxOutputTokens } : {}),
            ...(config.thinkingConfig ? { thinkingConfig: config.thinkingConfig } : {}),
          },
        });

        if (response.text) {
          incrementDailyRequestCount();
          return { result: parseResponse(response.text), usedModel: model };
        } else {
          throw new Error('Empty response from AI');
        }
      } catch (error: any) {
        console.warn(`[${tag}] Model ${model} thất bại:`, error.message);
        lastError = error;

        // Lỗi cho phép chuyển model → tiếp tục
        if (canFallbackToNextModel(error)) {
          console.log(`[${tag}] ↳ Chuyển model dự phòng (${parseApiError(error)})`);
          continue;
        }

        // Lỗi quota → xoay key (chỉ Gemini)
        if (shouldRotateApiKey(error)) {
          markKeyExhausted(apiKey);
          const nextKey = getNextApiKey();
          if (nextKey) {
            apiKey = nextKey;
            break; // Break model loop, retry với key mới
          }
          throw new Error(getVietnameseErrorMessage(error));
        }

        // Lỗi khác (401, 400, unknown) → dừng ngay
        throw new Error(getVietnameseErrorMessage(error));
      }
    }

    // Nếu vòng model kết thúc mà không break (không có lỗi quota), thoát while
    if (!lastError || !shouldRotateApiKey(lastError)) {
      break;
    }
  }

  throwGeminiError(lastError, 'Tất cả các model đều thất bại. Vui lòng thử lại sau.');
};

export const analyzeSKKNWithGemini = async (input: SKKNInput): Promise<AnalysisResult> => {
  const modelsToTry = getModelsToTry();

  // --- TÍNH TOÁN CLIENT-SIDE AI METRICS (Deterministic) ---
  const clientMetrics = computeTextMetrics(input.content);
  console.log(`[analyzeSKKN] Client AI Metrics:`, clientMetrics);

  let historyPrompt = "";
  try {
    const history = getHistory();
    const prevItem = history.find(item =>
      item.input.title.toLowerCase().trim() === input.title.toLowerCase().trim() &&
      item.input.subject === input.subject
    );
    if (prevItem && prevItem.result && prevItem.result.scores) {
      // CHỈ ép tăng điểm nếu NỘI DUNG ĐÃ THAY ĐỔI
      const contentChanged = prevItem.input.content !== input.content;
      if (contentChanged) {
        const prevScore = prevItem.result.scores.total;
        historyPrompt = `
⚠️ QUY ĐỊNH CHẤM ĐIỂM BẢN CẬP NHẬT:
Hệ thống nhận diện đây là phiên bản cập nhật (NỘI DUNG ĐÃ THAY ĐỔI) của đề tài "${input.title}". Điểm lần chấm trước là: ${prevScore} điểm.
YÊU CẦU BẮT BUỘC: Nếu bản văn này đã có sự cải thiện, bạn PHẢI cho tổng điểm cao hơn bản trước 1-2 điểm (nếu chưa đạt tối đa). Hãy tính toán cẩn thận để đảm bảo điểm tổng mới > ${prevScore}.
`;
      }
      // Nếu nội dung KHÔNG đổi → KHÔNG thêm historyPrompt → chấm khách quan
    }
  } catch (e) {
    console.error("Lỗi đọc lịch sử:", e);
  }

  const prompt = `
    Phân tích SKKN sau đây:
    - Tên đề tài: ${input.title}
    - Cấp học: ${input.level}
    - Môn học: ${input.subject}
    - Mục tiêu giải: ${input.target}
${historyPrompt}

    📊 DỮ LIỆU AI DETECTION TÍNH TOÁN TỪ HỆ THỐNG (deterministic, đã được đo lường chính xác):
    - Burstiness Score (biến động độ dài câu): ${clientMetrics.burstiness}/100 (${clientMetrics.burstiness < 30 ? 'THẤP - câu đều đặn, đặc trưng AI' : clientMetrics.burstiness > 60 ? 'CAO - câu đa dạng, đặc trưng người viết' : 'TRUNG BÌNH'})
    - Pattern Density (mật độ mẫu câu AI): ${clientMetrics.patternDensity}/100 (${clientMetrics.patternDensity > 40 ? 'CAO - nhiều cụm từ đặc trưng AI' : clientMetrics.patternDensity < 15 ? 'THẤP - ít mẫu câu AI' : 'TRUNG BÌNH'})
    - Sentence Uniformity (tính đồng đều câu): ${clientMetrics.sentenceUniformity}/100
    - Estimated AI Score từ hệ thống: ${clientMetrics.estimatedAIScore}%
    ⚠️ QUAN TRỌNG: Hãy THAM KHẢO các chỉ số trên khi đánh giá aiRiskScore. Điểm AI cuối cùng của bạn nên KHÔNG CHÊNH QUÁ ±15 điểm so với Estimated AI Score ${clientMetrics.estimatedAIScore}%. Nếu bạn thấy khác biệt lớn, hãy giải thích trong nhận xét.

    - Nội dung: ${input.content}
  `;

  const { result: parsed, usedModel } = await callWithFallback<AnalysisResult>(
    'analyzeSKKN',
    prompt,
    {
      systemInstruction: SYSTEM_INSTRUCTION,
      responseMimeType: 'application/json',
      responseSchema: RESPONSE_SCHEMA,
      temperature: 0,
    },
    (text) => JSON.parse(text) as AnalysisResult,
  );

  // Đảm bảo scores tồn tại
  if (!parsed.scores) {
    parsed.scores = { innovation: 0, feasibility: 0, scientific: 0, presentation: 0, total: 0 };
  }
  parsed.scores.innovation = Math.min(Number(parsed.scores.innovation) || 0, 30);
  parsed.scores.feasibility = Math.min(Number(parsed.scores.feasibility) || 0, 40);
  parsed.scores.scientific = Math.min(Number(parsed.scores.scientific) || 0, 20);
  parsed.scores.presentation = Math.min(Number(parsed.scores.presentation) || 0, 10);
  parsed.scores.total = Math.min(
    parsed.scores.innovation + parsed.scores.feasibility + parsed.scores.scientific + parsed.scores.presentation,
    100
  );

  // --- TRỘN AI RISK SCORE: 60% client (deterministic) + 40% Gemini ---
  const geminiAIScore = Number(parsed.aiRiskScore) || 0;
  const blendedAIScore = Math.round(
    clientMetrics.estimatedAIScore * 0.6 + geminiAIScore * 0.4
  );
  parsed.aiRiskScore = Math.min(100, Math.max(0, blendedAIScore));

  // --- VALIDATION: Đồng bộ aiRiskLevel với aiRiskScore ---
  if (parsed.aiRiskScore < 15) {
    parsed.aiRiskLevel = 'Thấp';
  } else if (parsed.aiRiskScore < 35) {
    parsed.aiRiskLevel = 'Trung bình';
  } else if (parsed.aiRiskScore < 60) {
    parsed.aiRiskLevel = 'Cao';
  } else {
    parsed.aiRiskLevel = 'Rất cao';
  }

  // --- VALIDATION: Đồng bộ overallAIPercent ---
  if (parsed.aiRiskDetails) {
    parsed.aiRiskDetails.overallAIPercent = parsed.aiRiskScore;
    parsed.aiRiskDetails.burstinessScore = clientMetrics.burstiness;
    parsed.aiRiskDetails.patternDensity = clientMetrics.patternDensity;
  }

  console.log(`[analyzeSKKN] AI Score: Client=${clientMetrics.estimatedAIScore}% | Gemini=${geminiAIScore}% | Blended=${parsed.aiRiskScore}%`);

  parsed.usedModel = usedModel;
  return parsed;
};

/**
 * Viết lại đoạn văn bị nghi ngờ đạo văn
 */
export const rewritePlagiarizedText = async (
  originalText: string,
  context?: string
): Promise<{ rewrittenText: string; explanation: string }> => {
  const modelsToTry = getModelsToTry();

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

  const { result } = await callWithFallback<{ rewrittenText: string; explanation: string }>(
    'Rewrite',
    prompt,
    { responseMimeType: 'application/json' },
    (text) => JSON.parse(text),
  );
  return result;
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
  const modelsToTry = getModelsToTry();

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

  const { result } = await callWithFallback<ReferenceItem[]>(
    'References',
    prompt,
    { responseMimeType: 'application/json' },
    (text) => JSON.parse(text),
  );
  return result;
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
    aiRiskReduced: number;
  };
  changes: Array<{
    type: 'spelling' | 'plagiarism' | 'structure' | 'vocabulary' | 'ai_detection';
    original: string;
    fixed: string;
    reason: string;
  }>;
}

/**
 * Bảo vệ năm học trong SKKN: khôi phục năm học gốc nếu AI tự ý thay đổi.
 * Trích xuất tất cả pattern năm học từ bản gốc, so sánh với bản sửa,
 * và thay thế lại nếu phát hiện sai lệch.
 */
const preserveSchoolYears = (originalContent: string, fixedContent: string): string => {
  // Regex bắt pattern "năm học XXXX-XXXX" (có hoặc không có chữ "năm học")
  const yearWithLabelRegex = /năm\s+học\s+(\d{4})\s*[-–]\s*(\d{4})/gi;
  const yearOnlyRegex = /(\d{4})\s*[-–]\s*(\d{4})/g;

  // Thu thập tất cả năm học từ bản gốc (dạng "năm học XXXX-XXXX" ưu tiên trước)
  const originalYearsWithLabel: string[] = [];
  let m;
  while ((m = yearWithLabelRegex.exec(originalContent)) !== null) {
    originalYearsWithLabel.push(m[0]);
  }

  // Nếu có pattern "năm học XXXX-XXXX" thì chỉ bảo vệ các pattern đó
  if (originalYearsWithLabel.length > 0) {
    let result = fixedContent;
    const fixedYearsWithLabel: string[] = [];
    const fixedYearWithLabelRegex = /năm\s+học\s+(\d{4})\s*[-–]\s*(\d{4})/gi;
    while ((m = fixedYearWithLabelRegex.exec(fixedContent)) !== null) {
      fixedYearsWithLabel.push(m[0]);
    }

    // Thay thế từng năm học bị thay đổi
    for (let i = 0; i < fixedYearsWithLabel.length && i < originalYearsWithLabel.length; i++) {
      // So sánh phần số (bỏ qua khoảng trắng/ký tự gạch ngang khác nhau)
      const origNums = originalYearsWithLabel[i].match(/\d{4}/g);
      const fixedNums = fixedYearsWithLabel[i].match(/\d{4}/g);
      if (origNums && fixedNums && (origNums[0] !== fixedNums[0] || origNums[1] !== fixedNums[1])) {
        result = result.replace(fixedYearsWithLabel[i], originalYearsWithLabel[i]);
      }
    }
    return result;
  }

  // Fallback: bảo vệ pattern XXXX-XXXX ở các vị trí phổ biến (gần đầu văn bản)
  const originalYearsOnly: string[] = [];
  while ((m = yearOnlyRegex.exec(originalContent)) !== null) {
    // Chỉ lấy các pattern năm hợp lệ (năm từ 2000-2099)
    const y1 = parseInt(m[1]);
    const y2 = parseInt(m[2]);
    if (y1 >= 2000 && y1 <= 2099 && y2 >= 2000 && y2 <= 2099 && Math.abs(y2 - y1) === 1) {
      originalYearsOnly.push(m[0]);
    }
  }

  if (originalYearsOnly.length === 0) return fixedContent;

  let result = fixedContent;
  const fixedYearOnlyRegex = /(\d{4})\s*[-–]\s*(\d{4})/g;
  const fixedYearsOnly: Array<{ full: string; y1: number; y2: number }> = [];
  while ((m = fixedYearOnlyRegex.exec(fixedContent)) !== null) {
    const y1 = parseInt(m[1]);
    const y2 = parseInt(m[2]);
    if (y1 >= 2000 && y1 <= 2099 && y2 >= 2000 && y2 <= 2099 && Math.abs(y2 - y1) === 1) {
      fixedYearsOnly.push({ full: m[0], y1, y2 });
    }
  }

  // So sánh: nếu năm học duy nhất trong gốc bị thay đổi trong bản sửa
  const origNums = originalYearsOnly[0].match(/\d{4}/g);
  if (origNums) {
    for (const fy of fixedYearsOnly) {
      if (fy.y1 !== parseInt(origNums[0]) || fy.y2 !== parseInt(origNums[1])) {
        result = result.replace(fy.full, originalYearsOnly[0]);
      }
    }
  }

  return result;
};

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
    aiRiskScore?: number;
    aiRiskDetails?: AIRiskDetails;
  }
): Promise<AutoFixResult> => {
  const modelsToTry = getModelsToTry();

  // Giới hạn nội dung - tăng lên 50k để hỗ trợ SKKN dài
  const MAX_CONTENT_LENGTH = 50000; // ~50k ký tự
  const MAX_SPELLING_ERRORS = 20;
  const MAX_PLAGIARISM_SEGMENTS = 5;

  const wasContentTruncated = originalContent.length > MAX_CONTENT_LENGTH;
  const truncatedContent = wasContentTruncated
    ? originalContent.substring(0, MAX_CONTENT_LENGTH)
    : originalContent;

  const limitedSpellingErrors = analysisResult.spellingErrors.slice(0, MAX_SPELLING_ERRORS);
  const limitedPlagiarismSegments = analysisResult.plagiarismSegments.slice(0, MAX_PLAGIARISM_SEGMENTS);

  // Phân tích AI Risk để thêm vào prompt
  const hasAIRisk = (analysisResult.aiRiskScore ?? 0) > 15;
  const aiRiskInfo = hasAIRisk && analysisResult.aiRiskDetails
    ? `
### Giảm nguy cơ AI (AI Risk Score hiện tại: ${analysisResult.aiRiskScore}%):
Các mẫu câu AI phát hiện được:
${(analysisResult.aiRiskDetails.suspiciousPatterns || []).slice(0, 5).map((p, i) => `${i + 1}. "${p}"`).join('\n')}

Áp dụng 10 KỸ THUẬT VƯỢT AI DETECTION sau để sửa lại văn bản, mục tiêu đưa AI score xuống dưới 15%:

1. PERPLEXITY INJECTION: Thay 15-20% từ ngữ thông dụng bằng từ đồng nghĩa học thuật ít gặp hơn. Tránh lặp lại cùng 1 cụm từ trong 3 câu liên tiếp.
2. BURSTINESS CONTROL: Đảm bảo có câu ngắn (<15 từ) xen kẽ câu dài (>40 từ). Không để 3 câu liên tiếp có độ dài tương đương.
3. SYNTACTIC VARIATION: Thay đổi chủ ngữ đa dạng ("Tôi" → "Việc..." → "Quá trình..."). Dùng câu bị động 20-30%.
4. LEXICAL SUBSTITUTION: Không lặp danh từ chính trong 2 câu liên tiếp. Chuẩn bị 3-4 từ đồng nghĩa cho khái niệm chính.
5. SENTENCE COMPLEXITY: Xen kẽ câu đơn (20%), câu ghép (30%), câu phức (50%). Không 3 câu cùng loại liên tiếp.
6. TRANSITION VARIATION: Không dùng cùng 1 liên từ quá 2 lần. "tuy nhiên" → "song" → "ngược lại" → "trái lại".
7. INFORMATION DENSITY: 30% câu nhiều thông tin (số liệu), 40% trung bình, 30% ít thông tin (kết luận ngắn).
8. PASSIVE VOICE: Dùng bị động 20-25% ở phần Phương pháp. Giữ chủ động ở suy nghĩ cá nhân.
9. NOMINALIZATION: 60% danh từ hóa, 40% động từ. Không 3 câu liên tiếp toàn danh từ hóa.
10. MICRO-VARIATION: Thêm ngoặc đơn chú thích, dấu hai chấm, trình bày số liệu đa dạng (%, phân số, tỷ lệ).

⚠️ QUAN TRỌNG: Sửa TẤT CẢ các đoạn có dấu hiệu AI, KHÔNG CHỈ đoạn đạo văn. Mục tiêu: AI score < 15%.`
    : '';

  const prompt = `
Sửa SKKN theo danh sách lỗi. GIỮ NGUYÊN định dạng gốc (bold, italic, bảng, công thức).

🚫 QUY TẮC TUYỆT ĐỐI - KHÔNG ĐƯỢC THAY ĐỔI THÔNG TIN CÁ NHÂN:
- TUYỆT ĐỐI GIỮ NGUYÊN 100% các thông tin sau, KHÔNG ĐƯỢC sửa, thay đổi hay "cập nhật":
  + Năm học (vd: 2025-2026, 2024-2025... giữ ĐÚNG như bản gốc)
  + Tên tác giả, họ tên
  + Đơn vị công tác (tên trường, phòng, sở)
  + Chức vụ, chức danh
  + Địa chỉ, địa danh, tên xã/huyện/tỉnh/thành phố
  + Tên tổ chuyên môn
  + Số điện thoại, email
  + Mã số, mã định danh
  + Các mốc thời gian cụ thể (ngày, tháng, năm)
- Đây là thông tin thực tế của tác giả, AI KHÔNG CÓ QUYỀN thay đổi.

⚠️ QUY TẮC VĂN PHONG VÀ TRÁNH ĐẠO VĂN (BẮT BUỘC):
- Viết theo giọng văn giáo viên thực tế: Dùng số liệu thực tế số lẻ (vd: 31/45 em, tránh số tròn trịa), diễn đạt tự nhiên, xen kẽ quan sát cá nhân và thừa nhận các khó khăn/hạn chế khi thực hiện.
- Trích dẫn: Paraphrase lý thuyết thay vì trích nguyên văn, luôn gắn kết lý thuyết với ngữ cảnh địa phương/lớp học.
- Đa dạng cấu trúc câu: Thay đổi độ dài câu, xen kẽ liên từ đa dạng, sử dụng trạng từ và cấu trúc chủ bị động linh hoạt.
- KHÔNG thay đổi hoặc bắt lỗi sai đối với các từ viết tắt hợp lệ được dùng phổ biến: KHBG, ĐGTX, NCBH, HSG, CSDL, KTTX, THPT, GDĐT, UBND, HĐND, BGD, SỞ, PHÒNG, THCS, TP, VN, SGK, GV, HS, BGH, CMHS, CNTT, SKKN, PPCT, KHGD, KHDH, NQ, TW, BGDĐT, ĐSVN, COVID, WHO, UNESCO, ASEAN.

⚠️ QUY TẮC KIỂM SOÁT ĐỊNH DẠNG:
- fixedContent PHẢI chứa TOÀN BỘ nội dung gốc (đã sửa lỗi), KHÔNG ĐƯỢC bỏ bớt hay lược bỏ bất kỳ đoạn nào.
- Chỉ thay đổi những chỗ có lỗi, phần còn lại giữ nguyên 100%.
- Bọc mỗi chỗ đã sửa trong thẻ <red>...</red>.
- TUYỆT ĐỐI KHÔNG dùng Markdown formatting: KHÔNG dùng **, *, #, ##, - , bullet points. Chỉ dùng text thuần và thẻ <red>.</red>.

## LỖI CẦN SỬA:

### Chính tả (${limitedSpellingErrors.length} lỗi):
${limitedSpellingErrors.map((e, i) => `${i + 1}. "${e.error}" → "${e.correction}"`).join('\n')}

### Đoạn đạo văn (${limitedPlagiarismSegments.length} đoạn):
${limitedPlagiarismSegments.map((p, i) => `${i + 1}. "${p.segment.substring(0, 80)}..." → ${p.advice}`).join('\n')}
${aiRiskInfo}

## NỘI DUNG GỐC:
${truncatedContent}

## OUTPUT JSON:
{
  "fixedContent": "TOÀN BỘ nội dung đã sửa (giữ nguyên phần không lỗi), bọc chỗ sửa trong <red>...</red>",
  "summary": {"spellingFixed": N, "plagiarismRewritten": N, "structureImproved": N, "vocabularyEnhanced": N, "aiRiskReduced": N},
  "changes": [{"type": "spelling|plagiarism|structure|vocabulary|ai_detection", "original": "gốc", "fixed": "sửa", "reason": "lý do"}]
}
Chỉ liệt kê tối đa 10 changes quan trọng nhất.${hasAIRisk ? ' Ưu tiên liệt kê các thay đổi loại ai_detection.' : ''}
`;

  const { result: parsed } = await callWithFallback<AutoFixResult>(
    'AutoFix',
    prompt,
    { responseMimeType: 'application/json', temperature: 0.2 },
    (text) => JSON.parse(text) as AutoFixResult,
  );
  // Bảo vệ năm học: khôi phục nếu AI tự ý thay đổi
  parsed.fixedContent = preserveSchoolYears(originalContent, parsed.fixedContent);
  return parsed;
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
  const modelsToTry = getModelsToTry();

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

  const { result } = await callWithFallback<TitleAnalysisResult>(
    'TitleAnalysis',
    prompt,
    { responseMimeType: 'application/json', temperature: 0.3 },
    (text) => JSON.parse(text) as TitleAnalysisResult,
  );
  return result;
};

// ========== IMPROVEMENT ANALYSIS ==========

/**
 * Phân tích SKKN để đề xuất cải thiện
 * Đánh giá theo 9 tiêu chí, phát hiện vấn đề, đề xuất lộ trình
 */
export const analyzeForImprovement = async (
  content: string,
  metadata?: { title?: string; subject?: string; level?: string }
): Promise<ImprovementAnalysisResult> => {
  const modelsToTry = getModelsToTry();

  const truncatedContent = content.length > 50000 ? content.substring(0, 50000) : content;

  const prompt = `
Bạn là chuyên gia thẩm định và tư vấn cải thiện SKKN (Sáng kiến kinh nghiệm) với 20 năm kinh nghiệm.

THÔNG TIN SKKN:
${metadata?.title ? `- Tên đề tài: ${metadata.title}` : ''}
${metadata?.subject ? `- Môn học: ${metadata.subject}` : ''}
${metadata?.level ? `- Cấp học: ${metadata.level}` : ''}

NỘI DUNG SKKN:
${truncatedContent}

## NHIỆM VỤ:
Đánh giá SKKN theo 9 tiêu chí dưới đây (mỗi tiêu chí tối đa 10 điểm, tổng 90 điểm):

1. C01 - Cấu trúc: Tính đầy đủ, logic và mạch lạc
2. C02 - Cơ sở lý luận: Lý thuyết giáo dục, trích dẫn nghiên cứu
3. C03 - Số liệu minh chứng: Chất lượng, tính thuyết phục
4. C04 - Tính khả thi: Khả năng áp dụng thực tế
5. C05 - Tính thực tiễn: Giải quyết vấn đề thực tế
6. C06 - Tính mới: Sáng tạo, khác biệt
7. C07 - Khả năng nhân rộng: Áp dụng rộng rãi
8. C08 - Ngôn ngữ: Diễn đạt, ngôn ngữ khoa học
9. C09 - Hình thức: Trình bày, lỗi chính tả

Sau khi đánh giá, phát hiện các vấn đề cần cải thiện và đề xuất giải pháp cụ thể.

## OUTPUT JSON:
{
  "totalScore": <tổng điểm trên thang 90>,
  "maxScore": 90,
  "rating": "<Xuất sắc|Tốt|Khá|Trung bình|Yếu>",
  "colorCode": "<mã màu hex>",
  "criteria": [
    {
      "criteriaId": "C01",
      "criteriaName": "Cấu trúc",
      "score": <0-10>,
      "maxScore": 10,
      "status": "<excellent|good|average|weak|critical>",
      "feedback": "Nhận xét chi tiết"
    }
  ],
  "detectedIssues": [
    {
      "issueId": "I001",
      "issueCode": "WEAK_THEORY_BASE",
      "issueName": "Cơ sở lý luận yếu",
      "criteriaId": "C02",
      "severity": "<critical|high|medium|low>",
      "priority": <1-4>,
      "description": "Mô tả chi tiết vấn đề",
      "solutions": [
        {
          "solutionId": "S001",
          "solutionType": "<rewrite|add|fix|enhance>",
          "actionType": "replace_section",
          "targetSection": "Cơ sở lý luận",
          "exampleContent": "Nội dung mẫu gợi ý (100-300 từ)",
          "estimatedTime": "2-3 giờ",
          "difficulty": "<low|medium|high>",
          "impactScore": <1-10>
        }
      ]
    }
  ],
  "roadmap": {
    "urgent": [{"issue": {<issue object>}, "estimatedTime": "X giờ", "impact": <1-10>}],
    "high": [...],
    "medium": [...],
    "low": [...]
  },
  "estimatedScoreAfterFix": <điểm dự kiến sau khi sửa>,
  "recommendation": "Khuyến nghị tổng quan"
}

⚠️ Phải trả về ĐẦY ĐỦ 9 tiêu chí. Phát hiện TỐI THIỂU 3 vấn đề. Mỗi vấn đề phải có ít nhất 1 giải pháp với nội dung mẫu CỤ THỂ.
`;

  const { result } = await callWithFallback<ImprovementAnalysisResult>(
    'Improvement',
    prompt,
    { responseMimeType: 'application/json', temperature: 0.3 },
    (text) => JSON.parse(text) as ImprovementAnalysisResult,
  );
  return result;
};

/**
 * Sinh nội dung sửa chữa SKKN dựa trên các vấn đề đã chọn
 * Trả về danh sách changes để inject vào file .docx gốc
 */
export const generateImprovementContent = async (
  originalContent: string,
  selectedIssues: DetectedIssue[],
  metadata?: { title?: string; subject?: string }
): Promise<AutoImprovementFixResult> => {
  const modelsToTry = getModelsToTry();

  const truncatedContent = originalContent.length > 50000
    ? originalContent.substring(0, 50000)
    : originalContent;

  const issuesDescription = selectedIssues.map((issue, i) => {
    const solutions = issue.solutions.map(s =>
      `  - ${s.solutionType}: ${s.actionType} tại "${s.targetSection}" (ưu tiên: ${s.impactScore}/10)`
    ).join('\n');
    return `${i + 1}. [${issue.severity.toUpperCase()}] ${issue.issueName} (${issue.issueCode})
   Mô tả: ${issue.description}
   Giải pháp:
${solutions}`;
  }).join('\n\n');

  const prompt = `
Bạn là chuyên gia sửa chữa và nâng cấp SKKN (Sáng kiến kinh nghiệm).

${metadata?.title ? `ĐỀ TÀI: ${metadata.title}` : ''}
${metadata?.subject ? `MÔN HỌC: ${metadata.subject}` : ''}

## CÁC VẤN ĐỀ CẦN SỬA (${selectedIssues.length} vấn đề):
${issuesDescription}

## NỘI DUNG SKKN GỐC:
${truncatedContent}

## NHIỆM VỤ:
Sửa chữa SKKN theo các vấn đề trên. Với mỗi vấn đề:
- Nếu actionType = "replace_section": Tìm đoạn tương ứng trong bản gốc và viết lại hoàn toàn
- Nếu actionType = "insert_section": Viết nội dung mới để chèn vào vị trí phù hợp
- Nếu actionType = "correct_errors": Sửa các lỗi chính tả/ngữ pháp
- Nếu actionType = "add_details": Bổ sung chi tiết vào phần hiện có

🚫 QUY TẮC TUYỆT ĐỐI - KHÔNG ĐƯỢC THAY ĐỔI THÔNG TIN CÁ NHÂN:
- TUYỆT ĐỐI GIỮ NGUYÊN 100% các thông tin sau, KHÔNG ĐƯỢC sửa, thay đổi hay "cập nhật":
  + Năm học (vd: 2025-2026, 2024-2025... giữ ĐÚNG như bản gốc)
  + Tên tác giả, họ tên
  + Đơn vị công tác (tên trường, phòng, sở)
  + Chức vụ, chức danh
  + Địa chỉ, địa danh, tên xã/huyện/tỉnh/thành phố
  + Tên tổ chuyên môn
  + Số điện thoại, email
  + Mã số, mã định danh
  + Các mốc thời gian cụ thể (ngày, tháng, năm)
- Đây là thông tin thực tế của tác giả, AI KHÔNG CÓ QUYỀN thay đổi.

⚠️ QUY TẮC VĂN PHONG "GIÁO VIÊN THỰC TIỄN" VÀ NGHIỆP VỤ:
- Áp dụng các nguyên tắc từ \`improvementDatabase.ts\` và \`loi chinh ta.txt\`. Đảm bảo đáp ứng đầy đủ yêu cầu khoa học (có kết quả định lượng, bằng chứng, hạn chế, điều kiện áp dụng...).
- Giọng văn: Sử dụng giọng điệu cá nhân tự nhiên của giáo viên, dùng số liệu thực tế lẻ (vd 17.8%, 31/45 học sinh), đan xen mô tả khó khăn thực tế, paraphrase lý thuyết cho phù hợp thực tiễn.
- Từ viết tắt chuyên ngành GIỮ NGUYÊN (không thay đổi, không sửa thành chữ thường): KHBG, ĐGTX, NCBH, HSG, CSDL, KTTX, THPT, GDĐT, UBND, HĐND, BGD, SỞ, PHÒNG, THCS, TP, VN, SGK, GV, HS, BGH, CMHS, CNTT, SKKN, PPCT, KHGD, KHDH, NQ, TW, BGDĐT, ĐSVN, COVID, WHO, UNESCO, ASEAN.

⚠️ QUY TẮC KIỂM SOÁT ĐỊNH DẠNG:
1. fixedContent phải chứa TOÀN BỘ nội dung SKKN đã sửa
2. Bọc chỗ đã sửa/thêm mới trong thẻ <red>...</red>
3. Giữ nguyên 100% phần không liên quan đến vấn đề
4. Nội dung mới phải chất lượng: có trích dẫn, lý thuyết, số liệu cụ thể
5. Sử dụng ngôn ngữ khoa học, phù hợp SKKN giáo dục
6. TUYỆT ĐỐI KHÔNG dùng Markdown formatting: KHÔNG dùng **, *, #, ##, - , bullet points. Chỉ dùng text thuần và thẻ <red>...</red>.

## OUTPUT JSON:
{
  "fixedContent": "TOÀN BỘ nội dung đã sửa, bọc chỗ sửa trong <red>...</red>",
  "changes": [
    {
      "issueId": "I001",
      "issueName": "Cơ sở lý luận yếu",
      "actionType": "replace_section",
      "targetSection": "Cơ sở lý luận",
      "original": "Đoạn gốc cần thay thế (50-100 ký tự đầu)",
      "fixed": "Nội dung đã sửa/thêm mới",
      "type": "rewrite"
    }
  ],
  "summary": {
    "sectionsRewritten": <số section viết lại>,
    "sectionsAdded": <số section thêm mới>,
    "errorsFixed": <số lỗi sửa>,
    "totalChanges": <tổng số thay đổi>
  },
  "newEstimatedScore": <điểm dự kiến sau sửa>
}
`;

  const { result: parsed } = await callWithFallback<AutoImprovementFixResult>(
    'ImprovementFix',
    prompt,
    { responseMimeType: 'application/json', temperature: 0.2 },
    (text) => JSON.parse(text) as AutoImprovementFixResult,
  );
  // Bảo vệ năm học: khôi phục nếu AI tự ý thay đổi
  parsed.fixedContent = preserveSchoolYears(originalContent, parsed.fixedContent);
  return parsed;
};

// ========== AI REDUCTION ==========

/**
 * Kiểm tra nhanh AI score trên nội dung - dùng CÙNG tiêu chí với analyzeSKKNWithGemini
 * Dùng để verify kết quả sau humanize, đảm bảo score nhất quán
 */
export const quickAIDetection = async (
  content: string
): Promise<QuickAIDetectionResult> => {
  const modelsToTry = getModelsToTry();

  // Giới hạn nội dung để giảm chi phí API
  const truncated = content.length > 30000 ? content.substring(0, 30000) : content;

  // Dùng CÙNG tiêu chí AI detection từ SYSTEM_INSTRUCTION (dòng 91-116)
  const prompt = `
Bạn là chuyên gia phát hiện văn bản AI. Phân tích nội dung sau và trả về JSON.

## Các chỉ số phân tích (CÙNG tiêu chí với hệ thống phân tích SKKN chính):
1. **Perplexity Score (0-100)**: Đánh giá mức độ "bất ngờ" của từ vựng. Văn bản AI thường có perplexity thấp (20-40). Văn bản người viết: 40-80+.
2. **Burstiness Score (0-100)**: Đánh giá biến động độ dài câu. AI viết câu đều đặn (burstiness thấp). Người viết câu ngắn dài xen kẽ.
3. **Pattern Density (0-100)**: Tỷ lệ các mẫu câu đặc trưng AI: "trong bối cảnh... hiện nay", "tuy nhiên, thực tế cho thấy", "không chỉ... mà còn", "qua đó... học sinh", "do đó... là rất cần thiết".
4. **Overall AI Percent (0-100)**: Phần trăm tổng thể khả năng văn bản do AI tạo.

### Ngưỡng đánh giá:
- **< 15%**: An toàn (Thấp) - Ít khả năng AI, hành văn tự nhiên, có cảm xúc con người.
- **15-35%**: Rủi ro thấp (Trung bình) - Có thể có một số đoạn AI hỗ trợ nhưng đã được biên tập kỹ.
- **35-60%**: Rủi ro cao (Cao) - Nhiều dấu hiệu AI rõ rệt, thiếu sự gắn kết thực tế.
- **> 60%**: Rủi ro nghiêm trọng (Rất cao) - Gần như chắc chắn 100% copy từ AI thô.

### Các mẫu câu đặc trưng AI (Raw AI) cần kiểm tra:
- ChatGPT: "trong bối cảnh... hiện nay", "theo định hướng... chương trình", "việc... là yêu cầu cấp thiết", "tuy nhiên... thực tế cho thấy", "không chỉ... mà còn"
- Gemini: "điều này cho thấy... rằng", "một cách... hiệu quả", "đáng chú ý là", "cần lưu ý rằng"
- Claude: "điều đáng chú ý là", "một điểm đáng xem xét", "có thể tranh luận rằng"

⚠️ LƯU Ý QUAN TRỌNG:
1. KHÔNG đánh đồng "văn bản trơn tru, logic chặt chẽ" với "văn bản AI". Một người giáo viên giỏi hoàn toàn có thể viết ra một SKKN với cấu trúc xuất sắc.
2. Dấu hiệu cốt lõi của "AI thô" là sự vô hồn, thiếu ví dụ thực tiễn sinh động mang tính cá nhân, quá lạm dụng các từ nối.
3. Nếu văn bản có cấu trúc câu đa dạng, từ vựng phong phú nhưng giản dị, đôi khi có cách diễn đạt hơi "đời thường" hoặc lặp từ nhẹ -> ĐÂY LÀ NGƯỜI VIẾT -> Chấm AI Score THẤP.
4. Chỉ cho aiRiskScore > 50% khi bạn thực sự thấy sự máy móc, lặp lại các pattern rập khuôn.

## NỘI DUNG CẦN PHÂN TÍCH:
${truncated}

## OUTPUT JSON (chỉ trả về JSON, không kèm giải thích):
{
  "aiRiskScore": <0-100>,
  "perplexityScore": <0-100>,
  "burstinessScore": <0-100>,
  "patternDensity": <0-100>,
  "overallAIPercent": <0-100>
}
`;

  const { result } = await callWithFallback<QuickAIDetectionResult>(
    'QuickAIDetection',
    prompt,
    { responseMimeType: 'application/json', temperature: 0.1 },
    (text) => JSON.parse(text) as QuickAIDetectionResult,
  );
  return result;
};

/**
 * Giảm độ AI cho SKKN - CÓ SELF-VERIFY
 * Sau khi humanize, tự kiểm tra lại bằng quickAIDetection (cùng tiêu chí với phân tích chính)
 * Nếu score không giảm → tự động retry (tối đa 2 lần)
 * Mục tiêu: AI Score khi check lại PHẢI thấp hơn trước
 */
export const reduceAIContent = async (
  originalContent: string,
  aiRiskDetails: AIRiskDetails,
  aiRiskScore: number,
  intensity: 'light' | 'medium' | 'aggressive' = 'medium',
  onProgress?: (step: string) => void
): Promise<AIReductionResult> => {
  const modelsToTry = getModelsToTry();

  const truncatedContent = originalContent.length > 50000
    ? originalContent.substring(0, 50000)
    : originalContent;

  const intensityConfig = {
    light: { keepPercent: 90, desc: 'Sửa nhẹ - giữ 90% nguyên bản, chỉ sửa các pattern AI rõ ràng nhất', temp: 0.7 },
    medium: { keepPercent: 70, desc: 'Sửa trung bình - viết lại 30% nội dung, đa dạng hóa mạnh', temp: 0.8 },
    aggressive: { keepPercent: 50, desc: 'Sửa mạnh - viết lại 50%+ nội dung, đảm bảo AI score < 15%', temp: 0.9 },
  };

  const MAX_RETRIES = 2;
  let bestResult: AIReductionResult | null = null;
  let bestVerifiedScore = aiRiskScore; // Bắt đầu với score gốc
  let retryCount = 0;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    // Tăng dần intensity khi retry
    let currentIntensity = intensity;
    if (attempt === 1 && intensity === 'light') currentIntensity = 'medium';
    if (attempt === 1 && intensity === 'medium') currentIntensity = 'aggressive';
    if (attempt === 2) currentIntensity = 'aggressive';
    const config = intensityConfig[currentIntensity];

    // Retry hint cho lần thử lại
    const retryHint = attempt > 0 ? `

⚠️ ĐÂY LÀ LẦN THỬ LẠI #${attempt + 1}. Lần trước AI score vẫn còn cao (${bestVerifiedScore}%)!
Hãy MẠNH TAY hơn:
- Viết lại NHIỀU câu hơn, KHÔNG giữ lại cấu trúc câu gốc
- TUYỆT ĐỐI loại bỏ MỌI từ nối AI: "tuy nhiên", "do đó", "qua đó", "không chỉ...mà còn"
- Dùng giọng văn BÌNH DÂN hơn, thêm diễn đạt "đời thường" kiểu giáo viên
- Cố tình để câu hơi dài dòng, lặp ý nhẹ ở một số chỗ (như người thật viết)
- Thay đổi cách mở đầu câu: bỏ hoàn toàn các mẫu "Việc...", "Điều này...", "Có thể thấy..."
- KHÔNG viết quá mượt mà, quá học thuật, quá "hoàn hảo" - đây chính là dấu hiệu AI` : '';

    const prompt = `
Bạn là chuyên gia humanizing văn bản - chuyên biến nội dung do AI tạo thành văn bản giống như GIÁO VIÊN THỰC TẾ viết.

## PHÂN TÍCH AI HIỆN TẠI (từ hệ thống phát hiện AI):
- AI Score tổng: ${aiRiskScore}% (mục tiêu: < 20%)
- Perplexity Score: ${aiRiskDetails.perplexityScore}/100 (${aiRiskDetails.perplexityScore < 40 ? 'THẤP - từ vựng dễ đoán, đặc trưng AI' : 'OK'})
- Burstiness Score: ${aiRiskDetails.burstinessScore}/100 (${aiRiskDetails.burstinessScore < 40 ? 'THẤP - câu đều đặn, đặc trưng AI' : 'OK'})
- Pattern Density: ${aiRiskDetails.patternDensity}/100 (${aiRiskDetails.patternDensity > 30 ? 'CAO - nhiều mẫu câu AI' : 'OK'})
- Overall AI Percent: ${aiRiskDetails.overallAIPercent}%

### Các mẫu câu AI phát hiện được:
${(aiRiskDetails.suspiciousPatterns || []).map((p, i) => `${i + 1}. "${p}"`).join('\n')}

## CHẾ ĐỘ XỬ LÝ: ${currentIntensity.toUpperCase()} - ${config.desc}
${retryHint}

## 5 KỸ THUẬT HUMANIZING (áp dụng TẤT CẢ):

### KT1: SENTENCE RESTRUCTURING (Tái cấu trúc câu)
- Tách câu dài (>30 từ) thành 2 câu ngắn tại điểm ngắt tự nhiên.
- Ghép 2 câu ngắn (<15 từ) liên tiếp thành 1 câu dài bằng liên từ đa dạng.
- QUAN TRỌNG: Cố tình để lại một vài câu hơi dài hoặc lặp cấu trúc một cách tự nhiên (đặc trưng của giáo viên viết SKKN). Không cần chia tỉ lệ độ dài câu hoàn hảo. Mọi thứ phải ngẫu nhiên.
- Mục tiêu: Tạo Burstiness cao (độ đột biến về chiều dài câu lớn).

### KT2: LEXICAL DIVERSIFICATION (Đa dạng hóa từ vựng)
- Thay thế từ lặp lại trong 2 câu liên tiếp bằng từ đồng nghĩa:
  + "giúp" → "tạo điều kiện", "hỗ trợ", "đóng góp vào"
  + "phương pháp" → "biện pháp", "cách thức", "phương thức"
  + "học sinh" → "người học", "học viên", "đối tượng nghiên cứu"
  + "cho thấy" → "chứng tỏ", "minh chứng", "thể hiện"
  + "nâng cao" → "cải thiện", "tối ưu hóa", "tăng cường"
  + "hiệu quả" → "tính hiệu dụng", "kết quả khả quan", "tác động tích cực"
- Không lặp cùng 1 danh từ chính trong 2 câu liên tiếp
- Ưu tiên thay thế bằng từ có độ dài KHÁC với từ gốc (tăng perplexity)

### KT3: SYNTACTIC VARIATION (Biến đổi cú pháp)
- Chuyển 20-25% câu sang bị động: "Tôi tiến hành khảo sát" → "Khảo sát được tiến hành"
- Đảo ngữ 10% câu: "Kết quả rất khả quan" → "Khả quan là kết quả đạt được"
- Thay đổi chủ ngữ: "Tôi" → "Việc..." → "Quá trình..." → "Thực tế cho thấy..."
- Xen kẽ liên từ: KHÔNG dùng cùng 1 liên từ quá 2 lần ("tuy nhiên" → "song" → "trái lại")

### KT4: INFORMATION DENSITY ADJUSTMENT (Mật độ thông tin)
- 30% câu nhiều info (số liệu cụ thể, chi tiết)
- 40% câu trung bình (phân tích, mô tả)
- 30% câu ít info (nhận xét ngắn, kết luận)
- Thêm ngoặc đơn chú thích cho từ viết tắt lần đầu
- Đa dạng cách trình bày số: "73.3%" → "73,3% (33/45 em)"

### KT5: MICRO-VARIATION INJECTION & NHIỄU CÓ CHỦ Ý
- Thêm dấu hai chấm trước danh sách.
- Thêm trạng ngữ đầu câu đa dạng nhưng bình dân: "Thực tế cho thấy,", "Có thể thấy,", "Qua quá trình giảng dạy,"
- LỖI CÓ KIỂM SOÁT (5-8%): Tạo diễn đạt hơi lặp từ, dùng từ ngữ rất "đời thường", giản dị. Hãy viết như một giáo viên bình thường - KHÔNG QUÁ MƯỢT MÀ, KHÔNG QUÁ HỌC THUẬT.
- TUYỆT ĐỐI KHÔNG viết "hoàn hảo" - văn bản quá hoàn hảo CHÍNH LÀ dấu hiệu AI lớn nhất.
- Xen kẽ câu đơn, ghép, phức một cách ngẫu nhiên. Bỏ tư duy đối xứng.
- KHÔNG thay đổi các từ viết tắt chuyên ngành: KHBG, ĐGTX, NCBH, HSG, CSDL, KTTX, THPT, GDĐT, UBND, HĐND, BGD, SỞ, PHÒNG, THCS, TP, VN, SGK, GV, HS, BGH, CMHS, CNTT, SKKN, PPCT, KHGD, KHDH, NQ, TW, BGDĐT, ĐSVN, COVID, WHO, UNESCO, ASEAN.

🚫 QUY TẮC TUYỆT ĐỐI - KHÔNG ĐƯỢC THAY ĐỔI THÔNG TIN CÁ NHÂN:
- GIỮ NGUYÊN 100%: Năm học, Tên tác giả, Đơn vị công tác, Chức vụ, Địa chỉ, Tổ chuyên môn, Mốc thời gian.

## QUY TẮC BẮT BUỘC:
1. fixedContent phải chứa TOÀN BỘ nội dung SKKN (không bỏ sót)
2. Bọc phần đã sửa trong thẻ <red>...</red>
3. GIỮ NGUYÊN 100%: số liệu, kết quả nghiên cứu, tên riêng, tiêu đề
4. GIỮ NGUYÊN ý nghĩa khoa học - chỉ thay đổi CÁCH DIỄN ĐẠT
5. TUYỆT ĐỐI KHÔNG dùng Markdown (**, *, #, ##). Chỉ text thuần + <red>
6. XÓA TẤT CẢ các mẫu câu AI đã phát hiện ở trên
7. Mục tiêu AI Score sau sửa: < 20%

## NỘI DUNG GỐC:
${truncatedContent}

## OUTPUT JSON:
{
  "fixedContent": "TOÀN BỘ nội dung đã humanize, bọc chỗ sửa trong <red>...</red>",
  "changes": [
    {
      "technique": "sentence_restructure|lexical_diversify|syntactic_variation|density_adjust|micro_variation",
      "techniqueName": "Tên kỹ thuật tiếng Việt",
      "original": "Đoạn gốc (50-80 ký tự)",
      "fixed": "Đoạn đã sửa",
      "reason": "Lý do sửa"
    }
  ],
  "stats": {
    "sentencesRestructured": <số câu đã tái cấu trúc>,
    "wordsReplaced": <số từ đã thay thế>,
    "patternsRemoved": <số pattern AI đã xóa>,
    "syntacticChanges": <số biến đổi cú pháp>,
    "microVariations": <số vi biến đổi>
  },
  "beforeMetrics": {
    "aiScore": ${aiRiskScore},
    "perplexity": ${aiRiskDetails.perplexityScore},
    "burstiness": ${aiRiskDetails.burstinessScore},
    "patternDensity": ${aiRiskDetails.patternDensity}
  },
  "afterMetrics": {
    "estimatedAIScore": <dự kiến AI score sau sửa, mục tiêu < 20>,
    "estimatedPerplexity": <dự kiến perplexity sau sửa, mục tiêu > 50>,
    "estimatedBurstiness": <dự kiến burstiness sau sửa, mục tiêu > 50>,
    "estimatedPatternDensity": <dự kiến pattern density sau sửa, mục tiêu < 15>
  }
}

Chỉ liệt kê tối đa 15 changes quan trọng nhất, đại diện cho 5 kỹ thuật.
`;

    // === Bước 1: Humanize ===
    if (onProgress) onProgress(attempt > 0 ? `Đang thử lại lần ${attempt + 1}...` : 'Đang humanize nội dung...');
    const humanizeResult = await _callGeminiForJSON<AIReductionResult>(prompt, modelsToTry, config.temp);
    humanizeResult.fixedContent = preserveSchoolYears(originalContent, humanizeResult.fixedContent);

    // === Bước 2: Self-verify bằng quickAIDetection ===
    if (onProgress) onProgress('Đang kiểm tra lại AI score...');
    try {
      // Strip <red> tags trước khi verify
      const cleanContent = humanizeResult.fixedContent.replace(/<red>/g, '').replace(/<\/red>/g, '');
      const verification = await quickAIDetection(cleanContent);
      const verifiedScore = verification.aiRiskScore;

      console.log(`[AIReduction] Attempt ${attempt + 1}: Before=${aiRiskScore}% → Verified=${verifiedScore}% (Estimated=${humanizeResult.afterMetrics.estimatedAIScore}%)`);

      // Cập nhật afterMetrics bằng score đã verify
      humanizeResult.afterMetrics = {
        estimatedAIScore: verifiedScore,
        estimatedPerplexity: verification.perplexityScore,
        estimatedBurstiness: verification.burstinessScore,
        estimatedPatternDensity: verification.patternDensity,
        verified: true,
      };

      // Lưu kết quả tốt nhất
      if (verifiedScore < bestVerifiedScore || bestResult === null) {
        bestVerifiedScore = verifiedScore;
        bestResult = humanizeResult;
        bestResult.retryCount = attempt;
      }

      // Nếu score đã giảm đáng kể → thành công, dừng retry
      if (verifiedScore < aiRiskScore) {
        console.log(`[AIReduction] ✅ Score giảm: ${aiRiskScore}% → ${verifiedScore}%. Dừng retry.`);
        bestResult.retryCount = attempt;
        return bestResult;
      }

      // Nếu score tăng hoặc không giảm → retry
      console.log(`[AIReduction] ⚠️ Score chưa giảm (${verifiedScore}% >= ${aiRiskScore}%). Retry ${attempt + 1}/${MAX_RETRIES}...`);
      retryCount = attempt + 1;

    } catch (verifyError: any) {
      // Nếu verify thất bại, vẫn return kết quả nhưng đánh dấu chưa verified
      console.warn(`[AIReduction] Verify thất bại:`, verifyError.message);
      humanizeResult.afterMetrics.verified = false;
      if (!bestResult) {
        bestResult = humanizeResult;
        bestResult.retryCount = attempt;
      }
      // Không retry nếu verify fail - giữ kết quả hiện tại
      break;
    }
  }

  // Trả về kết quả tốt nhất sau N lần retry
  if (bestResult) {
    bestResult.retryCount = retryCount;
    if (bestVerifiedScore >= aiRiskScore) {
      bestResult.verificationWarning = `Sau ${retryCount + 1} lần tối ưu, AI score (${bestVerifiedScore}%) chưa giảm đáng kể so với trước (${aiRiskScore}%). Nội dung này có thể có đặc điểm khiến hệ thống AI detection nhận diện cao. Bạn có thể thử lại với chế độ "Mạnh" hoặc chỉnh sửa thủ công.`;
    }
    return bestResult;
  }

  throw new Error("Không thể giảm AI. Vui lòng thử lại sau.");
};

/**
 * Helper: Gọi Gemini API trả về JSON (dùng callWithFallback)
 */
const _callGeminiForJSON = async <T>(
  prompt: string,
  _modelsToTry: string[],
  temperature: number = 0.8
): Promise<T> => {
  const { result } = await callWithFallback<T>(
    'GeminiJSON',
    prompt,
    { responseMimeType: 'application/json', temperature },
    (text) => JSON.parse(text) as T,
  );
  return result;
};

