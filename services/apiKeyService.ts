/**
 * API Key Management Service
 * Quản lý nhiều API key và xoay vòng tự động khi gặp lỗi quota/rate limit
 */

export interface ApiKeyEntry {
    id: string;
    key: string;
    name: string;
    isActive: boolean;
    lastError?: string;
    errorCount: number;
    lastUsed?: number;
    cooldownUntil?: number;
}

const STORAGE_KEY = 'skkn-api-keys';
const CURRENT_INDEX_KEY = 'skkn-api-key-index';
const OLD_API_KEY_STORAGE = 'skkn-gemini-api-key';
const MAX_KEYS = 10;
const COOLDOWN_DURATION = 60 * 1000; // 1 phút cooldown khi gặp lỗi
const MAX_ERROR_COUNT = 3; // Sau 3 lần lỗi liên tiếp, key sẽ bị cooldown

/**
 * Tạo UUID đơn giản
 */
const generateId = (): string => {
    return 'key_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
};

/**
 * Migrate key cũ (nếu có) sang format mới
 */
const migrateOldApiKey = (): void => {
    const oldKey = localStorage.getItem(OLD_API_KEY_STORAGE);
    if (oldKey && getApiKeys().length === 0) {
        const newEntry: ApiKeyEntry = {
            id: generateId(),
            key: oldKey,
            name: 'Key đã lưu trước đó',
            isActive: true,
            errorCount: 0,
        };
        saveApiKeys([newEntry]);
        localStorage.removeItem(OLD_API_KEY_STORAGE);
        console.log('[ApiKeyService] Đã migrate key cũ sang format mới');
    }
};

/**
 * Lấy danh sách tất cả API key
 */
export const getApiKeys = (): ApiKeyEntry[] => {
    try {
        const data = localStorage.getItem(STORAGE_KEY);
        if (!data) return [];
        return JSON.parse(data) as ApiKeyEntry[];
    } catch {
        return [];
    }
};

/**
 * Lưu danh sách API key
 */
const saveApiKeys = (keys: ApiKeyEntry[]): void => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(keys));
};

/**
 * Lấy index key hiện tại
 */
const getCurrentIndex = (): number => {
    const index = localStorage.getItem(CURRENT_INDEX_KEY);
    return index ? parseInt(index, 10) : 0;
};

/**
 * Lưu index key hiện tại
 */
const setCurrentIndex = (index: number): void => {
    localStorage.setItem(CURRENT_INDEX_KEY, index.toString());
};

/**
 * Thêm API key mới
 */
export const addApiKey = (key: string, name?: string): ApiKeyEntry | null => {
    const keys = getApiKeys();

    if (keys.length >= MAX_KEYS) {
        console.warn(`[ApiKeyService] Đã đạt giới hạn ${MAX_KEYS} keys`);
        return null;
    }

    // Kiểm tra key đã tồn tại
    if (keys.some(k => k.key === key)) {
        console.warn('[ApiKeyService] Key đã tồn tại');
        return null;
    }

    const newEntry: ApiKeyEntry = {
        id: generateId(),
        key,
        name: name || `Key ${keys.length + 1}`,
        isActive: true,
        errorCount: 0,
    };

    keys.push(newEntry);
    saveApiKeys(keys);
    console.log(`[ApiKeyService] Đã thêm key mới: ${newEntry.name}`);

    return newEntry;
};

/**
 * Xóa API key theo ID
 */
export const removeApiKey = (id: string): boolean => {
    const keys = getApiKeys();
    const filtered = keys.filter(k => k.id !== id);

    if (filtered.length === keys.length) {
        return false;
    }

    saveApiKeys(filtered);

    // Reset index nếu cần
    const currentIndex = getCurrentIndex();
    if (currentIndex >= filtered.length) {
        setCurrentIndex(0);
    }

    console.log(`[ApiKeyService] Đã xóa key: ${id}`);
    return true;
};

/**
 * Cập nhật thông tin API key
 */
export const updateApiKey = (id: string, data: Partial<ApiKeyEntry>): boolean => {
    const keys = getApiKeys();
    const index = keys.findIndex(k => k.id === id);

    if (index === -1) return false;

    keys[index] = { ...keys[index], ...data, id: keys[index].id }; // Không cho đổi id
    saveApiKeys(keys);

    return true;
};

/**
 * Kiểm tra key có đang trong cooldown không
 */
const isInCooldown = (entry: ApiKeyEntry): boolean => {
    if (!entry.cooldownUntil) return false;
    return Date.now() < entry.cooldownUntil;
};

/**
 * Lấy key khả dụng tiếp theo (round-robin)
 */
export const getNextAvailableKey = (): ApiKeyEntry | null => {
    // Migrate key cũ nếu cần
    migrateOldApiKey();

    const keys = getApiKeys();
    if (keys.length === 0) return null;

    const activeKeys = keys.filter(k => k.isActive);
    if (activeKeys.length === 0) return null;

    let currentIndex = getCurrentIndex();
    const startIndex = currentIndex;
    let attempts = 0;

    // Tìm key khả dụng, tối đa thử qua tất cả keys
    while (attempts < activeKeys.length) {
        currentIndex = (currentIndex + 1) % activeKeys.length;
        const key = activeKeys[currentIndex];

        // Reset cooldown nếu đã hết thời gian
        if (key.cooldownUntil && Date.now() >= key.cooldownUntil) {
            updateApiKey(key.id, { cooldownUntil: undefined, errorCount: 0 });
            key.cooldownUntil = undefined;
            key.errorCount = 0;
        }

        if (!isInCooldown(key)) {
            setCurrentIndex(currentIndex);
            updateApiKey(key.id, { lastUsed: Date.now() });
            console.log(`[ApiKeyService] Sử dụng key: ${key.name} (${key.key.substring(0, 8)}...)`);
            return key;
        }

        attempts++;
    }

    // Tất cả key đều đang cooldown
    console.warn('[ApiKeyService] Tất cả key đều đang trong cooldown');
    return null;
};

/**
 * Đánh dấu key gặp lỗi
 */
export const markKeyError = (id: string, error: string): void => {
    const keys = getApiKeys();
    const key = keys.find(k => k.id === id);

    if (!key) return;

    const newErrorCount = key.errorCount + 1;
    const updates: Partial<ApiKeyEntry> = {
        lastError: error,
        errorCount: newErrorCount,
    };

    // Nếu vượt quá số lần lỗi cho phép, đặt cooldown
    if (newErrorCount >= MAX_ERROR_COUNT) {
        updates.cooldownUntil = Date.now() + COOLDOWN_DURATION;
        console.warn(`[ApiKeyService] Key ${key.name} bị cooldown ${COOLDOWN_DURATION / 1000}s do lỗi quá nhiều`);
    }

    updateApiKey(id, updates);
};

/**
 * Reset trạng thái lỗi của key (khi thành công)
 */
export const resetKeyError = (id: string): void => {
    updateApiKey(id, {
        lastError: undefined,
        errorCount: 0,
        cooldownUntil: undefined,
    });
};

/**
 * Đếm số key đang hoạt động (không trong cooldown)
 */
export const getActiveKeyCount = (): { active: number; total: number; inCooldown: number } => {
    const keys = getApiKeys();
    const activeKeys = keys.filter(k => k.isActive);
    const inCooldownCount = activeKeys.filter(k => isInCooldown(k)).length;

    return {
        active: activeKeys.length - inCooldownCount,
        total: keys.length,
        inCooldown: inCooldownCount,
    };
};

/**
 * Kiểm tra xem có key nào không
 */
export const hasAnyKey = (): boolean => {
    migrateOldApiKey();
    return getApiKeys().length > 0;
};

/**
 * Lấy thời gian cooldown còn lại của key (ms)
 */
export const getRemainingCooldown = (entry: ApiKeyEntry): number => {
    if (!entry.cooldownUntil) return 0;
    const remaining = entry.cooldownUntil - Date.now();
    return remaining > 0 ? remaining : 0;
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
