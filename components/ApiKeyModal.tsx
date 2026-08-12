import React, { useState, useEffect } from 'react';
import { X, Key, ExternalLink, Check, AlertCircle, Settings } from 'lucide-react';
import {
    getApiKey,
    saveApiKey,
    getAgentPlatformApiKey,
    saveAgentPlatformApiKey,
    getSelectedModel,
    saveSelectedModel,
    getProvider,
    saveProvider,
    hasAnyKey,
    ENV_API_KEYS,
    isValidGoogleAiApiKey,
    GEMINI_UI_MODELS,
    AGENT_PLATFORM_UI_MODELS,
    DEFAULT_MODEL_BY_PROVIDER,
    AiProvider,
} from '../services/apiKeyService';

/** Ẩn API key, chỉ hiện 4 ký tự đầu + 4 ký tự cuối */
const maskKey = (key: string): string => {
    if (key.length <= 10) return '••••••••••';
    return key.slice(0, 4) + '••••••••••••••••••••••••••••••••' + key.slice(-4);
};

interface ApiKeyModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (apiKey: string, model: string, provider: AiProvider) => void;
    isRequired?: boolean;
}

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
    const [selectedModel, setSelectedModel] = useState('gemini-3.6-flash');
    const [error, setError] = useState('');
    const [showKey, setShowKey] = useState(false);
    const [inputMode, setInputMode] = useState<'env' | 'manual'>('env');
    const [provider, setProvider] = useState<AiProvider>('gemini');

    const hasEnvKeys = ENV_API_KEYS.length > 0;

    // Model list theo provider
    const modelList = provider === 'agent-platform' ? AGENT_PLATFORM_UI_MODELS : GEMINI_UI_MODELS;

    useEffect(() => {
        if (isOpen) {
            const currentProvider = getProvider();
            setProvider(currentProvider);

            // Load key theo provider
            const currentKey = currentProvider === 'agent-platform'
                ? getAgentPlatformApiKey()
                : getApiKey();
            setApiKeyInput(currentKey);
            setSelectedModel(getSelectedModel());
            setError('');

            // Nếu Gemini và chưa có key user → dùng env
            if (currentProvider === 'gemini' && !currentKey && hasEnvKeys) {
                setInputMode('env');
            } else if (currentKey) {
                setInputMode('manual');
            } else {
                setInputMode('manual');
            }
        }
    }, [isOpen]);

    // Khi đổi provider → load key tương ứng + reset model nếu không tương thích
    const handleProviderChange = (newProvider: AiProvider) => {
        setProvider(newProvider);
        setError('');

        // Load key cho provider mới
        const key = newProvider === 'agent-platform'
            ? getAgentPlatformApiKey()
            : getApiKey();
        setApiKeyInput(key);

        // Kiểm tra model có tương thích không
        const newModels = newProvider === 'agent-platform' ? AGENT_PLATFORM_UI_MODELS : GEMINI_UI_MODELS;
        const isModelValid = newModels.some(m => m.id === selectedModel);
        if (!isModelValid) {
            setSelectedModel(DEFAULT_MODEL_BY_PROVIDER[newProvider]);
        }

        // Agent Platform không có env keys
        if (newProvider === 'agent-platform') {
            setInputMode('manual');
        } else if (!key && hasEnvKeys) {
            setInputMode('env');
        } else {
            setInputMode('manual');
        }
    };

    const handleSwitchToManual = () => {
        setInputMode('manual');
        setApiKeyInput('');
        setError('');
    };

    const handleSave = () => {
        if (inputMode === 'env' && hasEnvKeys && provider === 'gemini') {
            // Dùng env keys → xóa key user để hệ thống tự dùng env keys
            saveApiKey('');
            saveSelectedModel(selectedModel);
            saveProvider(provider);
            onSave('', selectedModel, provider);
            onClose();
            return;
        }

        // Manual mode
        const key = apiKeyInput.trim();
        if (!key) {
            setError('Vui lòng nhập API Key');
            return;
        }
        if (!isValidGoogleAiApiKey(key)) {
            setError('API Key không hợp lệ. Key phải bắt đầu bằng "AIzaSy" hoặc "AQ"');
            return;
        }

        // Lưu key theo provider
        if (provider === 'agent-platform') {
            saveAgentPlatformApiKey(key);
        } else {
            saveApiKey(key);
        }
        saveSelectedModel(selectedModel);
        saveProvider(provider);
        onSave(key, selectedModel, provider);
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
                    {/* Safety Notice - Giúp Google Safe Browsing hiểu đây không phải phishing */}
                    <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-700">
                        <p className="font-semibold mb-1">🔒 Thông tin an toàn:</p>
                        <p>
                            Đây là công cụ giáo dục hỗ trợ giáo viên kiểm tra SKKN. API Key là mã miễn phí bạn tự tạo tại{' '}
                            <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer" className="underline font-medium">Google AI Studio</a>
                            {' '}— <strong>không phải mật khẩu</strong>. Key được lưu trên trình duyệt của bạn, không gửi cho bên thứ ba.
                        </p>
                    </div>
                    {/* ═══ PROVIDER SELECTION ═══ */}
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-3">
                            Chọn dịch vụ AI
                        </label>
                        <div className="grid grid-cols-2 gap-3">
                            <button
                                type="button"
                                onClick={() => handleProviderChange('gemini')}
                                className={`p-3 rounded-xl border-2 text-left transition-all ${provider === 'gemini'
                                    ? 'border-blue-500 bg-blue-50'
                                    : 'border-gray-200 hover:border-gray-300'
                                    }`}
                            >
                                <div className="font-semibold text-sm text-gray-800">🌐 Gemini API</div>
                                <p className="text-xs text-gray-500 mt-1">Miễn phí, key từ AI Studio</p>
                            </button>
                            <button
                                type="button"
                                onClick={() => handleProviderChange('agent-platform')}
                                className={`p-3 rounded-xl border-2 text-left transition-all ${provider === 'agent-platform'
                                    ? 'border-purple-500 bg-purple-50'
                                    : 'border-gray-200 hover:border-gray-300'
                                    }`}
                            >
                                <div className="font-semibold text-sm text-gray-800">🤖 Agent Platform</div>
                                <p className="text-xs text-gray-500 mt-1">Google Cloud, doanh nghiệp</p>
                            </button>
                        </div>
                    </div>

                    {/* ═══ API KEY SECTION ═══ */}
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-3">
                            {provider === 'agent-platform' ? 'Agent Platform API Key' : 'Google Gemini API Key'}
                        </label>

                        {/* Tab env/manual (chỉ hiện cho Gemini) */}
                        {provider === 'gemini' && (
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
                        )}

                        {/* Env Keys Mode */}
                        {inputMode === 'env' && hasEnvKeys && provider === 'gemini' && (
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
                        {(inputMode === 'manual' || provider === 'agent-platform') && (
                            <div className="relative">
                                <input
                                    type={showKey ? 'text' : 'password'}
                                    value={apiKeyInput}
                                    onChange={(e) => { setApiKeyInput(e.target.value); setError(''); }}
                                    placeholder="AIzaSy... hoặc AQ..."
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

                    {/* ═══ MODEL SELECTION ═══ */}
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-3">Chọn Model AI</label>
                        <div className="space-y-2">
                            {modelList.map((model) => (
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
                            {provider === 'gemini' ? (
                                <>
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
                                </>
                            ) : (
                                <>
                                    <a
                                        href="https://console.cloud.google.com/apis/credentials"
                                        target="_blank"
                                        rel="noreferrer"
                                        className="flex items-center gap-2 text-purple-600 hover:text-purple-700 text-sm"
                                    >
                                        <ExternalLink size={14} />
                                        Tạo API Key tại Google Cloud Console
                                    </a>
                                    <p className="text-xs text-gray-500">
                                        Cần bật Agent Platform API và kích hoạt billing trong dự án Google Cloud.
                                    </p>
                                </>
                            )}
                        </div>
                    </div>

                    {/* Save Button */}
                    <button
                        onClick={handleSave}
                        className={`w-full py-3 font-bold rounded-xl transition-colors ${provider === 'agent-platform'
                            ? 'bg-purple-600 hover:bg-purple-700 text-white'
                            : 'bg-blue-600 hover:bg-blue-700 text-white'
                            }`}
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
