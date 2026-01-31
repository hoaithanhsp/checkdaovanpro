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
    type: 'plagiarism' | 'spelling' | 'structure' | 'vocabulary';
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
 * Normalize text để so sánh (xử lý Unicode và dấu tiếng Việt)
 */
const normalizeText = (text: string): string => {
    return text
        .normalize('NFC')  // Chuẩn hóa Unicode
        .replace(/\s+/g, ' ')  // Multiple spaces → single space
        .replace(/[\r\n\t]+/g, ' ')  // Newlines, tabs → space
        .trim()
        .toLowerCase();
};

/**
 * Trích xuất text từ tất cả runs trong paragraph
 */
const extractTextFromParagraph = (paragraphXml: string): string => {
    const textMatches = paragraphXml.match(/<w:t[^>]*>([^<]*)<\/w:t>/g) || [];
    return textMatches
        .map(t => {
            const match = t.match(/<w:t[^>]*>([^<]*)<\/w:t>/);
            return match ? match[1] : '';
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

    // Bước 5: Xác định kiểu thay thế
    // Nếu originalText và replacementText khác nhau nhiều (viết lại) → thay thế TOÀN BỘ paragraph
    // Nếu tương tự (sửa nhỏ) → chỉ thay thế phần cần sửa

    const isFullRewrite = originalText.length > 50 &&
        (replacementText.length / originalText.length > 1.5 ||
            replacementText.length / originalText.length < 0.7 ||
            normalizeText(replacementText).indexOf(normalizedOriginal.substring(0, 20)) === -1);

    let newRuns = '';

    if (isFullRewrite) {
        // TRƯỜNG HỢP 1: Viết lại toàn bộ paragraph
        // Thay thế TOÀN BỘ nội dung, không giữ beforeText/afterText
        console.log(`📝 Thay thế toàn bộ paragraph (viết lại)`);
        newRuns = `<w:r><w:rPr><w:color w:val="FF0000"/></w:rPr><w:t xml:space="preserve">${escapeXml(replacementText)}</w:t></w:r>`;
    } else {
        // TRƯỜNG HỢP 2: Sửa một phần trong paragraph
        // Tìm vị trí chính xác và giữ beforeText/afterText
        const regex = new RegExp(
            originalText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+'),
            'i'
        );
        const match = fullText.match(regex);

        if (!match || match.index === undefined) {
            // Fallback: thay thế toàn bộ
            console.log(`📝 Fallback: thay thế toàn bộ paragraph`);
            newRuns = `<w:r><w:rPr><w:color w:val="FF0000"/></w:rPr><w:t xml:space="preserve">${escapeXml(replacementText)}</w:t></w:r>`;
        } else {
            const startIndex = match.index;
            const endIndex = startIndex + match[0].length;

            const beforeText = fullText.substring(0, startIndex);
            const afterText = fullText.substring(endIndex);

            console.log(`📝 Sửa một phần: before=${beforeText.length}, after=${afterText.length}`);

            // Run 1: Text trước đoạn cần sửa (nếu có)
            if (beforeText.trim()) {
                newRuns += `<w:r><w:t xml:space="preserve">${escapeXml(beforeText)}</w:t></w:r>`;
            }

            // Run 2: Text đã sửa - MÀU ĐỎ
            newRuns += `<w:r><w:rPr><w:color w:val="FF0000"/></w:rPr><w:t xml:space="preserve">${escapeXml(replacementText)}</w:t></w:r>`;

            // Run 3: Text sau đoạn cần sửa (nếu có)
            if (afterText.trim()) {
                newRuns += `<w:r><w:t xml:space="preserve">${escapeXml(afterText)}</w:t></w:r>`;
            }
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
    replacementText: string
): { result: string; replaced: boolean } => {

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

    // Regex để tìm cả paragraphs và table cells
    const elementRegex = /<w:p\b[^>]*>[\s\S]*?<\/w:p>|<w:tc\b[^>]*>[\s\S]*?<\/w:tc>/g;
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
        const zip = await JSZip.loadAsync(originalFile.arrayBuffer);

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
        const replacements: ReplacementSegment[] = changes.map(c => ({
            original: c.original,
            replacement: c.fixed,
            type: c.type as ReplacementSegment['type']
        }));

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

        const zip = await JSZip.loadAsync(originalFile.arrayBuffer);

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

            // Tạo paragraphs từ fixedContent
            const paragraphs = fixedContent.split('\n').map(line => {
                if (!line.trim()) {
                    return '<w:p><w:r><w:t></w:t></w:r></w:p>';
                }

                // Xử lý thẻ <red> trong line
                let runsXml = '';
                let currentIndex = 0;
                const redOpenTag = '<red>';
                const redCloseTag = '</red>';

                while (currentIndex < line.length) {
                    const openIndex = line.indexOf(redOpenTag, currentIndex);

                    if (openIndex === -1) {
                        const remaining = line.substring(currentIndex);
                        if (remaining) {
                            runsXml += `<w:r><w:t xml:space="preserve">${escapeXml(remaining)}</w:t></w:r>`;
                        }
                        break;
                    }

                    if (openIndex > currentIndex) {
                        const normalText = line.substring(currentIndex, openIndex);
                        runsXml += `<w:r><w:t xml:space="preserve">${escapeXml(normalText)}</w:t></w:r>`;
                    }

                    const closeIndex = line.indexOf(redCloseTag, openIndex);
                    if (closeIndex === -1) {
                        const remaining = line.substring(openIndex + redOpenTag.length);
                        runsXml += `<w:r><w:rPr><w:color w:val="FF0000"/></w:rPr><w:t xml:space="preserve">${escapeXml(remaining)}</w:t></w:r>`;
                        break;
                    }

                    const redText = line.substring(openIndex + redOpenTag.length, closeIndex);
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
