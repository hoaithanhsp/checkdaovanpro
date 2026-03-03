/**
 * API Key Management Service
 * Quản lý API key với tự động xoay key dự phòng khi hết quota
 * Keys được đọc từ biến môi trường VITE_GEMINI_API_KEYS (file .env)
 */

const STORAGE_KEY = 'skkn-gemini-api-key';
const MODEL_STORAGE_KEY = 'skkn-gemini-model';

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

/**
 * Kiểm tra lỗi có phải là quota/rate limit không
 */
export const isQuotaOrRateLimitError = (error: any): boolean => {
  if (!error) return false;
  const message = error.message?.toLowerCase() || '';
  const status = error.status || error.code;
  // Không coi lỗi model not found là quota error
  if (isModelNotFoundError(error)) return false;
  return (
    status === 429 ||
    status === 503 ||
    message.includes('quota') ||
    message.includes('rate limit') ||
    message.includes('resource exhausted') ||
    message.includes('too many requests') ||
    message.includes('overloaded')
  );
};

/**
 * Kiểm tra lỗi model không tồn tại (404 / NOT_FOUND)
 * Lỗi này không nên đánh dấu key hết quota
 */
export const isModelNotFoundError = (error: any): boolean => {
  if (!error) return false;
  const message = error.message?.toLowerCase() || '';
  const status = error.status || error.code;
  return (
    status === 404 ||
    message.includes('not found') ||
    message.includes('is not found') ||
    message.includes('model') && message.includes('not') ||
    message.includes('models/') && message.includes('not')
  );
};

/**
 * Kiểm tra lỗi key không hợp lệ
 */
export const isInvalidKeyError = (error: any): boolean => {
  if (!error) return false;
  const message = error.message?.toLowerCase() || '';
  const status = error.status || error.code;
  return (
    status === 401 ||
    status === 403 ||
    message.includes('invalid api key') ||
    message.includes('api key not valid') ||
    message.includes('permission denied')
  );
};

/**
 * Tạo thông báo lỗi tiếng Việt
 */
export const getVietnameseErrorMessage = (error: any): string => {
  if (isQuotaOrRateLimitError(error)) {
    return '⚠️ Tất cả API Key đã hết quota hoặc bị giới hạn tạm thời.\n\n' +
      '📝 Hướng dẫn:\n' +
      '1. Chờ vài phút rồi thử lại (quota sẽ được reset)\n' +
      '2. Hoặc bấm "Đổi API Key" để nhập key mới\n' +
      '3. Lấy key miễn phí tại: aistudio.google.com/apikey';
  }

  if (isInvalidKeyError(error)) {
    return '❌ API Key không hợp lệ hoặc đã bị vô hiệu hóa.\n\n' +
      '📝 Hướng dẫn:\n' +
      '1. Kiểm tra lại API Key (phải bắt đầu bằng "AIza")\n' +
      '2. Lấy key mới tại: aistudio.google.com/apikey\n' +
      '3. Bấm "Đổi API Key" để nhập key mới';
  }

  return error.message || 'Đã xảy ra lỗi không xác định. Vui lòng thử lại sau.';
};
