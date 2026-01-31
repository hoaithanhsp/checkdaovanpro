import React, { useState, useEffect } from 'react';
import { X, Key, ExternalLink, Check, AlertCircle, Settings } from 'lucide-react';

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

const API_KEY_STORAGE = 'skkn-gemini-api-key';
const MODEL_STORAGE = 'skkn-gemini-model';

export const getStoredApiKey = (): string => {
    return localStorage.getItem(API_KEY_STORAGE) || '';
};

export const getStoredModel = (): string => {
    return localStorage.getItem(MODEL_STORAGE) || MODELS[0].id;
};

export const saveApiKeyAndModel = (apiKey: string, model: string): void => {
    localStorage.setItem(API_KEY_STORAGE, apiKey);
    localStorage.setItem(MODEL_STORAGE, model);
};

const ApiKeyModal: React.FC<ApiKeyModalProps> = ({ isOpen, onClose, onSave, isRequired = false }) => {
    const [apiKey, setApiKey] = useState('');
    const [selectedModel, setSelectedModel] = useState(MODELS[0].id);
    const [error, setError] = useState('');

    useEffect(() => {
        if (isOpen) {
            setApiKey(getStoredApiKey());
            setSelectedModel(getStoredModel());
            setError('');
        }
    }, [isOpen]);

    const handleSave = () => {
        if (!apiKey.trim()) {
            setError('Vui lòng nhập API Key');
            return;
        }
        if (!apiKey.startsWith('AIza')) {
            setError('API Key không hợp lệ. Key phải bắt đầu bằng "AIza"');
            return;
        }
        saveApiKeyAndModel(apiKey.trim(), selectedModel);
        onSave(apiKey.trim(), selectedModel);
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
                            <h2 className="text-xl font-bold">Thiết lập Model & API Key</h2>
                            <p className="text-blue-100 text-sm">Cấu hình để sử dụng ứng dụng</p>
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

                    {/* API Key Input */}
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">API Key Gemini</label>
                        <input
                            type="password"
                            value={apiKey}
                            onChange={(e) => { setApiKey(e.target.value); setError(''); }}
                            placeholder="AIza..."
                            className={`w-full px-4 py-3 border-2 rounded-xl focus:outline-none transition-colors ${error ? 'border-red-400 focus:border-red-500' : 'border-gray-200 focus:border-blue-500'
                                }`}
                        />
                        {error && (
                            <p className="mt-2 text-sm text-red-600 flex items-center gap-1">
                                <AlertCircle size={14} /> {error}
                            </p>
                        )}
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
                {hasKey ? 'API Key' : 'Lấy API key để sử dụng app'}
            </span>
        </button>
    );
};

export default ApiKeyModal;
