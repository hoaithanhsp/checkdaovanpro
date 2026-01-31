import React, { useState } from 'react';
import { X, Wand2, Check, FileText, AlertCircle, Copy, Download, ChevronDown, ChevronUp, FileEdit } from 'lucide-react';
import { autoFixSKKN, AutoFixResult } from '../services/geminiService';
import { AnalysisResult, OriginalDocxFile } from '../types';
import { injectFixesToDocx, replaceFullContent, ReplacementSegment } from '../services/wordInjectionService';
import FileSaver from 'file-saver';

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

    const handleAutoFix = async () => {
        setIsProcessing(true);
        setError(null);

        try {
            const fixResult = await autoFixSKKN(originalContent, {
                spellingErrors: analysisResult.spellingErrors,
                plagiarismSegments: analysisResult.plagiarismSegments,
                scoreDetails: analysisResult.scoreDetails
            });
            setResult(fixResult);
        } catch (err: any) {
            setError(err.message || 'Đã xảy ra lỗi khi sửa SKKN');
        } finally {
            setIsProcessing(false);
        }
    };

    const handleCopy = async () => {
        if (result?.fixedContent) {
            await navigator.clipboard.writeText(result.fixedContent);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    /**
     * Xuất Word với XML Injection (giữ nguyên file gốc)
     * Bảo toàn: OLE Objects (MathType), Hình ảnh, Bảng
     */
    const handleExportWithInjection = async () => {
        if (!result || !originalDocx) return;

        setIsExporting(true);
        try {
            // Chuyển đổi changes thành ReplacementSegment
            const replacements: ReplacementSegment[] = result.changes.map(c => ({
                original: c.original,
                replacement: c.fixed,
                type: c.type
            }));

            const blob = await injectFixesToDocx(originalDocx, replacements);
            const newFileName = originalDocx.fileName.replace('.docx', '_DA_SUA.docx');
            FileSaver.saveAs(blob, newFileName);

            console.log('✓ Xuất thành công với XML Injection, giữ nguyên OLE objects');
        } catch (err: any) {
            console.error('XML Injection thất bại:', err);
            setError(`Không thể xuất với XML Injection: ${err.message}. Thử xuất file mới.`);
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
            // Tạo blob từ nội dung text
            const blob = new Blob([result.fixedContent], { type: 'text/plain' });
            FileSaver.saveAs(blob, 'SKKN_DA_SUA.txt');

            console.log('✓ Đã xuất file text');
        } catch (err: any) {
            setError(`Không thể xuất file: ${err.message}`);
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
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
