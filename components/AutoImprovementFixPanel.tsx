import React, { useState } from 'react';
import { X, Wrench, Check, FileText, AlertCircle, Download, ChevronDown, ChevronUp, Zap, Target } from 'lucide-react';
import { ImprovementAnalysisResult, DetectedIssue, AutoImprovementFixResult, SKKNInput, OriginalDocxFile } from '../types';
import { generateImprovementContent } from '../services/geminiService';
import { injectFixedContentToDocx } from '../services/wordInjectionService';
import FileSaver from 'file-saver';

interface AutoImprovementFixPanelProps {
    isOpen: boolean;
    onClose: () => void;
    originalContent: string;
    improvementResult: ImprovementAnalysisResult;
    input?: SKKNInput;
    originalDocx?: OriginalDocxFile;
}

const AutoImprovementFixPanel: React.FC<AutoImprovementFixPanelProps> = ({
    isOpen, onClose, originalContent, improvementResult, input, originalDocx
}) => {
    const [selectedIssues, setSelectedIssues] = useState<Set<string>>(
        new Set((improvementResult.detectedIssues || []).map(i => i.issueId))
    );
    const [isProcessing, setIsProcessing] = useState(false);
    const [result, setResult] = useState<AutoImprovementFixResult | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isExporting, setIsExporting] = useState(false);
    const [expandedChanges, setExpandedChanges] = useState<Set<number>>(new Set());

    const toggleIssue = (issueId: string) => {
        setSelectedIssues(prev => {
            const next = new Set(prev);
            if (next.has(issueId)) next.delete(issueId);
            else next.add(issueId);
            return next;
        });
    };

    const toggleSelectAll = () => {
        const allIds = (improvementResult.detectedIssues || []).map(i => i.issueId);
        if (selectedIssues.size === allIds.length) {
            setSelectedIssues(new Set());
        } else {
            setSelectedIssues(new Set(allIds));
        }
    };

    const handleAutoFix = async () => {
        if (selectedIssues.size === 0) {
            setError('Vui lòng chọn ít nhất 1 vấn đề cần sửa');
            return;
        }
        setIsProcessing(true);
        setError(null);
        try {
            const issues = (improvementResult.detectedIssues || []).filter(i => selectedIssues.has(i.issueId));
            const fixResult = await generateImprovementContent(
                originalContent, issues, { title: input?.title, subject: input?.subject }
            );

            // Kiểm tra fixedContent có đủ dài
            const cleanFixed = fixResult.fixedContent.replace(/<red>/g, '').replace(/<\/red>/g, '');
            const ratio = cleanFixed.length / originalContent.length;
            if (ratio < 0.8 && originalContent.length > 5000) {
                console.warn(`⚠️ fixedContent chỉ có ${Math.round(ratio * 100)}% so với bản gốc`);
                const lastChunk = cleanFixed.substring(cleanFixed.length - 100).trim();
                const lastChunkIdx = originalContent.indexOf(lastChunk.substring(0, 50));
                if (lastChunkIdx > 0) {
                    const appendFromIdx = lastChunkIdx + lastChunk.length;
                    if (appendFromIdx < originalContent.length) {
                        fixResult.fixedContent += '\n' + originalContent.substring(appendFromIdx);
                    }
                }
            }

            setResult(fixResult);
        } catch (err: any) {
            setError(err.message || 'Đã xảy ra lỗi khi sửa SKKN');
        } finally {
            setIsProcessing(false);
        }
    };

    const handleExportWithInjection = async () => {
        if (!result || !originalDocx) return;
        setIsExporting(true);
        try {
            // Strip markdown nhưng GIỮ LẠI <red> tags (tham khảo AIReductionPanel)
            const stripMd = (str: string) => {
                let s = str.replace(/\*\*(.*?)\*\*/g, '$1').replace(/(^|\n)\*\s/g, '$1- ').replace(/\*/g, '');
                for (let i = 0; i < 5; i++) {
                    const next = s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'");
                    if (next === s) break;
                    s = next;
                }
                return s;
            };

            const changes = (result.changes || []).map(c => ({
                original: stripMd(c.original),
                fixed: stripMd(c.fixed),
                type: c.type as string,
            }));
            const blob = await injectFixedContentToDocx(originalDocx, stripMd(result.fixedContent), changes);
            const newFileName = originalDocx.fileName.replace('.docx', '_CAI_THIEN.docx');
            FileSaver.saveAs(blob, newFileName);
        } catch (err: any) {
            setError(`Không thể xuất file: ${err.message}`);
        } finally {
            setIsExporting(false);
        }
    };

    const handleExportNewWord = async () => {
        if (!result) return;
        setIsExporting(true);
        try {
            const { Document: DocClass, Packer, Paragraph: Para, TextRun: TR, HeadingLevel: HL, AlignmentType: AT } =
                await import('docx');

            // Loại bỏ Markdown và unescape HTML entities
            const cleanContent = result.fixedContent
                .replace(/\*\*(.*?)\*\*/g, '$1') // Bỏ **bôi đậm**
                .replace(/(^|\n)\*\s/g, '$1- ')  // Bỏ * list items
                .replace(/\*/g, '');             // Bỏ * còn lại

            // Deep unescape: &amp;lt;red&amp;gt; → &lt;red&gt; → <red>
            let unescaped = cleanContent;
            for (let i = 0; i < 10; i++) {
                const next = unescaped
                    .replace(/&amp;/g, '&')
                    .replace(/&lt;/g, '<')
                    .replace(/&gt;/g, '>')
                    .replace(/&quot;/g, '"')
                    .replace(/&apos;/g, "'");
                if (next === unescaped) break;
                unescaped = next;
            }

            const lines = unescaped.split('\n');
            const children: any[] = [];

            for (const line of lines) {
                if (!line.trim()) continue;
                // Parse <red> tags
                const parts: any[] = [];
                let current = 0;
                const redOpen = '<red>';
                const redClose = '</red>';
                while (current < line.length) {
                    const oi = line.indexOf(redOpen, current);
                    if (oi === -1) {
                        const rem = line.substring(current);
                        if (rem) parts.push(new TR({ text: rem, size: 26, font: 'Times New Roman' }));
                        break;
                    }
                    if (oi > current) {
                        parts.push(new TR({ text: line.substring(current, oi), size: 26, font: 'Times New Roman' }));
                    }
                    const ci = line.indexOf(redClose, oi);
                    if (ci === -1) {
                        parts.push(new TR({ text: line.substring(oi + redOpen.length), size: 26, font: 'Times New Roman', color: 'FF0000' }));
                        break;
                    }
                    parts.push(new TR({ text: line.substring(oi + redOpen.length, ci), size: 26, font: 'Times New Roman', color: 'FF0000' }));
                    current = ci + redClose.length;
                }
                if (parts.length === 0) parts.push(new TR({ text: line, size: 26, font: 'Times New Roman' }));
                children.push(new Para({ children: parts, spacing: { after: 100 }, alignment: AT.JUSTIFIED }));
            }

            const doc = new DocClass({ sections: [{ properties: {}, children }] });
            const blob = await Packer.toBlob(doc);
            FileSaver.saveAs(blob, `SKKN_CAI_THIEN.docx`);
        } catch (err: any) {
            setError(`Không thể xuất file: ${err.message}`);
        } finally {
            setIsExporting(false);
        }
    };

    const getSeverityColor = (severity: string) => {
        switch (severity) {
            case 'critical': return 'border-red-300 bg-red-50';
            case 'high': return 'border-orange-300 bg-orange-50';
            case 'medium': return 'border-blue-300 bg-blue-50';
            case 'low': return 'border-gray-300 bg-gray-50';
            default: return 'border-gray-300 bg-gray-50';
        }
    };

    const getSeverityBadge = (severity: string) => {
        switch (severity) {
            case 'critical': return { bg: 'bg-red-100 text-red-700', label: 'Khẩn cấp' };
            case 'high': return { bg: 'bg-orange-100 text-orange-700', label: 'Cao' };
            case 'medium': return { bg: 'bg-blue-100 text-blue-700', label: 'TB' };
            case 'low': return { bg: 'bg-gray-100 text-gray-700', label: 'Thấp' };
            default: return { bg: 'bg-gray-100 text-gray-700', label: severity };
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="relative w-full max-w-5xl max-h-[90vh] overflow-y-auto rounded-2xl shadow-2xl bg-white dark:bg-gray-800">
                {/* Header */}
                <div className="sticky top-0 z-10 bg-gradient-to-r from-purple-600 to-pink-600 p-5 rounded-t-2xl">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-11 h-11 bg-white/20 rounded-xl flex items-center justify-center">
                                <Wrench size={22} className="text-white" />
                            </div>
                            <div>
                                <h2 className="text-xl font-bold text-white">Sửa chữa SKKN Tự động</h2>
                                <p className="text-purple-100 text-sm">Dựa trên đề xuất cải thiện đã phân tích</p>
                            </div>
                        </div>
                        <button onClick={onClose} className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white">
                            <X size={20} />
                        </button>
                    </div>
                </div>

                <div className="p-6 space-y-6">
                    {/* Step 1: Select issues */}
                    {!result && (
                        <>
                            <div className="flex items-center justify-between">
                                <h3 className="text-lg font-bold text-gray-800 dark:text-white flex items-center gap-2">
                                    <Target size={18} className="text-purple-500" />
                                    Chọn vấn đề cần sửa ({selectedIssues.size}/{(improvementResult.detectedIssues || []).length})
                                </h3>
                                <button onClick={toggleSelectAll} className="text-sm text-purple-600 hover:underline font-medium">
                                    {selectedIssues.size === (improvementResult.detectedIssues || []).length ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}
                                </button>
                            </div>

                            <div className="space-y-2">
                                {(improvementResult.detectedIssues || []).map((issue: DetectedIssue) => {
                                    const badge = getSeverityBadge(issue.severity);
                                    return (
                                        <label key={issue.issueId}
                                            className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all hover:shadow-sm ${selectedIssues.has(issue.issueId) ? getSeverityColor(issue.severity) + ' border-2' : 'border-gray-200 dark:border-gray-600'
                                                }`}
                                        >
                                            <input
                                                type="checkbox"
                                                checked={selectedIssues.has(issue.issueId)}
                                                onChange={() => toggleIssue(issue.issueId)}
                                                className="w-5 h-5 rounded text-purple-600"
                                            />
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${badge.bg}`}>{badge.label}</span>
                                                    <span className="font-semibold text-sm text-gray-800 dark:text-white">{issue.issueName}</span>
                                                </div>
                                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">{issue.description}</p>
                                            </div>
                                            {issue.solutions?.[0] && (
                                                <div className="text-right text-xs text-gray-400 dark:text-gray-500 hidden sm:block">
                                                    <div className="flex items-center gap-1"><Zap size={10} /> {issue.solutions[0].impactScore}/10</div>
                                                    <div>{issue.solutions[0].estimatedTime}</div>
                                                </div>
                                            )}
                                        </label>
                                    );
                                })}
                            </div>

                            <div className="flex justify-center pt-2">
                                <button
                                    onClick={handleAutoFix}
                                    disabled={isProcessing || selectedIssues.size === 0}
                                    className="px-8 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl font-bold hover:opacity-90 transition-all shadow-lg disabled:opacity-50"
                                >
                                    {isProcessing ? (
                                        <span className="flex items-center gap-2">
                                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                            Đang sửa chữa...
                                        </span>
                                    ) : (
                                        <span className="flex items-center gap-2">
                                            <Wrench size={16} /> Sửa chữa Tự động ({selectedIssues.size} vấn đề)
                                        </span>
                                    )}
                                </button>
                            </div>
                        </>
                    )}

                    {/* Error */}
                    {error && (
                        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4">
                            <div className="flex items-center gap-2 text-red-700 dark:text-red-400">
                                <AlertCircle size={16} />
                                <p className="text-sm">{error}</p>
                            </div>
                        </div>
                    )}

                    {/* Step 2: Results */}
                    {result && (
                        <>
                            {/* Summary */}
                            <div className="bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-2xl p-5 border border-purple-200 dark:border-purple-800">
                                <h3 className="text-lg font-bold text-purple-800 dark:text-purple-300 mb-3 flex items-center gap-2">
                                    <Check size={18} /> Kết quả Sửa chữa
                                </h3>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                    <div className="text-center p-3 bg-white dark:bg-gray-700 rounded-xl">
                                        <div className="text-2xl font-black text-purple-600">{result.summary?.sectionsRewritten || 0}</div>
                                        <div className="text-xs text-gray-500">Phần viết lại</div>
                                    </div>
                                    <div className="text-center p-3 bg-white dark:bg-gray-700 rounded-xl">
                                        <div className="text-2xl font-black text-emerald-600">{result.summary?.sectionsAdded || 0}</div>
                                        <div className="text-xs text-gray-500">Phần thêm mới</div>
                                    </div>
                                    <div className="text-center p-3 bg-white dark:bg-gray-700 rounded-xl">
                                        <div className="text-2xl font-black text-blue-600">{result.summary?.errorsFixed || 0}</div>
                                        <div className="text-xs text-gray-500">Lỗi đã sửa</div>
                                    </div>
                                    <div className="text-center p-3 bg-white dark:bg-gray-700 rounded-xl">
                                        <div className="text-2xl font-black text-orange-600">{result.newEstimatedScore || 0}</div>
                                        <div className="text-xs text-gray-500">Điểm dự kiến</div>
                                    </div>
                                </div>
                            </div>

                            {/* Changes list */}
                            <div>
                                <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-3">
                                    Các thay đổi ({(result.changes || []).length})
                                </h3>
                                <div className="space-y-2">
                                    {(result.changes || []).map((change, i) => (
                                        <div key={i} className="border border-gray-200 dark:border-gray-600 rounded-xl overflow-hidden">
                                            <button
                                                onClick={() => {
                                                    setExpandedChanges(prev => {
                                                        const next = new Set(prev);
                                                        if (next.has(i)) next.delete(i); else next.add(i);
                                                        return next;
                                                    });
                                                }}
                                                className="w-full px-4 py-3 flex items-center justify-between text-left bg-gray-50 dark:bg-gray-700"
                                            >
                                                <div className="flex items-center gap-2">
                                                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${change.type === 'rewrite' ? 'bg-purple-100 text-purple-700' :
                                                        change.type === 'add' ? 'bg-emerald-100 text-emerald-700' :
                                                            change.type === 'fix' ? 'bg-blue-100 text-blue-700' :
                                                                'bg-gray-100 text-gray-700'
                                                        }`}>
                                                        {change.type === 'rewrite' ? 'Viết lại' : change.type === 'add' ? 'Thêm mới' : change.type === 'fix' ? 'Sửa lỗi' : 'Nâng cấp'}
                                                    </span>
                                                    <span className="text-sm font-medium text-gray-800 dark:text-white">{change.issueName}</span>
                                                    <span className="text-xs text-gray-400">@ {change.targetSection}</span>
                                                </div>
                                                {expandedChanges.has(i) ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                            </button>
                                            {expandedChanges.has(i) && (
                                                <div className="p-4 space-y-3">
                                                    {change.original && (
                                                        <div>
                                                            <p className="text-xs font-bold text-red-600 mb-1">Nội dung gốc:</p>
                                                            <pre className="text-xs text-gray-500 bg-red-50 dark:bg-red-900/20 p-2 rounded overflow-auto max-h-32 whitespace-pre-wrap">{change.original}</pre>
                                                        </div>
                                                    )}
                                                    <div>
                                                        <p className="text-xs font-bold text-emerald-600 mb-1">Nội dung mới:</p>
                                                        <pre className="text-xs text-gray-700 dark:text-gray-300 bg-emerald-50 dark:bg-emerald-900/20 p-2 rounded overflow-auto max-h-48 whitespace-pre-wrap">{change.fixed}</pre>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Export buttons */}
                            <div className="flex flex-col sm:flex-row gap-3 pt-2">
                                {originalDocx && (
                                    <button
                                        onClick={handleExportWithInjection}
                                        disabled={isExporting}
                                        className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl font-bold hover:opacity-90 disabled:opacity-50"
                                    >
                                        <Download size={16} />
                                        {isExporting ? 'Đang xuất...' : 'Xuất Word (Giữ gốc - MathType, hình vẽ)'}
                                    </button>
                                )}
                                <button
                                    onClick={handleExportNewWord}
                                    disabled={isExporting}
                                    className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 disabled:opacity-50"
                                >
                                    <FileText size={16} />
                                    {isExporting ? 'Đang xuất...' : 'Xuất Word (Tạo mới)'}
                                </button>
                            </div>

                            {/* Back button */}
                            <div className="text-center">
                                <button
                                    onClick={() => { setResult(null); setError(null); }}
                                    className="text-sm text-gray-500 hover:text-gray-700 underline"
                                >
                                    ← Quay lại chọn vấn đề
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AutoImprovementFixPanel;
