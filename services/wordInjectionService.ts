/**
 * Word XML Injection Service - PHIÊN BẢN SỬA LỖI
 * Giữ nguyên: MathType, Hình ảnh, Bảng, Định dạng gốc
 * Chỉ thay đổi: Text cần sửa → màu đỏ
 */

import JSZip from 'jszip';
import FileSaver from 'file-saver';

export interface OriginalDocxFile {
    arrayBuffer: ArrayBuffer;
    fileName: string;
}

export interface ReplacementSegment {
    original: string;
    replacement: string;
    type: 'plagiarism' | 'spelling' | 'structure' | 'vocabulary' | 'ai_detection' | 'rewrite';
}

/**
 * Escape XML đúng cách
 */
const escapeXml = (text: string): string => {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
};

/**
 * Unescape XML entities (ngược lại escapeXml)
 */
const unescapeXml = (text: string): string => {
    return text
        .replace(/&apos;/g, "'")
        .replace(/&quot;/g, '"')
        .replace(/&gt;/g, '>')
        .replace(/&lt;/g, '<')
        .replace(/&amp;/g, '&');
};

/**
 * Deep unescape - xử lý escape nhiều lần lồng nhau
 * VD: &amp;amp;lt;red&amp;amp;gt; → &amp;lt;red&amp;gt; → &lt;red&gt; → <red>
 */
const deepUnescapeXml = (text: string): string => {
    let prev = text;
    let current = unescapeXml(text);
    // Tối đa 10 lần để tránh infinite loop
    let iterations = 0;
    while (current !== prev && iterations < 10) {
        prev = current;
        current = unescapeXml(current);
        iterations++;
    }
    return current;
};

/**
 * Normalize text để so sánh (xử lý Unicode, dấu tiếng Việt và Markdown)
 */
const normalizeText = (text: string): string => {
    return text
        .normalize('NFC')  // Chuẩn hóa Unicode
        .replace(/\*\*/g, '')  // Bỏ markdown bold
        .replace(/\s+/g, ' ')  // Multiple spaces → single space
        .replace(/[\r\n\t]+/g, ' ')  // Newlines, tabs → space
        .trim()
        .toLowerCase();
};

/**
 * Loại bỏ các ký tự Markdown (**, *) ra khỏi text để hiển thị đẹp trong Word
 */
const stripMarkdown = (text: string): string => {
    return text
        .replace(/\*\*(.*?)\*\*/g, '$1') // Bỏ **bôi đậm** nhưng giữ text bên trong
        .replace(/(^|\n)\*\s/g, '$1- ')  // Thay * list item bằng gạch đầu dòng
        .replace(/\*/g, '');             // Xóa các dấu * còn lại
};

/**
 * Trích xuất text từ tất cả runs trong paragraph
 */
const extractTextFromParagraph = (paragraphXml: string): string => {
    const textMatches = paragraphXml.match(/<w:t[^>]*>([^<]*)<\/w:t>/g) || [];
    return textMatches
        .map(t => {
            const match = t.match(/<w:t[^>]*>([^<]*)<\/w:t>/);
            return match ? unescapeXml(match[1]) : '';
        })
        .join('');
};

/**
 * Kiểm tra xem paragraph có chứa OLE Object (MathType) không
 */
const hasOleObject = (paragraphXml: string): boolean => {
    return paragraphXml.includes('<o:OLEObject') ||
        paragraphXml.includes('w:object') ||
        paragraphXml.includes('v:shape');
};

/**
 * Tìm và thay thế text trong paragraph
 * CHIẾN LƯỢC:
 * 1. Ghép text từ tất cả runs
 * 2. Tìm vị trí text cần thay thế
 * 3. Xây dựng lại paragraph với text mới (giữ nguyên OLE Objects)
 */
const replaceTextInParagraph = (
    paragraphXml: string,
    originalText: string,
    replacementText: string
): { result: string; replaced: boolean } => {

    // Bước 1: Trích xuất text đầy đủ
    const fullText = extractTextFromParagraph(paragraphXml);
    const normalizedFull = normalizeText(fullText);
    const normalizedOriginal = normalizeText(originalText);

    // Bước 2: Kiểm tra có chứa text cần tìm không
    if (!normalizedFull.includes(normalizedOriginal)) {
        return { result: paragraphXml, replaced: false };
    }

    // Bước 3: Kiểm tra có OLE Object không - bỏ qua nếu có
    if (hasOleObject(paragraphXml)) {
        console.warn('⚠️ Paragraph chứa OLE Object - bỏ qua thay thế');
        return { result: paragraphXml, replaced: false };
    }

    // Bước 4: Giữ nguyên pPr (paragraph properties)
    const pPrMatch = paragraphXml.match(/<w:pPr>[\s\S]*?<\/w:pPr>/);
    const pPr = pPrMatch ? pPrMatch[0] : '';

    // Bước 4b: Trích xuất rPr (run properties) từ run đầu tiên để giữ font gốc
    // Tìm <w:rPr>...</w:rPr> từ run đầu tiên chứa text
    const firstRPrMatch = paragraphXml.match(/<w:r>[\s\S]*?<w:rPr>([\s\S]*?)<\/w:rPr>[\s\S]*?<w:t/);
    const originalRPrContent = firstRPrMatch ? firstRPrMatch[1] : '';
    // Loại bỏ w:color khỏi rPr gốc (để không conflict khi thêm màu đỏ)
    // Match cả self-closing <w:color ... /> VÀ dạng có closing tag <w:color ...>...</w:color>
    const baseRPrContent = originalRPrContent
        .replace(/<w:color[^>]*\/>/g, '')
        .replace(/<w:color[^>]*>.*?<\/w:color>/g, '')
        .trim();
    const baseRPr = baseRPrContent ? `<w:rPr>${baseRPrContent}</w:rPr>` : '';

    // Bước 5: Luôn tìm vị trí chính xác của đoạn text cần sửa trong paragraph
    // và giữ lại text trước/sau dù là sửa nhỏ hay viết lại toàn bộ
    const regex = new RegExp(
        originalText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+'),
        'i'
    );
    const match = fullText.match(regex);

    let newRuns = '';

    // Helper: tạo 1 run XML giữ font gốc
    const makeRun = (text: string, extraRPr?: string): string => {
        let rPrXml = '';
        if (baseRPrContent || extraRPr) {
            // extraRPr (màu đỏ) đặt TRƯỚC baseRPrContent để được ưu tiên
            rPrXml = `<w:rPr>${extraRPr || ''}${baseRPrContent}</w:rPr>`;
        }
        return `<w:r>${rPrXml}<w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r>`;
    };

    // Helper để parse replacementText chứa <red>...</red> và tạo ra các XML runs
    // GIỮ NGUYÊN font gốc (rPr) cho tất cả runs
    const createRunsFromReplacement = (rawText: string): string => {
        if (!rawText) return '';

        // Deep unescape để xử lý trường hợp Gemini trả về &lt;red&gt; hoặc &amp;lt;red&amp;gt;...
        const text = deepUnescapeXml(rawText);

        let runsXml = '';
        let currentIndex = 0;
        const redOpenTag = '<red>';
        const redCloseTag = '</red>';

        while (currentIndex < text.length) {
            const openIndex = text.indexOf(redOpenTag, currentIndex);

            if (openIndex === -1) {
                const remaining = text.substring(currentIndex);
                if (remaining) {
                    runsXml += makeRun(remaining);
                }
                break;
            }

            if (openIndex > currentIndex) {
                const normalText = text.substring(currentIndex, openIndex);
                runsXml += makeRun(normalText);
            }

            const closeIndex = text.indexOf(redCloseTag, openIndex);
            if (closeIndex === -1) {
                const remaining = text.substring(openIndex + redOpenTag.length);
                runsXml += makeRun(remaining, '<w:color w:val="FF0000"/>');
                break;
            }

            const redText = text.substring(openIndex + redOpenTag.length, closeIndex);
            runsXml += makeRun(redText, '<w:color w:val="FF0000"/>');

            currentIndex = closeIndex + redCloseTag.length;
        }
        return runsXml;
    };

    if (match && match.index !== undefined) {
        const startIndex = match.index;
        const endIndex = startIndex + match[0].length;

        const beforeText = fullText.substring(0, startIndex);
        const afterText = fullText.substring(endIndex);

        console.log(`📝 Sửa chính xác: before=${beforeText.length}, matched=${match[0].length}, after=${afterText.length}`);

        // Run 1: Text trước đoạn cần sửa (giữ font gốc)
        if (beforeText) {
            newRuns += makeRun(beforeText);
        }

        // Run 2: Text đã sửa - Xử lý tag <red> (giữ font gốc)
        newRuns += createRunsFromReplacement(replacementText);

        // Run 3: Text sau đoạn cần sửa (giữ font gốc)
        if (afterText) {
            newRuns += makeRun(afterText);
        }
    } else {
        // Fallback: nếu không match regex chính xác, thử dùng normalized matching
        // Tìm vị trí trong normalized text
        const normalizedFullText = normalizeText(fullText);
        const normalizedSearch = normalizeText(originalText);
        const normalizedIdx = normalizedFullText.indexOf(normalizedSearch);

        if (normalizedIdx >= 0) {
            // Ước lượng vị trí tương đương trong fullText gốc
            // Tính tỷ lệ vị trí
            const ratio = normalizedIdx / normalizedFullText.length;
            const approxStart = Math.floor(ratio * fullText.length);
            const approxEnd = Math.min(approxStart + originalText.length + 20, fullText.length);

            // Tìm ranh giới từ gần nhất
            let bestStart = approxStart;
            let bestEnd = Math.min(approxEnd, fullText.length);

            // Tìm khoảng trắng gần nhất làm ranh giới
            for (let i = approxStart; i >= Math.max(0, approxStart - 10); i--) {
                if (fullText[i] === ' ' || i === 0) {
                    bestStart = i === 0 ? 0 : i + 1;
                    break;
                }
            }

            const beforeText = fullText.substring(0, bestStart);
            const afterText = fullText.substring(bestEnd);

            console.log(`📝 Fallback normalized match: before=${beforeText.length}, after=${afterText.length}`);

            if (beforeText) {
                newRuns += makeRun(beforeText);
            }
            newRuns += createRunsFromReplacement(replacementText);
            if (afterText) {
                newRuns += makeRun(afterText);
            }
        } else {
            // Final fallback: Chỉ thay thế phần text, không xóa toàn bộ paragraph
            console.log(`📝 Final fallback: giữ nguyên paragraph, chỉ đổi nội dung text`);
            newRuns = createRunsFromReplacement(replacementText);
        }
    }

    // Ghép lại paragraph
    const newParagraph = `<w:p>${pPr}${newRuns}</w:p>`;

    return { result: newParagraph, replaced: true };
};

/**
 * Tìm và thay thế trong toàn bộ document
 * CHỈ thay thế runs chứa text - KHÔNG động vào OLE Objects
 * Hỗ trợ cả paragraph thường và table cells
 */
const findAndReplaceInDocument = (
    documentXml: string,
    originalText: string,
    rawReplacementText: string
): { result: string; replaced: boolean } => {

    const replacementText = stripMarkdown(rawReplacementText);

    // QUAN TRỌNG: Chỉ cắt ngắn text để TÌM KIẾM, KHÔNG cắt ngắn replacementText
    let searchText = originalText;

    // Nếu đoạn gốc quá dài (> 100 ký tự), chỉ lấy phần đầu để tìm kiếm
    // NHƯNG vẫn thay thế với TOÀN BỘ replacementText
    if (originalText.length > 100) {
        const cutPoint = originalText.indexOf(' ', 50);
        if (cutPoint > 0 && cutPoint < 100) {
            searchText = originalText.substring(0, cutPoint);
            console.log(`📝 Đoạn dài - chỉ tìm: "${searchText.substring(0, 40)}...", thay thế đầy đủ ${replacementText.length} ký tự`);
        }
    }

    // Regex để tìm paragraphs (không match nested - chỉ match <w:p> không chứa <w:p> bên trong)
    // Sử dụng negative lookahead để tránh match quá rộng qua nhiều paragraphs
    const elementRegex = /<w:p\b[^>]*>(?:(?!<w:p\b)[\s\S])*?<\/w:p>/g;
    let match;
    let modifiedXml = documentXml;
    let replaced = false;

    // Reset regex
    elementRegex.lastIndex = 0;

    while ((match = elementRegex.exec(documentXml)) !== null) {
        const element = match[0];

        // Thử thay thế trong element này
        // QUAN TRỌNG: Dùng searchText để tìm, nhưng replacementText ĐẦY ĐỦ để thay thế
        const { result, replaced: wasReplaced } = replaceTextInParagraph(
            element,
            searchText,
            replacementText  // TOÀN BỘ nội dung thay thế, không cắt ngắn
        );

        if (wasReplaced) {
            modifiedXml = modifiedXml.replace(element, result);
            replaced = true;
            console.log(`✓ Đã thay thế: "${searchText.substring(0, 40)}..."`);
            break;  // Chỉ thay thế lần đầu tiên
        }
    }

    // Nếu vẫn không tìm thấy và đoạn dài, thử tìm với 30 ký tự đầu
    if (!replaced && originalText.length > 50) {
        const shortSearch = originalText.substring(0, 30).trim();
        console.log(` Thử tìm với đoạn ngắn hơn: "${shortSearch}..."`);

        elementRegex.lastIndex = 0;
        while ((match = elementRegex.exec(documentXml)) !== null) {
            const element = match[0];
            const { result, replaced: wasReplaced } = replaceTextInParagraph(
                element,
                shortSearch,
                replacementText  // TOÀN BỘ nội dung thay thế, không cắt ngắn
            );

            if (wasReplaced) {
                modifiedXml = modifiedXml.replace(element, result);
                replaced = true;
                console.log(`✓ Đã thay thế (đoạn ngắn): "${shortSearch}..."`);
                break;
            }
        }
    }

    return { result: modifiedXml, replaced };
};

/**
 * MAIN FUNCTION: Inject các sửa đổi vào file Word gốc
 */
export const injectFixesToDocx = async (
    originalFile: OriginalDocxFile,
    replacements: ReplacementSegment[]
): Promise<Blob> => {
    try {
        console.log(' Bắt đầu XML Injection...');
        console.log(` Số lượng replacements: ${replacements.length}`);

        // 1. Giải nén file DOCX
        // Đảm bảo arrayBuffer là ArrayBuffer thực sự (có thể bị mất prototype qua React state)
        const buffer = originalFile.arrayBuffer instanceof ArrayBuffer
            ? originalFile.arrayBuffer
            : new Uint8Array(originalFile.arrayBuffer as any).buffer;
        const zip = await JSZip.loadAsync(buffer);

        // 2. Đọc document.xml
        const documentXmlFile = zip.file('word/document.xml');
        if (!documentXmlFile) {
            throw new Error('File DOCX không hợp lệ - thiếu document.xml');
        }

        let documentXml = await documentXmlFile.async('string');
        console.log(` Đọc document.xml thành công (${documentXml.length} ký tự)`);

        // 3. Thực hiện từng thay thế
        let successCount = 0;
        let failedSegments: string[] = [];

        for (const segment of replacements) {
            const { result, replaced } = findAndReplaceInDocument(
                documentXml,
                segment.original,
                segment.replacement
            );

            if (replaced) {
                documentXml = result;
                successCount++;
            } else {
                failedSegments.push(segment.original);
                console.warn(`✗ Không tìm thấy: "${segment.original.substring(0, 50)}..."`);
            }
        }

        console.log(`✅ Tổng kết: ${successCount}/${replacements.length} đoạn đã được thay thế`);

        // 4. Nếu có đoạn không tìm thấy, thêm ghi chú vào cuối file
        if (failedSegments.length > 0) {
            const noteXml = `
                <w:p><w:pPr><w:pBdr><w:top w:val="single" w:sz="12" w:space="1" w:color="FFA500"/></w:pBdr></w:pPr></w:p>
                <w:p><w:r><w:rPr><w:b/><w:color w:val="FFA500"/></w:rPr><w:t>═══ GHI CHÚ: Một số đoạn cần sửa thủ công ═══</w:t></w:r></w:p>
                <w:p><w:r><w:t>Các đoạn sau không tìm thấy vị trí chính xác, vui lòng sửa thủ công:</w:t></w:r></w:p>
                ${failedSegments.map(s => `<w:p><w:r><w:rPr><w:color w:val="FF0000"/></w:rPr><w:t>• ${escapeXml(s.substring(0, 100))}...</w:t></w:r></w:p>`).join('')}
            `;

            documentXml = documentXml.replace('</w:body>', noteXml + '</w:body>');
        }

        // 5. Ghi lại document.xml
        zip.file('word/document.xml', documentXml);

        // 6. Tạo file mới
        const blob = await zip.generateAsync({
            type: 'blob',
            mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        });

        console.log('✅ Hoàn thành XML Injection');
        return blob;

    } catch (error: any) {
        console.error('❌ Lỗi XML Injection:', error);
        throw new Error(`Không thể chỉnh sửa file Word: ${error.message}`);
    }
};

/**
 * Đọc file DOCX
 */
export const readDocxForInjection = async (file: File): Promise<OriginalDocxFile> => {
    const arrayBuffer = await file.arrayBuffer();
    return {
        arrayBuffer,
        fileName: file.name
    };
};

/**
 * Lưu file đã sửa
 */
export const saveFixedDocx = (blob: Blob, originalFileName: string): void => {
    const newFileName = originalFileName.replace('.docx', '_DA_SUA.docx');
    FileSaver.saveAs(blob, newFileName);
};

/**
 * Hàm wrapper cho AutoFixPanel - chuyển đổi từ changes array
 * @param originalFile - File DOCX gốc
 * @param fixedContent - Nội dung đã sửa (dùng để fallback)
 * @param changes - Danh sách thay đổi từ AI
 */
export const injectFixedContentToDocx = async (
    originalFile: OriginalDocxFile,
    fixedContent: string,
    changes?: Array<{ original: string, fixed: string, type: string }>
): Promise<Blob> => {
    console.log(' injectFixedContentToDocx được gọi');
    console.log(' File:', originalFile.fileName);
    console.log(' fixedContent length:', fixedContent?.length || 0);
    console.log(' changes:', changes?.length || 0);

    // Nếu có changes, chuyển đổi format và sử dụng XML Injection
    if (changes && changes.length > 0) {
        const replacements: ReplacementSegment[] = changes.map(c => {
            // Nếu c.fixed chưa có <red> tags, wrap toàn bộ trong <red>
            // Vì Gemini chỉ đặt <red> trong fixedContent, không trong changes[].fixed
            let fixedWithRed = c.fixed;
            if (!fixedWithRed.includes('<red>') && !fixedWithRed.includes('&lt;red&gt;')) {
                fixedWithRed = `<red>${fixedWithRed}</red>`;
            }
            return {
                original: c.original,
                replacement: fixedWithRed,
                type: c.type as ReplacementSegment['type']
            };
        });

        return injectFixesToDocx(originalFile, replacements);
    }

    // Fallback: Nếu không có changes, thay thế toàn bộ body với fixedContent
    console.log('⚠️ Không có changes, sử dụng fallback thay thế body');
    return fallbackReplaceBody(originalFile, fixedContent);
};

/**
 * Fallback: Thay thế toàn bộ body content
 * Dùng khi không có danh sách changes cụ thể
 */
const fallbackReplaceBody = async (
    originalFile: OriginalDocxFile,
    fixedContent: string
): Promise<Blob> => {
    try {
        console.log(' Fallback: Thay thế toàn bộ body...');

        // Đảm bảo arrayBuffer là ArrayBuffer thực sự (có thể bị mất prototype qua React state)
        const buffer = originalFile.arrayBuffer instanceof ArrayBuffer
            ? originalFile.arrayBuffer
            : new Uint8Array(originalFile.arrayBuffer as any).buffer;
        const zip = await JSZip.loadAsync(buffer);

        const documentXmlFile = zip.file('word/document.xml');
        if (!documentXmlFile) {
            throw new Error('File DOCX không hợp lệ');
        }

        let documentXml = await documentXmlFile.async('string');

        // Tìm phần body
        const bodyStartMatch = documentXml.match(/<w:body[^>]*>/);
        const bodyEndIndex = documentXml.indexOf('</w:body>');

        if (bodyStartMatch && bodyEndIndex > -1) {
            const beforeBody = documentXml.substring(0, bodyStartMatch.index! + bodyStartMatch[0].length);
            const afterBody = documentXml.substring(bodyEndIndex);

            // Giữ lại sectPr (page settings)
            const bodyContent = documentXml.substring(bodyStartMatch.index! + bodyStartMatch[0].length, bodyEndIndex);
            const sectPrMatch = bodyContent.match(/<w:sectPr[\s\S]*?<\/w:sectPr>/);
            const sectPr = sectPrMatch ? sectPrMatch[0] : '';

            const cleanFixedContent = deepUnescapeXml(stripMarkdown(fixedContent));

            // Tạo paragraphs từ cleanFixedContent
            const paragraphs = cleanFixedContent.split('\n').map(line => {
                if (!line.trim()) {
                    return '<w:p><w:r><w:t></w:t></w:r></w:p>';
                }

                // Deep unescape line trước khi xử lý thẻ <red>
                const cleanLine = deepUnescapeXml(line);
                // Xử lý thẻ <red> trong line
                let runsXml = '';
                let currentIndex = 0;
                const redOpenTag = '<red>';
                const redCloseTag = '</red>';

                while (currentIndex < cleanLine.length) {
                    const openIndex = cleanLine.indexOf(redOpenTag, currentIndex);

                    if (openIndex === -1) {
                        const remaining = cleanLine.substring(currentIndex);
                        if (remaining) {
                            runsXml += `<w:r><w:t xml:space="preserve">${escapeXml(remaining)}</w:t></w:r>`;
                        }
                        break;
                    }

                    if (openIndex > currentIndex) {
                        const normalText = cleanLine.substring(currentIndex, openIndex);
                        runsXml += `<w:r><w:t xml:space="preserve">${escapeXml(normalText)}</w:t></w:r>`;
                    }

                    const closeIndex = cleanLine.indexOf(redCloseTag, openIndex);
                    if (closeIndex === -1) {
                        const remaining = cleanLine.substring(openIndex + redOpenTag.length);
                        runsXml += `<w:r><w:rPr><w:color w:val="FF0000"/></w:rPr><w:t xml:space="preserve">${escapeXml(remaining)}</w:t></w:r>`;
                        break;
                    }

                    const redText = cleanLine.substring(openIndex + redOpenTag.length, closeIndex);
                    runsXml += `<w:r><w:rPr><w:color w:val="FF0000"/></w:rPr><w:t xml:space="preserve">${escapeXml(redText)}</w:t></w:r>`;

                    currentIndex = closeIndex + redCloseTag.length;
                }

                return `<w:p>${runsXml}</w:p>`;
            }).join('');

            documentXml = beforeBody + paragraphs + sectPr + afterBody;
            console.log('✅ Fallback: Đã thay thế body');
        }

        zip.file('word/document.xml', documentXml);

        return await zip.generateAsync({
            type: 'blob',
            mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        });

    } catch (error: any) {
        console.error('❌ Fallback Error:', error);
        throw new Error(`Không thể thay thế nội dung: ${error.message}`);
    }
};
