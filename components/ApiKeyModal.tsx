import React, { useState, useEffect } from 'react';
import { X, Key, ExternalLink, Check, AlertCircle, Settings, ChevronDown, ChevronUp } from 'lucide-react';
import {
    getApiKey,
    saveApiKey,
    getSelectedModel,
    saveSelectedModel,
    hasAnyKey,
    ENV_API_KEYS,
} from '../services/apiKeyService';

/** Ẩn API key, chỉ hiện 4 ký tự đầu + 4 ký tự cuối */
const maskKey = (key: string): string => {
    if (key.length <= 10) return '••••••••••';
    return key.slice(0, 4) + '••••••••••••••••••••••••••••••••' + key.slice(-4);
};

interface ApiKeyModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (apiKey: string, model: string) => void;
    isRequired?: boolean;
}

const FREE_MODELS = [
    { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', description: 'Mới, mạnh mẽ hơn', default: true },
    { id: 'gemini-3-flash-preview', name: 'Gemini 3 Flash', description: 'Nhanh và hiệu quả' },
    { id: 'gemini-2.5-flash-lite', name: 'Gemini 2.5 Flash Lite', description: 'Ổn định và đáng tin cậy' },
];

const PAID_MODELS = [
    { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', description: 'Mới, mạnh mẽ hơn', default: true },
    { id: 'gemini-3-flash-preview', name: 'Gemini 3 Flash', description: 'Nhanh và hiệu quả' },
    { id: 'gemini-2.5-flash-lite', name: 'Gemini 2.5 Flash Lite', description: 'Ổn định và đáng tin cậy' },
    { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', description: 'Mạnh mẽ, chi tiết, chính xác cao', paid: true },
];

export const getStoredApiKey = (): string => {
    return getApiKey();
};

export const getStoredModel = (): string => {
    return getSelectedModel();
};

export const saveApiKeyAndModel = (apiKey: string, model: string): void => {
    saveApiKey(apiKey);
    saveSelectedModel(model);
};

const ApiKeyModal: React.FC<ApiKeyModalProps> = ({ isOpen, onClose, onSave, isRequired = false }) => {
    const [apiKeyInput, setApiKeyInput] = useState('');
    const [selectedModel, setSelectedModel] = useState('gemini-2.5-flash');
    const [error, setError] = useState('');
    const [showKey, setShowKey] = useState(false);
    const [inputMode, setInputMode] = useState<'env' | 'manual'>('env');

    const hasEnvKeys = ENV_API_KEYS.length > 0;

    useEffect(() => {
        if (isOpen) {
            const currentKey = getApiKey();
            setApiKeyInput(currentKey);
            setSelectedModel(getSelectedModel());
            setError('');
            // Nếu chưa có key user nhập → mặc định dùng env
            if (!currentKey && hasEnvKeys) {
                setInputMode('env');
            } else if (currentKey) {
                setInputMode('manual');
            } else {
                setInputMode('manual');
            }
        }
    }, [isOpen]);

    const handleSwitchToManual = () => {
        setInputMode('manual');
        setApiKeyInput('');
        setError('');
    };

    const handleSave = () => {
        if (inputMode === 'env' && hasEnvKeys) {
            // Dùng env keys → xóa key user để hệ thống tự dùng env keys
            saveApiKey('');
            saveSelectedModel(selectedModel);
            onSave('', selectedModel);
            onClose();
            return;
        }

        // Manual mode
        const key = apiKeyInput.trim();
        if (!key) {
            setError('Vui lòng nhập API Key');
            return;
        }
        if (!key.startsWith('AIza')) {
            setError('API Key không hợp lệ. Key phải bắt đầu bằng "AIza"');
            return;
        }

        saveApiKey(key);
        saveSelectedModel(selectedModel);
        onSave(key, selectedModel);
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
                            <h2 className="text-xl font-bold">Cài đặt API Key</h2>
                            <p className="text-blue-100 text-sm">
                                {hasAnyKey() ? 'Đã có API Key' : 'Nhập API Key để sử dụng app'}
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
                    {/* API Key Section */}
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-3">
                            Google Gemini API Key
                        </label>

                        {/* Tab chuyển đổi */}
                        <div className="flex rounded-lg bg-gray-100 p-1 mb-4">
                            {hasEnvKeys && (
                                <button
                                    type="button"
                                    onClick={() => { setInputMode('env'); setError(''); }}
                                    className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-all ${inputMode === 'env'
                                        ? 'bg-white text-blue-600 shadow-sm'
                                        : 'text-gray-500 hover:text-gray-700'
                                        }`}
                                >
                                    🔑 Dùng Key hệ thống
                                </button>
                            )}
                            <button
                                type="button"
                                onClick={handleSwitchToManual}
                                className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-all ${inputMode === 'manual'
                                    ? 'bg-white text-blue-600 shadow-sm'
                                    : 'text-gray-500 hover:text-gray-700'
                                    }`}
                            >
                                ✏️ Nhập Key riêng
                            </button>
                        </div>

                        {/* Env Keys Mode */}
                        {inputMode === 'env' && hasEnvKeys && (
                            <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                                <div className="flex items-center gap-2 text-green-700 mb-2">
                                    <Check size={18} />
                                    <span className="font-semibold text-sm">Hệ thống đã được cấu hình sẵn API Keys</span>
                                </div>
                                <p className="text-green-600 text-sm">
                                    App sẽ tự động sử dụng {ENV_API_KEYS.length} key có sẵn. Khi một key hết quota,
                                    hệ thống sẽ tự động chuyển sang key tiếp theo.
                                </p>
                                <div className="mt-3 space-y-1">
                                    {ENV_API_KEYS.map((key, index) => (
                                        <div key={index} className="flex items-center gap-2 text-xs text-green-600">
                                            <div className="w-2 h-2 rounded-full bg-green-400"></div>
                                            <span className="font-mono">{maskKey(key)}</span>
                                            <span className="text-green-400">#{index + 1}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Manual API Key Input */}
                        {inputMode === 'manual' && (
                            <div className="relative">
                                <input
                                    type={showKey ? 'text' : 'password'}
                                    value={apiKeyInput}
                                    onChange={(e) => { setApiKeyInput(e.target.value); setError(''); }}
                                    placeholder="AIza..."
                                    className="w-full px-4 py-3 pr-20 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-blue-400 text-sm font-mono"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowKey(!showKey)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 text-sm"
                                >
                                    {showKey ? 'Ẩn' : 'Hiện'}
                                </button>
                            </div>
                        )}

                        {error && (
                            <p className="mt-2 text-sm text-red-600 flex items-center gap-1">
                                <AlertCircle size={14} /> {error}
                            </p>
                        )}
                    </div>

                    {/* Model Selection */}
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-3">Chọn Model AI</label>
                        <div className="space-y-2">
                            {(inputMode === 'manual' ? PAID_MODELS : FREE_MODELS).map((model) => (
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
                                            {(model as any).default && (
                                                <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full">Mặc định</span>
                                            )}
                                            {(model as any).paid && (
                                                <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs rounded-full">💎 Trả phí</span>
                                            )}
                                        </div>
                                        <p className="text-sm text-gray-500">{model.description}</p>
                                    </div>
                                </label>
                            ))}
                        </div>
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
                                Lấy API Key miễn phí tại Google AI Studio
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
                        className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-colors"
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
    return (
        <button
            onClick={onClick}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg transition-colors ${hasKey ? 'hover:bg-gray-100' : 'bg-red-50 hover:bg-red-100'}`}
        >
            <Settings size={18} className={hasKey ? '' : 'text-red-600'} />
            <span className={`hidden sm:inline ${!hasKey ? 'text-red-600 font-medium' : ''}`}>
                {hasKey ? 'API Key' : 'Lấy API key để sử dụng'}
            </span>
        </button>
    );
};

export default ApiKeyModal;
