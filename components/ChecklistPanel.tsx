import React, { useState, useEffect } from 'react';
import { X, CheckSquare, Square, Sparkles, TrendingUp, BookOpen, AlertTriangle, FileText, RotateCcw } from 'lucide-react';
import { AnalysisResult } from '../types';

interface ChecklistItem {
    id: string;
    category: 'plagiarism' | 'spelling' | 'innovation' | 'feasibility' | 'scientific' | 'presentation';
    text: string;
    priority: 'high' | 'medium' | 'low';
    completed: boolean;
}

interface ChecklistPanelProps {
    result: AnalysisResult;
    skknTitle: string;
    onClose: () => void;
}

const STORAGE_KEY = 'skkn-checklist';

const getCategoryIcon = (category: string) => {
    switch (category) {
        case 'plagiarism': return <AlertTriangle size={14} className="text-red-500" />;
        case 'spelling': return <BookOpen size={14} className="text-orange-500" />;
        case 'innovation': return <Sparkles size={14} className="text-blue-500" />;
        case 'feasibility': return <TrendingUp size={14} className="text-green-500" />;
        case 'scientific': return <FileText size={14} className="text-purple-500" />;
        case 'presentation': return <FileText size={14} className="text-indigo-500" />;
        default: return <CheckSquare size={14} />;
    }
};

const getCategoryLabel = (category: string) => {
    switch (category) {
        case 'plagiarism': return 'Đạo văn';
        case 'spelling': return 'Chính tả';
        case 'innovation': return 'Tính mới';
        case 'feasibility': return 'Khả thi';
        case 'scientific': return 'Khoa học';
        case 'presentation': return 'Hình thức';
        default: return category;
    }
};

const getPriorityColor = (priority: string) => {
    switch (priority) {
        case 'high': return 'bg-red-100 text-red-700 border-red-200';
        case 'medium': return 'bg-yellow-100 text-yellow-700 border-yellow-200';
        case 'low': return 'bg-green-100 text-green-700 border-green-200';
        default: return 'bg-gray-100 text-gray-700';
    }
};

const generateChecklist = (result: AnalysisResult): ChecklistItem[] => {
    const items: ChecklistItem[] = [];
    let idCounter = 0;

    // Từ plagiarismSegments - Priority cao
    result.plagiarismSegments.forEach((seg, idx) => {
        items.push({
            id: `plag-${idCounter++}`,
            category: 'plagiarism',
            text: `Viết lại đoạn: "${seg.segment.substring(0, 50)}..."`,
            priority: 'high',
            completed: false
        });
    });

    // Từ spellingErrors - Priority trung bình
    if (result.spellingErrors.length > 0) {
        items.push({
            id: `spell-${idCounter++}`,
            category: 'spelling',
            text: `Sửa ${result.spellingErrors.length} lỗi chính tả/ngữ pháp đã phát hiện`,
            priority: 'medium',
            completed: false
        });
    }

    // Từ scoreDetails - Các điểm yếu cần khắc phục
    result.scoreDetails.forEach((detail) => {
        if (detail.weakness && detail.weakness.trim()) {
            let category: ChecklistItem['category'] = 'innovation';
            if (detail.category.toLowerCase().includes('khả thi')) category = 'feasibility';
            else if (detail.category.toLowerCase().includes('khoa học')) category = 'scientific';
            else if (detail.category.toLowerCase().includes('hình thức')) category = 'presentation';

            items.push({
                id: `score-${idCounter++}`,
                category,
                text: `Khắc phục: ${detail.weakness}`,
                priority: 'medium',
                completed: false
            });
        }
    });

    // Từ developmentPlan - Các task ngắn hạn
    result.developmentPlan.shortTerm.forEach((task) => {
        items.push({
            id: `short-${idCounter++}`,
            category: 'innovation',
            text: task,
            priority: 'high',
            completed: false
        });
    });

    // Từ developmentPlan - Các task trung hạn
    result.developmentPlan.mediumTerm.forEach((task) => {
        items.push({
            id: `medium-${idCounter++}`,
            category: 'feasibility',
            text: task,
            priority: 'medium',
            completed: false
        });
    });

    // Từ developmentPlan - Các task dài hạn
    result.developmentPlan.longTerm.forEach((task) => {
        items.push({
            id: `long-${idCounter++}`,
            category: 'scientific',
            text: task,
            priority: 'low',
            completed: false
        });
    });

    return items;
};

const ChecklistPanel: React.FC<ChecklistPanelProps> = ({ result, skknTitle, onClose }) => {
    const [items, setItems] = useState<ChecklistItem[]>([]);
    const [filter, setFilter] = useState<'all' | 'pending' | 'completed'>('all');

    // Load từ localStorage hoặc generate mới
    useEffect(() => {
        const storageKey = `${STORAGE_KEY}-${skknTitle.substring(0, 30)}`;
        const saved = localStorage.getItem(storageKey);
        if (saved) {
            try {
                setItems(JSON.parse(saved));
            } catch {
                setItems(generateChecklist(result));
            }
        } else {
            setItems(generateChecklist(result));
        }
    }, [result, skknTitle]);

    // Lưu vào localStorage khi thay đổi
    useEffect(() => {
        if (items.length > 0) {
            const storageKey = `${STORAGE_KEY}-${skknTitle.substring(0, 30)}`;
            localStorage.setItem(storageKey, JSON.stringify(items));
        }
    }, [items, skknTitle]);

    const toggleItem = (id: string) => {
        setItems(prev => prev.map(item =>
            item.id === id ? { ...item, completed: !item.completed } : item
        ));
    };

    const resetChecklist = () => {
        const newItems = generateChecklist(result);
        setItems(newItems);
    };

    const completedCount = items.filter(i => i.completed).length;
    const progress = items.length > 0 ? Math.round((completedCount / items.length) * 100) : 0;

    const filteredItems = items.filter(item => {
        if (filter === 'pending') return !item.completed;
        if (filter === 'completed') return item.completed;
        return true;
    });

    // Nhóm theo category
    const groupedItems = filteredItems.reduce((acc, item) => {
        if (!acc[item.category]) acc[item.category] = [];
        acc[item.category].push(item);
        return acc;
    }, {} as Record<string, ChecklistItem[]>);

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-fade-in">
                {/* Header */}
                <div className="bg-gradient-to-r from-emerald-600 to-teal-600 p-5 text-white">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-white/20 rounded-lg">
                                <CheckSquare size={24} />
                            </div>
                            <div>
                                <h2 className="text-xl font-bold">Checklist Cải thiện SKKN</h2>
                                <p className="text-emerald-100 text-sm line-clamp-1">{skknTitle}</p>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                        >
                            <X size={24} />
                        </button>
                    </div>

                    {/* Progress Bar */}
                    <div className="bg-white/20 rounded-full h-3 overflow-hidden">
                        <div
                            className="h-full bg-white rounded-full transition-all duration-500"
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                    <div className="flex justify-between mt-2 text-sm">
                        <span>{completedCount}/{items.length} hoàn thành</span>
                        <span className="font-bold">{progress}%</span>
                    </div>
                </div>

                {/* Filter Tabs */}
                <div className="flex border-b border-gray-200 px-4">
                    {(['all', 'pending', 'completed'] as const).map((f) => (
                        <button
                            key={f}
                            onClick={() => setFilter(f)}
                            className={`px-4 py-3 text-sm font-medium transition-colors border-b-2 -mb-px ${filter === f
                                ? 'text-emerald-600 border-emerald-600'
                                : 'text-gray-500 border-transparent hover:text-gray-700'
                                }`}
                        >
                            {f === 'all' ? 'Tất cả' : f === 'pending' ? 'Chưa xong' : 'Hoàn thành'}
                            <span className="ml-1.5 px-1.5 py-0.5 bg-gray-100 rounded text-xs">
                                {f === 'all' ? items.length :
                                    f === 'pending' ? items.filter(i => !i.completed).length :
                                        completedCount}
                            </span>
                        </button>
                    ))}
                    <div className="flex-1" />
                    <button
                        onClick={resetChecklist}
                        className="px-3 py-2 text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1"
                        title="Đặt lại checklist"
                    >
                        <RotateCcw size={14} />
                        <span className="hidden sm:inline">Reset</span>
                    </button>
                </div>

                {/* Checklist Items */}
                <div className="flex-1 overflow-y-auto p-4 space-y-6">
                    {Object.entries(groupedItems).map(([category, categoryItems]: [string, ChecklistItem[]]) => (
                        <div key={category}>
                            <h3 className="text-sm font-semibold text-gray-600 mb-2 flex items-center gap-2">
                                {getCategoryIcon(category)}
                                {getCategoryLabel(category)}
                                <span className="text-gray-400">({categoryItems.length})</span>
                            </h3>
                            <div className="space-y-2">
                                {categoryItems.map((item) => (
                                    <div
                                        key={item.id}
                                        onClick={() => toggleItem(item.id)}
                                        className={`flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-all ${item.completed
                                            ? 'bg-gray-50 opacity-60'
                                            : 'bg-white border border-gray-200 hover:border-emerald-300 hover:shadow-sm'
                                            }`}
                                    >
                                        <div className="mt-0.5">
                                            {item.completed ? (
                                                <CheckSquare size={20} className="text-emerald-600" />
                                            ) : (
                                                <Square size={20} className="text-gray-400" />
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className={`text-sm ${item.completed ? 'line-through text-gray-500' : 'text-gray-800'}`}>
                                                {item.text}
                                            </p>
                                        </div>
                                        <span className={`px-2 py-0.5 text-xs rounded border ${getPriorityColor(item.priority)}`}>
                                            {item.priority === 'high' ? 'Cao' : item.priority === 'medium' ? 'TB' : 'Thấp'}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}

                    {filteredItems.length === 0 && (
                        <div className="text-center py-12 text-gray-500">
                            <CheckSquare size={48} className="mx-auto mb-3 opacity-30" />
                            <p>Không có mục nào</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ChecklistPanel;
