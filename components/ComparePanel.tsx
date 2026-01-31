import React, { useState, useEffect } from 'react';
import { GitCompare, X, ArrowRight, TrendingUp, TrendingDown, Minus, Check, Award, Clock } from 'lucide-react';
import { getHistory, formatTimestamp, HistoryItem } from '../services/historyService';

interface ComparePanelProps {
    onClose: () => void;
}

const ComparePanel: React.FC<ComparePanelProps> = ({ onClose }) => {
    const [history, setHistory] = useState<HistoryItem[]>([]);
    const [selectedItems, setSelectedItems] = useState<[HistoryItem | null, HistoryItem | null]>([null, null]);
    const [step, setStep] = useState<'select' | 'compare'>('select');

    useEffect(() => {
        setHistory(getHistory());
    }, []);

    const handleSelect = (item: HistoryItem, slot: 0 | 1) => {
        const newSelection = [...selectedItems] as [HistoryItem | null, HistoryItem | null];
        newSelection[slot] = item;
        setSelectedItems(newSelection);
    };

    const handleCompare = () => {
        if (selectedItems[0] && selectedItems[1]) {
            setStep('compare');
        }
    };

    const getDiff = (val1: number, val2: number) => {
        const diff = val2 - val1;
        if (diff > 0) return { icon: TrendingUp, color: 'text-green-600', text: `+${diff}` };
        if (diff < 0) return { icon: TrendingDown, color: 'text-red-600', text: `${diff}` };
        return { icon: Minus, color: 'text-gray-400', text: '0' };
    };

    const renderComparison = () => {
        if (!selectedItems[0] || !selectedItems[1]) return null;
        const [item1, item2] = selectedItems;
        const scores1 = item1.result.scores;
        const scores2 = item2.result.scores;

        const scoreComparisons = [
            { label: 'Tính mới & Sáng tạo', s1: scores1.innovation, s2: scores2.innovation, max: 30 },
            { label: 'Tính khả thi & Hiệu quả', s1: scores1.feasibility, s2: scores2.feasibility, max: 40 },
            { label: 'Tính khoa học', s1: scores1.scientific, s2: scores2.scientific, max: 20 },
            { label: 'Hình thức trình bày', s1: scores1.presentation, s2: scores2.presentation, max: 10 },
            { label: 'TỔNG ĐIỂM', s1: scores1.total, s2: scores2.total, max: 100, isTotal: true },
        ];

        return (
            <div className="space-y-6">
                {/* Headers */}
                <div className="grid grid-cols-3 gap-4 text-center">
                    <div className="bg-blue-50 rounded-lg p-4">
                        <p className="text-xs text-blue-600 font-medium mb-1">Phiên bản 1</p>
                        <p className="font-bold text-gray-800 text-sm line-clamp-2">{item1.input.title}</p>
                        <p className="text-xs text-gray-500 mt-1">{formatTimestamp(item1.timestamp)}</p>
                    </div>
                    <div className="flex items-center justify-center">
                        <GitCompare size={24} className="text-gray-400" />
                    </div>
                    <div className="bg-purple-50 rounded-lg p-4">
                        <p className="text-xs text-purple-600 font-medium mb-1">Phiên bản 2</p>
                        <p className="font-bold text-gray-800 text-sm line-clamp-2">{item2.input.title}</p>
                        <p className="text-xs text-gray-500 mt-1">{formatTimestamp(item2.timestamp)}</p>
                    </div>
                </div>

                {/* Score Comparisons */}
                <div className="bg-gray-50 rounded-xl overflow-hidden">
                    <table className="w-full">
                        <thead>
                            <tr className="bg-gray-100">
                                <th className="text-left px-4 py-3 text-sm font-semibold text-gray-700">Tiêu chí</th>
                                <th className="text-center px-4 py-3 text-sm font-semibold text-blue-600 w-20">V1</th>
                                <th className="text-center px-4 py-3 text-sm font-semibold text-gray-400 w-16">→</th>
                                <th className="text-center px-4 py-3 text-sm font-semibold text-purple-600 w-20">V2</th>
                                <th className="text-center px-4 py-3 text-sm font-semibold text-gray-700 w-20">Thay đổi</th>
                            </tr>
                        </thead>
                        <tbody>
                            {scoreComparisons.map((row, idx) => {
                                const diff = getDiff(row.s1, row.s2);
                                const DiffIcon = diff.icon;
                                return (
                                    <tr
                                        key={idx}
                                        className={`border-t border-gray-200 ${row.isTotal ? 'bg-blue-50 font-bold' : ''}`}
                                    >
                                        <td className="px-4 py-3 text-sm">{row.label}</td>
                                        <td className="text-center px-4 py-3">
                                            <span className={`text-sm ${row.isTotal ? 'text-xl' : ''}`}>{row.s1}</span>
                                            <span className="text-xs text-gray-400">/{row.max}</span>
                                        </td>
                                        <td className="text-center px-4 py-3">
                                            <ArrowRight size={16} className="inline text-gray-400" />
                                        </td>
                                        <td className="text-center px-4 py-3">
                                            <span className={`text-sm ${row.isTotal ? 'text-xl' : ''}`}>{row.s2}</span>
                                            <span className="text-xs text-gray-400">/{row.max}</span>
                                        </td>
                                        <td className="text-center px-4 py-3">
                                            <span className={`flex items-center justify-center gap-1 ${diff.color} font-medium`}>
                                                <DiffIcon size={16} />
                                                {diff.text}
                                            </span>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                {/* Summary */}
                <div className="grid grid-cols-2 gap-4">
                    <div className="bg-gray-50 rounded-lg p-4">
                        <p className="text-xs text-gray-500 mb-1">Đạo văn V1</p>
                        <p className="font-medium text-gray-800">{item1.result.plagiarismRisk}</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-4">
                        <p className="text-xs text-gray-500 mb-1">Đạo văn V2</p>
                        <p className="font-medium text-gray-800">{item2.result.plagiarismRisk}</p>
                    </div>
                </div>

                <button
                    onClick={() => setStep('select')}
                    className="w-full py-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors text-sm font-medium"
                >
                    ← Chọn lại phiên bản khác
                </button>
            </div>
        );
    };

    const renderSelection = () => (
        <div className="space-y-4">
            {history.length < 2 ? (
                <div className="text-center py-8 text-gray-500">
                    <GitCompare size={48} className="mx-auto mb-4 opacity-40" />
                    <p className="font-medium">Cần ít nhất 2 kết quả kiểm tra</p>
                    <p className="text-sm">Hãy kiểm tra thêm SKKN để có thể so sánh</p>
                </div>
            ) : (
                <>
                    <div className="grid grid-cols-2 gap-4">
                        {/* Slot 1 */}
                        <div>
                            <p className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-1">
                                <span className="w-5 h-5 bg-blue-600 text-white rounded-full text-xs flex items-center justify-center">1</span>
                                Chọn phiên bản 1
                            </p>
                            <div className="space-y-2 max-h-[250px] overflow-y-auto">
                                {history.map((item) => (
                                    <button
                                        key={item.id}
                                        onClick={() => handleSelect(item, 0)}
                                        disabled={selectedItems[1]?.id === item.id}
                                        className={`w-full text-left p-3 rounded-lg border transition-all ${selectedItems[0]?.id === item.id
                                                ? 'border-blue-500 bg-blue-50'
                                                : selectedItems[1]?.id === item.id
                                                    ? 'border-gray-200 bg-gray-100 opacity-50 cursor-not-allowed'
                                                    : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
                                            }`}
                                    >
                                        <p className="font-medium text-sm text-gray-800 line-clamp-1">{item.input.title}</p>
                                        <div className="flex items-center justify-between mt-1">
                                            <span className="text-xs text-gray-500">{formatTimestamp(item.timestamp)}</span>
                                            <span className="text-xs font-bold text-blue-600">{item.result.scores.total}/100</span>
                                        </div>
                                        {selectedItems[0]?.id === item.id && (
                                            <Check size={16} className="absolute top-2 right-2 text-blue-600" />
                                        )}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Slot 2 */}
                        <div>
                            <p className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-1">
                                <span className="w-5 h-5 bg-purple-600 text-white rounded-full text-xs flex items-center justify-center">2</span>
                                Chọn phiên bản 2
                            </p>
                            <div className="space-y-2 max-h-[250px] overflow-y-auto">
                                {history.map((item) => (
                                    <button
                                        key={item.id}
                                        onClick={() => handleSelect(item, 1)}
                                        disabled={selectedItems[0]?.id === item.id}
                                        className={`w-full text-left p-3 rounded-lg border transition-all ${selectedItems[1]?.id === item.id
                                                ? 'border-purple-500 bg-purple-50'
                                                : selectedItems[0]?.id === item.id
                                                    ? 'border-gray-200 bg-gray-100 opacity-50 cursor-not-allowed'
                                                    : 'border-gray-200 hover:border-purple-300 hover:bg-gray-50'
                                            }`}
                                    >
                                        <p className="font-medium text-sm text-gray-800 line-clamp-1">{item.input.title}</p>
                                        <div className="flex items-center justify-between mt-1">
                                            <span className="text-xs text-gray-500">{formatTimestamp(item.timestamp)}</span>
                                            <span className="text-xs font-bold text-purple-600">{item.result.scores.total}/100</span>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    <button
                        onClick={handleCompare}
                        disabled={!selectedItems[0] || !selectedItems[1]}
                        className={`w-full py-3 rounded-lg font-semibold flex items-center justify-center gap-2 transition-all ${selectedItems[0] && selectedItems[1]
                                ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:shadow-lg'
                                : 'bg-gray-200 text-gray-500 cursor-not-allowed'
                            }`}
                    >
                        <GitCompare size={18} />
                        So sánh 2 phiên bản
                    </button>
                </>
            )}
        </div>
    );

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden animate-fade-in">
                {/* Header */}
                <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-5 text-white flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-white/20 rounded-lg">
                            <GitCompare size={24} />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold">So sánh phiên bản</h2>
                            <p className="text-blue-100 text-sm">
                                {step === 'select' ? 'Chọn 2 kết quả để so sánh' : 'Kết quả so sánh'}
                            </p>
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
                <div className="flex-1 overflow-y-auto p-6">
                    {step === 'select' ? renderSelection() : renderComparison()}
                </div>
            </div>
        </div>
    );
};

export default ComparePanel;
