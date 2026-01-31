import React, { useState } from 'react';
import { PenLine, X, Copy, Check, Loader2, ArrowRight, Sparkles, RefreshCw } from 'lucide-react';
import { PlagiarismSegment } from '../types';
import { rewritePlagiarizedText } from '../services/geminiService';

interface RewritePanelProps {
    segment: PlagiarismSegment;
    onClose: () => void;
}

const RewritePanel: React.FC<RewritePanelProps> = ({ segment, onClose }) => {
    const [isLoading, setIsLoading] = useState(false);
    const [rewrittenText, setRewrittenText] = useState<string | null>(null);
    const [explanation, setExplanation] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleRewrite = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const result = await rewritePlagiarizedText(segment.segment, segment.advice);
            setRewrittenText(result.rewrittenText);
            setExplanation(result.explanation);
        } catch (err: any) {
            setError(err.message || 'Đã xảy ra lỗi khi viết lại');
        }
        setIsLoading(false);
    };

    const handleCopy = () => {
        if (rewrittenText) {
            navigator.clipboard.writeText(rewrittenText);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden animate-fade-in">
                {/* Header */}
                <div className="bg-gradient-to-r from-purple-600 to-pink-600 p-5 text-white flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-white/20 rounded-lg">
                            <PenLine size={24} />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold">AI Viết Lại Đoạn Văn</h2>
                            <p className="text-purple-100 text-sm">Tạo phiên bản mới không bị đạo văn</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                    >
                        <X size={24} />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {/* Original Text */}
                    <div>
                        <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                            <span className="w-6 h-6 bg-red-100 text-red-600 rounded-full flex items-center justify-center text-xs">1</span>
                            Đoạn văn gốc (nghi ngờ đạo văn)
                        </h3>
                        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                            <p className="text-gray-800 italic">"{segment.segment}"</p>
                            <p className="text-xs text-red-600 mt-2">
                                Độ tương đồng: {segment.similarity}% • Nguồn: {segment.source}
                            </p>
                        </div>
                    </div>

                    {/* Action Button */}
                    {!rewrittenText && !isLoading && (
                        <button
                            onClick={handleRewrite}
                            className="w-full py-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl font-semibold flex items-center justify-center gap-2 hover:shadow-lg transition-all"
                        >
                            <Sparkles size={20} />
                            Viết lại bằng AI
                        </button>
                    )}

                    {/* Loading */}
                    {isLoading && (
                        <div className="flex flex-col items-center py-8">
                            <Loader2 size={40} className="text-purple-600 animate-spin mb-4" />
                            <p className="text-gray-600 font-medium">Đang tạo phiên bản mới...</p>
                            <p className="text-sm text-gray-500">AI đang phân tích và viết lại đoạn văn</p>
                        </div>
                    )}

                    {/* Error */}
                    {error && (
                        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
                            <p className="font-medium">Lỗi: {error}</p>
                            <button
                                onClick={handleRewrite}
                                className="mt-2 text-sm underline hover:no-underline"
                            >
                                Thử lại
                            </button>
                        </div>
                    )}

                    {/* Rewritten Text */}
                    {rewrittenText && (
                        <>
                            <div className="flex items-center justify-center">
                                <div className="p-2 bg-gray-100 rounded-full">
                                    <ArrowRight size={20} className="text-gray-500" />
                                </div>
                            </div>

                            <div>
                                <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                                    <span className="w-6 h-6 bg-green-100 text-green-600 rounded-full flex items-center justify-center text-xs">2</span>
                                    Đoạn văn đã viết lại
                                </h3>
                                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                                    <p className="text-gray-800">{rewrittenText}</p>
                                </div>
                            </div>

                            {explanation && (
                                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                                    <p className="text-sm text-blue-800">
                                        <span className="font-semibold">Giải thích: </span>{explanation}
                                    </p>
                                </div>
                            )}

                            <div className="flex gap-3">
                                <button
                                    onClick={handleCopy}
                                    className={`flex-1 py-3 rounded-lg font-medium flex items-center justify-center gap-2 transition-all ${copied
                                            ? 'bg-green-600 text-white'
                                            : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                                        }`}
                                >
                                    {copied ? <Check size={18} /> : <Copy size={18} />}
                                    {copied ? 'Đã sao chép!' : 'Sao chép'}
                                </button>
                                <button
                                    onClick={handleRewrite}
                                    disabled={isLoading}
                                    className="flex-1 py-3 bg-purple-100 hover:bg-purple-200 text-purple-700 rounded-lg font-medium flex items-center justify-center gap-2 transition-all"
                                >
                                    <RefreshCw size={18} />
                                    Viết lại khác
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default RewritePanel;
