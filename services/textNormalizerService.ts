/**
 * Text Normalizer Service
 * Chuẩn hóa văn bản tiếng Việt (sửa lỗi viết hoa, bullet points)
 * Tham khảo từ: chinhvanban-main/services/textProcessor.ts
 */

// Danh sách từ viết tắt cần giữ nguyên
export const WHITELIST_ACRONYMS = new Set([
    'KHBG', 'ĐGTX', 'NCBH', 'HSG', 'CSDL', 'KTTX', 'THPT',
    'GDĐT', 'UBND', 'HĐND', 'BGD', 'SỞ', 'PHÒNG', 'THCS', 'TP', 'VN', 'SGK',
    'GV', 'HS', 'BGH', 'CMHS', 'CNTT', 'SKKN', 'PPCT', 'KHGD', 'KHDH',
    'NQ', 'TW', 'BGDĐT', 'ĐSVN', 'COVID', 'WHO', 'UNESCO', 'ASEAN'
]);

const ROMAN_NUMERALS = /^(I|II|III|IV|V|VI|VII|VIII|IX|X|XI|XII|XIII|XIV|XV|XVI|XVII|XVIII|XIX|XX)$/;

// Regex phát hiện các bullet points
const BULLET_DASH_GROUP = /^[•●⚫◆▪■▸►]\s*/;
const BULLET_PLUS_GROUP = /^[○◦]\s*/;

// Regex phát hiện marker đầu dòng (1., a), -, +)
const MARKER_REGEX = /^([-+*•]|\+\)|\d+[.)]|[a-zA-Z][.)]|[IVXLCDM]+[.)])$/;

const isMarker = (word: string) => MARKER_REGEX.test(word);
const hasEndPunctuation = (word: string) => /[.!?]$/.test(word);

/**
 * Xử lý một dòng văn bản
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

    // 2. Sửa lỗi viết hoa
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

        // --- LOGIC SỬA LỖI ---

        // 2.1 Lỗi "KHông", "KHối" (Mixed Case: 2+ chữ đầu hoa, sau thường) -> Về lowercase
        if (/^[A-ZÀ-Ỹ]{2,}[a-zà-ỹ]+$/.test(coreWord)) {
            fixedCoreWord = coreWord.toLowerCase();
        }
        // 2.2 Lỗi VIẾT HOA TOÀN BỘ không phải từ viết tắt -> Về lowercase
        else if (/^[A-ZÀ-Ỹ]{2,}$/.test(coreWord)) {
            fixedCoreWord = coreWord.toLowerCase();
        }
        // 2.3 Từ viết hoa chữ cái đầu (Title Case)
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
 * Chuẩn hóa văn bản tiếng Việt
 * - Sửa lỗi viết hoa
 * - Chuẩn hóa bullet points
 * - Giữ nguyên tên riêng, từ viết tắt
 */
export const normalizeVietnameseText = (text: string): string => {
    if (!text) return '';

    const lines = text.split('\n');
    const processedLines = lines.map(processLine);

    return processedLines.join('\n');
};

/**
 * Thống kê văn bản
 */
export const getTextStats = (text: string) => {
    if (!text.trim()) return { chars: 0, words: 0 };
    const chars = text.length;
    const words = text.trim().split(/\s+/).length;
    return { chars, words };
};
