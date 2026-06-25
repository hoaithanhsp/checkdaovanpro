/**
 * API Key Management Service
 * Quản lý API key với tự động xoay key dự phòng khi hết quota
 * Keys được đọc từ biến môi trường VITE_GEMINI_API_KEYS (file .env)
 */

const STORAGE_KEY = 'skkn-gemini-api-key';
const MODEL_STORAGE_KEY = 'skkn-gemini-model';
export const GOOGLE_AI_API_KEY_PATTERN = /^(?:AIzaSy|AQ)\S{8,}$/;

export type GeminiApiErrorType =
  | 'QUOTA_EXCEEDED'
  | 'MODEL_OVERLOADED'
  | 'INVALID_API_KEY'
  | 'MODEL_NOT_FOUND'
  | 'UNKNOWN';

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

/**
 * Đọc danh sách API keys từ biến môi trường VITE_GEMINI_API_KEYS
 * Keys được phân tách bằng dấu phẩy trong file .env
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
 * Danh sách API key dự phòng - đọc từ biến môi trường
 */
export const ENV_API_KEYS: string[] = getEnvApiKeys();

// Track key hiện tại đang dùng trong phiên: -1 = key user, 0..N = env key index
let currentFallbackIndex = -1;

// Các key đã hết quota trong phiên này
const exhaustedKeys = new Set<string>();

/**
 * Lấy API key do người dùng tự nhập (từ localStorage)
 */
export const getApiKey = (): string => {
  const raw = localStorage.getItem(STORAGE_KEY) || '';
  return sanitizeApiKey(raw);
};

/**
 * Lưu API key do người dùng nhập
 */
export const saveApiKey = (key: string): void => {
  localStorage.setItem(STORAGE_KEY, sanitizeApiKey(key));
  currentFallbackIndex = -1;
  exhaustedKeys.clear();
};

/**
 * Lấy model đã chọn
 */
export const getSelectedModel = (): string => {
  return localStorage.getItem(MODEL_STORAGE_KEY) || 'gemini-2.5-flash';
};

/**
 * Lưu model đã chọn
 */
export const saveSelectedModel = (model: string): void => {
  localStorage.setItem(MODEL_STORAGE_KEY, model);
};

/**
 * Kiểm tra xem có API key không (user key hoặc env keys)
 */
export const hasAnyKey = (): boolean => {
  const userKey = getApiKey();
  if (userKey.length > 0) return true;
  // Kiểm tra env keys
  return ENV_API_KEYS.some(k => !exhaustedKeys.has(k));
};

/**
 * Xóa API key người dùng
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
 * Lấy API key hiện tại đang hoạt động
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
 * Chuyển sang API key tiếp theo
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
 * Kiểm tra lỗi model/service quá tải tạm thời (503 / UNAVAILABLE)
 * Lỗi này không được đánh dấu API key hết quota hoặc invalid.
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
    text.includes('try again later')
  );
};

/**
 * Kiểm tra lỗi model không tồn tại (404 / NOT_FOUND)
 * Lỗi này không nên đánh dấu key hết quota
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
 * Kiểm tra lỗi key không hợp lệ
 */
export const isInvalidKeyError = (error: any): boolean => {
  if (!error) return false;
  const { text, statusText } = getErrorInfo(error);
  return (
    hasStatusCode(statusText, 401) ||
    hasStatusCode(statusText, 403) ||
    text.includes('api_key_invalid') ||
    text.includes('invalid api key') ||
    text.includes('api key not valid') ||
    text.includes('permission denied')
  );
};

export const parseApiError = (error: any): GeminiApiErrorType => {
  if (isModelOverloadedError(error)) return 'MODEL_OVERLOADED';
  if (isModelNotFoundError(error)) return 'MODEL_NOT_FOUND';
  if (isQuotaOrRateLimitError(error)) return 'QUOTA_EXCEEDED';
  if (isInvalidKeyError(error)) return 'INVALID_API_KEY';
  return 'UNKNOWN';
};

/**
 * Tạo thông báo lỗi tiếng Việt
 */
export const getVietnameseErrorMessage = (error: any): string => {
  if (isModelOverloadedError(error)) {
    return '⚠️ Model Gemini đang quá tải tạm thời.\n\n' +
      '📝 Hướng dẫn:\n' +
      '1. Hệ thống sẽ tự thử model dự phòng khi có thể\n' +
      '2. Vui lòng thử lại sau ít phút hoặc chọn model nhẹ hơn như Gemini 2.5 Flash Lite\n' +
      '3. API Key vẫn còn hiệu lực, không cần đổi key chỉ vì lỗi quá tải model';
  }

  if (isQuotaOrRateLimitError(error)) {
    return '⚠️ Tất cả API Key đã hết quota hoặc bị giới hạn tạm thời.\n\n' +
      '📝 Hướng dẫn:\n' +
      '1. Lấy API key từ một tài khoản Gmail khác để dán vào dùng tiếp\n' +
      '2. Hoặc chờ đến ngày hôm sau để quota được reset tự động\n' +
      '3. Bấm "Đổi API Key" để nhập key mới\n' +
      '4. Lấy key miễn phí tại: aistudio.google.com/apikey';
  }

  if (isInvalidKeyError(error)) {
    return '❌ API Key không hợp lệ hoặc đã bị vô hiệu hóa.\n\n' +
      '📝 Hướng dẫn:\n' +
      '1. Kiểm tra lại API Key (phải bắt đầu bằng "AIzaSy" hoặc "AQ")\n' +
      '2. Lấy key mới từ tài khoản Gmail khác tại: aistudio.google.com/apikey\n' +
      '3. Bấm "Đổi API Key" để nhập key mới';
  }

  return error.message || 'Đã xảy ra lỗi không xác định. Vui lòng thử lại sau.';
};
