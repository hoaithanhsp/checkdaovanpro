import React, { useState, useEffect } from 'react';
import { X, Key, ExternalLink, Check, AlertCircle, Settings, Plus, Trash2, Clock, AlertTriangle, CheckCircle2 } from 'lucide-react';
import {
    getApiKeys,
    addApiKey,
    removeApiKey,
    getRemainingCooldown,
    getActiveKeyCount,
    ApiKeyEntry,
} from '../services/apiKeyService';

interface ApiKeyModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (apiKey: string, model: string) => void;
    isRequired?: boolean;
}

const MODELS = [
    { id: 'gemini-3-flash-preview', name: 'Gemini 3 Flash', description: 'Nhanh và hiệu quả', default: true },
    { id: 'gemini-3-pro-preview', name: 'Gemini 3 Pro', description: 'Mạnh mẽ và chi tiết' },
    { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', description: 'Ổn định và đáng tin cậy' },
];

const MODEL_STORAGE = 'skkn-gemini-model';
const MAX_KEYS = 10;

export const getStoredApiKey = (): string => {
    // Trả về key đầu tiên nếu có, để tương thích ngược
    const keys = getApiKeys();
    return keys.length > 0 ? keys[0].key : '';
};

export const getStoredModel = (): string => {
    return localStorage.getItem(MODEL_STORAGE) || MODELS[0].id;
};

export const saveApiKeyAndModel = (apiKey: string, model: string): void => {
    // Thêm key mới nếu chưa có
    const keys = getApiKeys();
    if (!keys.some(k => k.key === apiKey)) {
        addApiKey(apiKey);
    }
    localStorage.setItem(MODEL_STORAGE, model);
};

// Helper để mask API key
const maskApiKey = (key: string): string => {
    if (key.length <= 10) return key;
    return `${key.substring(0, 6)}...${key.substring(key.length - 4)}`;
};

// Helper để format thời gian cooldown
const formatCooldown = (ms: number): string => {
    const seconds = Math.ceil(ms / 1000);
    if (seconds < 60) return `${seconds}s`;
    return `${Math.ceil(seconds / 60)} phút`;
};

// Component hiển thị trạng thái key
const KeyStatusBadge: React.FC<{ entry: ApiKeyEntry }> = ({ entry }) => {
    const cooldown = getRemainingCooldown(entry);

    if (cooldown > 0) {
        return (
            <span className="flex items-center gap-1 px-2 py-0.5 bg-yellow-100 text-yellow-700 text-xs rounded-full">
                <Clock size={12} />
                Chờ {formatCooldown(cooldown)}
            </span>
        );
    }

    if (entry.lastError) {
        return (
            <span className="flex items-center gap-1 px-2 py-0.5 bg-red-100 text-red-700 text-xs rounded-full">
                <AlertTriangle size={12} />
                Lỗi
            </span>
        );
    }

    return (
        <span className="flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full">
            <CheckCircle2 size={12} />
            Sẵn sàng
        </span>
    );
};

const ApiKeyModal: React.FC<ApiKeyModalProps> = ({ isOpen, onClose, onSave, isRequired = false }) => {
    const [apiKeys, setApiKeys] = useState<ApiKeyEntry[]>([]);
    const [newKeyInput, setNewKeyInput] = useState('');
    const [newKeyName, setNewKeyName] = useState('');
    const [selectedModel, setSelectedModel] = useState(MODELS[0].id);
    const [error, setError] = useState('');
    const [keyCount, setKeyCount] = useState({ active: 0, total: 0, inCooldown: 0 });

    // Refresh key list và trạng thái
    const refreshKeys = () => {
        setApiKeys(getApiKeys());
        setKeyCount(getActiveKeyCount());
    };

    useEffect(() => {
        if (isOpen) {
            refreshKeys();
            setSelectedModel(getStoredModel());
            setError('');
            setNewKeyInput('');
            setNewKeyName('');
        }
    }, [isOpen]);

    // Auto-refresh cooldown status mỗi 5 giây
    useEffect(() => {
        if (!isOpen) return;
        const interval = setInterval(refreshKeys, 5000);
        return () => clearInterval(interval);
    }, [isOpen]);

    const handleAddKey = () => {
        const key = newKeyInput.trim();

        if (!key) {
            setError('Vui lòng nhập API Key');
            return;
        }
        if (!key.startsWith('AIza')) {
            setError('API Key không hợp lệ. Key phải bắt đầu bằng "AIza"');
            return;
        }
        if (apiKeys.some(k => k.key === key)) {
            setError('API Key này đã tồn tại');
            return;
        }
        if (apiKeys.length >= MAX_KEYS) {
            setError(`Đã đạt giới hạn ${MAX_KEYS} key`);
            return;
        }

        const result = addApiKey(key, newKeyName.trim() || undefined);
        if (result) {
            refreshKeys();
            setNewKeyInput('');
            setNewKeyName('');
            setError('');
        }
    };

    const handleRemoveKey = (id: string) => {
        removeApiKey(id);
        refreshKeys();
    };

    const handleSave = () => {
        if (apiKeys.length === 0) {
            setError('Vui lòng thêm ít nhất 1 API Key');
            return;
        }

        localStorage.setItem(MODEL_STORAGE, selectedModel);
        onSave(apiKeys[0].key, selectedModel);
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto animate-fade-in">
                {/* Header */}
                <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-5 text-white flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-white/20 rounded-lg">
                            <Key size={24} />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold">Quản lý API Keys</h2>
                            <p className="text-blue-100 text-sm">
                                {keyCount.total > 0
                                    ? `${keyCount.active} key sẵn sàng / ${keyCount.total} tổng`
                                    : 'Thêm API Key để sử dụng app'}
                            </p>
                        </div>
                    </div>
                    {!isRequired && (
                        <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-lg transition-colors">
                            <X size={24} />
                        </button>
                    )}
                </div>

                {/* Content */}
                <div className="p-6 space-y-6">
                    {/* Model Selection */}
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-3">Chọn Model AI</label>
                        <div className="space-y-2">
                            {MODELS.map((model) => (
                                <label
                                    key={model.id}
                                    className={`flex items-center gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all ${selectedModel === model.id
                                        ? 'border-blue-500 bg-blue-50'
                                        : 'border-gray-200 hover:border-gray-300'
                                        }`}
                                >
                                    <input
                                        type="radio"
                                        name="model"
                                        value={model.id}
                                        checked={selectedModel === model.id}
                                        onChange={(e) => setSelectedModel(e.target.value)}
                                        className="hidden"
                                    />
                                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${selectedModel === model.id ? 'border-blue-500 bg-blue-500' : 'border-gray-300'
                                        }`}>
                                        {selectedModel === model.id && <Check size={12} className="text-white" />}
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2">
                                            <span className="font-semibold text-gray-800">{model.name}</span>
                                            {model.default && (
                                                <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full">Mặc định</span>
                                            )}
                                        </div>
                                        <p className="text-sm text-gray-500">{model.description}</p>
                                    </div>
                                </label>
                            ))}
                        </div>
                    </div>

                    {/* API Keys List */}
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-3">
                            Danh sách API Keys ({apiKeys.length}/{MAX_KEYS})
                        </label>

                        {apiKeys.length === 0 ? (
                            <div className="text-center py-6 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
                                <Key size={32} className="mx-auto text-gray-400 mb-2" />
                                <p className="text-gray-500 text-sm">Chưa có API Key nào</p>
                                <p className="text-gray-400 text-xs">Thêm key bên dưới để bắt đầu</p>
                            </div>
                        ) : (
                            <div className="space-y-2 max-h-48 overflow-y-auto">
                                {apiKeys.map((entry, index) => (
                                    <div
                                        key={entry.id}
                                        className={`flex items-center gap-3 p-3 rounded-xl border ${entry.lastError ? 'border-red-200 bg-red-50' : 'border-gray-200 bg-gray-50'
                                            }`}
                                    >
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <span className="font-medium text-gray-800 truncate">
                                                    {entry.name || `Key ${index + 1}`}
                                                </span>
                                                <KeyStatusBadge entry={entry} />
                                            </div>
                                            <p className="text-xs text-gray-500 font-mono">
                                                {maskApiKey(entry.key)}
                                            </p>
                                            {entry.lastError && (
                                                <p className="text-xs text-red-500 mt-1 truncate" title={entry.lastError}>
                                                    {entry.lastError}
                                                </p>
                                            )}
                                        </div>
                                        <button
                                            onClick={() => handleRemoveKey(entry.id)}
                                            className="p-2 text-red-500 hover:bg-red-100 rounded-lg transition-colors"
                                            title="Xóa key"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Add New Key */}
                    <div className="bg-blue-50 rounded-xl p-4 space-y-3">
                        <label className="block text-sm font-semibold text-blue-700">
                            <Plus size={16} className="inline mr-1" />
                            Thêm API Key mới
                        </label>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={newKeyName}
                                onChange={(e) => setNewKeyName(e.target.value)}
                                placeholder="Tên (tùy chọn)"
                                className="w-1/3 px-3 py-2 border-2 border-blue-200 rounded-lg focus:outline-none focus:border-blue-400 text-sm"
                            />
                            <input
                                type="password"
                                value={newKeyInput}
                                onChange={(e) => { setNewKeyInput(e.target.value); setError(''); }}
                                placeholder="AIza..."
                                className="flex-1 px-3 py-2 border-2 border-blue-200 rounded-lg focus:outline-none focus:border-blue-400 text-sm font-mono"
                            />
                        </div>
                        <button
                            onClick={handleAddKey}
                            disabled={apiKeys.length >= MAX_KEYS}
                            className="w-full py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
                        >
                            <Plus size={16} />
                            Thêm key
                        </button>
                        {error && (
                            <p className="text-sm text-red-600 flex items-center gap-1">
                                <AlertCircle size={14} /> {error}
                            </p>
                        )}
                    </div>

                    {/* Info Box */}
                    <div className="bg-gradient-to-r from-yellow-50 to-orange-50 rounded-xl p-4 border border-yellow-200">
                        <p className="text-sm font-medium text-yellow-800 mb-2">💡 Xoay vòng tự động</p>
                        <p className="text-xs text-yellow-700">
                            Khi gặp lỗi quota hoặc rate limit, hệ thống sẽ tự động chuyển sang key tiếp theo.
                            Thêm nhiều key để tránh gián đoạn khi sử dụng.
                        </p>
                    </div>

                    {/* Help Links */}
                    <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                        <p className="text-sm font-medium text-gray-700">Hướng dẫn lấy API Key:</p>
                        <div className="space-y-2">
                            <a
                                href="https://aistudio.google.com/apikey"
                                target="_blank"
                                rel="noreferrer"
                                className="flex items-center gap-2 text-blue-600 hover:text-blue-700 text-sm"
                            >
                                <ExternalLink size={14} />
                                Lấy API Key tại Google AI Studio
                            </a>
                            <a
                                href="https://drive.google.com/drive/folders/1G6eiVeeeEvsYgNk2Om7FEybWf30EP1HN?usp=drive_link"
                                target="_blank"
                                rel="noreferrer"
                                className="flex items-center gap-2 text-blue-600 hover:text-blue-700 text-sm"
                            >
                                <ExternalLink size={14} />
                                Xem hướng dẫn chi tiết (Video)
                            </a>
                        </div>
                    </div>

                    {/* Save Button */}
                    <button
                        onClick={handleSave}
                        disabled={apiKeys.length === 0}
                        className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-bold rounded-xl transition-colors"
                    >
                        Lưu cấu hình
                    </button>
                </div>
            </div>
        </div>
    );
};

// Header Settings Button Component
export const ApiKeySettingsButton: React.FC<{ onClick: () => void; hasKey: boolean }> = ({ onClick, hasKey }) => {
    const keyCount = getActiveKeyCount();

    return (
        <button
            onClick={onClick}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg transition-colors ${hasKey ? 'hover:bg-gray-100' : 'bg-red-50 hover:bg-red-100'}`}
        >
            <Settings size={18} className={hasKey ? '' : 'text-red-600'} />
            <span className={`hidden sm:inline ${!hasKey ? 'text-red-600 font-medium' : ''}`}>
                {hasKey
                    ? (keyCount.total > 1 ? `${keyCount.active}/${keyCount.total} Keys` : 'API Key')
                    : 'Lấy API key để sử dụng app'}
            </span>
        </button>
    );
};

export default ApiKeyModal;
