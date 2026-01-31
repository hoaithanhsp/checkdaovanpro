/**
 * Word XML Injection Service - VERSION FINAL
 * FIX: Thay thế đầy đủ không cắt ngắn
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
        .replace(/&/g, '&')
        .replace(//g, '>')
        .replace(/"/g, '"')
        .replace(/'/g, ''');
};

/**
 * Normalize text để so sánh
 */
const normalizeText = (text: string): string => {
    return text
        .normalize('NFC')
        .replace(/\s+/g, ' ')
        .replace(/[\r
\t]+/g, ' ')
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
    return paragraphXml.includes('<o:oleobject') ||="" paragraphxml.includes('w:object')="" paragraphxml.includes('v:shape');="" };="" **="" *="" tìm="" và="" thay="" thế="" text="" trong="" paragraph="" chiẾn="" lƯỢc="" mỚi:="" 1.="" kiếm:="" dùng="" đoạn="" ngắn="" (50-100="" ký="" tự="" đầu)="" để="" vị="" trí="" 2.="" thế:="" toÀn="" bỘ="" bằng="" replacementtext="" ĐẦy="" ĐỦ="" 3.="" không="" cắt="" ngắn:="" giữ="" nguyên="" 100%="" nội="" dung="" const="" replacetextinparagraph="(" paragraphxml:="" string,="" originaltext:="" replacementtext:="" useshortsearch:="" boolean="false" ):="" {="" result:="" string;="" replaced:="" }=""> {

    // Bước 1: Trích xuất text đầy đủ từ paragraph
    const fullText = extractTextFromParagraph(paragraphXml);
    const normalizedFull = normalizeText(fullText);
    
    // Bước 2: Xác định text để tìm kiếm
    let searchText = originalText;
    
    // Nếu đoạn gốc quá dài (> 100 ký tự), chỉ dùng phần đầu để TÌM KIẾM
    // NHƯNG VẪN THAY THẾ TOÀN BỘ
    if (useShortSearch && originalText.length > 100) {
        const cutPoint = originalText.indexOf(' ', 50);
        if (cutPoint > 0 && cutPoint < 100) {
            searchText = originalText.substring(0, cutPoint);
            console.log(`🔍 Tìm kiếm với đoạn ngắn: "${searchText.substring(0, 40)}..."`);
        }
    }
    
    const normalizedSearch = normalizeText(searchText);
    
    // Bước 3: Kiểm tra có chứa text cần tìm không
    if (!normalizedFull.includes(normalizedSearch)) {
        return { result: paragraphXml, replaced: false };
    }
    
    // Bước 4: Tìm vị trí chính xác (case-insensitive)
    const regex = new RegExp(
        searchText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+'),
        'i'
    );
    const match = fullText.match(regex);
    
    if (!match || match.index === undefined) {
        return { result: paragraphXml, replaced: false };
    }
    
    // Bước 5: Kiểm tra OLE Object
    if (hasOleObject(paragraphXml)) {
        console.warn('⚠️ Paragraph chứa OLE Object - bỏ qua');
        return { result: paragraphXml, replaced: false };
    }
    
    // Bước 6: Xây dựng lại paragraph
    // Giữ nguyên pPr (paragraph properties)
    const pPrMatch = paragraphXml.match(/<w:ppr>[\s\S]*?<\/w:pPr>/);
    const pPr = pPrMatch ? pPrMatch[0] : '';
    
    // QUAN TRỌNG: Thay thế TOÀN BỘ paragraph bằng replacementText ĐẦY ĐỦ
    // KHÔNG cắt ngắn replacementText
    const newRuns = `<w:r><w:rpr><w:color w:val="FF0000"></w:color></w:rpr><w:t xml:space="preserve">${escapeXml(replacementText)}</w:t></w:r>`;
    
    const newParagraph = `<w:p>${pPr}${newRuns}</w:p>`;
    
    return { result: newParagraph, replaced: true };
};

/**
 * Tìm và thay thế trong toàn bộ document
 * CHIẾN LƯỢC:
 * 1. Thử tìm với text đầy đủ trước
 * 2. Nếu không thấy, thử với đoạn ngắn
 * 3. Luôn thay thế TOÀN BỘ replacementText (không cắt ngắn)
 */
const findAndReplaceInDocument = (
    documentXml: string,
    originalText: string,
    replacementText: string
): { result: string; replaced: boolean } => {

    const elementRegex = /<w:p\b[^>]*>[\s\S]*?<\/w:p>/g;
    let match;
    let modifiedXml = documentXml;
    let replaced = false;

    // BƯỚC 1: Thử tìm với text đầy đủ trước
    elementRegex.lastIndex = 0;
    while ((match = elementRegex.exec(documentXml)) !== null) {
        const element = match[0];
        
        const { result, replaced: wasReplaced } = replaceTextInParagraph(
            element,
            originalText,
            replacementText,
            false  // Không dùng short search
        );
        
        if (wasReplaced) {
            modifiedXml = modifiedXml.replace(element, result);
            replaced = true;
            console.log(`✓ Đã thay thế (full text): "${originalText.substring(0, 40)}..."`);
            break;
        }
    }

    // BƯỚC 2: Nếu không tìm thấy và đoạn dài, thử với đoạn ngắn
    if (!replaced && originalText.length > 100) {
        console.log(`🔄 Thử lại với đoạn ngắn...`);
        
        elementRegex.lastIndex = 0;
        while ((match = elementRegex.exec(documentXml)) !== null) {
            const element = match[0];
            
            const { result, replaced: wasReplaced } = replaceTextInParagraph(
                element,
                originalText,
                replacementText,
                true  // Dùng short search
            );
            
            if (wasReplaced) {
                modifiedXml = modifiedXml.replace(element, result);
                replaced = true;
                console.log(`✓ Đã thay thế (short search): "${originalText.substring(0, 40)}..."`);
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
): Promise<blob> => {
    try {
        console.log('🔧 Bắt đầu XML Injection...');
        console.log(`📝 Số lượng replacements: ${replacements.length}`);

        // 1. Giải nén file DOCX
        const zip = await JSZip.loadAsync(originalFile.arrayBuffer);

        // 2. Đọc document.xml
        const documentXmlFile = zip.file('word/document.xml');
        if (!documentXmlFile) {
            throw new Error('File DOCX không hợp lệ - thiếu document.xml');
        }

        let documentXml = await documentXmlFile.async('string');
        console.log(`📄 Đọc document.xml thành công (${documentXml.length} ký tự)`);

        // 3. Thực hiện từng thay thế
        let successCount = 0;
        let failedSegments: Array<{ original: string; replacement: string }> = [];

        for (let i = 0; i < replacements.length; i++) {
            const segment = replacements[i];
            console.log(`
--- Replacement ${i + 1}/${replacements.length} ---`);
            console.log(`Original (${segment.original.length} chars): "${segment.original.substring(0, 50)}..."`);
            console.log(`Replacement (${segment.replacement.length} chars): "${segment.replacement.substring(0, 50)}..."`);
            
            const { result, replaced } = findAndReplaceInDocument(
                documentXml,
                segment.original,
                segment.replacement
            );

            if (replaced) {
                documentXml = result;
                successCount++;
                console.log(`✅ Thành công!`);
            } else {
                failedSegments.push({
                    original: segment.original,
                    replacement: segment.replacement
                });
                console.warn(`❌ Thất bại!`);
            }
        }

        console.log(`
✅ Tổng kết: ${successCount}/${replacements.length} đoạn đã được thay thế`);

        // 4. Nếu có đoạn không tìm thấy, thêm ghi chú vào cuối file
        if (failedSegments.length > 0) {
            console.log(`⚠️ Thêm ghi chú cho ${failedSegments.length} đoạn không tìm thấy`);
            
            const noteXml = `
                <w:p><w:ppr><w:pbdr><w:top w:val="single" w:sz="12" w:space="1" w:color="FFA500"></w:top></w:pbdr></w:ppr></w:p>
                <w:p><w:r><w:rpr><w:b><w:color w:val="FFA500"></w:color></w:b></w:rpr><w:t>═══ GHI CHÚ: Một số đoạn cần sửa thủ công ═══</w:t></w:r></w:p>
                <w:p><w:r><w:t>Các đoạn sau không tìm thấy vị trí chính xác trong file, vui lòng sửa thủ công:</w:t></w:r></w:p>
                ${failedSegments.map((s, idx) => `
                    <w:p><w:r><w:rpr><w:b></w:b></w:rpr><w:t>${idx + 1}. Đoạn gốc:</w:t></w:r></w:p>
                    <w:p><w:r><w:t>${escapeXml(s.original.substring(0, 200))}${s.original.length > 200 ? '...' : ''}</w:t></w:r></w:p>
                    <w:p><w:r><w:rpr><w:b><w:color w:val="FF0000"></w:color></w:b></w:rpr><w:t>→ Sửa thành:</w:t></w:r></w:p>
                    <w:p><w:r><w:rpr><w:color w:val="FF0000"></w:color></w:rpr><w:t>${escapeXml(s.replacement.substring(0, 200))}${s.replacement.length > 200 ? '...' : ''}</w:t></w:r></w:p>
                    <w:p><w:r><w:t></w:t></w:r></w:p>
                `).join('')}
            `;

            documentXml = documentXml.replace('', noteXml + '');
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
export const readDocxForInjection = async (file: File): Promise<originaldocxfile> => {
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
 * Hàm wrapper cho AutoFixPanel
 */
export const injectFixedContentToDocx = async (
    originalFile: OriginalDocxFile,
    fixedContent: string,
    changes?: Array<{ original: string, fixed: string, type: string }>
): Promise<blob> => {
    console.log('🔧 injectFixedContentToDocx được gọi');
    console.log(`📁 File: ${originalFile.fileName}`);
    console.log(`📝 fixedContent length: ${fixedContent?.length || 0}`);
    console.log(`🔄 changes: ${changes?.length || 0}`);

    // Nếu có changes, sử dụng XML Injection
    if (changes && changes.length > 0) {
        console.log('✅ Có changes, sử dụng XML Injection');
        
        const replacements: ReplacementSegment[] = changes.map(c => ({
            original: c.original,
            replacement: c.fixed,
            type: c.type as ReplacementSegment['type']
        }));

        return injectFixesToDocx(originalFile, replacements);
    }

    // Fallback: Thay thế toàn bộ body
    console.log('⚠️ Không có changes, sử dụng fallback');
    return fallbackReplaceBody(originalFile, fixedContent);
};

/**
 * Fallback: Thay thế toàn bộ body content
 */
const fallbackReplaceBody = async (
    originalFile: OriginalDocxFile,
    fixedContent: string
): Promise<blob> => {
    try {
        console.log('🔄 Fallback: Thay thế toàn bộ body...');

        const zip = await JSZip.loadAsync(originalFile.arrayBuffer);

        const documentXmlFile = zip.file('word/document.xml');
        if (!documentXmlFile) {
            throw new Error('File DOCX không hợp lệ');
        }

        let documentXml = await documentXmlFile.async('string');

        const bodyStartMatch = documentXml.match(/<w:body[^>]*>/);
        const bodyEndIndex = documentXml.indexOf('');

        if (bodyStartMatch && bodyEndIndex > -1) {
            const beforeBody = documentXml.substring(0, bodyStartMatch.index! + bodyStartMatch[0].length);
            const afterBody = documentXml.substring(bodyEndIndex);

            const bodyContent = documentXml.substring(bodyStartMatch.index! + bodyStartMatch[0].length, bodyEndIndex);
            const sectPrMatch = bodyContent.match(/<w:sectpr[\s\s]*?<\ w:sectpr="">/);
            const sectPr = sectPrMatch ? sectPrMatch[0] : '';

            // Tạo paragraphs từ fixedContent
            const paragraphs = fixedContent.split('
').map(line => {
                if (!line.trim()) {
                    return '<w:p><w:r><w:t></w:t></w:r></w:p>';
                }

                // Xử lý thẻ <red>
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
                        runsXml += `<w:r><w:rpr><w:color w:val="FF0000"></w:color></w:rpr><w:t xml:space="preserve">${escapeXml(remaining)}</w:t></w:r>`;
                        break;
                    }

                    const redText = line.substring(openIndex + redOpenTag.length, closeIndex);
                    runsXml += `<w:r><w:rpr><w:color w:val="FF0000"></w:color></w:rpr><w:t xml:space="preserve">${escapeXml(redText)}</w:t></w:r>`;

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
</red></w:sectpr[\s\s]*?<\></w:body[^></blob></blob></originaldocxfile></blob></w:p\b[^></w:ppr></o:oleobject')></w:t[^></w:t[^>
