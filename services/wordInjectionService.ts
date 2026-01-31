/**
 * Word Injection Service - XML Injection để sửa file Word giữ nguyên định dạng gốc
 * Bảo toàn: OLE Objects (MathType), Hình ảnh, Bảng, Định dạng
 */

import JSZip from 'jszip';
import FileSaver from 'file-saver';

/**
 * Interface cho file Word gốc
 */
export interface OriginalDocxFile {
    arrayBuffer: ArrayBuffer;
    fileName: string;
}

/**
 * Interface cho đoạn cần thay thế
 */
export interface ReplacementSegment {
    original: string;  // Đoạn văn gốc
    replacement: string;  // Đoạn văn thay thế
    type: 'plagiarism' | 'spelling' | 'structure' | 'vocabulary';
}

/**
 * Escape các ký tự đặc biệt XML
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
 * Chuyển đổi text sang Word XML paragraph
 */
const textToWordXml = (text: string, isHighlighted: boolean = false): string => {
    const escapedText = escapeXml(text);

    if (isHighlighted) {
        // Đánh dấu nội dung đã sửa bằng màu đỏ
        return `<w:p><w:r><w:rPr><w:color w:val="FF0000"/></w:rPr><w:t>${escapedText}</w:t></w:r></w:p>`;
    }

    return `<w:p><w:r><w:t>${escapedText}</w:t></w:r></w:p>`;
};

/**
 * Tìm và thay thế nội dung trong XML
 * Tìm kiếm linh hoạt: bỏ qua whitespace và dấu câu khác nhau
 */
const findAndReplace = (
    xml: string,
    original: string,
    replacement: string
): { result: string; replaced: boolean } => {
    // Normalize text để tìm kiếm
    const normalizeForSearch = (text: string): string => {
        return text
            .replace(/\s+/g, ' ')  // Multiple spaces -> single space
            .replace(/[\r\n]+/g, ' ')  // Newlines -> space
            .trim()
            .toLowerCase();
    };

    const originalNormalized = normalizeForSearch(original);

    // Tìm trong các thẻ <w:t>
    // Pattern: Tìm chuỗi các <w:t>...</w:t> mà nội dung ghép lại chứa original
    const paragraphRegex = /<w:p[^>]*>([\s\S]*?)<\/w:p>/g;
    let match;
    let modifiedXml = xml;
    let replaced = false;

    while ((match = paragraphRegex.exec(xml)) !== null) {
        const fullParagraph = match[0];
        const paragraphContent = match[1];

        // Trích xuất text từ paragraph
        const textMatches = paragraphContent.match(/<w:t[^>]*>([^<]*)<\/w:t>/g);
        if (!textMatches) continue;

        const paragraphText = textMatches
            .map(t => t.replace(/<w:t[^>]*>([^<]*)<\/w:t>/, '$1'))
            .join('');

        const paragraphNormalized = normalizeForSearch(paragraphText);

        // So sánh
        if (paragraphNormalized.includes(originalNormalized)) {
            // Tìm thấy! Thay thế paragraph
            // Đánh dấu nội dung đã sửa bằng màu đỏ
            const newParagraphContent = `<w:p><w:r><w:rPr><w:color w:val="FF0000"/></w:rPr><w:t>${escapeXml(replacement)}</w:t></w:r></w:p>`;

            modifiedXml = modifiedXml.replace(fullParagraph, newParagraphContent);
            replaced = true;
            break;  // Chỉ thay thế lần đầu tiên
        }
    }

    return { result: modifiedXml, replaced };
};

/**
 * Thực hiện XML Injection vào file Word gốc
 * Giữ nguyên: OLE Objects (MathType), Hình ảnh, Bảng, Headers, Footers
 */
export const injectFixesToDocx = async (
    originalFile: OriginalDocxFile,
    replacements: ReplacementSegment[]
): Promise<Blob> => {
    try {
        // 1. Giải nén file DOCX (thực chất là ZIP)
        const zip = await JSZip.loadAsync(originalFile.arrayBuffer);

        // 2. Đọc document.xml (nội dung chính)
        const documentXmlFile = zip.file('word/document.xml');
        if (!documentXmlFile) {
            throw new Error('File DOCX không hợp lệ - thiếu document.xml');
        }

        let documentXml = await documentXmlFile.async('string');

        // 3. Thực hiện từng thay thế
        let successCount = 0;
        let failedSegments: string[] = [];

        for (const segment of replacements) {
            const { result, replaced } = findAndReplace(
                documentXml,
                segment.original,
                segment.replacement
            );

            if (replaced) {
                documentXml = result;
                successCount++;
                console.log(`✓ Đã thay thế [${segment.type}]: "${segment.original.substring(0, 30)}..."`);
            } else {
                failedSegments.push(segment.original.substring(0, 50));
                console.log(`✗ Không tìm thấy để thay thế: "${segment.original.substring(0, 30)}..."`);
            }
        }

        // 4. Nếu có segment không tìm thấy, thêm ghi chú vào cuối file
        if (failedSegments.length > 0) {
            const noteXml = `
        <w:p><w:pPr><w:pBdr><w:top w:val="single" w:sz="12" w:space="1" w:color="FFA500"/></w:pBdr></w:pPr></w:p>
        <w:p><w:r><w:rPr><w:b/><w:color w:val="FFA500"/></w:rPr><w:t>═══ GHI CHÚ: Một số đoạn cần sửa thủ công ═══</w:t></w:r></w:p>
        <w:p><w:r><w:t>Các đoạn sau không tìm thấy vị trí chính xác trong file, vui lòng sửa thủ công:</w:t></w:r></w:p>
        ${failedSegments.map(s => `<w:p><w:r><w:rPr><w:color w:val="FF0000"/></w:rPr><w:t>• ${escapeXml(s)}...</w:t></w:r></w:p>`).join('')}
      `;

            documentXml = documentXml.replace('</w:body>', noteXml + '</w:body>');
        }

        console.log(`Tổng kết: ${successCount}/${replacements.length} đoạn đã được thay thế thành công`);

        // 5. Ghi lại document.xml vào ZIP
        zip.file('word/document.xml', documentXml);

        // 6. Tạo file mới
        return await zip.generateAsync({
            type: 'blob',
            mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        });

    } catch (error: any) {
        console.error('XML Injection Error:', error);
        throw new Error(`Không thể chỉnh sửa file Word: ${error.message}`);
    }
};

/**
 * Tải file Word gốc và lưu ArrayBuffer
 */
export const readDocxForInjection = async (file: File): Promise<OriginalDocxFile> => {
    const arrayBuffer = await file.arrayBuffer();
    return {
        arrayBuffer,
        fileName: file.name
    };
};

/**
 * Xuất file đã sửa
 */
export const saveFixedDocx = (blob: Blob, originalFileName: string): void => {
    const newFileName = originalFileName.replace('.docx', '_DA_SUA.docx');
    FileSaver.saveAs(blob, newFileName);
};

/**
 * Thay thế toàn bộ nội dung (fallback khi XML Injection thất bại)
 * Vẫn giữ header, footer, styles từ file gốc
 */
export const replaceFullContent = async (
    originalFile: OriginalDocxFile,
    newContent: string
): Promise<Blob> => {
    try {
        const zip = await JSZip.loadAsync(originalFile.arrayBuffer);

        // Đọc document.xml
        const documentXmlFile = zip.file('word/document.xml');
        if (!documentXmlFile) {
            throw new Error('File DOCX không hợp lệ');
        }

        let documentXml = await documentXmlFile.async('string');

        // Tìm phần body và thay thế nội dung
        const bodyStartMatch = documentXml.match(/<w:body[^>]*>/);
        const bodyEndMatch = documentXml.match(/<\/w:body>/);

        if (bodyStartMatch && bodyEndMatch) {
            // Giữ nguyên phần đầu (trước body) và cuối (sau body)
            const beforeBody = documentXml.substring(0, bodyStartMatch.index! + bodyStartMatch[0].length);
            const afterBodyIndex = documentXml.indexOf('</w:body>');
            const afterBody = documentXml.substring(afterBodyIndex);

            // Giữ lại sectPr (page settings) nếu có
            const sectPrMatch = documentXml.match(/<w:sectPr[\s\S]*?<\/w:sectPr>/);
            const sectPr = sectPrMatch ? sectPrMatch[0] : '';

            // Tạo nội dung mới
            const lines = newContent.split('\n');
            const newBodyContent = lines
                .filter(line => line.trim())
                .map(line => {
                    const escaped = escapeXml(line.trim());
                    // Kiểm tra heading
                    if (line.startsWith('# ')) {
                        return `<w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>${escapeXml(line.substring(2))}</w:t></w:r></w:p>`;
                    } else if (line.startsWith('## ')) {
                        return `<w:p><w:pPr><w:pStyle w:val="Heading2"/></w:pPr><w:r><w:t>${escapeXml(line.substring(3))}</w:t></w:r></w:p>`;
                    } else if (line.startsWith('### ')) {
                        return `<w:p><w:pPr><w:pStyle w:val="Heading3"/></w:pPr><w:r><w:t>${escapeXml(line.substring(4))}</w:t></w:r></w:p>`;
                    } else if (line.startsWith('- ') || line.startsWith('* ')) {
                        return `<w:p><w:pPr><w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr></w:pPr><w:r><w:t>${escapeXml(line.substring(2))}</w:t></w:r></w:p>`;
                    }
                    return `<w:p><w:r><w:t>${escaped}</w:t></w:r></w:p>`;
                })
                .join('');

            // Ghép lại
            documentXml = beforeBody + newBodyContent + sectPr + afterBody;
        }

        zip.file('word/document.xml', documentXml);

        return await zip.generateAsync({
            type: 'blob',
            mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        });

    } catch (error: any) {
        console.error('Replace Full Content Error:', error);
        throw new Error(`Không thể thay thế nội dung: ${error.message}`);
    }
};

/**
 * Tìm text trong XML document và thay thế bằng text mới với màu đỏ
 * Giữ nguyên tất cả cấu trúc XML khác (OLE, hình ảnh, bảng, công thức...)
 */
const findAndReplaceTextInDocument = (
    documentXml: string,
    originalText: string,
    newText: string
): { result: string; replaced: boolean } => {
    // Normalize text để so sánh
    const normalize = (t: string) => t.replace(/\s+/g, ' ').trim().toLowerCase();
    const normalizedOriginal = normalize(originalText);

    // Tìm tất cả paragraphs
    const paragraphRegex = /<w:p[^>]*>[\s\S]*?<\/w:p>/g;
    let match;
    let modifiedXml = documentXml;

    while ((match = paragraphRegex.exec(documentXml)) !== null) {
        const paragraph = match[0];

        // Trích xuất tất cả text từ paragraph
        const textMatches = paragraph.match(/<w:t[^>]*>([^<]*)<\/w:t>/g) || [];
        const fullText = textMatches
            .map(t => t.replace(/<w:t[^>]*>([^<]*)<\/w:t>/, '$1'))
            .join('');

        const normalizedFull = normalize(fullText);

        // Kiểm tra xem paragraph có chứa text cần tìm không
        if (normalizedFull.includes(normalizedOriginal)) {
            // Tìm thấy! Thay thế trong paragraph này
            // Chiến lược: Tìm vị trí chính xác và thay thế

            // Tìm text gốc trong fullText (case insensitive, flexible whitespace)
            const originalRegex = new RegExp(
                originalText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+'),
                'i'
            );
            const foundMatch = fullText.match(originalRegex);

            if (foundMatch) {
                // Tạo paragraph mới với text đã thay thế (màu đỏ)
                const beforeText = fullText.substring(0, foundMatch.index);
                const afterText = fullText.substring(foundMatch.index! + foundMatch[0].length);

                // Tạo runs mới
                let newRuns = '';
                if (beforeText) {
                    newRuns += `<w:r><w:t xml:space="preserve">${escapeXml(beforeText)}</w:t></w:r>`;
                }
                // Text mới với màu đỏ (KHÔNG in đậm, KHÔNG highlight)
                newRuns += `<w:r><w:rPr><w:color w:val="FF0000"/></w:rPr><w:t xml:space="preserve">${escapeXml(newText)}</w:t></w:r>`;
                if (afterText) {
                    newRuns += `<w:r><w:t xml:space="preserve">${escapeXml(afterText)}</w:t></w:r>`;
                }

                // Giữ nguyên pPr (paragraph properties) nếu có
                const pPrMatch = paragraph.match(/<w:pPr>[\s\S]*?<\/w:pPr>/);
                const pPr = pPrMatch ? pPrMatch[0] : '';

                const newParagraph = `<w:p>${pPr}${newRuns}</w:p>`;

                modifiedXml = modifiedXml.replace(paragraph, newParagraph);
                return { result: modifiedXml, replaced: true };
            }
        }
    }

    return { result: modifiedXml, replaced: false };
};

/**
 * Xuất nội dung đã sửa vào file Word gốc sử dụng XML Injection
 * 🎯 KỸ THUẬT CHÍNH:
 *   - Tìm và thay thế TEXT CỤ THỂ trong các run
 *   - Giữ nguyên TẤT CẢ cấu trúc gốc: OLE Objects, hình ảnh, bảng, công thức MathType
 *   - Chỉ thay đổi phần text bị sửa → màu đỏ
 *   - KHÔNG thay thế toàn bộ body
 * 
 * @param originalFile - File DOCX gốc
 * @param fixedContent - Nội dung đã sửa (dùng để fallback nếu không có changes)  
 * @param changes - Danh sách các thay đổi cụ thể (original -> fixed)
 */
export const injectFixedContentToDocx = async (
    originalFile: OriginalDocxFile,
    fixedContent: string,
    changes?: Array<{ original: string, fixed: string, type: string }>
): Promise<Blob> => {
    try {
        // 1. Giải nén file DOCX
        const zip = await JSZip.loadAsync(originalFile.arrayBuffer);

        // 2. Đọc document.xml
        const documentXmlFile = zip.file('word/document.xml');
        if (!documentXmlFile) {
            throw new Error('File DOCX không hợp lệ - thiếu document.xml');
        }

        let documentXml = await documentXmlFile.async('string');
        let useFullReplace = false;  // Flag để quyết định sử dụng fallback

        // 3. Nếu có danh sách changes, thử XML Injection
        if (changes && changes.length > 0) {
            let successCount = 0;
            const failedChanges: string[] = [];

            for (const change of changes) {
                const { result, replaced } = findAndReplaceTextInDocument(
                    documentXml,
                    change.original,
                    change.fixed
                );

                if (replaced) {
                    documentXml = result;
                    successCount++;
                    console.log(`✓ [${change.type}] Đã thay thế: "${change.original.substring(0, 30)}..."`);
                } else {
                    failedChanges.push(change.original.substring(0, 50));
                    console.log(`✗ Không tìm thấy: "${change.original.substring(0, 30)}..."`);
                }
            }

            console.log(`XML Injection: ${successCount}/${changes.length} thay đổi thành công`);

            // Nếu KHÔNG có change nào thành công, sử dụng fallback
            if (successCount === 0) {
                console.log('⚠️ XML Injection thất bại hoàn toàn, sử dụng fallback thay thế body');
                useFullReplace = true;
            } else if (failedChanges.length > 0) {
                // Một số thành công, thêm ghi chú về các đoạn thất bại
                const noteXml = `
                <w:p><w:pPr><w:pBdr><w:top w:val="single" w:sz="12" w:space="1" w:color="FFA500"/></w:pBdr></w:pPr></w:p>
                <w:p><w:r><w:rPr><w:b/><w:color w:val="FFA500"/></w:rPr><w:t>═══ GHI CHÚ: Một số đoạn cần sửa thủ công ═══</w:t></w:r></w:p>
                <w:p><w:r><w:t>Các đoạn sau không tìm thấy vị trí chính xác trong file, vui lòng kiểm tra:</w:t></w:r></w:p>
                ${failedChanges.map(s => `<w:p><w:r><w:rPr><w:color w:val="FF0000"/></w:rPr><w:t>• ${escapeXml(s)}...</w:t></w:r></w:p>`).join('')}
                `;
                documentXml = documentXml.replace('</w:body>', noteXml + '</w:body>');
            }
        } else {
            // Không có changes array -> sử dụng fullReplace
            console.log('⚠️ Không có danh sách changes, sử dụng fallback thay thế body');
            useFullReplace = true;
        }

        // 4. FALLBACK: Thay thế toàn bộ body content
        if (useFullReplace && fixedContent) {
            console.log('📝 Đang thay thế toàn bộ body content với fixedContent...');

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
                console.log('✅ Đã thay thế body content thành công');
            }
        }

        // 5. Ghi lại document.xml
        zip.file('word/document.xml', documentXml);

        // 6. Tạo file mới
        return await zip.generateAsync({
            type: 'blob',
            mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        });

    } catch (error: any) {
        console.error('Inject Fixed Content Error:', error);
        throw new Error(`Không thể chèn nội dung đã sửa: ${error.message}`);
    }
};

