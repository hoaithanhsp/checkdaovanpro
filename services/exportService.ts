/**
 * Export Service - Xuất báo cáo kết quả kiểm tra SKKN
 */

import {
    Document,
    Packer,
    Paragraph,
    TextRun,
    HeadingLevel,
    Table,
    TableRow,
    TableCell,
    WidthType,
    AlignmentType,
    BorderStyle,
    ShadingType
} from 'docx';
import { saveAs } from 'file-saver';
import { AnalysisResult, SKKNInput } from '../types';

/**
 * Xuất báo cáo kết quả kiểm tra ra file Word
 */
export const exportToWord = async (
    input: SKKNInput,
    result: AnalysisResult
): Promise<void> => {
    const doc = new Document({
        sections: [{
            properties: {},
            children: [
                // Tiêu đề
                new Paragraph({
                    children: [
                        new TextRun({
                            text: "BÁO CÁO THẨM ĐỊNH SKKN",
                            bold: true,
                            size: 32,
                            color: "1E40AF"
                        })
                    ],
                    heading: HeadingLevel.TITLE,
                    alignment: AlignmentType.CENTER,
                    spacing: { after: 200 }
                }),

                new Paragraph({
                    children: [
                        new TextRun({
                            text: "SKKN Checker Pro - Trợ Lý Thẩm Định SKKN",
                            italics: true,
                            size: 20,
                            color: "6B7280"
                        })
                    ],
                    alignment: AlignmentType.CENTER,
                    spacing: { after: 400 }
                }),

                // Thông tin đề tài
                new Paragraph({
                    text: "I. THÔNG TIN ĐỀ TÀI",
                    heading: HeadingLevel.HEADING_1,
                    spacing: { before: 300, after: 200 }
                }),

                createInfoTable(input),

                // Kết quả đánh giá
                new Paragraph({
                    text: "II. KẾT QUẢ ĐÁNH GIÁ",
                    heading: HeadingLevel.HEADING_1,
                    spacing: { before: 400, after: 200 }
                }),

                createScoreTable(result),

                // Mức độ trùng lặp
                new Paragraph({
                    text: "III. KIỂM TRA TRÙNG LẶP & ĐẠO VĂN",
                    heading: HeadingLevel.HEADING_1,
                    spacing: { before: 400, after: 200 }
                }),

                new Paragraph({
                    children: [
                        new TextRun({ text: "Mức độ trùng lặp đề tài: ", bold: true }),
                        new TextRun({ text: result.duplicateLevel, color: getColorByLevel(result.duplicateLevel) })
                    ],
                    spacing: { after: 100 }
                }),

                new Paragraph({
                    children: [
                        new TextRun({ text: "Chi tiết: ", bold: true }),
                        new TextRun({ text: result.duplicateDetails })
                    ],
                    spacing: { after: 200 }
                }),

                new Paragraph({
                    children: [
                        new TextRun({ text: "Nguy cơ đạo văn: ", bold: true }),
                        new TextRun({ text: result.plagiarismRisk, color: getColorByLevel(result.plagiarismRisk) })
                    ],
                    spacing: { after: 200 }
                }),

                // Lỗi chính tả
                ...(result.spellingErrors.length > 0 ? [
                    new Paragraph({
                        text: "IV. LỖI CHÍNH TẢ & NGỮ PHÁP",
                        heading: HeadingLevel.HEADING_1,
                        spacing: { before: 400, after: 200 }
                    }),
                    new Paragraph({
                        children: [
                            new TextRun({ text: `Tổng số lỗi phát hiện: ${result.spellingErrors.length}`, bold: true })
                        ],
                        spacing: { after: 200 }
                    }),
                    ...result.spellingErrors.slice(0, 10).map((error, idx) =>
                        new Paragraph({
                            children: [
                                new TextRun({ text: `${idx + 1}. [${error.type}] `, bold: true }),
                                new TextRun({ text: `"${error.error}" → "${error.correction}"` }),
                                new TextRun({ text: ` (${error.line})`, italics: true, color: "6B7280" })
                            ],
                            spacing: { after: 100 }
                        })
                    )
                ] : []),

                // Kế hoạch phát triển
                new Paragraph({
                    text: "V. KẾ HOẠCH NÂNG CẤP SKKN",
                    heading: HeadingLevel.HEADING_1,
                    spacing: { before: 400, after: 200 }
                }),

                new Paragraph({
                    children: [new TextRun({ text: "Ngắn hạn (1-2 tuần):", bold: true })],
                    spacing: { after: 100 }
                }),
                ...result.developmentPlan.shortTerm.map(item =>
                    new Paragraph({
                        text: `• ${item}`,
                        spacing: { after: 50 }
                    })
                ),

                new Paragraph({
                    children: [new TextRun({ text: "Trung hạn (1 tháng):", bold: true })],
                    spacing: { before: 200, after: 100 }
                }),
                ...result.developmentPlan.mediumTerm.map(item =>
                    new Paragraph({
                        text: `• ${item}`,
                        spacing: { after: 50 }
                    })
                ),

                new Paragraph({
                    children: [new TextRun({ text: "Dài hạn (2-3 tháng):", bold: true })],
                    spacing: { before: 200, after: 100 }
                }),
                ...result.developmentPlan.longTerm.map(item =>
                    new Paragraph({
                        text: `• ${item}`,
                        spacing: { after: 50 }
                    })
                ),

                // Kết luận
                new Paragraph({
                    text: "VI. KẾT LUẬN",
                    heading: HeadingLevel.HEADING_1,
                    spacing: { before: 400, after: 200 }
                }),

                new Paragraph({
                    children: [new TextRun({ text: result.overallConclusion, italics: true })],
                    spacing: { after: 400 }
                }),

                // Footer
                new Paragraph({
                    children: [
                        new TextRun({
                            text: "─".repeat(50),
                            color: "D1D5DB"
                        })
                    ],
                    alignment: AlignmentType.CENTER,
                    spacing: { before: 400 }
                }),

                new Paragraph({
                    children: [
                        new TextRun({
                            text: `Báo cáo được tạo bởi SKKN Checker Pro - ${new Date().toLocaleDateString('vi-VN')}`,
                            size: 18,
                            color: "9CA3AF",
                            italics: true
                        })
                    ],
                    alignment: AlignmentType.CENTER
                })
            ]
        }]
    });

    const blob = await Packer.toBlob(doc);
    const fileName = `SKKN_Report_${new Date().toISOString().split('T')[0]}.docx`;
    saveAs(blob, fileName);
};

/**
 * Tạo bảng thông tin đề tài
 */
function createInfoTable(input: SKKNInput): Table {
    return new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
            createTableRow("Tên đề tài", input.title, true),
            createTableRow("Cấp học", input.level),
            createTableRow("Môn học / Lĩnh vực", input.subject),
            createTableRow("Mục tiêu giải", input.target),
        ]
    });
}

/**
 * Tạo bảng điểm số
 */
function createScoreTable(result: AnalysisResult): Table {
    return new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
            new TableRow({
                children: [
                    createHeaderCell("Tiêu chí"),
                    createHeaderCell("Điểm"),
                    createHeaderCell("Tối đa"),
                ]
            }),
            createScoreRow("Tính mới & Sáng tạo", result.scores.innovation, 30),
            createScoreRow("Tính khả thi & Hiệu quả", result.scores.feasibility, 40),
            createScoreRow("Tính khoa học", result.scores.scientific, 20),
            createScoreRow("Hình thức trình bày", result.scores.presentation, 10),
            new TableRow({
                children: [
                    new TableCell({
                        children: [new Paragraph({
                            children: [new TextRun({ text: "TỔNG ĐIỂM", bold: true })],
                            alignment: AlignmentType.CENTER
                        })],
                        shading: { fill: "DBEAFE", type: ShadingType.CLEAR }
                    }),
                    new TableCell({
                        children: [new Paragraph({
                            children: [new TextRun({ text: `${result.scores.total}`, bold: true, color: "1E40AF" })],
                            alignment: AlignmentType.CENTER
                        })],
                        shading: { fill: "DBEAFE", type: ShadingType.CLEAR }
                    }),
                    new TableCell({
                        children: [new Paragraph({
                            children: [new TextRun({ text: "100", bold: true })],
                            alignment: AlignmentType.CENTER
                        })],
                        shading: { fill: "DBEAFE", type: ShadingType.CLEAR }
                    }),
                ]
            })
        ]
    });
}

function createTableRow(label: string, value: string, highlight: boolean = false): TableRow {
    return new TableRow({
        children: [
            new TableCell({
                children: [new Paragraph({ children: [new TextRun({ text: label, bold: true })] })],
                width: { size: 30, type: WidthType.PERCENTAGE },
                shading: highlight ? { fill: "F3F4F6", type: ShadingType.CLEAR } : undefined
            }),
            new TableCell({
                children: [new Paragraph({ text: value })],
                shading: highlight ? { fill: "F3F4F6", type: ShadingType.CLEAR } : undefined
            })
        ]
    });
}

function createHeaderCell(text: string): TableCell {
    return new TableCell({
        children: [new Paragraph({
            children: [new TextRun({ text, bold: true, color: "FFFFFF" })],
            alignment: AlignmentType.CENTER
        })],
        shading: { fill: "1E40AF", type: ShadingType.CLEAR }
    });
}

function createScoreRow(label: string, score: number, max: number): TableRow {
    return new TableRow({
        children: [
            new TableCell({
                children: [new Paragraph({ text: label })]
            }),
            new TableCell({
                children: [new Paragraph({
                    text: `${score}`,
                    alignment: AlignmentType.CENTER
                })]
            }),
            new TableCell({
                children: [new Paragraph({
                    text: `${max}`,
                    alignment: AlignmentType.CENTER
                })]
            }),
        ]
    });
}

function getColorByLevel(level: string): string {
    switch (level.toLowerCase()) {
        case 'cao':
        case 'rất cao':
            return "DC2626"; // Red
        case 'trung bình':
            return "D97706"; // Yellow
        default:
            return "16A34A"; // Green
    }
}
