import React, { useState } from 'react';
import { X, Wand2, Check, FileText, AlertCircle, Copy, Download, ChevronDown, ChevronUp, FileEdit, FileBarChart } from 'lucide-react';
import { autoFixSKKN, AutoFixResult } from '../services/geminiService';
import { AnalysisResult, OriginalDocxFile } from '../types';
import { injectFixesToDocx, ReplacementSegment, injectFixedContentToDocx } from '../services/wordInjectionService';
import { normalizeVietnameseText } from '../services/textNormalizerService';
import FileSaver from 'file-saver';
import {
    Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell,
    WidthType, AlignmentType, ShadingType
} from 'docx';
// jspdf & jspdf-autotable: dynamic import trong handleExportReportPdf

interface AutoFixPanelProps {
    isOpen: boolean;
    onClose: () => void;
    originalContent: string;
    analysisResult: AnalysisResult;
    originalDocx?: OriginalDocxFile; // File Word gốc cho XML Injection
}

const AutoFixPanel: React.FC<AutoFixPanelProps> = ({
    isOpen,
    onClose,
    originalContent,
    analysisResult,
    originalDocx
}) => {
    const [isProcessing, setIsProcessing] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    const [result, setResult] = useState<AutoFixResult | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [showChanges, setShowChanges] = useState(true);
    const [copied, setCopied] = useState(false);
    const [normalizeText, setNormalizeText] = useState(true); // Chuẩn hóa văn bản trước khi sửa

    const handleAutoFix = async () => {
        setIsProcessing(true);
        setError(null);

        try {
            // Chuẩn hóa văn bản trước nếu option được bật
            const contentToFix = normalizeText
                ? normalizeVietnameseText(originalContent)
                : originalContent;

            const fixResult = await autoFixSKKN(contentToFix, {
                spellingErrors: analysisResult.spellingErrors,
                plagiarismSegments: analysisResult.plagiarismSegments,
                scoreDetails: analysisResult.scoreDetails,
                aiRiskScore: analysisResult.aiRiskScore,
                aiRiskDetails: analysisResult.aiRiskDetails
            });

            // Kiểm tra nếu AI trả về fixedContent ngắn hơn đáng kể so với nội dung gốc
            // (dấu hiệu bị cắt/thiếu nội dung)
            const cleanFixed = fixResult.fixedContent
                .replace(/<red>/g, '').replace(/<\/red>/g, '');
            const ratio = cleanFixed.length / contentToFix.length;

            if (ratio < 0.8 && contentToFix.length > 5000) {
                console.warn(`⚠️ fixedContent chỉ có ${Math.round(ratio * 100)}% so với bản gốc. Nối thêm phần còn lại.`);
                // Tìm điểm cuối cùng của fixedContent trong originalContent
                // và nối thêm phần chưa được sửa
                const lastChunk = cleanFixed.substring(cleanFixed.length - 100).trim();
                const lastChunkIdx = contentToFix.indexOf(lastChunk.substring(0, 50));

                if (lastChunkIdx > 0) {
                    const appendFromIdx = lastChunkIdx + lastChunk.length;
                    if (appendFromIdx < contentToFix.length) {
                        const remainingContent = contentToFix.substring(appendFromIdx);
                        fixResult.fixedContent += '\n' + remainingContent;
                        console.log(`✓ Đã nối thêm ${remainingContent.length} ký tự còn thiếu`);
                    }
                } else {
                    // Fallback: nối thêm phần sau dựa trên tỷ lệ
                    const cutPoint = Math.floor(contentToFix.length * ratio);
                    const remainingContent = contentToFix.substring(cutPoint);
                    fixResult.fixedContent += '\n' + remainingContent;
                    console.log(`✓ Fallback: nối thêm ${remainingContent.length} ký tự từ vị trí ${cutPoint}`);
                }
            }

            setResult(fixResult);
        } catch (err: any) {
            setError(err.message || 'Đã xảy ra lỗi khi sửa SKKN');
        } finally {
            setIsProcessing(false);
        }
    };

    /**
     * Chuyển đổi bảng Markdown thành HTML table
     */
    const markdownTableToHtml = (text: string): string => {
        const lines = text.split('\n');
        let result: string[] = [];
        let inTable = false;
        let tableRows: string[] = [];

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();

            // Phát hiện dòng bảng (bắt đầu và kết thúc bằng |)
            if (line.startsWith('|') && line.endsWith('|')) {
                // Bỏ qua dòng separator (|---|---|)
                if (/^\|[\s:-]+\|$/.test(line.replace(/\|/g, '|').replace(/[-:]+/g, '-'))) {
                    continue;
                }

                if (!inTable) {
                    inTable = true;
                    tableRows = [];
                }
                tableRows.push(line);
            } else {
                // Kết thúc bảng
                if (inTable && tableRows.length > 0) {
                    result.push(convertRowsToTable(tableRows));
                    tableRows = [];
                    inTable = false;
                }
                result.push(line);
            }
        }

        // Xử lý bảng cuối cùng nếu có
        if (inTable && tableRows.length > 0) {
            result.push(convertRowsToTable(tableRows));
        }

        return result.join('\n');
    };

    const convertRowsToTable = (rows: string[]): string => {
        let html = '<table style="border-collapse: collapse; width: 100%; margin: 10px 0;">';

        rows.forEach((row, rowIndex) => {
            const cells = row.split('|').filter(cell => cell.trim() !== '');
            const isHeader = rowIndex === 0;
            const cellTag = isHeader ? 'th' : 'td';
            const bgColor = isHeader ? 'background-color: #f0f0f0;' : '';

            html += '<tr>';
            cells.forEach(cell => {
                const cellContent = cell.trim()
                    .replace(/<red>/g, '<span style="color: red;">')
                    .replace(/<\/red>/g, '</span>');
                html += `<${cellTag} style="border: 1px solid #333; padding: 8px; ${bgColor}">${cellContent}</${cellTag}>`;
            });
            html += '</tr>';
        });

        html += '</table>';
        return html;
    };

    const handleCopy = async () => {
        if (result?.fixedContent) {
            try {
                // Bước 1: Chuyển markdown table thành HTML table
                let processedContent = markdownTableToHtml(result.fixedContent);

                // Bước 2: Chuyển đổi thẻ <red> thành HTML với màu đỏ (cho text ngoài bảng)
                processedContent = processedContent
                    .replace(/<red>/g, '<span style="color: red;">')
                    .replace(/<\/red>/g, '</span>')
                    .replace(/\n/g, '<br>');

                const htmlBlob = new Blob([`
                    <html>
                    <body>
                    <div style="font-family: Times New Roman, serif; font-size: 13pt;">
                    ${processedContent}
                    </div>
                    </body>
                    </html>
                `], { type: 'text/html' });

                // Cũng copy plain text (không có thẻ <red>)
                const plainText = result.fixedContent
                    .replace(/<red>/g, '')
                    .replace(/<\/red>/g, '');
                const textBlob = new Blob([plainText], { type: 'text/plain' });

                // Sử dụng ClipboardItem để copy cả HTML và plain text
                const clipboardItem = new ClipboardItem({
                    'text/html': htmlBlob,
                    'text/plain': textBlob
                });

                await navigator.clipboard.write([clipboardItem]);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
            } catch (err) {
                // Fallback: chỉ copy plain text nếu ClipboardItem không được hỗ trợ
                console.warn('ClipboardItem API không hỗ trợ, dùng fallback:', err);
                const plainText = result.fixedContent
                    .replace(/<red>/g, '')
                    .replace(/<\/red>/g, '');
                await navigator.clipboard.writeText(plainText);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
            }
        }
    };

    /**
     * Strip markdown và <red> tags để xuất file sạch
     */
    const stripMdAndRed = (str: string): string => {
        let s = str
            .replace(/\*\*(.*?)\*\*/g, '$1')
            .replace(/(^|\n)\*\s/g, '$1- ')
            .replace(/\*/g, '');
        // Xóa tag <red>
        s = s.replace(/<red>/g, '').replace(/<\/red>/g, '');
        // Deep unescape HTML entities
        for (let i = 0; i < 5; i++) {
            const next = s
                .replace(/&amp;/g, '&')
                .replace(/&lt;/g, '<')
                .replace(/&gt;/g, '>')
                .replace(/&quot;/g, '"')
                .replace(/&apos;/g, "'");
            if (next === s) break;
            s = next;
        }
        // Xóa lại tag <red> sau unescape
        s = s.replace(/<red>/g, '').replace(/<\/red>/g, '');
        return s;
    };

    /**
     * Xuất Word với XML Injection (giữ nguyên OLE Objects, hình ảnh, công thức)
     * KHÔNG bôi đỏ phần đã sửa - chỉ thay thế text sạch
     */
    const handleExportWithInjection = async () => {
        if (!result || !originalDocx) return;

        setIsExporting(true);
        try {
            // Xóa <red> tags và markdown trước khi truyền vào injection
            // Để file Word xuất ra KHÔNG bôi đỏ phần đã sửa
            const cleanChanges = result.changes.map(c => ({
                original: stripMdAndRed(c.original),
                fixed: stripMdAndRed(c.fixed),
                type: c.type,
            }));
            const cleanFixedContent = stripMdAndRed(result.fixedContent);

            const blob = await injectFixedContentToDocx(
                originalDocx,
                cleanFixedContent,
                cleanChanges
            );
            const newFileName = originalDocx.fileName.replace('.docx', '_DA_SUA.docx');
            FileSaver.saveAs(blob, newFileName);

            console.log('✓ Xuất thành công với XML Injection (không bôi đỏ), giữ nguyên OLE objects');
        } catch (err: any) {
            console.error('Xuất Word thất bại:', err);
            setError(`Không thể xuất file Word: ${err.message}`);
        } finally {
            setIsExporting(false);
        }
    };

    /**
     * Xuất Word mới (fallback khi không có file gốc)
     */
    const handleExportNewWord = async () => {
        if (!result) return;

        setIsExporting(true);
        try {
            const blob = new Blob([result.fixedContent], { type: 'text/plain' });
            FileSaver.saveAs(blob, 'SKKN_DA_SUA.txt');
            console.log('✓ Đã xuất file text');
        } catch (err: any) {
            setError(`Không thể xuất file: ${err.message}`);
        } finally {
            setIsExporting(false);
        }
    };

    /**
     * Xuất báo cáo dạng Word (.docx)
     */
    const handleExportReportWord = async () => {
        if (!result) return;
        setIsExporting(true);
        try {
            const children: (Paragraph | Table)[] = [];

            // Tiêu đề
            children.push(new Paragraph({
                children: [new TextRun({ text: 'BÁO CÁO SỬA CHỮA SKKN TỰ ĐỘNG', bold: true, size: 32, font: 'Times New Roman' })],
                heading: HeadingLevel.HEADING_1,
                alignment: AlignmentType.CENTER,
                spacing: { after: 300 },
            }));

            children.push(new Paragraph({
                children: [new TextRun({ text: `Ngày xuất: ${new Date().toLocaleDateString('vi-VN')}`, size: 22, font: 'Times New Roman', italics: true })],
                alignment: AlignmentType.CENTER,
                spacing: { after: 200 },
            }));

            // Bảng tổng hợp
            children.push(new Paragraph({
                children: [new TextRun({ text: 'TỔNG HỢP KẾT QUẢ SỬA CHỮA', bold: true, size: 26, font: 'Times New Roman' })],
                heading: HeadingLevel.HEADING_2,
                spacing: { before: 300, after: 150 },
            }));

            const summaryHeaderRow = new TableRow({
                children: ['Hạng mục', 'Số lượng'].map(text =>
                    new TableCell({
                        children: [new Paragraph({ children: [new TextRun({ text, bold: true, size: 22, font: 'Times New Roman' })] })],
                        shading: { type: ShadingType.SOLID, color: 'D9D9D9' },
                        width: { size: 50, type: WidthType.PERCENTAGE },
                    })
                ),
            });

            const summaryData = [
                ['Lỗi chính tả đã sửa', `${result.summary.spellingFixed}`],
                ['Đoạn đạo văn viết lại', `${result.summary.plagiarismRewritten}`],
                ['Câu cải thiện cấu trúc', `${result.summary.structureImproved}`],
                ['Từ vựng nâng cấp', `${result.summary.vocabularyEnhanced}`],
                ['Đoạn giảm AI', `${result.summary.aiRiskReduced ?? 0}`],
                ['Tổng thay đổi', `${result.changes.length}`],
            ];

            const summaryRows = summaryData.map(([label, value]) =>
                new TableRow({
                    children: [
                        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: label, size: 22, font: 'Times New Roman' })] })], width: { size: 60, type: WidthType.PERCENTAGE } }),
                        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: value, size: 22, font: 'Times New Roman', bold: true })] })], width: { size: 40, type: WidthType.PERCENTAGE } }),
                    ],
                })
            );

            children.push(new Table({ rows: [summaryHeaderRow, ...summaryRows], width: { size: 100, type: WidthType.PERCENTAGE } }));

            // Chi tiết thay đổi
            children.push(new Paragraph({
                children: [new TextRun({ text: 'CHI TIẾT CÁC THAY ĐỔI', bold: true, size: 26, font: 'Times New Roman' })],
                heading: HeadingLevel.HEADING_2,
                spacing: { before: 300, after: 150 },
            }));

            const detailHeaderRow = new TableRow({
                children: ['STT', 'Loại', 'Nội dung gốc', 'Nội dung đã sửa', 'Lý do'].map((text, idx) =>
                    new TableCell({
                        children: [new Paragraph({ children: [new TextRun({ text, bold: true, size: 20, font: 'Times New Roman' })] })],
                        shading: { type: ShadingType.SOLID, color: 'D9D9D9' },
                        width: { size: idx === 0 ? 5 : idx === 4 ? 20 : 25, type: WidthType.PERCENTAGE },
                    })
                ),
            });

            const detailRows = result.changes.map((change, i) => {
                const typeLabel = getTypeLabel(change.type);
                return new TableRow({
                    children: [
                        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: `${i + 1}`, size: 20, font: 'Times New Roman' })] })], width: { size: 5, type: WidthType.PERCENTAGE } }),
                        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: typeLabel.text, size: 20, font: 'Times New Roman' })] })], width: { size: 10, type: WidthType.PERCENTAGE } }),
                        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: (change.original || '').substring(0, 200), size: 20, font: 'Times New Roman' })] })], width: { size: 30, type: WidthType.PERCENTAGE } }),
                        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: stripMdAndRed(change.fixed || '').substring(0, 200), size: 20, font: 'Times New Roman' })] })], width: { size: 30, type: WidthType.PERCENTAGE } }),
                        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: change.reason || '', size: 20, font: 'Times New Roman' })] })], width: { size: 25, type: WidthType.PERCENTAGE } }),
                    ],
                });
            });

            children.push(new Table({ rows: [detailHeaderRow, ...detailRows], width: { size: 100, type: WidthType.PERCENTAGE } }));

            const doc = new Document({ sections: [{ properties: {}, children }] });
            const blob = await Packer.toBlob(doc);
            FileSaver.saveAs(blob, `Bao_cao_sua_SKKN_${new Date().toISOString().slice(0, 10)}.docx`);
        } catch (err: any) {
            setError(`Không thể xuất báo cáo: ${err.message}`);
        } finally {
            setIsExporting(false);
        }
    };

    /**
     * Xuất báo cáo dạng PDF
     */
    const handleExportReportPdf = async () => {
        if (!result) return;
        setIsExporting(true);
        try {
            // Dynamic import để tránh lỗi Vite/Rollup build
            const { default: jsPDF } = await import('jspdf');
            const { default: autoTable } = await import('jspdf-autotable');
            const doc = new jsPDF('p', 'mm', 'a4');

            // Tiêu đề
            doc.setFontSize(18);
            doc.setFont('helvetica', 'bold');
            doc.text('BAO CAO SUA CHUA SKKN TU DONG', doc.internal.pageSize.getWidth() / 2, 20, { align: 'center' });

            doc.setFontSize(10);
            doc.setFont('helvetica', 'italic');
            doc.text(`Ngay xuat: ${new Date().toLocaleDateString('vi-VN')}`, doc.internal.pageSize.getWidth() / 2, 28, { align: 'center' });

            // Bảng tổng hợp
            doc.setFontSize(13);
            doc.setFont('helvetica', 'bold');
            doc.text('TONG HOP KET QUA', 14, 40);

            autoTable(doc, {
                startY: 44,
                head: [['Hang muc', 'So luong']],
                body: [
                    ['Loi chinh ta da sua', `${result.summary.spellingFixed}`],
                    ['Doan dao van viet lai', `${result.summary.plagiarismRewritten}`],
                    ['Cau cai thien cau truc', `${result.summary.structureImproved}`],
                    ['Tu vung nang cap', `${result.summary.vocabularyEnhanced}`],
                    ['Doan giam AI', `${result.summary.aiRiskReduced ?? 0}`],
                    ['Tong thay doi', `${result.changes.length}`],
                ],
                styles: { fontSize: 10 },
                headStyles: { fillColor: [100, 100, 100] },
            });

            // Bảng chi tiết
            const finalY = (doc as any).lastAutoTable?.finalY || 100;
            doc.setFontSize(13);
            doc.setFont('helvetica', 'bold');
            doc.text('CHI TIET CAC THAY DOI', 14, finalY + 10);

            const detailBody = result.changes.map((change, i) => {
                const typeLabel = getTypeLabel(change.type);
                return [
                    `${i + 1}`,
                    typeLabel.text,
                    (change.original || '').substring(0, 100),
                    stripMdAndRed(change.fixed || '').substring(0, 100),
                    change.reason || '',
                ];
            });

            autoTable(doc, {
                startY: finalY + 14,
                head: [['STT', 'Loai', 'Noi dung goc', 'Noi dung da sua', 'Ly do']],
                body: detailBody,
                styles: { fontSize: 8, cellPadding: 2 },
                headStyles: { fillColor: [100, 100, 100] },
                columnStyles: {
                    0: { cellWidth: 10 },
                    1: { cellWidth: 20 },
                    2: { cellWidth: 55 },
                    3: { cellWidth: 55 },
                    4: { cellWidth: 40 },
                },
            });

            doc.save(`Bao_cao_sua_SKKN_${new Date().toISOString().slice(0, 10)}.pdf`);
        } catch (err: any) {
            setError(`Không thể xuất PDF: ${err.message}`);
        } finally {
            setIsExporting(false);
        }
    };

    const getTypeLabel = (type: string) => {
        switch (type) {
            case 'spelling': return { text: 'Chính tả', color: 'bg-blue-100 text-blue-700' };
            case 'plagiarism': return { text: 'Đạo văn', color: 'bg-red-100 text-red-700' };
            case 'structure': return { text: 'Cấu trúc', color: 'bg-purple-100 text-purple-700' };
            case 'vocabulary': return { text: 'Từ vựng', color: 'bg-green-100 text-green-700' };
            case 'ai_detection': return { text: 'Giảm AI', color: 'bg-orange-100 text-orange-700' };
            default: return { text: type, color: 'bg-gray-100 text-gray-700' };
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden">
                {/* Header */}
                <div className="bg-gradient-to-r from-purple-600 to-indigo-600 p-6 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                            <Wand2 size={24} className="text-white" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-white">Tự động Sửa SKKN</h2>
                            <p className="text-purple-100 text-sm">AI sẽ tự động sửa tất cả lỗi và cải thiện nội dung</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
                    >
                        <X size={20} className="text-white" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    {!result && !isProcessing && (
                        <div className="text-center py-12">
                            <div className="w-20 h-20 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-6">
                                <Wand2 size={40} className="text-purple-600" />
                            </div>
                            <h3 className="text-xl font-bold text-gray-800 mb-3">Sẵn sàng sửa tự động</h3>
                            <p className="text-gray-500 mb-2">AI sẽ tự động sửa các lỗi sau:</p>
                            <div className="flex flex-wrap justify-center gap-3 mb-8">
                                <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm">
                                    {analysisResult.spellingErrors.length} lỗi chính tả
                                </span>
                                <span className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-sm">
                                    {analysisResult.plagiarismSegments.length} đoạn đạo văn
                                </span>
                                <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm">
                                    Cải thiện cấu trúc câu
                                </span>
                                <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm">
                                    Nâng cấp từ vựng
                                </span>
                                {(analysisResult.aiRiskScore ?? 0) > 15 && (
                                    <span className="px-3 py-1 bg-orange-100 text-orange-700 rounded-full text-sm font-semibold">
                                        🤖 Giảm nguy cơ AI ({analysisResult.aiRiskScore}% → &lt;15%)
                                    </span>
                                )}
                            </div>

                            {/* Option chuẩn hóa văn bản */}
                            <div className="flex items-center justify-center gap-2 mb-6">
                                <input
                                    type="checkbox"
                                    id="normalizeText"
                                    checked={normalizeText}
                                    onChange={(e) => setNormalizeText(e.target.checked)}
                                    className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500"
                                />
                                <label htmlFor="normalizeText" className="text-sm text-gray-600">
                                    Chuẩn hóa văn bản trước khi sửa (sửa lỗi viết hoa, bullet points)
                                </label>
                            </div>

                            {/* Note hướng dẫn */}
                            <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 mb-6 max-w-2xl mx-auto">
                                <p className="text-xs text-amber-700 leading-relaxed">
                                    <span className="font-semibold">📌 Note:</span> Phần chỉnh sửa sẽ được bôi <span className="text-red-600 font-semibold">đỏ</span> ở chế độ preview trên app, thầy cô copy dán vào SKKN trong trường hợp file Word xuất ra không đủ đoạn văn (do giới hạn ký tự tiêu chuẩn xử lý của AI).
                                </p>
                            </div>

                            <button
                                onClick={handleAutoFix}
                                className="px-8 py-4 bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-bold rounded-full hover:shadow-lg transform hover:scale-105 transition-all flex items-center gap-3 mx-auto"
                            >
                                <Wand2 size={20} />
                                BẮT ĐẦU SỬA TỰ ĐỘNG
                            </button>
                        </div>
                    )}

                    {isProcessing && (
                        <div className="text-center py-12">
                            <div className="w-20 h-20 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-6 animate-pulse">
                                <Wand2 size={40} className="text-purple-600 animate-spin" />
                            </div>
                            <h3 className="text-xl font-bold text-gray-800 mb-3">Đang sửa SKKN...</h3>
                            <p className="text-gray-500">AI đang phân tích và sửa từng đoạn, vui lòng đợi...</p>
                            <div className="mt-6 flex justify-center">
                                <div className="w-64 h-2 bg-gray-200 rounded-full overflow-hidden">
                                    <div className="h-full bg-gradient-to-r from-purple-500 to-indigo-500 animate-progress"></div>
                                </div>
                            </div>
                        </div>
                    )}

                    {error && (
                        <div className="bg-red-50 border border-red-200 rounded-xl p-6 flex items-start gap-4">
                            <AlertCircle className="text-red-500 flex-shrink-0" size={24} />
                            <div>
                                <h4 className="font-bold text-red-700 mb-1">Đã xảy ra lỗi</h4>
                                <p className="text-red-600">{error}</p>
                                <button
                                    onClick={handleAutoFix}
                                    className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                                >
                                    Thử lại
                                </button>
                            </div>
                        </div>
                    )}

                    {result && (
                        <div className="space-y-6">
                            {/* Summary */}
                            <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl p-6">
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center">
                                        <Check size={20} className="text-white" />
                                    </div>
                                    <h3 className="text-lg font-bold text-green-800">Đã hoàn thành sửa SKKN!</h3>
                                </div>
                                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                                    <div className="bg-white rounded-lg p-4 text-center">
                                        <div className="text-2xl font-bold text-blue-600">{result.summary.spellingFixed}</div>
                                        <div className="text-sm text-gray-500">Lỗi chính tả</div>
                                    </div>
                                    <div className="bg-white rounded-lg p-4 text-center">
                                        <div className="text-2xl font-bold text-red-600">{result.summary.plagiarismRewritten}</div>
                                        <div className="text-sm text-gray-500">Đoạn đạo văn</div>
                                    </div>
                                    <div className="bg-white rounded-lg p-4 text-center">
                                        <div className="text-2xl font-bold text-purple-600">{result.summary.structureImproved}</div>
                                        <div className="text-sm text-gray-500">Câu cải thiện</div>
                                    </div>
                                    <div className="bg-white rounded-lg p-4 text-center">
                                        <div className="text-2xl font-bold text-green-600">{result.summary.vocabularyEnhanced}</div>
                                        <div className="text-sm text-gray-500">Từ nâng cấp</div>
                                    </div>
                                    <div className="bg-white rounded-lg p-4 text-center">
                                        <div className="text-2xl font-bold text-orange-600">{result.summary.aiRiskReduced ?? 0}</div>
                                        <div className="text-sm text-gray-500">Đoạn giảm AI</div>
                                    </div>
                                </div>

                                {/* Nút xuất báo cáo */}
                                <div className="flex flex-wrap gap-3 pt-2">
                                    <button
                                        onClick={handleExportReportWord}
                                        disabled={isExporting}
                                        className="flex items-center gap-1.5 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                                    >
                                        <FileBarChart size={16} />
                                        {isExporting ? 'Đang xuất...' : 'Xuất báo cáo Word (.docx)'}
                                    </button>
                                    <button
                                        onClick={handleExportReportPdf}
                                        disabled={isExporting}
                                        className="flex items-center gap-1.5 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                                    >
                                        <FileText size={16} />
                                        {isExporting ? 'Đang xuất...' : 'Xuất báo cáo PDF'}
                                    </button>
                                </div>
                            </div>

                            {/* Changes List */}
                            {result.changes.length > 0 && (
                                <div className="border border-gray-200 rounded-xl overflow-hidden">
                                    <button
                                        onClick={() => setShowChanges(!showChanges)}
                                        className="w-full px-6 py-4 bg-gray-50 flex items-center justify-between hover:bg-gray-100 transition-colors"
                                    >
                                        <span className="font-semibold text-gray-700">
                                            Chi tiết các thay đổi ({result.changes.length})
                                        </span>
                                        {showChanges ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                                    </button>
                                    {showChanges && (
                                        <div className="divide-y">
                                            {result.changes.map((change, index) => {
                                                const typeInfo = getTypeLabel(change.type);
                                                return (
                                                    <div key={index} className="p-4 hover:bg-gray-50">
                                                        <div className="flex items-center gap-2 mb-2">
                                                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${typeInfo.color}`}>
                                                                {typeInfo.text}
                                                            </span>
                                                            <span className="text-sm text-gray-500">{change.reason}</span>
                                                        </div>
                                                        <div className="grid md:grid-cols-2 gap-4">
                                                            <div className="bg-red-50 rounded-lg p-3">
                                                                <div className="text-xs text-red-500 mb-1 font-medium">Gốc:</div>
                                                                <p className="text-sm text-gray-700 line-through">{change.original}</p>
                                                            </div>
                                                            <div className="bg-green-50 rounded-lg p-3">
                                                                <div className="text-xs text-green-500 mb-1 font-medium">Đã sửa:</div>
                                                                <p className="text-sm text-gray-700">{change.fixed}</p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Fixed Content Preview */}
                            <div className="border border-gray-200 rounded-xl overflow-hidden">
                                <div className="px-6 py-4 bg-gray-50 flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <FileText size={18} className="text-gray-500" />
                                        <span className="font-semibold text-gray-700">Nội dung SKKN đã sửa</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={handleCopy}
                                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${copied ? 'bg-green-100 text-green-700' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                                                }`}
                                        >
                                            {copied ? <Check size={16} /> : <Copy size={16} />}
                                            {copied ? 'Đã sao chép' : 'Sao chép'}
                                        </button>
                                        {originalDocx ? (
                                            <button
                                                onClick={handleExportWithInjection}
                                                disabled={isExporting}
                                                className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white rounded-lg text-sm font-medium transition-all disabled:opacity-50"
                                                title="Xuất vào file gốc, giữ nguyên công thức và hình ảnh"
                                            >
                                                <FileEdit size={16} />
                                                {isExporting ? 'Đang xuất...' : 'Xuất Word (Giữ gốc)'}
                                            </button>
                                        ) : (
                                            <button
                                                onClick={handleExportNewWord}
                                                disabled={isExporting}
                                                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                                            >
                                                <Download size={16} />
                                                {isExporting ? 'Đang xuất...' : 'Xuất Text'}
                                            </button>
                                        )}
                                    </div>
                                </div>
                                <div className="p-6 max-h-96 overflow-y-auto">
                                    <div
                                        className="whitespace-pre-wrap text-sm text-gray-700 font-sans leading-relaxed"
                                        dangerouslySetInnerHTML={{
                                            __html: result.fixedContent
                                                .replace(/</g, '&lt;')
                                                .replace(/>/g, '&gt;')
                                                .replace(/&lt;red&gt;/g, '<span style="color: #dc2626; background-color: #fef2f2; padding: 1px 4px; border-radius: 3px; font-weight: 600;">')
                                                .replace(/&lt;\/red&gt;/g, '</span>')
                                        }}
                                    />
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <style>{`
        @keyframes progress {
          0% { width: 0%; }
          50% { width: 70%; }
          100% { width: 100%; }
        }
        .animate-progress {
          animation: progress 3s ease-in-out infinite;
        }
      `}</style>
        </div>
    );
};

export default AutoFixPanel;
