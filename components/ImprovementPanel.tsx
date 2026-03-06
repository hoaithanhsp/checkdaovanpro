import React, { useState } from 'react';
import { X, BarChart3, AlertTriangle, CheckCircle, Clock, Zap, ChevronDown, ChevronUp, Download, Wrench, Star, Target } from 'lucide-react';
import { ImprovementAnalysisResult, DetectedIssue, ImprovementCriterion, SKKNInput, OriginalDocxFile } from '../types';
import { analyzeForImprovement } from '../services/geminiService';
import { PRIORITY_MATRIX } from '../data/improvementDatabase';
import {
    Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell,
    WidthType, AlignmentType, BorderStyle, ShadingType
} from 'docx';
import FileSaver from 'file-saver';

interface ImprovementPanelProps {
    isOpen: boolean;
    onClose: () => void;
    originalContent: string;
    input?: SKKNInput;
    originalDocx?: OriginalDocxFile;
    onStartAutoFix?: (result: ImprovementAnalysisResult) => void;
}

const ImprovementPanel: React.FC<ImprovementPanelProps> = ({
    isOpen, onClose, originalContent, input, onStartAutoFix
}) => {
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [result, setResult] = useState<ImprovementAnalysisResult | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [expandedIssues, setExpandedIssues] = useState<Set<string>>(new Set());
    const [isExporting, setIsExporting] = useState(false);

    const handleAnalyze = async () => {
        setIsAnalyzing(true);
        setError(null);
        try {
            const analysisResult = await analyzeForImprovement(originalContent, {
                title: input?.title,
                subject: input?.subject,
                level: input?.level,
            });
            setResult(analysisResult);
        } catch (err: any) {
            setError(err.message || 'Đã xảy ra lỗi khi phân tích');
        } finally {
            setIsAnalyzing(false);
        }
    };

    const toggleIssue = (issueId: string) => {
        setExpandedIssues(prev => {
            const next = new Set(prev);
            if (next.has(issueId)) next.delete(issueId);
            else next.add(issueId);
            return next;
        });
    };

    const getSeverityColor = (severity: string) => {
        switch (severity) {
            case 'critical': return 'text-red-600 bg-red-50 border-red-200';
            case 'high': return 'text-orange-600 bg-orange-50 border-orange-200';
            case 'medium': return 'text-blue-600 bg-blue-50 border-blue-200';
            case 'low': return 'text-gray-600 bg-gray-50 border-gray-200';
            default: return 'text-gray-600 bg-gray-50 border-gray-200';
        }
    };

    const getSeverityLabel = (severity: string) => {
        switch (severity) {
            case 'critical': return '⭐⭐⭐ Khẩn cấp';
            case 'high': return '⭐⭐ Cao';
            case 'medium': return '⭐ Trung bình';
            case 'low': return 'Thấp';
            default: return severity;
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'excellent': return '#10B981';
            case 'good': return '#3B82F6';
            case 'average': return '#F59E0B';
            case 'weak': return '#EF4444';
            case 'critical': return '#991B1B';
            default: return '#6B7280';
        }
    };

    const handleExportReport = async () => {
        if (!result) return;
        setIsExporting(true);
        try {
            const children: (Paragraph | Table)[] = [];

            children.push(new Paragraph({
                children: [new TextRun({ text: 'BÁO CÁO ĐỀ XUẤT CẢI THIỆN SKKN', bold: true, size: 32, font: 'Times New Roman' })],
                heading: HeadingLevel.HEADING_1,
                alignment: AlignmentType.CENTER,
                spacing: { after: 300 },
            }));

            if (input?.title) {
                children.push(new Paragraph({
                    children: [new TextRun({ text: `Đề tài: ${input.title}`, size: 26, font: 'Times New Roman', italics: true })],
                    alignment: AlignmentType.CENTER,
                    spacing: { after: 200 },
                }));
            }

            children.push(new Paragraph({
                children: [new TextRun({ text: `Tổng điểm: ${result.totalScore}/${result.maxScore} - Xếp loại: ${result.rating}`, bold: true, size: 28, font: 'Times New Roman' })],
                spacing: { before: 200, after: 200 },
            }));

            // Criteria table
            children.push(new Paragraph({
                children: [new TextRun({ text: 'BẢNG ĐIỂM CHI TIẾT', bold: true, size: 26, font: 'Times New Roman' })],
                heading: HeadingLevel.HEADING_2,
                spacing: { before: 300, after: 150 },
            }));

            const headerRow = new TableRow({
                children: ['STT', 'Tiêu chí', 'Điểm', 'Tối đa', 'Nhận xét'].map(text =>
                    new TableCell({
                        children: [new Paragraph({ children: [new TextRun({ text, bold: true, size: 22, font: 'Times New Roman' })] })],
                        shading: { type: ShadingType.SOLID, color: 'D9D9D9' },
                        width: { size: text === 'Nhận xét' ? 40 : 15, type: WidthType.PERCENTAGE },
                    })
                ),
            });

            const dataRows = (result.criteria || []).map((c: ImprovementCriterion, i: number) =>
                new TableRow({
                    children: [
                        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: `${i + 1}`, size: 22, font: 'Times New Roman' })] })], width: { size: 8, type: WidthType.PERCENTAGE } }),
                        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: c.criteriaName, size: 22, font: 'Times New Roman' })] })], width: { size: 17, type: WidthType.PERCENTAGE } }),
                        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: `${c.score}`, size: 22, font: 'Times New Roman', bold: true })] })], width: { size: 10, type: WidthType.PERCENTAGE } }),
                        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: `${c.maxScore}`, size: 22, font: 'Times New Roman' })] })], width: { size: 10, type: WidthType.PERCENTAGE } }),
                        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: c.feedback, size: 22, font: 'Times New Roman' })] })], width: { size: 55, type: WidthType.PERCENTAGE } }),
                    ],
                })
            );

            children.push(new Table({ rows: [headerRow, ...dataRows], width: { size: 100, type: WidthType.PERCENTAGE } }));

            // Issues
            children.push(new Paragraph({
                children: [new TextRun({ text: 'VẤN ĐỀ PHÁT HIỆN VÀ ĐỀ XUẤT CẢI THIỆN', bold: true, size: 26, font: 'Times New Roman' })],
                heading: HeadingLevel.HEADING_2,
                spacing: { before: 300, after: 150 },
            }));

            (result.detectedIssues || []).forEach((issue: DetectedIssue, i: number) => {
                children.push(new Paragraph({
                    children: [new TextRun({ text: `${i + 1}. ${issue.issueName} [${issue.severity.toUpperCase()}]`, bold: true, size: 24, font: 'Times New Roman' })],
                    spacing: { before: 200, after: 100 },
                }));
                children.push(new Paragraph({
                    children: [new TextRun({ text: issue.description, size: 22, font: 'Times New Roman' })],
                    spacing: { after: 100 },
                }));
                (issue.solutions || []).forEach(sol => {
                    children.push(new Paragraph({
                        children: [new TextRun({ text: `→ ${sol.solutionType}: ${sol.targetSection} (${sol.estimatedTime}, tác động: ${sol.impactScore}/10)`, size: 22, font: 'Times New Roman', italics: true })],
                        spacing: { after: 50 },
                    }));
                    if (sol.exampleContent) {
                        children.push(new Paragraph({
                            children: [new TextRun({ text: `Nội dung mẫu: ${sol.exampleContent.substring(0, 300)}...`, size: 20, font: 'Times New Roman', color: '666666' })],
                            spacing: { after: 100 },
                        }));
                    }
                });
            });

            // Recommendation
            children.push(new Paragraph({
                children: [new TextRun({ text: `Điểm dự kiến sau cải thiện: ${result.estimatedScoreAfterFix}/${result.maxScore}`, bold: true, size: 24, font: 'Times New Roman' })],
                spacing: { before: 300, after: 100 },
            }));
            children.push(new Paragraph({
                children: [new TextRun({ text: result.recommendation, size: 22, font: 'Times New Roman' })],
                spacing: { after: 200 },
            }));

            const doc = new Document({ sections: [{ properties: {}, children }] });
            const blob = await Packer.toBlob(doc);
            FileSaver.saveAs(blob, `De_xuat_cai_thien_SKKN.docx`);
        } catch (err: any) {
            setError(`Không thể xuất báo cáo: ${err.message}`);
        } finally {
            setIsExporting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="relative w-full max-w-5xl max-h-[90vh] overflow-y-auto rounded-2xl shadow-2xl bg-white dark:bg-gray-800">
                {/* Header */}
                <div className="sticky top-0 z-10 bg-gradient-to-r from-emerald-600 to-teal-600 p-5 rounded-t-2xl">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-11 h-11 bg-white/20 rounded-xl flex items-center justify-center">
                                <BarChart3 size={22} className="text-white" />
                            </div>
                            <div>
                                <h2 className="text-xl font-bold text-white">Đề xuất Cải thiện SKKN</h2>
                                <p className="text-emerald-100 text-sm">Đánh giá 9 tiêu chí & lộ trình nâng cấp</p>
                            </div>
                        </div>
                        <button onClick={onClose} className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white">
                            <X size={20} />
                        </button>
                    </div>
                </div>

                <div className="p-6 space-y-6">
                    {/* Initial state */}
                    {!result && !isAnalyzing && !error && (
                        <div className="text-center py-10">
                            <div className="w-20 h-20 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                                <Target size={36} className="text-emerald-600" />
                            </div>
                            <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-2">Phân tích Đề xuất Cải thiện</h3>
                            <p className="text-gray-500 dark:text-gray-400 mb-6 max-w-lg mx-auto">
                                AI sẽ đánh giá SKKN theo 9 tiêu chí chất lượng, phát hiện vấn đề và đề xuất lộ trình cải thiện chi tiết với nội dung mẫu.
                            </p>
                            <button
                                onClick={handleAnalyze}
                                className="px-8 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-xl font-semibold hover:opacity-90 transition-all shadow-lg"
                            >
                                🔍 Bắt đầu Phân tích
                            </button>
                        </div>
                    )}

                    {/* Loading */}
                    {isAnalyzing && (
                        <div className="text-center py-16">
                            <div className="w-16 h-16 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin mx-auto mb-4" />
                            <h3 className="text-lg font-bold text-gray-800 dark:text-white animate-pulse">Đang phân tích SKKN...</h3>
                            <p className="text-gray-500 dark:text-gray-400 mt-2">AI đang đánh giá 9 tiêu chí chất lượng</p>
                        </div>
                    )}

                    {/* Error */}
                    {error && (
                        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4">
                            <p className="text-red-700 dark:text-red-400">{error}</p>
                            <button onClick={handleAnalyze} className="mt-3 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700">
                                Thử lại
                            </button>
                        </div>
                    )}

                    {/* Results */}
                    {result && (
                        <>
                            {/* Score card */}
                            <div className="bg-gradient-to-br from-gray-50 to-white dark:from-gray-700 dark:to-gray-800 rounded-2xl p-6 border border-gray-200 dark:border-gray-600">
                                <div className="flex flex-col md:flex-row items-center gap-6">
                                    <div className="text-center">
                                        <div className="w-28 h-28 rounded-full border-4 flex items-center justify-center" style={{ borderColor: result.colorCode }}>
                                            <div>
                                                <div className="text-3xl font-black" style={{ color: result.colorCode }}>{result.totalScore}</div>
                                                <div className="text-xs text-gray-500">/{result.maxScore}</div>
                                            </div>
                                        </div>
                                        <div className="mt-2 px-4 py-1 rounded-full text-sm font-bold text-white" style={{ backgroundColor: result.colorCode }}>
                                            {result.rating}
                                        </div>
                                    </div>
                                    <div className="flex-1">
                                        <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-3">Biểu đồ Điểm số</h3>
                                        <div className="space-y-2">
                                            {(result.criteria || []).map((c: ImprovementCriterion) => (
                                                <div key={c.criteriaId} className="flex items-center gap-2">
                                                    <span className="text-xs font-medium text-gray-600 dark:text-gray-300 w-28 truncate">{c.criteriaName}</span>
                                                    <div className="flex-1 h-5 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
                                                        <div
                                                            className="h-full rounded-full transition-all duration-500"
                                                            style={{
                                                                width: `${(c.score / c.maxScore) * 100}%`,
                                                                backgroundColor: getStatusColor(c.status)
                                                            }}
                                                        />
                                                    </div>
                                                    <span className="text-xs font-bold w-10 text-right" style={{ color: getStatusColor(c.status) }}>
                                                        {c.score}/{c.maxScore}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                                <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-600 flex flex-wrap gap-3 items-center justify-between">
                                    <div className="flex items-center gap-2 text-sm">
                                        <Zap size={16} className="text-emerald-500" />
                                        <span className="text-gray-600 dark:text-gray-300">
                                            Điểm dự kiến sau cải thiện: <strong className="text-emerald-600">{result.estimatedScoreAfterFix}</strong>/{result.maxScore}
                                        </span>
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={handleExportReport}
                                            disabled={isExporting}
                                            className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                                        >
                                            <Download size={14} />
                                            {isExporting ? 'Đang xuất...' : 'Xuất báo cáo .docx'}
                                        </button>
                                        {onStartAutoFix && (
                                            <button
                                                onClick={() => onStartAutoFix(result)}
                                                className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg text-sm font-bold hover:opacity-90"
                                            >
                                                <Wrench size={14} />
                                                Sửa chữa tự động
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Issues list */}
                            <div>
                                <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
                                    <AlertTriangle size={20} className="text-orange-500" />
                                    Vấn đề Phát hiện ({(result.detectedIssues || []).length})
                                </h3>
                                <div className="space-y-3">
                                    {(result.detectedIssues || []).map((issue: DetectedIssue) => (
                                        <div key={issue.issueId} className={`border rounded-xl overflow-hidden ${getSeverityColor(issue.severity)}`}>
                                            <button
                                                onClick={() => toggleIssue(issue.issueId)}
                                                className="w-full px-4 py-3 flex items-center justify-between text-left"
                                            >
                                                <div className="flex items-center gap-3">
                                                    <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-current/10">
                                                        {getSeverityLabel(issue.severity)}
                                                    </span>
                                                    <span className="font-semibold text-sm">{issue.issueName}</span>
                                                </div>
                                                {expandedIssues.has(issue.issueId) ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                            </button>
                                            {expandedIssues.has(issue.issueId) && (
                                                <div className="px-4 pb-4 space-y-3">
                                                    <p className="text-sm text-gray-700 dark:text-gray-300">{issue.description}</p>
                                                    {(issue.solutions || []).map((sol, si) => (
                                                        <div key={si} className="bg-white dark:bg-gray-700 rounded-lg p-3 border border-gray-200 dark:border-gray-600">
                                                            <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400 mb-2">
                                                                <span className="flex items-center gap-1"><Target size={12} /> {sol.targetSection}</span>
                                                                <span className="flex items-center gap-1"><Clock size={12} /> {sol.estimatedTime}</span>
                                                                <span className="flex items-center gap-1"><Zap size={12} /> Tác động: {sol.impactScore}/10</span>
                                                            </div>
                                                            {sol.exampleContent && (
                                                                <pre className="text-xs text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-800 rounded p-2 overflow-x-auto whitespace-pre-wrap max-h-40">
                                                                    {sol.exampleContent}
                                                                </pre>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Recommendation */}
                            <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl p-4">
                                <h4 className="font-bold text-emerald-700 dark:text-emerald-400 mb-2 flex items-center gap-2">
                                    <CheckCircle size={16} /> Khuyến nghị
                                </h4>
                                <p className="text-sm text-emerald-800 dark:text-emerald-300">{result.recommendation}</p>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ImprovementPanel;
