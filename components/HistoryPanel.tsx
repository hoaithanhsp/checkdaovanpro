import React, { useState, useEffect } from 'react';
import { History, Trash2, Eye, Clock, Award, X, AlertTriangle } from 'lucide-react';
import {
    getHistory,
    deleteHistoryItem,
    clearHistory,
    formatTimestamp,
    HistoryItem
} from '../services/historyService';

interface HistoryPanelProps {
    onViewResult: (item: HistoryItem) => void;
    onClose: () => void;
}

const HistoryPanel: React.FC<HistoryPanelProps> = ({ onViewResult, onClose }) => {
    const [history, setHistory] = useState<HistoryItem[]>([]);
    const [showConfirmClear, setShowConfirmClear] = useState(false);

    useEffect(() => {
        setHistory(getHistory());
    }, []);

    const handleDelete = (id: string) => {
        deleteHistoryItem(id);
        setHistory(getHistory());
    };

    const handleClearAll = () => {
        clearHistory();
        setHistory([]);
        setShowConfirmClear(false);
    };

    const getScoreColor = (score: number) => {
        if (score >= 80) return 'text-green-600 bg-green-100';
        if (score >= 60) return 'text-yellow-600 bg-yellow-100';
        return 'text-red-600 bg-red-100';
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col overflow-hidden animate-fade-in">
                {/* Header */}
                <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-5 text-white flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-white/20 rounded-lg">
                            <History size={24} />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold">Lịch sử kiểm tra</h2>
                            <p className="text-indigo-100 text-sm">{history.length} bản ghi</p>
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
                <div className="flex-1 overflow-y-auto p-4">
                    {history.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                            <History size={48} className="mb-4 opacity-50" />
                            <p className="text-lg font-medium">Chưa có lịch sử kiểm tra</p>
                            <p className="text-sm">Kết quả kiểm tra sẽ được lưu tại đây</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {history.map((item) => (
                                <div
                                    key={item.id}
                                    className="bg-gray-50 hover:bg-gray-100 rounded-xl p-4 border border-gray-200 transition-colors group"
                                >
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="flex-1 min-w-0">
                                            <h3 className="font-semibold text-gray-800 truncate mb-1">
                                                {item.input.title || 'Không có tiêu đề'}
                                            </h3>
                                            <div className="flex flex-wrap items-center gap-2 text-sm text-gray-500">
                                                <span className="flex items-center gap-1">
                                                    <Clock size={14} />
                                                    {formatTimestamp(item.timestamp)}
                                                </span>
                                                <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs">
                                                    {item.input.level}
                                                </span>
                                                <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full text-xs">
                                                    {item.input.subject}
                                                </span>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            <span className={`flex items-center gap-1 px-3 py-1.5 rounded-lg font-bold text-sm ${getScoreColor(item.result.scores.total)}`}>
                                                <Award size={16} />
                                                {item.result.scores.total}/100
                                            </span>
                                            <button
                                                onClick={() => onViewResult(item)}
                                                className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors"
                                                title="Xem chi tiết"
                                            >
                                                <Eye size={18} />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(item.id)}
                                                className="p-2 text-red-500 hover:bg-red-100 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                                                title="Xóa"
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer */}
                {history.length > 0 && (
                    <div className="border-t border-gray-200 p-4 bg-gray-50">
                        {showConfirmClear ? (
                            <div className="flex items-center justify-between bg-red-50 p-3 rounded-lg border border-red-200">
                                <span className="text-red-700 flex items-center gap-2">
                                    <AlertTriangle size={18} />
                                    Xóa toàn bộ lịch sử?
                                </span>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => setShowConfirmClear(false)}
                                        className="px-3 py-1.5 text-gray-600 hover:bg-gray-200 rounded-lg text-sm"
                                    >
                                        Hủy
                                    </button>
                                    <button
                                        onClick={handleClearAll}
                                        className="px-3 py-1.5 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700"
                                    >
                                        Xác nhận xóa
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <button
                                onClick={() => setShowConfirmClear(true)}
                                className="text-red-600 hover:text-red-700 text-sm flex items-center gap-1"
                            >
                                <Trash2 size={16} />
                                Xóa toàn bộ lịch sử
                            </button>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default HistoryPanel;
