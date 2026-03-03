/**
 * Text Normalizer Service with AI-Powered Context-Aware Spell Checker
 * Chuẩn hóa văn bản tiếng Việt + Sửa lỗi chính tả thông minh dựa vào ngữ cảnh SKKN
 * Tham khảo từ: loi chinh ta.txt và chinhvanban-main/services/textProcessor.ts
 */

import { GoogleGenAI } from "@google/genai";
import { getSelectedModel } from './apiKeyService';

// Fallback models theo thứ tự ưu tiên
const FALLBACK_MODELS = [
    'gemini-2.0-flash',
    'gemini-2.5-flash-preview-05-20',
    'gemini-2.5-flash-lite'
];

// ==================== TYPES ====================

export interface SKKNContext {
    title: string;           // Tên đề tài SKKN
    subject: string;         // Môn học (Toán, Văn, Hóa...)
    grade: string;           // Cấp học (THCS, THPT...)
    keywords: string[];      // Từ khóa chính
    fullText: string;        // Toàn bộ nội dung (để AI phân tích)
}

export interface CorrectionDecision {
    original: string;        // Từ gốc
    corrected: string;       // Từ đã sửa (hoặc giữ nguyên)
    shouldCorrect: boolean;  // Có nên sửa không?
    reason: string;          // Lý do (tên riêng, thuật ngữ, lỗi thật...)
}

// ==================== WHITELIST ====================

// Danh sách từ viết tắt cần giữ nguyên
export const WHITELIST_ACRONYMS = new Set([
    'KHBG', 'ĐGTX', 'NCBH', 'HSG', 'CSDL', 'KTTX', 'THPT',
    'GDĐT', 'UBND', 'HĐND', 'BGD', 'SỞ', 'PHÒNG', 'THCS', 'TP', 'VN', 'SGK',
    'GV', 'HS', 'BGH', 'CMHS', 'CNTT', 'SKKN', 'PPCT', 'KHGD', 'KHDH',
    'NQ', 'TW', 'BGDĐT', 'ĐSVN', 'COVID', 'WHO', 'UNESCO', 'ASEAN',
    'STEM', 'ICT', 'GDPT', 'PPDH', 'KTĐG', 'ĐHQG', 'HN', 'HCM'
]);

const ROMAN_NUMERALS = /^(I|II|III|IV|V|VI|VII|VIII|IX|X|XI|XII|XIII|XIV|XV|XVI|XVII|XVIII|XIX|XX)$/;

// Regex phát hiện các bullet points
const BULLET_DASH_GROUP = /^[•●⚫◆▪■▸►]\s*/;
const BULLET_PLUS_GROUP = /^[○◦]\s*/;

// Regex phát hiện marker đầu dòng
const MARKER_REGEX = /^([-+*•]|\+\)|\d+[.)]|[a-zA-Z][.)]|[IVXLCDM]+[.)])$/;

const isMarker = (word: string) => MARKER_REGEX.test(word);
const hasEndPunctuation = (word: string) => /[.!?]$/.test(word);

// ==================== CONTEXT EXTRACTION ====================

/**
 * Trích xuất ngữ cảnh từ toàn bộ SKKN
 */
export const extractSKKNContext = (fullText: string): SKKNContext => {
    const lines = fullText.split('\n').map(l => l.trim()).filter(Boolean);

    let title = 'Không xác định';
    let subject = 'Chung';
    let grade = 'THCS';
    const keywords: string[] = [];

    // Tìm tên đề tài
    for (let i = 0; i < Math.min(10, lines.length); i++) {
        const line = lines[i];
        if (line.length > 10 && line.length < 200) {
            if (/^(TÊN ĐỀ TÀI|ĐỀ TÀI|SKKN)/i.test(line)) {
                title = lines[i + 1] || line;
                break;
            }
            if (i === 0 && line.length > 20) {
                title = line;
            }
        }
    }

    // Phát hiện môn học
    const subjectPatterns = [
        { pattern: /toán\s*học|môn\s*toán|giải\s*toán/i, name: 'Toán' },
        { pattern: /ngữ\s*văn|văn\s*học|môn\s*văn/i, name: 'Văn' },
        { pattern: /hóa\s*học|môn\s*hóa/i, name: 'Hóa' },
        { pattern: /vật\s*lý|môn\s*lý/i, name: 'Lý' },
        { pattern: /sinh\s*học|môn\s*sinh/i, name: 'Sinh' },
        { pattern: /lịch\s*sử|môn\s*sử/i, name: 'Sử' },
        { pattern: /địa\s*lý|môn\s*địa/i, name: 'Địa' },
        { pattern: /tiếng\s*anh|english/i, name: 'Tiếng Anh' },
        { pattern: /giáo\s*dục\s*công\s*dân|gdcd/i, name: 'GDCD' },
        { pattern: /tin\s*học|công\s*nghệ\s*thông\s*tin/i, name: 'Tin học' }
    ];

    for (const { pattern, name } of subjectPatterns) {
        if (pattern.test(fullText)) {
            subject = name;
            break;
        }
    }

    // Phát hiện cấp học
    if (/THPT|trung\s*học\s*phổ\s*thông|lớp\s*(10|11|12)/i.test(fullText)) {
        grade = 'THPT';
    } else if (/THCS|trung\s*học\s*cơ\s*sở|lớp\s*[6-9]/i.test(fullText)) {
        grade = 'THCS';
    } else if (/tiểu\s*học|lớp\s*[1-5]/i.test(fullText)) {
        grade = 'Tiểu học';
    }

    // Trích xuất từ khóa (các từ viết hoa xuất hiện nhiều lần)
    const wordFreq = new Map<string, number>();
    const words = fullText.match(/\b[A-ZÀ-Ỹ][a-zà-ỹ]{2,}\b/g) || [];

    words.forEach(word => {
        if (word.length > 3 && !WHITELIST_ACRONYMS.has(word.toUpperCase())) {
            wordFreq.set(word, (wordFreq.get(word) || 0) + 1);
        }
    });

    // Lấy top 10 từ xuất hiện nhiều nhất
    const sortedWords = Array.from(wordFreq.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([word]) => word);

    keywords.push(...sortedWords);

    return {
        title,
        subject,
        grade,
        keywords,
        fullText: fullText.substring(0, 3000) // Giới hạn 3000 ký tự cho AI
    };
};

// ==================== LOCAL NORMALIZATION ====================

/**
 * Xử lý một dòng văn bản (local, không cần AI)
 */
const processLine = (line: string): string => {
    if (!line.trim()) return line;

    // Giữ lại khoảng trắng đầu dòng (indentation)
    const indentMatch = line.match(/^(\s+)/);
    const indent = indentMatch ? indentMatch[1] : '';
    let content = line.trim();

    // 1. Chuẩn hóa bullet points
    if (BULLET_DASH_GROUP.test(content)) {
        content = content.replace(BULLET_DASH_GROUP, '- ');
    } else if (BULLET_PLUS_GROUP.test(content)) {
        content = content.replace(BULLET_PLUS_GROUP, '+ ');
    }

    // Nếu dòng là tiêu đề (VIẾT HOA TOÀN BỘ) thì giữ nguyên
    const upperCount = content.replace(/[^A-ZÀ-Ỹ]/g, '').length;
    const totalCount = content.replace(/[^a-zA-ZÀ-ỹ]/g, '').length;

    if (totalCount > 0 && (upperCount / totalCount) > 0.9 && content.length > 5) {
        return indent + content;
    }

    // 2. Sửa lỗi viết hoa cơ bản
    const words = content.split(/\s+/);
    const correctedWords: string[] = [];

    for (let i = 0; i < words.length; i++) {
        const word = words[i];

        // Tách từ và dấu câu
        const punctuationMatch = word.match(/^([^\wÀ-ỹ]*)([\wÀ-ỹ]+)([^\wÀ-ỹ]*)$/);

        if (!punctuationMatch) {
            correctedWords.push(word);
            continue;
        }

        const [, prePunct, coreWord, postPunct] = punctuationMatch;
        let fixedCoreWord = coreWord;

        // Xác định xem từ hiện tại có phải là bắt đầu câu/ý không
        let isStartOfSentence = false;
        if (i === 0) {
            isStartOfSentence = true;
        } else {
            const prevWordRaw = words[i - 1];
            if (hasEndPunctuation(prevWordRaw) || isMarker(prevWordRaw)) {
                isStartOfSentence = true;
            }
        }

        // Logic kiểm tra whitelist và số La Mã
        const isWhitelisted = WHITELIST_ACRONYMS.has(coreWord.toUpperCase()) && coreWord === coreWord.toUpperCase();
        const isRoman = ROMAN_NUMERALS.test(coreWord.toUpperCase());

        if (isWhitelisted || isRoman) {
            correctedWords.push(word);
            continue;
        }

        // --- LOGIC SỬA LỖI VIẾT HOA ---

        // 2.1 Lỗi "KHông", "KHối" (Mixed Case: 2+ chữ đầu hoa, sau thường) -> Về lowercase
        if (/^[A-ZÀ-Ỹ]{2,}[a-zà-ỹ]+$/.test(coreWord)) {
            fixedCoreWord = coreWord.toLowerCase();
        }
        // 2.2 Lỗi VIẾT HOA TOÀN BỘ không phải từ viết tắt -> Về lowercase
        else if (/^[A-ZÀ-Ỹ]{2,}$/.test(coreWord)) {
            fixedCoreWord = coreWord.toLowerCase();
        }
        // 2.3 Từ viết hoa chữ cái đầu (Title Case) giữa câu
        else if (/^[A-ZÀ-Ỹ][a-zà-ỹ]+$/.test(coreWord)) {
            if (!isStartOfSentence) {
                // Heuristic xác định tên riêng
                let isLikelyName = false;

                // Check từ tiếp theo có viết hoa không (Lookahead)
                if (i < words.length - 1) {
                    const nextWordRaw = words[i + 1];
                    if (!postPunct.includes('.') && !postPunct.includes('!') && !postPunct.includes('?')) {
                        const nextMatch = nextWordRaw.match(/[\wÀ-ỹ]+/);
                        if (nextMatch && /^[A-ZÀ-Ỹ]/.test(nextMatch[0])) {
                            isLikelyName = true;
                        }
                    }
                }

                // Check từ trước đó có viết hoa không (Lookbehind)
                if (i > 0) {
                    const prevWordRaw = words[i - 1];
                    let prevWasStart = false;
                    if (i === 1) prevWasStart = true;
                    else {
                        const prevPrevRaw = words[i - 2];
                        if (hasEndPunctuation(prevPrevRaw) || isMarker(prevPrevRaw)) prevWasStart = true;
                    }

                    if (!prevWasStart) {
                        const prevMatch = prevWordRaw.match(/[\wÀ-ỹ]+/);
                        if (prevMatch && /^[A-ZÀ-Ỹ]/.test(prevMatch[0])) {
                            isLikelyName = true;
                        }
                    }
                }

                if (!isLikelyName) {
                    fixedCoreWord = coreWord.toLowerCase();
                }
            }
        }

        // --- BẮT BUỘC VIẾT HOA ĐẦU CÂU ---
        if (isStartOfSentence && fixedCoreWord.length > 0) {
            fixedCoreWord = fixedCoreWord.charAt(0).toUpperCase() + fixedCoreWord.slice(1);
        }

        correctedWords.push(prePunct + fixedCoreWord + postPunct);
    }

    return indent + correctedWords.join(' ');
};

/**
 * Chuẩn hóa văn bản tiếng Việt (local, không cần AI)
 */
export const normalizeVietnameseText = (text: string): string => {
    if (!text) return '';
    const lines = text.split('\n');
    const processedLines = lines.map(processLine);
    return processedLines.join('\n');
};

// ==================== AI-POWERED CORRECTION ====================

/**
 * Gọi AI để phân tích và quyết định sửa lỗi (với ngữ cảnh SKKN)
 */
export const getAICorrectionDecisions = async (
    words: string[],
    context: SKKNContext,
    apiKey: string
): Promise<CorrectionDecision[]> => {

    const ai = new GoogleGenAI({ apiKey });

    const prompt = `Bạn là chuyên gia sửa lỗi chính tả tiếng Việt cho văn bản Sáng kiến Kinh nghiệm (SKKN) giáo dục.

**THÔNG TIN NGỮ CẢNH SKKN:**
- Tên đề tài: ${context.title}
- Môn học: ${context.subject}
- Cấp học: ${context.grade}
- Từ khóa chính: ${context.keywords.join(', ')}

**ĐOẠN VĂN MẪU (để hiểu ngữ cảnh):**
${context.fullText.substring(0, 500)}...

**NHIỆM VỤ:**
Phân tích danh sách các từ dưới đây và quyết định xem có nên sửa lỗi viết hoa hay không.

**CÁC TỪ CẦN PHÂN TÍCH:**
${words.map((w, i) => `${i + 1}. "${w}"`).join('\n')}

**QUY TẮC QUYẾT ĐỊNH:**
1. **GIỮ NGUYÊN** nếu là:
   - Tên riêng của người, địa danh (VD: "Nguyễn Văn A", "Hà Nội")
   - Thuật ngữ chuyên ngành của môn học (VD: "Pitago", "Newton", "Mendeleev")
   - Tên phương pháp giảng dạy (VD: "Jigsaw", "Montessori")
   - Từ viết hoa hợp lý trong ngữ cảnh

2. **SỬA THÀNH CHỮ THƯỜNG** nếu là:
   - Lỗi đánh máy (VD: "KHông" → "không", "NHững" → "những")
   - Từ thường bị viết hoa nhầm (VD: "Các" → "các", "Những" → "những")
   - Không phải tên riêng hay thuật ngữ

**ĐỊNH DẠNG ĐẦU RA (JSON):**
Trả về mảng JSON, mỗi phần tử có cấu trúc:
{
  "original": "từ gốc",
  "corrected": "từ đã sửa (hoặc giữ nguyên)",
  "shouldCorrect": true/false,
  "reason": "lý do ngắn gọn"
}

**CHỈ TRẢ VỀ JSON, KHÔNG GIẢI THÍCH THÊM.**`;

    try {
        const selectedModel = getSelectedModel();
        const modelsToTry = [selectedModel, ...FALLBACK_MODELS.filter(m => m !== selectedModel)];
        let lastError: Error | null = null;

        for (const model of modelsToTry) {
            try {
                console.log(`[TextNormalizer] Đang thử model: ${model}`);
                const response = await ai.models.generateContent({
                    model,
                    contents: prompt
                });

                const responseText = response.text || '';

                // Parse JSON từ response
                const jsonMatch = responseText.match(/\[[\s\S]*\]/);
                if (!jsonMatch) {
                    throw new Error('AI không trả về JSON hợp lệ');
                }

                const decisions: CorrectionDecision[] = JSON.parse(jsonMatch[0]);
                return decisions;
            } catch (error: any) {
                console.warn(`[TextNormalizer] Model ${model} thất bại:`, error.message);
                lastError = error;
                // Tiếp tục thử model khác
            }
        }

        throw lastError || new Error('Tất cả các model đều thất bại');
    } catch (error) {
        console.error('❌ Lỗi khi gọi AI:', error);

        // Fallback: giữ nguyên tất cả
        return words.map(word => ({
            original: word,
            corrected: word,
            shouldCorrect: false,
            reason: 'AI error - giữ nguyên an toàn'
        }));
    }
};

/**
 * Sửa lỗi chính tả dựa vào ngữ cảnh SKKN (với AI)
 */
export const correctSpellingWithContext = async (
    text: string,
    context: SKKNContext,
    apiKey: string
): Promise<string> => {

    if (!text.trim()) return text;

    const lines = text.split('\n');
    const correctedLines: string[] = [];
    const allProblematicWords: string[] = [];

    // Bước 1: Thu thập tất cả các từ có vấn đề
    for (const line of lines) {
        const content = line.trim();
        if (!content) continue;

        const words = content.split(/\s+/);

        words.forEach((word, index) => {
            const coreMatch = word.match(/[\wÀ-ỹ]+/);
            if (!coreMatch) return;

            const coreWord = coreMatch[0];

            // Bỏ qua whitelist
            if (WHITELIST_ACRONYMS.has(coreWord.toUpperCase())) return;

            // Phát hiện lỗi viết hoa
            const hasCapitalIssue =
                /^[A-ZÀ-Ỹ]{2,}[a-zà-ỹ]+$/.test(coreWord) ||  // "KHông"
                /^[A-ZÀ-Ỹ]{2,}$/.test(coreWord) ||            // "KHÔNG"
                (/^[A-ZÀ-Ỹ][a-zà-ỹ]+$/.test(coreWord) && index > 0); // "Không" giữa câu

            if (hasCapitalIssue && !allProblematicWords.includes(coreWord)) {
                allProblematicWords.push(coreWord);
            }
        });
    }

    // Bước 2: Gọi AI để phân tích (batch)
    let decisionMap: Map<string, CorrectionDecision> = new Map();

    if (allProblematicWords.length > 0) {
        const decisions = await getAICorrectionDecisions(allProblematicWords, context, apiKey);
        decisions.forEach(d => decisionMap.set(d.original, d));
    }

    // Bước 3: Áp dụng correction cho từng dòng
    for (const line of lines) {
        if (!line.trim()) {
            correctedLines.push(line);
            continue;
        }

        const indentMatch = line.match(/^(\s+)/);
        const indent = indentMatch ? indentMatch[1] : '';
        let content = line.trim();

        for (const [original, decision] of decisionMap) {
            if (decision.shouldCorrect) {
                const regex = new RegExp(`\\b${original}\\b`, 'g');
                content = content.replace(regex, decision.corrected);
            }
        }

        correctedLines.push(indent + content);
    }

    return correctedLines.join('\n');
};

/**
 * Pipeline đầy đủ: Extract context → Correct spelling (với AI)
 */
export const correctSKKNSpelling = async (
    fullText: string,
    apiKey: string
): Promise<string> => {

    console.log('🔍 Đang phân tích ngữ cảnh SKKN...');
    const context = extractSKKNContext(fullText);

    console.log('📊 Ngữ cảnh phát hiện:', {
        title: context.title,
        subject: context.subject,
        grade: context.grade,
        keywords: context.keywords.slice(0, 5)
    });

    console.log('🤖 Đang sửa lỗi chính tả với AI...');
    const correctedText = await correctSpellingWithContext(fullText, context, apiKey);

    console.log('✅ Hoàn thành!');
    return correctedText;
};

// ==================== UTILITIES ====================

/**
 * Thống kê văn bản
 */
export const getTextStats = (text: string) => {
    if (!text.trim()) return { chars: 0, words: 0 };
    const chars = text.length;
    const words = text.trim().split(/\s+/).length;
    return { chars, words };
};
