/**
 * File Service - Xử lý đọc nội dung từ file PDF và Word
 */

import * as mammoth from 'mammoth';
import * as pdfjsLib from 'pdfjs-dist';

// Cấu hình PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

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
        const arrayBuffer = await file.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer });

        if (result.value.trim().length === 0) {
            return {
                success: false,
                content: '',
                error: 'File Word không có nội dung văn bản hoặc chỉ chứa hình ảnh.'
            };
        }

        return {
            success: true,
            content: result.value,
            fileName: file.name
        };
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
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

        let fullText = '';
        const pageCount = pdf.numPages;

        for (let i = 1; i <= pageCount; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            const pageText = textContent.items
                .map((item: any) => item.str)
                .join(' ');
            fullText += pageText + '\n\n';
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
