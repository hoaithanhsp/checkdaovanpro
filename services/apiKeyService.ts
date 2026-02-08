/**
 * API Key Management Service (Đơn giản hóa)
 * Quản lý 1 API key duy nhất
 */

const STORAGE_KEY = 'skkn-gemini-api-key';
const MODEL_STORAGE_KEY = 'skkn-gemini-model';

/**
 * Lấy API key hiện tại
 */
export const getApiKey = (): string => {
  return localStorage.getItem(STORAGE_KEY) || '';
};

/**
 * Lưu API key
 */
export const saveApiKey = (key: string): void => {
  localStorage.setItem(STORAGE_KEY, key);
};

/**
 * Lấy model đã chọn
 */
export const getSelectedModel = (): string => {
  return localStorage.getItem(MODEL_STORAGE_KEY) || 'gemini-3-pro-preview';
};

/**
 * Lưu model đã chọn
 */
export const saveSelectedModel = (model: string): void => {
  localStorage.setItem(MODEL_STORAGE_KEY, model);
};

/**
 * Kiểm tra xem có API key không
 */
export const hasAnyKey = (): boolean => {
  const key = getApiKey();
  return key.length > 0;
};

/**
 * Xóa API key
 */
export const clearApiKey = (): void => {
  localStorage.removeItem(STORAGE_KEY);
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
    return '⚠️ API Key đã hết quota hoặc bị giới hạn tạm thời.\n\n' +
      '📝 Hướng dẫn:\n' +
      '1. Bấm "Đổi API Key" để nhập key mới\n' +
      '2. Lấy key miễn phí tại: aistudio.google.com/apikey\n' +
      '3. Sau khi lưu key mới, bấm "Thử lại" để tiếp tục';
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
