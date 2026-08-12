/**
 * API Key Management Service
 * Quản lý API key với tự động xoay key dự phòng khi hết quota
 * Hỗ trợ dual-provider: Gemini API & Agent Platform API
 * Keys được đọc từ biến môi trường VITE_GEMINI_API_KEYS (file .env)
 */

import { GoogleGenAI } from '@google/genai';

// ═══════════ PROVIDER TYPES ═══════════

export type AiProvider = 'gemini' | 'agent-platform';

// ═══════════ STORAGE KEYS ═══════════

const STORAGE_KEY = 'skkn-gemini-api-key';
const AGENT_PLATFORM_STORAGE_KEY = 'skkn-agent-platform-api-key';
const MODEL_STORAGE_KEY = 'skkn-gemini-model';
const PROVIDER_STORAGE_KEY = 'google_ai_provider';
const PROVIDER_SOURCE_KEY = 'google_ai_provider_selection_source';

// ═══════════ VALIDATION ═══════════

export const GOOGLE_AI_API_KEY_PATTERN = /^(?:AIzaSy|AQ)\S{8,}$/;

export type GeminiApiErrorType =
  | 'QUOTA_EXCEEDED'
  | 'MODEL_OVERLOADED'
  | 'INVALID_API_KEY'
  | 'PERMISSION_DENIED'
  | 'MODEL_NOT_FOUND'
  | 'INVALID_ARGUMENT'
  | 'UNKNOWN';

// ═══════════ MODEL LISTS ═══════════

/** Chuỗi fallback Gemini API (api.md §II) */
export const GEMINI_FALLBACK_MODELS = [
  'gemini-3.6-flash',
  'gemini-3.5-flash',
  'gemini-3.5-flash-lite',
  'gemini-3.1-flash-lite',
  'gemini-2.5-flash',
] as const;

/** Chuỗi fallback Agent Platform API (api.md §III) */
export const AGENT_PLATFORM_FALLBACK_MODELS = [
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
] as const;

/** Models hiển thị trong UI cho Gemini API */
export const GEMINI_UI_MODELS = [
  { id: 'gemini-3.6-flash', name: 'Gemini 3.6 Flash', description: 'Mặc định, mới nhất, mạnh mẽ và chi phí tốt', default: true },
  { id: 'gemini-3.5-flash', name: 'Gemini 3.5 Flash', description: 'Chất lượng cao, dự phòng chính' },
  { id: 'gemini-3.5-flash-lite', name: 'Gemini 3.5 Flash Lite', description: 'Nhanh, chi phí thấp, đọc/trích xuất tài liệu tốt' },
  { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', description: 'Ổn định, dự phòng cuối chuỗi' },
  { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', description: 'Chất lượng cao nhất, suy luận sâu', paid: true },
];

/** Models hiển thị trong UI cho Agent Platform API */
export const AGENT_PLATFORM_UI_MODELS = [
  { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', description: 'Mặc định Agent Platform, cân bằng', default: true },
  { id: 'gemini-2.5-flash-lite', name: 'Gemini 2.5 Flash Lite', description: 'Nhanh nhất, tiết kiệm' },
  { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', description: 'Chất lượng cao nhất' },
  { id: 'gemini-3.1-pro-preview', name: 'Gemini 3.1 Pro Preview', description: 'Frontier model, reasoning sâu', paid: true },
];

/** Model mặc định theo provider */
export const DEFAULT_MODEL_BY_PROVIDER: Record<AiProvider, string> = {
  'gemini': 'gemini-3.6-flash',
  'agent-platform': 'gemini-2.5-flash',
};

// ═══════════ CLIENT FACTORY (api.md §III) ═══════════

/**
 * Factory tập trung để tạo Google AI client.
 * Mọi tác vụ AI PHẢI đi qua hàm này. Không được tạo `new GoogleGenAI(...)` trực tiếp.
 *
 * vertexai: true chỉ là cờ định tuyến bắt buộc của SDK cho Agent Platform API.
 * Không dùng cờ này để suy đoán loại key.
 */
export const createGoogleAiClient = (
  apiKey: string,
  provider: AiProvider,
): GoogleGenAI => {
  if (provider === 'agent-platform') {
    return new GoogleGenAI({ vertexai: true, apiKey });
  }
  return new GoogleGenAI({ apiKey });
};

// ═══════════ SANITIZE ═══════════

/**
 * Làm sạch API key - loại bỏ khoảng trắng, ký tự Unicode ẩn, BOM
 */
const sanitizeApiKey = (key: string): string => {
  if (!key) return '';
  return key
    .replace(/[\u200B-\u200D\uFEFF\u00A0]/g, '')
    .replace(/[^\x20-\x7E]/g, '')
    .trim();
};

export const isValidGoogleAiApiKey = (key: string): boolean => {
  return GOOGLE_AI_API_KEY_PATTERN.test(sanitizeApiKey(key));
};

// ═══════════ PROVIDER MANAGEMENT ═══════════

/**
 * Lấy provider hiện tại (gemini hoặc agent-platform)
 */
export const getProvider = (): AiProvider => {
  const stored = localStorage.getItem(PROVIDER_STORAGE_KEY);
  if (stored === 'agent-platform') return 'agent-platform';
  return 'gemini'; // Mặc định Gemini
};

/**
 * Lưu provider đã chọn + đánh dấu manual
 */
export const saveProvider = (provider: AiProvider): void => {
  localStorage.setItem(PROVIDER_STORAGE_KEY, provider);
  localStorage.setItem(PROVIDER_SOURCE_KEY, 'manual');
};

// ═══════════ ENV API KEYS (chỉ Gemini) ═══════════

/**
 * Đọc danh sách API keys từ biến môi trường VITE_GEMINI_API_KEYS
 * Keys được phân tách bằng dấu phẩy trong file .env
 * CHỈ dùng cho Gemini API, KHÔNG dùng cho Agent Platform.
 */
const getEnvApiKeys = (): string[] => {
  const raw = import.meta.env.VITE_GEMINI_API_KEYS || '';
  if (!raw) return [];
  return raw
    .split(',')
    .map((k: string) => sanitizeApiKey(k))
    .filter((k: string) => k.length > 0);
};

/**
 * Danh sách API key dự phòng - đọc từ biến môi trường (chỉ Gemini)
 */
export const ENV_API_KEYS: string[] = getEnvApiKeys();

// Track key hiện tại đang dùng trong phiên: -1 = key user, 0..N = env key index
let currentFallbackIndex = -1;

// Các key đã hết quota trong phiên này
const exhaustedKeys = new Set<string>();

// ═══════════ GEMINI API KEY ═══════════

/**
 * Lấy API key Gemini do người dùng tự nhập (từ localStorage)
 */
export const getApiKey = (): string => {
  const raw = localStorage.getItem(STORAGE_KEY) || '';
  return sanitizeApiKey(raw);
};

/**
 * Lưu API key Gemini do người dùng nhập
 */
export const saveApiKey = (key: string): void => {
  localStorage.setItem(STORAGE_KEY, sanitizeApiKey(key));
  currentFallbackIndex = -1;
  exhaustedKeys.clear();
};

// ═══════════ AGENT PLATFORM API KEY ═══════════

/**
 * Lấy API key Agent Platform do người dùng nhập
 */
export const getAgentPlatformApiKey = (): string => {
  const raw = localStorage.getItem(AGENT_PLATFORM_STORAGE_KEY) || '';
  return sanitizeApiKey(raw);
};

/**
 * Lưu API key Agent Platform
 */
export const saveAgentPlatformApiKey = (key: string): void => {
  localStorage.setItem(AGENT_PLATFORM_STORAGE_KEY, sanitizeApiKey(key));
};

// ═══════════ MODEL SELECTION ═══════════

/**
 * Lấy model đã chọn
 */
export const getSelectedModel = (): string => {
  const provider = getProvider();
  return localStorage.getItem(MODEL_STORAGE_KEY) || DEFAULT_MODEL_BY_PROVIDER[provider];
};

/**
 * Lưu model đã chọn
 */
export const saveSelectedModel = (model: string): void => {
  localStorage.setItem(MODEL_STORAGE_KEY, model);
};

// ═══════════ KEY AVAILABILITY ═══════════

/**
 * Lấy API key hoạt động theo provider hiện tại
 */
export const getActiveApiKeyForProvider = (): string => {
  const provider = getProvider();
  if (provider === 'agent-platform') {
    return getAgentPlatformApiKey();
  }
  // Gemini: ưu tiên key user → env keys
  return getCurrentActiveKey();
};

/**
 * Kiểm tra xem có API key không (theo provider hiện tại)
 */
export const hasAnyKey = (): boolean => {
  const provider = getProvider();
  if (provider === 'agent-platform') {
    return getAgentPlatformApiKey().length > 0;
  }
  // Gemini
  const userKey = getApiKey();
  if (userKey.length > 0) return true;
  return ENV_API_KEYS.some(k => !exhaustedKeys.has(k));
};

/**
 * Xóa API key người dùng (Gemini)
 */
export const clearApiKey = (): void => {
  localStorage.removeItem(STORAGE_KEY);
};

/**
 * Đánh dấu 1 key đã hết quota
 */
export const markKeyExhausted = (key: string): void => {
  exhaustedKeys.add(key);
  console.warn(`🔑 API key ...${key.slice(-6)} đã bị đánh dấu hết quota.`);
};

/**
 * Lấy API key hiện tại đang hoạt động (Gemini)
 * Ưu tiên: key user (nếu có) → env keys (xoay vòng)
 */
export const getCurrentActiveKey = (): string => {
  // Ưu tiên key user trước
  if (currentFallbackIndex === -1) {
    const userKey = getApiKey();
    if (userKey && !exhaustedKeys.has(userKey)) {
      return userKey;
    }
  }

  // Dùng env keys
  const startIndex = currentFallbackIndex === -1 ? 0 : currentFallbackIndex;
  for (let i = startIndex; i < ENV_API_KEYS.length; i++) {
    if (!exhaustedKeys.has(ENV_API_KEYS[i])) {
      currentFallbackIndex = i;
      return ENV_API_KEYS[i];
    }
  }

  return '';
};

/**
 * Chuyển sang API key tiếp theo (chỉ Gemini env keys)
 */
export const getNextApiKey = (): string => {
  const startIndex = currentFallbackIndex + 1;

  for (let i = startIndex; i < ENV_API_KEYS.length; i++) {
    if (!exhaustedKeys.has(ENV_API_KEYS[i])) {
      currentFallbackIndex = i;
      console.log(`🔄 Tự động chuyển sang API key dự phòng #${i + 1} (...${ENV_API_KEYS[i].slice(-6)})`);
      return ENV_API_KEYS[i];
    }
  }

  console.warn('⚠️ Tất cả API key dự phòng đều đã hết quota!');
  return '';
};

/**
 * Reset trạng thái xoay key
 */
export const resetKeyRotation = (): void => {
  currentFallbackIndex = -1;
  exhaustedKeys.clear();
};

// ═══════════ FALLBACK MODEL ORDER (api.md §II) ═══════════

/**
 * Lấy danh sách model theo thứ tự thử, theo provider hiện tại.
 * Model người dùng chọn luôn đầu tiên, sau đó là chuỗi fallback (loại trùng).
 */
export const getOrderedModels = (selectedModel?: string): string[] => {
  const provider = getProvider();
  const model = selectedModel || getSelectedModel();

  const fallbackChain: readonly string[] = provider === 'agent-platform'
    ? AGENT_PLATFORM_FALLBACK_MODELS
    : GEMINI_FALLBACK_MODELS;

  // Model chọn luôn đầu tiên, sau đó fallback (loại trùng)
  return [model, ...fallbackChain.filter(m => m !== model)];
};

// ═══════════ REQUEST TRACKING (Budget Awareness) ═══════════
const REQUEST_COUNT_KEY = 'skkn-daily-request-count';
const REQUEST_DATE_KEY = 'skkn-daily-request-date';

/**
 * Lấy ngày hiện tại dạng YYYY-MM-DD
 */
const getTodayStr = (): string => new Date().toISOString().split('T')[0];

/**
 * Lấy số request đã dùng hôm nay
 */
export const getDailyRequestCount = (): number => {
  const savedDate = localStorage.getItem(REQUEST_DATE_KEY);
  if (savedDate !== getTodayStr()) {
    localStorage.setItem(REQUEST_DATE_KEY, getTodayStr());
    localStorage.setItem(REQUEST_COUNT_KEY, '0');
    return 0;
  }
  return parseInt(localStorage.getItem(REQUEST_COUNT_KEY) || '0', 10);
};

/**
 * Tăng số request hôm nay lên 1
 */
export const incrementDailyRequestCount = (): number => {
  const today = getTodayStr();
  const savedDate = localStorage.getItem(REQUEST_DATE_KEY);
  if (savedDate !== today) {
    localStorage.setItem(REQUEST_DATE_KEY, today);
    localStorage.setItem(REQUEST_COUNT_KEY, '1');
    return 1;
  }
  const newCount = getDailyRequestCount() + 1;
  localStorage.setItem(REQUEST_COUNT_KEY, String(newCount));
  return newCount;
};

// ═══════════ ERROR CLASSIFICATION (api.md §II + §III) ═══════════

/**
 * Kiểm tra lỗi có phải là quota/rate limit không
 */
const getErrorInfo = (error: any): { message: string; serialized: string; text: string; statusText: string } => {
  const message = error?.message || error?.toString?.() || '';
  let serialized = '';
  try {
    serialized = JSON.stringify(error) || '';
  } catch {
    serialized = '';
  }

  const status = error?.status ?? error?.code ?? error?.response?.status ?? '';
  return {
    message,
    serialized,
    text: `${message} ${serialized}`.toLowerCase(),
    statusText: String(status).toLowerCase(),
  };
};

const hasStatusCode = (statusText: string, code: number): boolean => {
  return statusText === String(code) || statusText.includes(String(code));
};

/**
 * Lỗi 500 INTERNAL - chuyển model được
 */
export const isInternalError = (error: any): boolean => {
  if (!error) return false;
  const { text, statusText } = getErrorInfo(error);
  return hasStatusCode(statusText, 500) || text.includes('internal');
};

/**
 * Lỗi 504 DEADLINE_EXCEEDED - chuyển model được
 */
export const isDeadlineExceededError = (error: any): boolean => {
  if (!error) return false;
  const { text, statusText } = getErrorInfo(error);
  return hasStatusCode(statusText, 504) || text.includes('deadline_exceeded');
};

/**
 * Lỗi model/service quá tải tạm thời (503 / UNAVAILABLE / overloaded)
 * Chuyển model được. KHÔNG đánh dấu key hết quota hoặc invalid.
 */
export const isModelOverloadedError = (error: any): boolean => {
  if (!error) return false;
  const { text, statusText } = getErrorInfo(error);
  return (
    hasStatusCode(statusText, 503) ||
    statusText.includes('unavailable') ||
    text.includes('503') ||
    text.includes('unavailable') ||
    text.includes('high demand') ||
    text.includes('overloaded') ||
    text.includes('try again later') ||
    text.includes('temporarily unavailable')
  );
};

/**
 * Lỗi model không tồn tại (404 / NOT_FOUND) - chuyển model được
 */
export const isModelNotFoundError = (error: any): boolean => {
  if (!error) return false;
  const { text, statusText } = getErrorInfo(error);
  return (
    hasStatusCode(statusText, 404) ||
    statusText.includes('not_found') ||
    text.includes('not found') ||
    text.includes('is not found') ||
    text.includes('model') && text.includes('not') ||
    text.includes('models/') && text.includes('not')
  );
};

/**
 * Lỗi quota/rate limit (429) - DỪNG, không chuyển model.
 * Không đánh dấu key là invalid.
 */
export const isQuotaOrRateLimitError = (error: any): boolean => {
  if (!error) return false;
  const { text, statusText } = getErrorInfo(error);
  // Không coi lỗi model not found là quota error
  if (isModelNotFoundError(error)) return false;
  // 503/UNAVAILABLE là lỗi model/service quá tải, không phải quota hay key hỏng
  if (isModelOverloadedError(error)) return false;
  return (
    hasStatusCode(statusText, 429) ||
    text.includes('quota') ||
    text.includes('rate limit') ||
    text.includes('resource exhausted') ||
    text.includes('too many requests')
  );
};

/**
 * Lỗi key không hợp lệ (401 / API_KEY_INVALID) - DỪNG ngay.
 */
export const isInvalidKeyError = (error: any): boolean => {
  if (!error) return false;
  const { text, statusText } = getErrorInfo(error);
  return (
    hasStatusCode(statusText, 401) ||
    text.includes('api_key_invalid') ||
    text.includes('invalid api key') ||
    text.includes('api key not valid')
  );
};

/**
 * Lỗi Permission Denied (403) - xử lý khác nhau theo provider:
 * - Gemini: DỪNG ngay
 * - Agent Platform: có thể thử model tiếp theo trước khi dừng
 */
export const isPermissionDeniedError = (error: any): boolean => {
  if (!error) return false;
  const { text, statusText } = getErrorInfo(error);
  return (
    hasStatusCode(statusText, 403) ||
    text.includes('permission_denied') ||
    text.includes('permission denied')
  );
};

/**
 * Lỗi 400 / INVALID_ARGUMENT - DỪNG ngay, payload sai.
 */
export const isInvalidArgumentError = (error: any): boolean => {
  if (!error) return false;
  const { text, statusText } = getErrorInfo(error);
  return (
    hasStatusCode(statusText, 400) ||
    text.includes('invalid_argument') ||
    text.includes('invalid argument')
  );
};

/**
 * Phân loại lỗi API (api.md §II)
 */
export const parseApiError = (error: any): GeminiApiErrorType => {
  if (isModelOverloadedError(error)) return 'MODEL_OVERLOADED';
  if (isModelNotFoundError(error)) return 'MODEL_NOT_FOUND';
  if (isInternalError(error)) return 'MODEL_OVERLOADED'; // 500 → cùng nhóm chuyển model
  if (isDeadlineExceededError(error)) return 'MODEL_OVERLOADED'; // 504 → cùng nhóm chuyển model
  if (isQuotaOrRateLimitError(error)) return 'QUOTA_EXCEEDED';
  if (isInvalidKeyError(error)) return 'INVALID_API_KEY';
  if (isPermissionDeniedError(error)) return 'PERMISSION_DENIED';
  if (isInvalidArgumentError(error)) return 'INVALID_ARGUMENT';
  return 'UNKNOWN';
};

/**
 * Kiểm tra lỗi có cho phép chuyển model không (api.md §II)
 * - 500, 503, 504, NOT_FOUND, overloaded → chuyển model được
 * - Agent Platform: 403 cũng cho thử model tiếp
 */
export const canFallbackToNextModel = (error: any): boolean => {
  const type = parseApiError(error);
  if (type === 'MODEL_OVERLOADED' || type === 'MODEL_NOT_FOUND') return true;
  // Agent Platform: 403 có thể do model cụ thể không có quyền → thử model khác
  if (type === 'PERMISSION_DENIED' && getProvider() === 'agent-platform') return true;
  return false;
};

/**
 * Kiểm tra lỗi có nên xoay API key không (chỉ Gemini)
 */
export const shouldRotateApiKey = (error: any): boolean => {
  if (getProvider() === 'agent-platform') return false; // Agent Platform không xoay key
  return isQuotaOrRateLimitError(error) || isInvalidKeyError(error);
};

/**
 * Tạo thông báo lỗi tiếng Việt
 */
export const getVietnameseErrorMessage = (error: any): string => {
  if (isModelOverloadedError(error) || isInternalError(error) || isDeadlineExceededError(error)) {
    return '⚠️ Model đang quá tải tạm thời.\n\n' +
      '📝 Hướng dẫn:\n' +
      '1. Hệ thống sẽ tự thử model dự phòng khi có thể\n' +
      '2. Vui lòng thử lại sau ít phút hoặc chọn model nhẹ hơn\n' +
      '3. API Key vẫn còn hiệu lực, không cần đổi key chỉ vì lỗi quá tải model';
  }

  if (isQuotaOrRateLimitError(error)) {
    return '⚠️ Đã hết quota hoặc vượt giới hạn tốc độ API.\n\n' +
      '📝 Hướng dẫn:\n' +
      '1. Lấy API key từ một tài khoản Gmail khác để dán vào dùng tiếp\n' +
      '2. Hoặc chờ đến ngày hôm sau để quota được reset tự động\n' +
      '3. Bấm "Đổi API Key" để nhập key mới\n' +
      '4. Lấy key miễn phí tại: aistudio.google.com/apikey';
  }

  if (isPermissionDeniedError(error)) {
    const provider = getProvider();
    if (provider === 'agent-platform') {
      return '⚠️ API key không có quyền truy cập Agent Platform API hoặc model này.\n\n' +
        '📝 Hướng dẫn:\n' +
        '1. Kiểm tra Agent Platform API đã bật trong dự án Google Cloud\n' +
        '2. Kiểm tra billing đã kích hoạt\n' +
        '3. Kiểm tra API restrictions và quyền sử dụng model\n' +
        '4. Thử chọn model khác (VD: Gemini 2.5 Flash)';
    }
    return '⚠️ API key không có quyền truy cập Gemini API.\n\n' +
      '📝 Hướng dẫn:\n' +
      '1. Kiểm tra lại API Key\n' +
      '2. Lấy key mới tại: aistudio.google.com/apikey\n' +
      '3. Bấm "Đổi API Key" để nhập key mới';
  }

  if (isInvalidKeyError(error)) {
    return '❌ API Key không hợp lệ hoặc đã hết hạn.\n\n' +
      '📝 Hướng dẫn:\n' +
      '1. Kiểm tra lại API Key (phải bắt đầu bằng "AIzaSy" hoặc "AQ")\n' +
      '2. Lấy key mới tại: aistudio.google.com/apikey\n' +
      '3. Bấm "Đổi API Key" để nhập key mới';
  }

  if (isInvalidArgumentError(error)) {
    return '❌ Tham số yêu cầu không hợp lệ.\n\n' +
      '📝 Hướng dẫn:\n' +
      '1. Thử chọn model khác trong Cài đặt\n' +
      '2. Nếu lỗi tiếp tục, vui lòng báo cho nhà phát triển';
  }

  return error.message || 'Đã xảy ra lỗi không xác định. Vui lòng thử lại sau.';
};
