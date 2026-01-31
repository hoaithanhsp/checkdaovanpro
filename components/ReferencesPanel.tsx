import React, { useState, useEffect } from 'react';
import { X, BookMarked, Copy, Check, Loader2, RefreshCw, Book, FileText, Globe, Scroll, GraduationCap } from 'lucide-react';
import { suggestReferences, ReferenceItem } from '../services/geminiService';

interface ReferencesPanelProps {
    title: string;
    subject: string;
    content: string;
    onClose: () => void;
}

const getTypeIcon = (type: string) => {
    switch (type) {
        case 'book': return <Book size={16} className="text-blue-500" />;
        case 'article': return <FileText size={16} className="text-green-500" />;
        case 'thesis': return <GraduationCap size={16} className="text-purple-500" />;
        case 'website': return <Globe size={16} className="text-cyan-500" />;
        case 'regulation': return <Scroll size={16} className="text-red-500" />;
        default: return <BookMarked size={16} className="text-gray-500" />;
    }
};

const getTypeLabel = (type: string) => {
    switch (type) {
        case 'book': return 'Sách';
        case 'article': return 'Bài báo';
        case 'thesis': return 'Luận văn/SKKN';
        case 'website': return 'Website';
        case 'regulation': return 'Văn bản pháp quy';
        default: return type;
    }
};

const getTypeColor = (type: string) => {
    switch (type) {
        case 'book': return 'bg-blue-100 text-blue-700 border-blue-200';
        case 'article': return 'bg-green-100 text-green-700 border-green-200';
        case 'thesis': return 'bg-purple-100 text-purple-700 border-purple-200';
        case 'website': return 'bg-cyan-100 text-cyan-700 border-cyan-200';
        case 'regulation': return 'bg-red-100 text-red-700 border-red-200';
        default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
};

const ReferencesPanel: React.FC<ReferencesPanelProps> = ({ title, subject, content, onClose }) => {
    const [references, setReferences] = useState<ReferenceItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

    const loadReferences = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const result = await suggestReferences(title, subject, content);
            setReferences(result);
        } catch (err: any) {
            setError(err.message || 'Không thể tải gợi ý tài liệu');
        }
        setIsLoading(false);
    };

    useEffect(() => {
        loadReferences();
    }, [title, subject, content]);

    const handleCopy = (citation: string, index: number) => {
        navigator.clipboard.writeText(citation);
        setCopiedIndex(index);
        setTimeout(() => setCopiedIndex(null), 2000);
    };

    const handleCopyAll = () => {
        const allCitations = references.map((ref, idx) => `[${idx + 1}] ${ref.citation}`).join('\n');
        navigator.clipboard.writeText(allCitations);
        setCopiedIndex(-1);
        setTimeout(() => setCopiedIndex(null), 2000);
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden animate-fade-in">
                {/* Header */}
                <div className="bg-gradient-to-r from-indigo-600 to-violet-600 p-5 text-white">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-white/20 rounded-lg">
                                <BookMarked size={24} />
                            </div>
                            <div>
                                <h2 className="text-xl font-bold">Gợi ý Tài liệu Tham khảo</h2>
                                <p className="text-indigo-100 text-sm">Dựa trên nội dung đề tài SKKN của bạn</p>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                        >
                            <X size={24} />
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    {isLoading && (
                        <div className="flex flex-col items-center py-16">
                            <Loader2 size={48} className="text-indigo-600 animate-spin mb-4" />
                            <p className="text-gray-600 font-medium">Đang tìm tài liệu phù hợp...</p>
                            <p className="text-sm text-gray-500">AI đang phân tích đề tài và gợi ý tài liệu</p>
                        </div>
                    )}

                    {error && (
                        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
                            <p className="text-red-700 font-medium mb-3">{error}</p>
                            <button
                                onClick={loadReferences}
                                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center gap-2 mx-auto"
                            >
                                <RefreshCw size={16} />
                                Thử lại
                            </button>
                        </div>
                    )}

                    {!isLoading && !error && references.length > 0 && (
                        <div className="space-y-4">
                            {/* Copy All Button */}
                            <div className="flex justify-end">
                                <button
                                    onClick={handleCopyAll}
                                    className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-all ${copiedIndex === -1
                                            ? 'bg-green-600 text-white'
                                            : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                                        }`}
                                >
                                    {copiedIndex === -1 ? <Check size={16} /> : <Copy size={16} />}
                                    {copiedIndex === -1 ? 'Đã sao chép!' : 'Sao chép tất cả'}
                                </button>
                            </div>

                            {/* Reference Cards */}
                            {references.map((ref, idx) => (
                                <div
                                    key={idx}
                                    className="border border-gray-200 rounded-xl p-4 hover:shadow-md transition-shadow"
                                >
                                    <div className="flex items-start gap-3">
                                        <div className="flex-shrink-0 w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center text-sm font-bold text-gray-600">
                                            {idx + 1}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap mb-2">
                                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full border ${getTypeColor(ref.type)}`}>
                                                    {getTypeIcon(ref.type)}
                                                    {getTypeLabel(ref.type)}
                                                </span>
                                                <span className="text-xs text-gray-500">{ref.year}</span>
                                            </div>
                                            <h3 className="font-semibold text-gray-800 mb-1">{ref.title}</h3>
                                            <p className="text-sm text-gray-600 mb-2">{ref.author}</p>
                                            <p className="text-sm text-gray-500 mb-3">{ref.description}</p>

                                            {/* Citation Box */}
                                            <div className="bg-gray-50 rounded-lg p-3 flex items-start gap-2">
                                                <p className="flex-1 text-sm text-gray-700 font-mono">{ref.citation}</p>
                                                <button
                                                    onClick={() => handleCopy(ref.citation, idx)}
                                                    className={`flex-shrink-0 p-1.5 rounded transition-colors ${copiedIndex === idx
                                                            ? 'bg-green-100 text-green-600'
                                                            : 'hover:bg-gray-200 text-gray-500'
                                                        }`}
                                                    title="Sao chép trích dẫn"
                                                >
                                                    {copiedIndex === idx ? <Check size={16} /> : <Copy size={16} />}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {!isLoading && !error && references.length === 0 && (
                        <div className="text-center py-12 text-gray-500">
                            <BookMarked size={48} className="mx-auto mb-3 opacity-30" />
                            <p>Không tìm thấy gợi ý tài liệu phù hợp</p>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="border-t border-gray-200 px-6 py-4 bg-gray-50">
                    <p className="text-xs text-gray-500 text-center">
                        💡 Lưu ý: Đây là gợi ý từ AI. Vui lòng kiểm tra và xác minh tính chính xác của tài liệu trước khi sử dụng.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default ReferencesPanel;
