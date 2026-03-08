import React, { useState } from 'react';
import { X, Bot, Zap, BarChart3, Download, FileText, ChevronDown, ChevronUp, AlertCircle, Shield, Activity, Brain, Sparkles } from 'lucide-react';
import { AIRiskDetails, AIReductionResult, OriginalDocxFile } from '../types';
import { reduceAIContent } from '../services/geminiService';
import { injectFixedContentToDocx } from '../services/wordInjectionService';
import FileSaver from 'file-saver';

interface AIReductionPanelProps {
    isOpen: boolean;
    onClose: () => void;
    originalContent: string;
    aiRiskScore: number;
    aiRiskDetails: AIRiskDetails;
    originalDocx?: OriginalDocxFile;
}

const AIReductionPanel: React.FC<AIReductionPanelProps> = ({
    isOpen, onClose, originalContent, aiRiskScore, aiRiskDetails, originalDocx
}) => {
    const [intensity, setIntensity] = useState<'light' | 'medium' | 'aggressive'>('medium');
    const [isProcessing, setIsProcessing] = useState(false);
    const [result, setResult] = useState<AIReductionResult | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isExporting, setIsExporting] = useState(false);
    const [expandedChanges, setExpandedChanges] = useState<Set<number>>(new Set());
    const [progressStep, setProgressStep] = useState<string>('');

    const handleReduce = async () => {
        setIsProcessing(true);
        setError(null);
        setProgressStep('Đang humanize nội dung...');
        try {
            const res = await reduceAIContent(
                originalContent, aiRiskDetails, aiRiskScore, intensity,
                (step) => setProgressStep(step)
            );

            // Kiểm tra fixedContent có đủ dài
            const cleanFixed = res.fixedContent.replace(/<red>/g, '').replace(/<\/red>/g, '');
            const ratio = cleanFixed.length / originalContent.length;
            if (ratio < 0.8 && originalContent.length > 5000) {
                console.warn(`⚠️ fixedContent chỉ có ${Math.round(ratio * 100)}% so với bản gốc`);
                const lastChunk = cleanFixed.substring(cleanFixed.length - 100).trim();
                const lastChunkIdx = originalContent.indexOf(lastChunk.substring(0, 50));
                if (lastChunkIdx > 0) {
                    const appendFromIdx = lastChunkIdx + lastChunk.length;
                    if (appendFromIdx < originalContent.length) {
                        res.fixedContent += '\n' + originalContent.substring(appendFromIdx);
                    }
                }
            }

            setResult(res);
        } catch (err: any) {
            setError(err.message || 'Đã xảy ra lỗi');
        } finally {
            setIsProcessing(false);
            setProgressStep('');
        }
    };

    const handleExportWithInjection = async () => {
        if (!result || !originalDocx) return;
        setIsExporting(true);
        try {
            // Strip markdown helper function
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
                type: 'rewrite', // Luôn set là rewrite để trigger thay thế đoạn
            }));
            const blob = await injectFixedContentToDocx(originalDocx, result.fixedContent, changes);
            const newFileName = originalDocx.fileName.replace('.docx', '_GIAM_AI.docx');
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
            const { Document: DocClass, Packer, Paragraph: Para, TextRun: TR, AlignmentType: AT } =
                await import('docx');

            // Strip markdown + deep unescape
            let content = result.fixedContent
                .replace(/\*\*(.*?)\*\*/g, '$1')
                .replace(/(^|\n)\*\s/g, '$1- ')
                .replace(/\*/g, '');
            for (let i = 0; i < 10; i++) {
                const next = content
                    .replace(/&amp;/g, '&').replace(/&lt;/g, '<')
                    .replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'");
                if (next === content) break;
                content = next;
            }

            const lines = content.split('\n');
            const children: any[] = [];

            for (const line of lines) {
                if (!line.trim()) continue;
                const parts: any[] = [];
                let current = 0;
                const ro = '<red>', rc = '</red>';
                while (current < line.length) {
                    const oi = line.indexOf(ro, current);
                    if (oi === -1) {
                        const rem = line.substring(current);
                        if (rem) parts.push(new TR({ text: rem, size: 26, font: 'Times New Roman' }));
                        break;
                    }
                    if (oi > current) parts.push(new TR({ text: line.substring(current, oi), size: 26, font: 'Times New Roman' }));
                    const ci = line.indexOf(rc, oi);
                    if (ci === -1) {
                        parts.push(new TR({ text: line.substring(oi + ro.length), size: 26, font: 'Times New Roman', color: 'FF0000' }));
                        break;
                    }
                    parts.push(new TR({ text: line.substring(oi + ro.length, ci), size: 26, font: 'Times New Roman', color: 'FF0000' }));
                    current = ci + rc.length;
                }
                if (parts.length === 0) parts.push(new TR({ text: line, size: 26, font: 'Times New Roman' }));
                children.push(new Para({ children: parts, spacing: { after: 100 }, alignment: AT.JUSTIFIED }));
            }

            const doc = new DocClass({ sections: [{ properties: {}, children }] });
            const blob = await Packer.toBlob(doc);
            FileSaver.saveAs(blob, 'SKKN_GIAM_AI.docx');
        } catch (err: any) {
            setError(`Không thể xuất file: ${err.message}`);
        } finally {
            setIsExporting(false);
        }
    };

    const getTechniqueLabel = (tech: string) => {
        const map: Record<string, { label: string; color: string; bg: string }> = {
            sentence_restructure: { label: 'Cấu trúc câu', color: 'text-blue-700', bg: 'bg-blue-100' },
            lexical_diversify: { label: 'Từ vựng', color: 'text-purple-700', bg: 'bg-purple-100' },
            syntactic_variation: { label: 'Cú pháp', color: 'text-emerald-700', bg: 'bg-emerald-100' },
            density_adjust: { label: 'Mật độ', color: 'text-orange-700', bg: 'bg-orange-100' },
            micro_variation: { label: 'Vi biến đổi', color: 'text-pink-700', bg: 'bg-pink-100' },
        };
        return map[tech] || { label: tech, color: 'text-gray-700', bg: 'bg-gray-100' };
    };

    const getScoreColor = (score: number, isGood: 'low' | 'high') => {
        if (isGood === 'low') return score < 20 ? '#10b981' : score < 40 ? '#f59e0b' : '#ef4444';
        return score > 50 ? '#10b981' : score > 30 ? '#f59e0b' : '#ef4444';
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="relative w-full max-w-5xl max-h-[90vh] overflow-y-auto rounded-2xl shadow-2xl bg-white dark:bg-gray-800">
                {/* Header */}
                <div className="sticky top-0 z-10 bg-gradient-to-r from-violet-600 via-indigo-600 to-cyan-600 p-5 rounded-t-2xl">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-11 h-11 bg-white/20 rounded-xl flex items-center justify-center">
                                <Bot size={22} className="text-white" />
                            </div>
                            <div>
                                <h2 className="text-xl font-bold text-white">Giảm độ AI cho SKKN</h2>
                                <p className="text-indigo-100 text-sm">5 kỹ thuật humanizing • Mục tiêu AI Score &lt; 20%</p>
                            </div>
                        </div>
                        <button onClick={onClose} className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white">
                            <X size={20} />
                        </button>
                    </div>
                </div>

                <div className="p-6 space-y-6">
                    {/* Step 1: Current AI Metrics */}
                    {!result && (
                        <>
                            {/* AI Score Overview */}
                            <div className="bg-gradient-to-br from-red-50 to-orange-50 dark:from-red-900/20 dark:to-orange-900/20 rounded-2xl p-5 border border-red-200 dark:border-red-800">
                                <h3 className="text-lg font-bold text-red-800 dark:text-red-300 mb-4 flex items-center gap-2">
                                    <Shield size={18} /> Chỉ số AI hiện tại
                                </h3>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    {[
                                        { label: 'AI Score', value: aiRiskScore, unit: '%', good: 'low' as const, icon: <Brain size={16} /> },
                                        { label: 'Perplexity', value: aiRiskDetails.perplexityScore, unit: '/100', good: 'high' as const, icon: <Activity size={16} /> },
                                        { label: 'Burstiness', value: aiRiskDetails.burstinessScore, unit: '/100', good: 'high' as const, icon: <BarChart3 size={16} /> },
                                        { label: 'Pattern AI', value: aiRiskDetails.patternDensity, unit: '/100', good: 'low' as const, icon: <Sparkles size={16} /> },
                                    ].map((m, i) => (
                                        <div key={i} className="text-center p-4 bg-white dark:bg-gray-700 rounded-xl shadow-sm">
                                            <div className="flex items-center justify-center gap-1 text-xs text-gray-500 mb-1">{m.icon} {m.label}</div>
                                            <div className="text-3xl font-black" style={{ color: getScoreColor(m.value, m.good) }}>
                                                {m.value}{m.unit}
                                            </div>
                                            <div className="text-xs mt-1" style={{ color: getScoreColor(m.value, m.good) }}>
                                                {m.good === 'low' ? (m.value < 20 ? '✓ Tốt' : m.value < 40 ? '⚠ Cảnh báo' : '✗ Nguy hiểm') :
                                                    (m.value > 50 ? '✓ Tốt' : m.value > 30 ? '⚠ Thiếu' : '✗ Rất thiếu')}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Suspicious Patterns */}
                            {aiRiskDetails.suspiciousPatterns && aiRiskDetails.suspiciousPatterns.length > 0 && (
                                <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-4 border border-amber-200">
                                    <h4 className="text-sm font-bold text-amber-800 mb-2 flex items-center gap-1">
                                        <AlertCircle size={14} /> Mẫu câu AI phát hiện ({aiRiskDetails.suspiciousPatterns.length})
                                    </h4>
                                    <div className="flex flex-wrap gap-2">
                                        {aiRiskDetails.suspiciousPatterns.map((p, i) => (
                                            <span key={i} className="text-xs px-2 py-1 bg-amber-100 text-amber-800 rounded-full border border-amber-300">
                                                "{p}"
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Disclaimer */}
                            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 border border-blue-200 flex items-start gap-3">
                                <AlertCircle className="text-blue-600 mt-0.5 shrink-0" size={18} />
                                <div>
                                    <h4 className="text-sm font-bold text-blue-800 dark:text-blue-300">Lưu ý về Điểm AI (AI Score)</h4>
                                    <p className="text-xs text-blue-700/80 dark:text-blue-400 mt-1 leading-relaxed">
                                        Điểm AI là con số <b>dự đoán xác suất</b> dựa trên thuật toán (tính bất ngờ và độ đa dạng). Việc sử dụng tính năng humanizing có thể làm cho văn bản mượt mà, cấu trúc tốt hơn và đôi khi khiến các công cụ quét AI <b>nhận diện nhầm là AI cấp cao</b>. Điều quan trọng nhất là nội dung đã được làm mới, diễn đạt tự nhiên và giảm thiểu các mẫu câu rập khuôn (pattern).
                                    </p>
                                </div>
                            </div>

                            {/* Intensity Selection */}
                            <div>
                                <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-3 flex items-center gap-2">
                                    <Zap size={18} className="text-indigo-500" /> Chọn mức độ xử lý
                                </h3>
                                <div className="grid grid-cols-3 gap-3">
                                    {[
                                        { key: 'light' as const, emoji: '🌿', title: 'Nhẹ', desc: 'Giữ 90% gốc, sửa pattern AI rõ ràng nhất', target: 'AI < 30%' },
                                        { key: 'medium' as const, emoji: '⚡', title: 'Trung bình', desc: 'Viết lại 30% nội dung, đa dạng hóa mạnh', target: 'AI < 20%' },
                                        { key: 'aggressive' as const, emoji: '🔥', title: 'Mạnh', desc: 'Viết lại 50%+ nội dung, humanize toàn diện', target: 'AI < 15%' },
                                    ].map(opt => (
                                        <button
                                            key={opt.key}
                                            onClick={() => setIntensity(opt.key)}
                                            className={`p-4 rounded-xl border-2 text-left transition-all ${intensity === opt.key
                                                ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 shadow-lg shadow-indigo-100'
                                                : 'border-gray-200 dark:border-gray-600 hover:border-indigo-300'
                                                }`}
                                        >
                                            <div className="text-2xl mb-1">{opt.emoji}</div>
                                            <div className="font-bold text-gray-800 dark:text-white">{opt.title}</div>
                                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{opt.desc}</p>
                                            <div className="text-xs font-bold text-indigo-600 mt-2">Mục tiêu: {opt.target}</div>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Process Button */}
                            <div className="flex justify-center pt-2">
                                <button
                                    onClick={handleReduce}
                                    disabled={isProcessing}
                                    className="px-10 py-3 bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-xl font-bold hover:opacity-90 transition-all shadow-lg disabled:opacity-50"
                                >
                                    {isProcessing ? (
                                        <span className="flex items-center gap-2">
                                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                            {progressStep || 'Đang xử lý humanizing...'}
                                        </span>
                                    ) : (
                                        <span className="flex items-center gap-2">
                                            <Bot size={16} /> Giảm độ AI ({intensity === 'light' ? 'Nhẹ' : intensity === 'medium' ? 'TB' : 'Mạnh'})
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
                            {/* Before/After Comparison */}
                            <div className="bg-gradient-to-br from-emerald-50 to-cyan-50 dark:from-emerald-900/20 dark:to-cyan-900/20 rounded-2xl p-5 border border-emerald-200 dark:border-emerald-800">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-lg font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
                                        <Shield size={18} /> So sánh Trước / Sau
                                    </h3>
                                    <div className="flex items-center gap-2">
                                        {result.afterMetrics.verified && (
                                            <span className="text-xs font-bold px-2.5 py-1 bg-emerald-100 text-emerald-700 rounded-full border border-emerald-300 flex items-center gap-1">
                                                ✅ Đã kiểm chứng
                                            </span>
                                        )}
                                        {!result.afterMetrics.verified && (
                                            <span className="text-xs font-bold px-2.5 py-1 bg-amber-100 text-amber-700 rounded-full border border-amber-300 flex items-center gap-1">
                                                ⚠️ Ước lượng
                                            </span>
                                        )}
                                        {(result.retryCount ?? 0) > 0 && (
                                            <span className="text-xs font-medium px-2 py-1 bg-blue-100 text-blue-700 rounded-full">
                                                Tối ưu {(result.retryCount ?? 0) + 1} lần
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    {[
                                        { label: 'AI Score', before: result.beforeMetrics.aiScore, after: result.afterMetrics.estimatedAIScore, unit: '%', good: 'low' as const },
                                        { label: 'Perplexity', before: result.beforeMetrics.perplexity, after: result.afterMetrics.estimatedPerplexity, unit: '', good: 'high' as const },
                                        { label: 'Burstiness', before: result.beforeMetrics.burstiness, after: result.afterMetrics.estimatedBurstiness, unit: '', good: 'high' as const },
                                        { label: 'Pattern AI', before: result.beforeMetrics.patternDensity, after: result.afterMetrics.estimatedPatternDensity, unit: '', good: 'low' as const },
                                    ].map((m, i) => (
                                        <div key={i} className="text-center p-3 bg-white dark:bg-gray-700 rounded-xl">
                                            <div className="text-xs text-gray-500 font-medium mb-1">{m.label}</div>
                                            <div className="flex items-center justify-center gap-1">
                                                <span className="text-lg font-bold" style={{ color: getScoreColor(m.before, m.good) }}>
                                                    {m.before}{m.unit}
                                                </span>
                                                <span className="text-gray-400">→</span>
                                                <span className="text-lg font-black" style={{ color: getScoreColor(m.after, m.good) }}>
                                                    {m.after}{m.unit}
                                                </span>
                                            </div>
                                            <div className="text-xs font-bold mt-1" style={{ color: '#10b981' }}>
                                                {m.good === 'low' ? `↓${m.before - m.after}` : `↑${m.after - m.before}`}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Stats */}
                            <div className="grid grid-cols-5 gap-2">
                                {[
                                    { label: 'Câu tái cấu trúc', value: result.stats.sentencesRestructured, color: 'text-blue-600' },
                                    { label: 'Từ thay thế', value: result.stats.wordsReplaced, color: 'text-purple-600' },
                                    { label: 'Pattern xóa', value: result.stats.patternsRemoved, color: 'text-red-600' },
                                    { label: 'Biến đổi cú pháp', value: result.stats.syntacticChanges, color: 'text-emerald-600' },
                                    { label: 'Vi biến đổi', value: result.stats.microVariations, color: 'text-pink-600' },
                                ].map((s, i) => (
                                    <div key={i} className="text-center p-3 bg-gray-50 dark:bg-gray-700 rounded-xl">
                                        <div className={`text-2xl font-black ${s.color}`}>{s.value}</div>
                                        <div className="text-xs text-gray-500 mt-0.5">{s.label}</div>
                                    </div>
                                ))}
                            </div>

                            {/* Changes List */}
                            <div>
                                <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-3">
                                    Các thay đổi ({(result.changes || []).length})
                                </h3>
                                <div className="space-y-2 max-h-64 overflow-y-auto">
                                    {(result.changes || []).map((change, i) => {
                                        const tech = getTechniqueLabel(change.technique);
                                        return (
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
                                                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${tech.bg} ${tech.color}`}>
                                                            {tech.label}
                                                        </span>
                                                        <span className="text-sm text-gray-600 dark:text-gray-300 truncate max-w-xs">{change.reason}</span>
                                                    </div>
                                                    {expandedChanges.has(i) ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                                </button>
                                                {expandedChanges.has(i) && (
                                                    <div className="p-4 space-y-2">
                                                        <div>
                                                            <p className="text-xs font-bold text-red-600 mb-1">Gốc:</p>
                                                            <pre className="text-xs text-gray-500 bg-red-50 dark:bg-red-900/20 p-2 rounded overflow-auto max-h-24 whitespace-pre-wrap">{change.original}</pre>
                                                        </div>
                                                        <div>
                                                            <p className="text-xs font-bold text-emerald-600 mb-1">Đã sửa:</p>
                                                            <pre className="text-xs text-gray-700 dark:text-gray-300 bg-emerald-50 dark:bg-emerald-900/20 p-2 rounded overflow-auto max-h-24 whitespace-pre-wrap">{change.fixed}</pre>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Verification Warning */}
                            {result.verificationWarning && (
                                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-700 rounded-xl p-4 flex items-start gap-3">
                                    <AlertCircle className="text-amber-600 mt-0.5 shrink-0" size={18} />
                                    <div>
                                        <h4 className="text-sm font-bold text-amber-800 dark:text-amber-300">Lưu ý</h4>
                                        <p className="text-xs text-amber-700/80 dark:text-amber-400 mt-1 leading-relaxed">
                                            {result.verificationWarning}
                                        </p>
                                    </div>
                                </div>
                            )}

                            {/* Verified Disclaimer */}
                            {result.afterMetrics.verified && (
                                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 border border-blue-200 flex items-start gap-3">
                                    <Shield className="text-blue-600 mt-0.5 shrink-0" size={18} />
                                    <div>
                                        <h4 className="text-sm font-bold text-blue-800 dark:text-blue-300">AI Score đã kiểm chứng</h4>
                                        <p className="text-xs text-blue-700/80 dark:text-blue-400 mt-1 leading-relaxed">
                                            Điểm AI sau xử lý đã được <b>kiểm tra lại</b> bằng cùng hệ thống phân tích AI của ứng dụng. Kết quả hiển thị phía trên là điểm <b>đã kiểm chứng</b>, không phải ước lượng.
                                        </p>
                                    </div>
                                </div>
                            )}

                            {/* Export Buttons */}
                            <div className="flex flex-col sm:flex-row gap-3 pt-2">
                                {originalDocx && (
                                    <button
                                        onClick={handleExportWithInjection}
                                        disabled={isExporting}
                                        className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-xl font-bold hover:opacity-90 disabled:opacity-50"
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

                            {/* Back */}
                            <div className="text-center">
                                <button
                                    onClick={() => { setResult(null); setError(null); }}
                                    className="text-sm text-gray-500 hover:text-gray-700 underline"
                                >
                                    ← Quay lại chọn mức xử lý
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AIReductionPanel;
