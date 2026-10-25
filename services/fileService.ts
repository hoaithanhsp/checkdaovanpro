/**
 * File Service - Xử lý đọc nội dung từ file PDF và Word
 */

import * as mammoth from 'mammoth';
import * as pdfjsLib from 'pdfjs-dist';

// Cấu hình PDF.js worker - sử dụng CDN với phiên bản cố định
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

const MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024;
const MAX_PDF_PAGES = 60;
const MAX_EXTRACTED_CHARACTERS = 200_000;

const validateFileHeader = async (file: File): Promise<string | null> => {
    if (file.size > MAX_FILE_SIZE_BYTES) {
        return 'File vượt quá giới hạn 15 MB. Vui lòng giảm dung lượng hoặc tách tài liệu trước khi tải lên.';
    }

    const header = new Uint8Array(await file.slice(0, 8).arrayBuffer());
    const isZip = header[0] === 0x50 && header[1] === 0x4b;
    const isPdf = new TextDecoder().decode(header).startsWith('%PDF-');
    const fileName = file.name.toLowerCase();

    if (fileName.endsWith('.docx') && !isZip) {
        return 'File .docx không có cấu trúc ZIP hợp lệ hoặc đã bị hỏng.';
    }
    if (fileName.endsWith('.pdf') && !isPdf) {
        return 'File .pdf không có chữ ký PDF hợp lệ hoặc đã bị hỏng.';
    }
    return null;
};

export interface FileReadResult {
    success: boolean;
    content: string;
    error?: string;
    fileName?: string;
    pageCount?: number;
}

/**
 * Đọc nội dung từ file Word (.docx)
 */
export const extractTextFromDocx = async (file: File): Promise<FileReadResult> => {
    try {
        const validationError = await validateFileHeader(file);
        if (validationError) return { success: false, content: '', error: validationError };
        const arrayBuffer = await file.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer });
        const content = result.value.trim();

        if (content.length === 0) {
            return {
                success: false,
                content: '',
                error: 'File Word không có nội dung văn bản hoặc chỉ chứa hình ảnh.'
            };
        }
        if (content.length > MAX_EXTRACTED_CHARACTERS) {
            return {
                success: false,
                content: '',
                error: 'Nội dung sau khi trích xuất vượt quá 200.000 ký tự. Vui lòng tách tài liệu thành các phần nhỏ hơn.'
            };
        }

        return { success: true, content, fileName: file.name };
    } catch (error: any) {
        console.error('Error reading DOCX:', error);
        return {
            success: false,
            content: '',
            error: `Không thể đọc file Word: ${error.message || 'Lỗi không xác định'}`
        };
    }
};

/**
 * Đọc nội dung từ file PDF
 */
export const extractTextFromPdf = async (file: File): Promise<FileReadResult> => {
    try {
        const validationError = await validateFileHeader(file);
        if (validationError) return { success: false, content: '', error: validationError };
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

        let fullText = '';
        const pageCount = pdf.numPages;
        if (pageCount > MAX_PDF_PAGES) {
            return {
                success: false,
                content: '',
                pageCount,
                error: `File PDF có ${pageCount} trang, vượt giới hạn ${MAX_PDF_PAGES} trang. Vui lòng tách tài liệu.`
            };
        }

        for (let i = 1; i <= pageCount; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            const pageText = textContent.items
                .map((item: any) => item.str)
                .join(' ');
            fullText += pageText + '\n\n';
            if (fullText.length > MAX_EXTRACTED_CHARACTERS) {
                return {
                    success: false,
                    content: '',
                    pageCount,
                    error: 'Nội dung sau khi trích xuất vượt quá 200.000 ký tự. Vui lòng tách tài liệu thành các phần nhỏ hơn.'
                };
            }
        }

        if (fullText.trim().length === 0) {
            return {
                success: false,
                content: '',
                error: 'File PDF không có nội dung văn bản. Có thể đây là file scan/hình ảnh.'
            };
        }

        return {
            success: true,
            content: fullText.trim(),
            fileName: file.name,
            pageCount
        };
    } catch (error: any) {
        console.error('Error reading PDF:', error);
        return {
            success: false,
            content: '',
            error: `Không thể đọc file PDF: ${error.message || 'Lỗi không xác định'}`
        };
    }
};

/**
 * Xử lý file tự động dựa trên loại file
 */
export const extractTextFromFile = async (file: File): Promise<FileReadResult> => {
    const fileName = file.name.toLowerCase();

    if (fileName.endsWith('.docx')) {
        return extractTextFromDocx(file);
    } else if (fileName.endsWith('.pdf')) {
        return extractTextFromPdf(file);
    } else if (fileName.endsWith('.doc')) {
        return {
            success: false,
            content: '',
            error: 'File .doc (Word 97-2003) không được hỗ trợ. Vui lòng chuyển sang định dạng .docx'
        };
    } else {
        return {
            success: false,
            content: '',
            error: 'Định dạng file không được hỗ trợ. Vui lòng sử dụng file .pdf hoặc .docx'
        };
    }
};
