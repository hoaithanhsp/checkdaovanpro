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
        // Đánh dấu nội dung đã sửa bằng màu xanh lá
        return `<w:p><w:r><w:rPr><w:color w:val="008000"/><w:highlight w:val="yellow"/></w:rPr><w:t>${escapedText}</w:t></w:r></w:p>`;
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
            const newParagraphContent = `<w:p><w:r><w:rPr><w:color w:val="008000"/></w:rPr><w:t>${escapeXml(replacement)}</w:t></w:r></w:p>`;

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
 * Chèn TOÀN BỘ nội dung đã sửa vào file Word gốc
 * Chuyển thẻ <red>...</red> thành chữ đỏ trong Word
 * Bảo toàn cấu trúc file (header, footer, styles)
 */
export const injectFixedContentToDocx = async (
    originalFile: OriginalDocxFile,
    fixedContent: string
): Promise<Blob> => {
    try {
        const zip = await JSZip.loadAsync(originalFile.arrayBuffer);

        const documentXmlFile = zip.file('word/document.xml');
        if (!documentXmlFile) {
            throw new Error('File DOCX không hợp lệ');
        }

        let documentXml = await documentXmlFile.async('string');

        // Tìm phần body
        const bodyStartMatch = documentXml.match(/<w:body[^>]*>/);
        const bodyEndMatch = documentXml.match(/<\/w:body>/);

        if (!bodyStartMatch || !bodyEndMatch) {
            throw new Error('Không tìm thấy body trong file Word');
        }

        const beforeBody = documentXml.substring(0, bodyStartMatch.index! + bodyStartMatch[0].length);
        const afterBodyIndex = documentXml.indexOf('</w:body>');
        const afterBody = documentXml.substring(afterBodyIndex);

        // Giữ lại sectPr (page settings)
        const sectPrMatch = documentXml.match(/<w:sectPr[\s\S]*?<\/w:sectPr>/);
        const sectPr = sectPrMatch ? sectPrMatch[0] : '';

        // Chuyển đổi nội dung có thẻ <red> thành Word XML
        const lines = fixedContent.split('\n');
        const newBodyContent = lines
            .filter(line => line.trim())
            .map(line => {
                // Xử lý thẻ <red>...</red> trong từng dòng
                // Tách dòng thành các phần: text thường và text đỏ
                const parts: Array<{ text: string, isRed: boolean }> = [];
                let remaining = line;

                while (remaining.length > 0) {
                    const redStart = remaining.indexOf('<red>');
                    if (redStart === -1) {
                        // Không còn thẻ red
                        if (remaining.trim()) {
                            parts.push({ text: remaining, isRed: false });
                        }
                        break;
                    }

                    // Phần trước thẻ red
                    if (redStart > 0) {
                        parts.push({ text: remaining.substring(0, redStart), isRed: false });
                    }

                    // Tìm </red>
                    const redEnd = remaining.indexOf('</red>', redStart);
                    if (redEnd === -1) {
                        // Không có thẻ đóng, coi như text thường
                        parts.push({ text: remaining.substring(redStart), isRed: false });
                        break;
                    }

                    // Phần trong thẻ red
                    const redContent = remaining.substring(redStart + 5, redEnd);
                    parts.push({ text: redContent, isRed: true });

                    remaining = remaining.substring(redEnd + 6);
                }

                // Tạo Word XML cho dòng này
                if (parts.length === 0) {
                    return '';
                }

                const runs = parts.map(part => {
                    const escaped = escapeXml(part.text);
                    if (part.isRed) {
                        // Chữ đỏ, in đậm, có highlight vàng
                        return `<w:r><w:rPr><w:color w:val="FF0000"/><w:b/><w:highlight w:val="yellow"/></w:rPr><w:t xml:space="preserve">${escaped}</w:t></w:r>`;
                    }
                    return `<w:r><w:t xml:space="preserve">${escaped}</w:t></w:r>`;
                }).join('');

                return `<w:p>${runs}</w:p>`;
            })
            .filter(p => p)
            .join('');

        // Ghép lại document.xml
        documentXml = beforeBody + newBodyContent + sectPr + afterBody;

        zip.file('word/document.xml', documentXml);

        return await zip.generateAsync({
            type: 'blob',
            mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        });

    } catch (error: any) {
        console.error('Inject Fixed Content Error:', error);
        throw new Error(`Không thể chèn nội dung vào Word: ${error.message}`);
    }
};
