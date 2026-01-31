/**
 * History Service - Quản lý lịch sử kiểm tra SKKN
 */

import { SKKNInput, AnalysisResult } from '../types';

const STORAGE_KEY = 'skkn_check_history';
const MAX_HISTORY_ITEMS = 20;

export interface HistoryItem {
    id: string;
    timestamp: number;
    input: SKKNInput;
    result: AnalysisResult;
}

/**
 * Tạo ID duy nhất
 */
const generateId = (): string => {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
};

/**
 * Lấy tất cả lịch sử
 */
export const getHistory = (): HistoryItem[] => {
    try {
        const data = localStorage.getItem(STORAGE_KEY);
        if (!data) return [];
        return JSON.parse(data) as HistoryItem[];
    } catch (error) {
        console.error('Error reading history:', error);
        return [];
    }
};

/**
 * Lưu kết quả kiểm tra mới
 */
export const saveToHistory = (input: SKKNInput, result: AnalysisResult): HistoryItem => {
    const history = getHistory();

    const newItem: HistoryItem = {
        id: generateId(),
        timestamp: Date.now(),
        input,
        result
    };

    // Thêm vào đầu danh sách
    history.unshift(newItem);

    // Giữ tối đa MAX_HISTORY_ITEMS
    const trimmedHistory = history.slice(0, MAX_HISTORY_ITEMS);

    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmedHistory));
    } catch (error) {
        console.error('Error saving history:', error);
    }

    return newItem;
};

/**
 * Lấy một item theo ID
 */
export const getHistoryItem = (id: string): HistoryItem | null => {
    const history = getHistory();
    return history.find(item => item.id === id) || null;
};

/**
 * Xóa một item
 */
export const deleteHistoryItem = (id: string): void => {
    const history = getHistory();
    const filtered = history.filter(item => item.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
};

/**
 * Xóa toàn bộ lịch sử
 */
export const clearHistory = (): void => {
    localStorage.removeItem(STORAGE_KEY);
};

/**
 * Format thời gian
 */
export const formatTimestamp = (timestamp: number): string => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffHours < 1) {
        return 'Vừa xong';
    } else if (diffHours < 24) {
        return `${diffHours} giờ trước`;
    } else if (diffDays < 7) {
        return `${diffDays} ngày trước`;
    } else {
        return date.toLocaleDateString('vi-VN', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
    }
};
