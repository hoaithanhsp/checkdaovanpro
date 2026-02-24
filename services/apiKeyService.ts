/**
 * API Key Management Service
 * Quản lý API key với tự động xoay key dự phòng khi hết quota
 */

const STORAGE_KEY = 'skkn-gemini-api-key';
const MODEL_STORAGE_KEY = 'skkn-gemini-model';

/**
 * Làm sạch API key - loại bỏ khoảng trắng, ký tự Unicode ẩn, BOM
 * Tránh lỗi "String contains non ISO-8859-1 code point" khi gửi HTTP request
 */
const sanitizeApiKey = (key: string): string => {
  if (!key) return '';
  // Loại bỏ BOM, zero-width characters, khoảng trắng đầu/cuối
  return key
    .replace(/[\u200B-\u200D\uFEFF\u00A0]/g, '') // zero-width chars, BOM, nbsp
    .replace(/[^\x20-\x7E]/g, '') // chỉ giữ ký tự ASCII printable
    .trim();
};

/**
 * Danh sách API key dự phòng - tự động chuyển khi key hiện tại hết quota
 */
const FALLBACK_API_KEYS: string[] = [
  'AIzaSyBOuT03aNFvn14FMjHcG5sfTXRzKrPwJVo',
  'AIzaSyCA8TnfB-x2JjNdsOVe8SjVNYNne9e_sHk',
  'AIzaSyAuD5aEMEuCrGJ9DTuvWiiEb6QQ6hZnBlc',
  'AIzaSyA1CIAEDWzWrBs0KQW1tfPwoHFsiXyQlCQ',
  'AIzaSyCxQQI8973lLssmnol7TIz9Qfu6bLW2QNY',
  'AIzaSyAVOJQb1eUQRNpdQAz3UuZ4CAMpcj0eaDc',
];

// Track key hiện tại đang dùng trong phiên: -1 = key user, 0..N = fallback index
let currentFallbackIndex = -1;

// Các key đã hết quota trong phiên này
const exhaustedKeys = new Set<string>();

/**
 * Lấy API key hiện tại
 */
export const getApiKey = (): string => {
  const raw = localStorage.getItem(STORAGE_KEY) || '';
  return sanitizeApiKey(raw);
};

/**
 * Lưu API key
 */
export const saveApiKey = (key: string): void => {
  localStorage.setItem(STORAGE_KEY, sanitizeApiKey(key));
  // Reset lại trạng thái xoay key khi user lưu key mới
  currentFallbackIndex = -1;
  exhaustedKeys.clear();
};

/**
 * Lấy model đã chọn
 */
export const getSelectedModel = (): string => {
  return localStorage.getItem(MODEL_STORAGE_KEY) || 'gemini-3-flash-preview';
};

/**
 * Lưu model đã chọn
 */
export const saveSelectedModel = (model: string): void => {
  localStorage.setItem(MODEL_STORAGE_KEY, model);
};

/**
 * Kiểm tra xem có API key không (bao gồm cả fallback)
 */
export const hasAnyKey = (): boolean => {
  const userKey = getApiKey();
  if (userKey.length > 0) return true;
  // Nếu user chưa nhập key thì dùng fallback
  return FALLBACK_API_KEYS.some(k => !exhaustedKeys.has(k));
};

/**
 * Xóa API key
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
 * Lấy API key hiện tại đang hoạt động (user key hoặc fallback)
 * Bỏ qua các key đã hết quota
 */
export const getCurrentActiveKey = (): string => {
  // Nếu đang dùng key user và chưa bị exhausted
  if (currentFallbackIndex === -1) {
    const userKey = getApiKey();
    if (userKey && !exhaustedKeys.has(userKey)) {
      return userKey;
    }
  }

  // Tìm fallback key chưa hết quota, bắt đầu từ index hiện tại
  const startIndex = currentFallbackIndex === -1 ? 0 : currentFallbackIndex;
  for (let i = startIndex; i < FALLBACK_API_KEYS.length; i++) {
    if (!exhaustedKeys.has(FALLBACK_API_KEYS[i])) {
      currentFallbackIndex = i;
      return FALLBACK_API_KEYS[i];
    }
  }

  // Không tìm thấy key nào
  return '';
};

/**
 * Chuyển sang API key dự phòng tiếp theo
 * Trả về key mới hoặc rỗng nếu đã hết key
 */
export const getNextApiKey = (): string => {
  const startIndex = currentFallbackIndex + 1;

  for (let i = startIndex; i < FALLBACK_API_KEYS.length; i++) {
    if (!exhaustedKeys.has(FALLBACK_API_KEYS[i])) {
      currentFallbackIndex = i;
      console.log(`🔄 Tự động chuyển sang API key dự phòng #${i + 1} (...${FALLBACK_API_KEYS[i].slice(-6)})`);
      return FALLBACK_API_KEYS[i];
    }
  }

  // Đã thử hết tất cả key
  console.warn('⚠️ Tất cả API key dự phòng đều đã hết quota!');
  return '';
};

/**
 * Reset trạng thái xoay key (gọi khi reload app hoặc sau 1 khoảng thời gian)
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
 * Tạo thông báo lỗi tiếng Việt dễ hiểu
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

