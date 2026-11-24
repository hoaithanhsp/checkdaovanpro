import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  X,
  Key,
  ExternalLink,
  Check,
  AlertCircle,
  Settings,
  Cpu,
  Server,
  Sparkles,
  Zap,
  Plus,
  Trash2,
  RefreshCw,
  ShieldCheck,
  CheckCircle2,
  Clock,
  FlaskConical,
} from 'lucide-react';
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
  isValidGoogleAiApiKey,
  normalizeGoogleAiApiKey,
  GEMINI_UI_MODELS,
  AGENT_PLATFORM_UI_MODELS,
  GEMINI_FALLBACK_MODELS,
  DEFAULT_MODEL_BY_PROVIDER,
  apiKeyManager,
  testApiKey,
  checkServerProxyAvailable,
  getServerProxyStatus,
  type AiProvider,
  type ServerProxyStatus,
} from '../services/apiKeyService';
import type { ApiKeyInfo } from '../services/apiKeyManager';

interface ApiKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (apiKey: string, model: string, provider: AiProvider) => void;
  isRequired?: boolean;
}

export const getStoredApiKey = (): string => getApiKey();
export const getStoredModel = (): string => getSelectedModel();
export const saveApiKeyAndModel = (apiKey: string, model: string): void => {
  saveApiKey(apiKey);
  saveSelectedModel(model);
};

const ModelIcon: React.FC<{ modelId: string }> = ({ modelId }) => {
  if (modelId.startsWith('gemini-4')) return <Sparkles size={16} />;
  if (modelId.includes('flash-lite')) return <Zap size={16} />;
  if (modelId.includes('pro')) return <Sparkles size={16} />;
  return <Cpu size={16} />;
};

const formatDurationShort = (ms: number): string => {
  const totalSec = Math.max(1, Math.ceil(ms / 1000));
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  if (min > 0) return `${min}p ${sec}s`;
  return `${sec}s`;
};

const ApiKeyModal: React.FC<ApiKeyModalProps> = ({ isOpen, onClose, onSave, isRequired = false }) => {
  const [provider, setProvider] = useState<AiProvider>('gemini');
  const [selectedModel, setSelectedModel] = useState<string>(DEFAULT_MODEL_BY_PROVIDER['gemini']);

  // Tab Gemini: Kho nhiều key xoay vòng (tối đa 30 key)
  const [bulkKeyInput, setBulkKeyInput] = useState('');
  const [poolKeys, setPoolKeys] = useState<ApiKeyInfo[]>([]);
  const [currentPoolIndex, setCurrentPoolIndex] = useState<number>(0);
  const [bulkFeedback, setBulkFeedback] = useState<{ ok: boolean; text: string } | null>(null);
  const [testingKey, setTestingKey] = useState<string | null>(null);
  const [isTestingAll, setIsTestingAll] = useState(false);
  const [keyTestResults, setKeyTestResults] = useState<Record<string, { ok: boolean; message: string }>>({});

  // Tab Agent Platform: 1 key riêng tách biệt
  const [agentApiKey, setAgentApiKey] = useState('');
  const [showAgentKey, setShowAgentKey] = useState(false);
  const [isTestingAgent, setIsTestingAgent] = useState(false);
  const [agentTestResult, setAgentTestResult] = useState<{ ok: boolean; title: string; message: string } | null>(null);

  // Server Proxy (/api/gemini)
  const [serverProxy, setServerProxy] = useState<ServerProxyStatus>(() => getServerProxyStatus());
  const [error, setError] = useState('');

  const modelList = useMemo(
    () => (provider === 'agent-platform' ? AGENT_PLATFORM_UI_MODELS : GEMINI_UI_MODELS),
    [provider]
  );

  const refreshPoolState = useCallback(() => {
    setPoolKeys(apiKeyManager.getAllKeys());
    setCurrentPoolIndex(apiKeyManager.getCurrentIndex());
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const currentProvider = getProvider();
    setProvider(currentProvider);
    setAgentApiKey(getAgentPlatformApiKey());

    const currentModel = getSelectedModel(currentProvider);
    const validList = currentProvider === 'agent-platform' ? AGENT_PLATFORM_UI_MODELS : GEMINI_UI_MODELS;
    setSelectedModel(validList.some(m => m.id === currentModel) ? currentModel : DEFAULT_MODEL_BY_PROVIDER[currentProvider]);

    setBulkKeyInput('');
    setBulkFeedback(null);
    setAgentTestResult(null);
    setError('');
    refreshPoolState();

    checkServerProxyAvailable().then(status => setServerProxy(status));
  }, [isOpen, refreshPoolState]);

  // Cập nhật đếm ngược cooldown mỗi 2 giây khi modal đang mở
  useEffect(() => {
    if (!isOpen || provider !== 'gemini') return;
    const timer = setInterval(() => {
      refreshPoolState();
    }, 2000);
    return () => clearInterval(timer);
  }, [isOpen, provider, refreshPoolState]);

  const handleProviderChange = (newProvider: AiProvider) => {
    setProvider(newProvider);
    setError('');
    setBulkFeedback(null);
    setAgentTestResult(null);

    if (newProvider === 'agent-platform') {
      setAgentApiKey(getAgentPlatformApiKey());
    } else {
      refreshPoolState();
    }

    const newModels = newProvider === 'agent-platform' ? AGENT_PLATFORM_UI_MODELS : GEMINI_UI_MODELS;
    if (!newModels.some(m => m.id === selectedModel)) {
      setSelectedModel(DEFAULT_MODEL_BY_PROVIDER[newProvider]);
    }
  };

  const handleAddBulkKeys = () => {
    if (!bulkKeyInput.trim()) {
      setBulkFeedback({ ok: false, text: 'Hãy dán ít nhất 1 API key (AIzaSy... hoặc AQ...) vào ô phía trên.' });
      return;
    }
    const res = apiKeyManager.addKeysBulk(bulkKeyInput);
    refreshPoolState();
    setError('');

    if (res.added > 0) {
      setBulkKeyInput('');
      const extras: string[] = [];
      if (res.duplicates > 0) extras.push(`bỏ qua ${res.duplicates} key trùng`);
      if (res.invalid > 0) extras.push(`${res.invalid} dòng sai định dạng`);
      if (res.limitReached > 0) extras.push(`${res.limitReached} key vượt giới hạn ${apiKeyManager.getMaxKeys()}`);
      setBulkFeedback({
        ok: true,
        text: `✅ Đã thêm ${res.added} API key vào kho xoay vòng${extras.length ? ` (${extras.join(', ')})` : ''}. Tổng hiện có: ${res.total} key.`,
      });
      if (res.addedKeys[0] && !apiKeyManager.hasAvailableKeys()) {
        apiKeyManager.setActiveKey(res.addedKeys[0]);
        refreshPoolState();
      }
    } else {
      const reasons: string[] = [];
      if (res.duplicates > 0) reasons.push(`${res.duplicates} key đã tồn tại`);
      if (res.invalid > 0) reasons.push(`${res.invalid} key sai định dạng (cần bắt đầu bằng AIza... hoặc AQ...)`);
      if (res.limitReached > 0) reasons.push(`đã đạt giới hạn tối đa ${apiKeyManager.getMaxKeys()} key`);
      setBulkFeedback({
        ok: false,
        text: `⚠️ Không thêm được key mới: ${reasons.join(', ') || 'chưa nhận diện được key hợp lệ'}.`,
      });
    }
  };

  const handleTestSinglePoolKey = async (keyInfo: ApiKeyInfo) => {
    setTestingKey(keyInfo.key);
    try {
      const result = await testApiKey(keyInfo.key, 'gemini', selectedModel);
      if (result.ok) {
        apiKeyManager.resetKey(keyInfo.key);
        setKeyTestResults(prev => ({
          ...prev,
          [keyInfo.key]: { ok: true, message: `Hoạt động tốt (${result.model || selectedModel})` },
        }));
      } else {
        if (result.errorType === 'INVALID_API_KEY') {
          apiKeyManager.markKeyError(keyInfo.key, 'INVALID_API_KEY', selectedModel);
        } else if (result.errorType === 'QUOTA_EXCEEDED' || result.errorType === 'RATE_LIMIT') {
          apiKeyManager.markKeyModelQuotaError(keyInfo.key, selectedModel, result.errorType);
        }
        setKeyTestResults(prev => ({
          ...prev,
          [keyInfo.key]: { ok: false, message: result.title },
        }));
      }
      refreshPoolState();
    } finally {
      setTestingKey(null);
    }
  };

  const handleTestAllKeys = async () => {
    const all = apiKeyManager.getAllKeys();
    if (all.length === 0) {
      setBulkFeedback({ ok: false, text: 'Chưa có API key nào trong kho để kiểm tra.' });
      return;
    }
    setIsTestingAll(true);
    setBulkFeedback(null);
    let okCount = 0;
    try {
      for (const item of all) {
        setTestingKey(item.key);
        const result = await testApiKey(item.key, 'gemini', selectedModel);
        if (result.ok) {
          okCount++;
          apiKeyManager.resetKey(item.key);
          setKeyTestResults(prev => ({
            ...prev,
            [item.key]: { ok: true, message: `OK (${result.model || selectedModel})` },
          }));
        } else {
          if (result.errorType === 'INVALID_API_KEY') {
            apiKeyManager.markKeyError(item.key, 'INVALID_API_KEY', selectedModel);
          } else if (result.errorType === 'QUOTA_EXCEEDED' || result.errorType === 'RATE_LIMIT') {
            apiKeyManager.markKeyModelQuotaError(item.key, selectedModel, result.errorType);
          }
          setKeyTestResults(prev => ({
            ...prev,
            [item.key]: { ok: false, message: result.title },
          }));
        }
        refreshPoolState();
      }
      setBulkFeedback({
        ok: okCount > 0,
        text:
          okCount > 0
            ? `🧪 Kiểm tra xong: ${okCount}/${all.length} API key đang hoạt động tốt với ${selectedModel}.`
            : `⚠️ Không có key nào vượt qua kiểm tra với ${selectedModel} (có thể đang hết quota hoặc sai key).`,
      });
    } finally {
      setTestingKey(null);
      setIsTestingAll(false);
    }
  };

  const handleTestAgentKey = async () => {
    const clean = normalizeGoogleAiApiKey(agentApiKey);
    setAgentTestResult(null);
    if (!clean || !isValidGoogleAiApiKey(clean)) {
      setError('Vui lòng nhập Agent Platform API Key hợp lệ (AIza... hoặc AQ...) trước khi kiểm tra.');
      return;
    }
    setError('');
    setIsTestingAgent(true);
    try {
      setAgentTestResult(await testApiKey(clean, 'agent-platform', selectedModel));
    } finally {
      setIsTestingAgent(false);
    }
  };

  const handleSave = () => {
    if (provider === 'agent-platform') {
      const keyToSave = normalizeGoogleAiApiKey(agentApiKey);
      if (!keyToSave) {
        setError('Vui lòng nhập Agent Platform API Key.');
        return;
      }
      if (!isValidGoogleAiApiKey(keyToSave)) {
        setError('API Key không hợp lệ. Key phải bắt đầu bằng "AIza..." hoặc "AQ...".');
        return;
      }
      const validModel = AGENT_PLATFORM_UI_MODELS.some(m => m.id === selectedModel)
        ? selectedModel
        : DEFAULT_MODEL_BY_PROVIDER['agent-platform'];
      saveAgentPlatformApiKey(keyToSave);
      saveSelectedModel(validModel);
      saveProvider('agent-platform');
      onSave(keyToSave, validModel, 'agent-platform');
      onClose();
      return;
    }

    // Tab Gemini: nếu người dùng dán key vào textarea nhưng chưa bấm "+ Thêm vào kho", tự thêm luôn
    if (bulkKeyInput.trim()) {
      const bulkRes = apiKeyManager.addKeysBulk(bulkKeyInput);
      refreshPoolState();
      if (bulkRes.added === 0 && bulkRes.duplicates === 0 && apiKeyManager.getAllKeys().length === 0) {
        setError('API Key vừa dán không đúng định dạng. Key hợp lệ bắt đầu bằng "AIzaSy..." hoặc "AQ...".');
        return;
      }
      setBulkKeyInput('');
    }

    const validModel = GEMINI_UI_MODELS.some(m => m.id === selectedModel)
      ? selectedModel
      : DEFAULT_MODEL_BY_PROVIDER['gemini'];
    const activeKey = apiKeyManager.getActiveKey(validModel) || apiKeyManager.getAllKeys()[0]?.key || '';

    if (!activeKey && !serverProxy.available) {
      setError('Vui lòng thêm ít nhất 1 Gemini API Key vào kho (nên dùng 2–5 key để tự xoay vòng tránh hết quota).');
      return;
    }

    saveSelectedModel(validModel);
    saveProvider('gemini');
    onSave(activeKey, validModel, 'gemini');
    onClose();
  };

  const stats = useMemo(() => apiKeyManager.getKeyStats(), [poolKeys]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] overflow-hidden flex flex-col animate-fade-in">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/20 rounded-xl">
              <Key size={22} />
            </div>
            <div>
              <h2 className="text-lg font-bold">Cài đặt Model & Kho API Key Xoay Vòng</h2>
              <p className="text-blue-100 text-xs">
                Mặc định Gemini 4 Hydrogen (Miễn phí) • Hỗ trợ tối đa {apiKeyManager.getMaxKeys()} key chống hết quota 429
              </p>
            </div>
          </div>
          {!isRequired && (
            <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-lg transition-colors" aria-label="Đóng">
              <X size={20} />
            </button>
          )}
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5 text-gray-800">
          {/* Safety Notice - Google Safe Browsing transparency */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-800">
            <p className="font-semibold mb-1">🔒 Thông tin an toàn:</p>
            <p>
              Đây là công cụ giáo dục hỗ trợ giáo viên thẩm định SKKN. API Key là mã miễn phí bạn tự tạo tại{' '}
              <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer" className="underline font-medium">
                Google AI Studio
              </a>{' '}
              — <strong>không phải mật khẩu</strong>. Key được lưu cục bộ trên trình duyệt của bạn, không gửi cho bên thứ ba.
            </p>
          </div>

          {/* 1. Provider Selection */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">1. Chọn dịch vụ AI</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => handleProviderChange('gemini')}
                className={`p-3 rounded-xl border-2 text-left flex items-center gap-2.5 transition-all ${
                  provider === 'gemini'
                    ? 'border-blue-500 bg-blue-50 shadow-xs'
                    : 'border-gray-200 hover:border-gray-300 bg-white'
                }`}
              >
                <Cpu size={20} className={provider === 'gemini' ? 'text-blue-600' : 'text-gray-400'} />
                <div>
                  <div className="font-semibold text-sm text-gray-800">Gemini API</div>
                  <p className="text-xs text-gray-500">Google AI Studio (Free Tier)</p>
                </div>
              </button>
              <button
                type="button"
                onClick={() => handleProviderChange('agent-platform')}
                className={`p-3 rounded-xl border-2 text-left flex items-center gap-2.5 transition-all ${
                  provider === 'agent-platform'
                    ? 'border-purple-500 bg-purple-50 shadow-xs'
                    : 'border-gray-200 hover:border-gray-300 bg-white'
                }`}
              >
                <Server size={20} className={provider === 'agent-platform' ? 'text-purple-600' : 'text-gray-400'} />
                <div>
                  <div className="font-semibold text-sm text-gray-800">Agent Platform API</div>
                  <p className="text-xs text-gray-500">Google Cloud Express</p>
                </div>
              </button>
            </div>
          </div>

          {/* 2. Model Selection */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">2. Chọn Model AI ưu tiên</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {modelList.map(model => {
                const isSelected = selectedModel === model.id;
                return (
                  <button
                    key={model.id}
                    type="button"
                    onClick={() => setSelectedModel(model.id)}
                    className={`flex items-start gap-2.5 p-3 rounded-xl border-2 text-left transition-all ${
                      isSelected
                        ? provider === 'agent-platform'
                          ? 'border-purple-500 bg-purple-50 shadow-xs'
                          : 'border-blue-500 bg-blue-50 shadow-xs'
                        : 'border-gray-200 hover:border-gray-300 bg-white'
                    }`}
                  >
                    <div
                      className={`p-1.5 rounded-lg shrink-0 mt-0.5 ${
                        isSelected
                          ? provider === 'agent-platform'
                            ? 'bg-purple-600 text-white'
                            : 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-500'
                      }`}
                    >
                      <ModelIcon modelId={model.id} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-semibold text-sm text-gray-800">{model.name}</span>
                        {model.badge && (
                          <span
                            className={`px-1.5 py-0.5 text-[10px] font-bold rounded-full ${
                              model.default
                                ? 'bg-emerald-100 text-emerald-700'
                                : model.paid
                                  ? 'bg-amber-100 text-amber-700'
                                  : 'bg-blue-100 text-blue-700'
                            }`}
                          >
                            {model.badge}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5 leading-snug">{model.description}</p>
                    </div>
                    {isSelected && (
                      <div
                        className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${
                          provider === 'agent-platform' ? 'bg-purple-600' : 'bg-blue-600'
                        }`}
                      >
                        <Check size={12} className="text-white" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-gray-600 mt-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
              💡 <strong>Chống hết quota 2 tầng:</strong> Khi 1 key hết lượt trên model đang chọn, app tự xoay sang key
              dự phòng kế tiếp trên <em>cùng model</em>; nếu hết tất cả key trên model đó, app tự chuyển sang model miễn
              phí tiếp theo (6 model × N key = 6N nguồn quota độc lập).
            </p>
          </div>

          {/* 3. API Key Management */}
          {provider === 'gemini' ? (
            <div className="border-t border-gray-200 pt-4 space-y-3.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="text-sm font-semibold text-gray-800">
                  🔑 3. Kho Gemini API Key Xoay Vòng (tối đa {apiKeyManager.getMaxKeys()} key)
                </label>
                <div className="flex flex-wrap items-center gap-1.5 text-xs">
                  <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-semibold">
                    {stats.active} sẵn sàng
                  </span>
                  {stats.cooldown > 0 && (
                    <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-semibold">
                      {stats.cooldown} tạm nghỉ
                    </span>
                  )}
                  {stats.error > 0 && (
                    <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-semibold">
                      {stats.error} lỗi
                    </span>
                  )}
                </div>
              </div>

              {serverProxy.available && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-2.5 text-xs text-emerald-800">
                  <ShieldCheck size={18} className="text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <strong>Kho key dự phòng bảo mật trên máy chủ đang bật ({serverProxy.keyCount} key ẩn).</strong>
                    <p className="mt-0.5 text-emerald-700">
                      Bạn có thể dùng ngay không cần nhập key, hoặc dán thêm key cá nhân bên dưới để ưu tiên dùng trước.
                    </p>
                  </div>
                </div>
              )}

              {stats.envTotal > 0 && (
                <div className="p-3 bg-sky-50 border border-sky-200 rounded-xl flex items-start gap-2.5 text-xs text-sky-800">
                  <ShieldCheck size={18} className="text-sky-600 shrink-0 mt-0.5" />
                  <div>
                    Đã nạp ngầm <strong>{stats.envTotal} API key dự phòng</strong> từ cấu hình môi trường (tự động ẩn giá
                    trị key để bảo mật).
                  </div>
                </div>
              )}

              {/* Bulk Paste Input */}
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-3.5 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-gray-700">
                    Dán 1 hoặc nhiều API Key (mỗi dòng 1 key, hoặc ngăn cách bằng dấu phẩy):
                  </span>
                  <span className="text-[11px] text-gray-500">AIzaSy... & AQ...</span>
                </div>
                <textarea
                  rows={3}
                  value={bulkKeyInput}
                  onChange={e => {
                    setBulkKeyInput(e.target.value);
                    setBulkFeedback(null);
                    setError('');
                  }}
                  placeholder={
                    'Dán nhiều API key từ nhiều Gmail để không lo hết quota:\nAIzaSy...key1\nAIzaSy...key2\nAIzaSy...key3'
                  }
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-xs font-mono resize-y"
                />

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={handleAddBulkKeys}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                  >
                    <Plus size={14} />
                    Thêm vào kho xoay vòng
                  </button>
                  {poolKeys.length > 0 && (
                    <>
                      <button
                        type="button"
                        onClick={handleTestAllKeys}
                        disabled={isTestingAll || testingKey !== null}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-blue-300 text-blue-700 bg-white hover:bg-blue-50 disabled:opacity-50 transition-colors"
                      >
                        <FlaskConical size={14} />
                        {isTestingAll ? 'Đang kiểm tra...' : 'Kiểm tra tất cả'}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          apiKeyManager.resetAllKeys();
                          setKeyTestResults({});
                          refreshPoolState();
                          setBulkFeedback({ ok: true, text: '🔄 Đã reset trạng thái tất cả key về Sẵn sàng.' });
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-emerald-300 text-emerald-700 bg-white hover:bg-emerald-50 transition-colors"
                      >
                        <RefreshCw size={13} />
                        Reset tất cả
                      </button>
                    </>
                  )}
                </div>

                {bulkFeedback && (
                  <div
                    className={`p-2.5 rounded-lg text-xs font-medium border ${
                      bulkFeedback.ok
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                        : 'bg-amber-50 border-amber-200 text-amber-800'
                    }`}
                  >
                    {bulkFeedback.text}
                  </div>
                )}
              </div>

              {/* Pool Key List */}
              {poolKeys.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-gray-700">
                      Danh sách key trong kho ({poolKeys.length} key — bấm &quot;Dùng&quot; để chọn ưu tiên #1):
                    </span>
                    {stats.userTotal > 1 && (
                      <button
                        type="button"
                        onClick={() => {
                          if (window.confirm('Xóa toàn bộ các API key bạn đã nhập?')) {
                            apiKeyManager.clearAllUserKeys();
                            setKeyTestResults({});
                            refreshPoolState();
                          }
                        }}
                        className="text-[11px] text-red-500 hover:text-red-700 hover:underline"
                      >
                        Xóa tất cả key của tôi
                      </button>
                    )}
                  </div>

                  <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                    {poolKeys.map((keyInfo, idx) => {
                      const isCurrent = idx === currentPoolIndex;
                      const isEnv = keyInfo.source === 'env';
                      const masked = apiKeyManager.maskKey(keyInfo.key);
                      const activeModelCds = apiKeyManager.getActiveModelCooldowns(keyInfo.key);
                      const cdModelCount = Object.keys(activeModelCds).length;
                      const soonestCdMs = keyInfo.cooldownUntil
                        ? Math.max(0, keyInfo.cooldownUntil - Date.now())
                        : cdModelCount > 0
                          ? Math.min(...Object.values(activeModelCds))
                          : 0;
                      const testRes = keyTestResults[keyInfo.key];
                      const isTestingThis = testingKey === keyInfo.key;

                      return (
                        <div
                          key={keyInfo.key}
                          className={`p-2.5 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-2 ${
                            isCurrent && keyInfo.status === 'active'
                              ? 'border-blue-400 bg-blue-50/70'
                              : keyInfo.status === 'error'
                                ? 'border-red-200 bg-red-50/50'
                                : keyInfo.status === 'cooldown'
                                  ? 'border-amber-200 bg-amber-50/50'
                                  : 'border-gray-200 bg-white'
                          }`}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="font-semibold text-xs text-gray-800">{keyInfo.name}</span>
                              <span className="font-mono text-[11px] text-gray-600 bg-gray-100 px-1.5 py-0.5 rounded">
                                {masked}
                              </span>
                              {isEnv && (
                                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700">
                                  Hệ thống (ẩn)
                                </span>
                              )}
                              {isCurrent && keyInfo.status === 'active' && (
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-blue-600 text-white">
                                  Đang ưu tiên
                                </span>
                              )}
                            </div>

                            <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px]">
                              {keyInfo.status === 'error' ? (
                                <span className="inline-flex items-center gap-1 text-red-600 font-medium">
                                  <AlertCircle size={12} /> Key lỗi / không hợp lệ
                                </span>
                              ) : keyInfo.status === 'cooldown' ? (
                                <span className="inline-flex items-center gap-1 text-amber-700 font-medium">
                                  <Clock size={12} /> Tạm nghỉ hết quota (
                                  {soonestCdMs > 0 ? `còn ${formatDurationShort(soonestCdMs)}` : 'sắp mở lại'})
                                </span>
                              ) : cdModelCount > 0 ? (
                                <span className="inline-flex items-center gap-1 text-amber-700 font-medium">
                                  <Clock size={12} /> Hết lượt {cdModelCount}/{GEMINI_FALLBACK_MODELS.length} model (còn{' '}
                                  {GEMINI_FALLBACK_MODELS.length - cdModelCount} model dùng được)
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-emerald-700 font-medium">
                                  <CheckCircle2 size={12} /> Sẵn sàng
                                </span>
                              )}

                              {testRes && (
                                <span className={`font-medium ${testRes.ok ? 'text-emerald-700' : 'text-red-600'}`}>
                                  • {testRes.message}
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            {!isCurrent && keyInfo.status !== 'error' && (
                              <button
                                type="button"
                                onClick={() => {
                                  apiKeyManager.setActiveKey(keyInfo.key);
                                  refreshPoolState();
                                }}
                                className="px-2 py-1 text-[11px] font-semibold rounded-lg border border-blue-300 text-blue-700 bg-white hover:bg-blue-50"
                              >
                                Dùng
                              </button>
                            )}
                            <button
                              type="button"
                              disabled={isTestingThis || isTestingAll}
                              onClick={() => handleTestSinglePoolKey(keyInfo)}
                              className="px-2 py-1 text-[11px] font-semibold rounded-lg border border-gray-300 text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                            >
                              {isTestingThis ? '...' : 'Test'}
                            </button>
                            {(keyInfo.status !== 'active' || cdModelCount > 0) && (
                              <button
                                type="button"
                                onClick={() => {
                                  apiKeyManager.resetKey(keyInfo.key);
                                  refreshPoolState();
                                }}
                                title="Kích hoạt lại key"
                                className="p-1.5 rounded-lg border border-emerald-200 text-emerald-700 bg-white hover:bg-emerald-50"
                              >
                                <RefreshCw size={13} />
                              </button>
                            )}
                            {!isEnv && (
                              <button
                                type="button"
                                onClick={() => {
                                  apiKeyManager.removeKey(keyInfo.key);
                                  refreshPoolState();
                                }}
                                title="Xóa key"
                                className="p-1.5 rounded-lg border border-red-200 text-red-600 bg-white hover:bg-red-50"
                              >
                                <Trash2 size={13} />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Help Links (giữ nguyên link hướng dẫn gốc của app) */}
              <div className="bg-gray-50 rounded-xl p-3.5 space-y-1.5">
                <a
                  href="https://aistudio.google.com/apikey"
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 text-blue-600 hover:text-blue-700 text-xs font-medium"
                >
                  <ExternalLink size={14} />
                  Lấy API Key miễn phí tại Google AI Studio (có thể tạo nhiều key từ nhiều Gmail)
                </a>
                <a
                  href="https://drive.google.com/drive/folders/1G6eiVeeeEvsYgNk2Om7FEybWf30EP1HN?usp=drive_link"
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 text-blue-600 hover:text-blue-700 text-xs font-medium"
                >
                  <ExternalLink size={14} />
                  Xem hướng dẫn chi tiết (Video)
                </a>
              </div>
            </div>
          ) : (
            <div className="border-t border-gray-200 pt-4 space-y-3">
              <label className="block text-sm font-semibold text-purple-800">🔑 3. Agent Platform API Key</label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    type={showAgentKey ? 'text' : 'password'}
                    value={agentApiKey}
                    onChange={e => {
                      setAgentApiKey(e.target.value);
                      setAgentTestResult(null);
                      setError('');
                    }}
                    onKeyDown={e => e.key === 'Enter' && handleSave()}
                    placeholder="AQ... hoặc AIzaSy..."
                    className="w-full px-3.5 py-2.5 pr-16 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-purple-400 text-sm font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowAgentKey(!showAgentKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 text-xs"
                  >
                    {showAgentKey ? 'Ẩn' : 'Hiện'}
                  </button>
                </div>
                <button
                  type="button"
                  onClick={handleTestAgentKey}
                  disabled={isTestingAgent}
                  className="px-3.5 py-2 rounded-xl border border-purple-300 text-purple-700 bg-purple-50 hover:bg-purple-100 font-semibold text-xs shrink-0 disabled:opacity-50"
                >
                  {isTestingAgent ? 'Đang thử...' : 'Kiểm tra'}
                </button>
              </div>
              {agentTestResult && (
                <div
                  className={`p-2.5 rounded-lg text-xs border ${
                    agentTestResult.ok
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                      : 'bg-red-50 border-red-200 text-red-700'
                  }`}
                >
                  <strong>{agentTestResult.title}:</strong> {agentTestResult.message}
                </div>
              )}
              <div className="bg-gray-50 rounded-xl p-3 space-y-1">
                <a
                  href="https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/start/api-keys"
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 text-purple-600 hover:text-purple-700 text-xs font-medium"
                >
                  <ExternalLink size={14} />
                  Hướng dẫn lấy API Key tại Agent Platform (Google Cloud)
                </a>
                <p className="text-[11px] text-gray-500">
                  Cần bật Agent Platform API và kích hoạt billing trong dự án Google Cloud.
                </p>
              </div>
            </div>
          )}

          {error && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 font-medium flex items-center gap-2">
              <AlertCircle size={15} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex items-center gap-3 shrink-0">
          {!isRequired && (
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-gray-300 text-gray-700 hover:bg-gray-100 text-sm font-medium transition-colors"
            >
              Đóng
            </button>
          )}
          <button
            type="button"
            onClick={handleSave}
            className={`flex-1 py-2.5 font-bold rounded-xl text-sm transition-colors ${
              provider === 'agent-platform'
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

// Header Settings Button Component (hiển thị live badge số key xoay vòng hoặc Server Proxy)
export const ApiKeySettingsButton: React.FC<{
  onClick: () => void;
  hasKey: boolean;
  provider?: AiProvider;
  activeKeys?: number;
  totalKeys?: number;
  serverProxyCount?: number;
}> = ({ onClick, hasKey, provider = 'gemini', activeKeys = 0, totalKeys = 0, serverProxyCount = 0 }) => {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-2 rounded-lg transition-colors ${
        hasKey ? 'hover:bg-gray-100 dark:hover:bg-gray-700' : 'bg-red-50 hover:bg-red-100'
      }`}
      title="Cấu hình Model AI & Kho API Key Xoay Vòng"
    >
      <Settings size={18} className={hasKey ? '' : 'text-red-600'} />
      {!hasKey ? (
        <span className="hidden sm:inline text-red-600 font-medium">Lấy API key để sử dụng</span>
      ) : provider === 'agent-platform' ? (
        <span className="hidden sm:inline text-purple-600 font-medium">Agent Platform</span>
      ) : totalKeys > 0 ? (
        <span className="hidden sm:inline-flex items-center gap-1.5 font-medium">
          <span>API Key</span>
          <span
            className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
              activeKeys > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
            }`}
          >
            {activeKeys}/{totalKeys}
          </span>
        </span>
      ) : serverProxyCount > 0 ? (
        <span className="hidden sm:inline-flex items-center gap-1 font-medium text-emerald-700">
          <span>Server</span>
          <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700">
            {serverProxyCount} key
          </span>
        </span>
      ) : (
        <span className="hidden sm:inline">API Key</span>
      )}
    </button>
  );
};

export default ApiKeyModal;
