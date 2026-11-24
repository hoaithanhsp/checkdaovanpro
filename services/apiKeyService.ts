/**
 * API Key & AI Provider Management Service (v5.0 — 24/11/2026)
 * - Mặc định Gemini 4 Hydrogen (GA 11/2026, Free Tier) + 6 model Free Tier sạch
 * - Xoay vòng tới 30 API key qua apiKeyManager + cooldown thông minh theo từng (key, model)
 * - Hỗ trợ kho key dự phòng ngầm phía server qua Vercel Edge Proxy /api/gemini
 * - Hỗ trợ dual-provider tách biệt: Gemini API & Agent Platform API
 */

import { GoogleGenAI, ThinkingLevel } from '@google/genai';
import {
  GOOGLE_AI_API_KEY_PATTERN,
  normalizeGoogleAiApiKey,
  isValidGoogleAiApiKey,
  maskGoogleAiApiKey,
} from './apiKeyValidation';
import { apiKeyManager, GEMINI_FREE_FALLBACK_MODELS, ENV_BACKUP_KEY_LIST } from './apiKeyManager';

export {
  GOOGLE_AI_API_KEY_PATTERN,
  normalizeGoogleAiApiKey,
  isValidGoogleAiApiKey,
  maskGoogleAiApiKey,
  apiKeyManager,
};

// ═══════════ PROVIDER TYPES ═══════════

export type AiProvider = 'gemini' | 'agent-platform';

// ═══════════ STORAGE KEYS & MIGRATION (api.md §V) ═══════════

const AGENT_PLATFORM_STORAGE_KEY = 'agent_platform_api_key';
const LEGACY_AGENT_PLATFORM_STORAGE_KEY = 'skkn-agent-platform-api-key';
export const GEMINI_MODEL_STORAGE_KEY = 'gemini_model_id_v4';
export const LEGACY_GEMINI_MODEL_STORAGE_KEYS = [
  'skkn-gemini-model',
  'gemini_model_id_v38',
  'GEMINI_MODEL_ID',
  'selected_model',
] as const;
const PROVIDER_STORAGE_KEY = 'google_ai_provider';
const PROVIDER_SOURCE_KEY = 'google_ai_provider_selection_source';

export const SERVER_PROXY_KEY_SENTINEL = '__SERVER_PROXY__';

// ═══════════ MODEL CATALOG (v5.0 — 24/11/2026) ═══════════

export const DEFAULT_GEMINI_MODEL = 'gemini-4-hydrogen';
export const DEFAULT_AGENT_PLATFORM_MODEL = 'gemini-3-flash-preview';

export const isGemini3Or4 = (model: string): boolean => /^gemini-[34]/i.test((model || '').trim());
export const isLiteModel = (model: string): boolean => /flash-lite/i.test((model || '').trim());

/** Chuỗi 6 model MIỄN PHÍ (Free Tier) đang hoạt động cho Gemini API (api.md §I.1) */
export const GEMINI_FALLBACK_MODELS = GEMINI_FREE_FALLBACK_MODELS;

/** Chuỗi fallback Agent Platform API Express Mode (api.md §III) */
export const AGENT_PLATFORM_FALLBACK_MODELS = [
  'gemini-3-flash-preview',
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
] as const;

export interface UiModelOption {
  id: string;
  name: string;
  description: string;
  badge?: string;
  default?: boolean;
  paid?: boolean;
  isFree?: boolean;
}

/** Models hiển thị trong UI cho Gemini API (100% Free Tier, không có model deprecated/auto-route) */
export const GEMINI_UI_MODELS: UiModelOption[] = [
  {
    id: 'gemini-4-hydrogen',
    name: 'Gemini 4 Hydrogen',
    description: 'Mới nhất (GA 11/2026, Miễn phí) — giảm >5x ảo giác, thẩm định & nâng cấp SKKN chính xác nhất',
    badge: 'Mặc định',
    default: true,
    isFree: true,
  },
  {
    id: 'gemini-3.8-flash',
    name: 'Gemini 3.8 Flash',
    description: 'Ổn định (GA 09/2026, Miễn phí) — chất lượng cao, xử lý bài SKKN dài mượt mà',
    badge: 'Miễn phí',
    isFree: true,
  },
  {
    id: 'gemini-3.5-flash-lite',
    name: 'Gemini 3.5 Flash-Lite',
    description: 'Nhanh nhất (GA 07/2026, Miễn phí) — chịu tải lớn, quota rộng, tốt nhất giờ cao điểm',
    badge: 'Siêu nhanh',
    isFree: true,
  },
  {
    id: 'gemini-3.6-flash',
    name: 'Gemini 3.6 Flash',
    description: 'Cân bằng (GA 07/2026, Miễn phí) — hạn mức Free Tier độc lập, phân tích đa bước ổn định',
    badge: 'Miễn phí',
    isFree: true,
  },
  {
    id: 'gemini-3.1-flash-lite',
    name: 'Gemini 3.1 Flash-Lite',
    description: 'Nhẹ (GA 05/2026, Miễn phí) — dự phòng riêng biệt khi các model chính chạm hạn mức',
    badge: 'Lite',
    isFree: true,
  },
  {
    id: 'gemini-3-flash-preview',
    name: 'Gemini 3 Flash (Preview)',
    description: 'Preview (Miễn phí) — dự phòng cuối cùng dòng Gemini 3',
    badge: 'Preview',
    isFree: true,
  },
];

/** Models hiển thị trong UI cho Agent Platform API (cập nhật 11/2026) */
export const AGENT_PLATFORM_UI_MODELS: UiModelOption[] = [
  {
    id: 'gemini-3-flash-preview',
    name: 'Gemini 3 Flash (Preview)',
    description: 'Mặc định mới cho Agent Platform Express Mode, tốc độ cao, tư duy mạnh',
    badge: 'Mặc định',
    default: true,
  },
  {
    id: 'gemini-2.5-flash',
    name: 'Gemini 2.5 Flash',
    description: 'Ổn định trên Agent Platform, cân bằng tốc độ và chất lượng',
    badge: 'Ổn định',
  },
  {
    id: 'gemini-2.5-flash-lite',
    name: 'Gemini 2.5 Flash-Lite',
    description: 'Nhanh nhất, tiết kiệm chi phí trên Agent Platform',
    badge: 'Lite',
  },
  {
    id: 'gemini-2.5-pro',
    name: 'Gemini 2.5 Pro',
    description: 'Suy luận sâu, xử lý SKKN dài trên Agent Platform',
    badge: 'Pro',
    paid: true,
  },
  {
    id: 'gemini-3.1-pro-preview',
    name: 'Gemini 3.1 Pro (Preview)',
    description: 'Suy luận nâng cao thế hệ 3.1 trên Agent Platform',
    badge: 'Pro',
    paid: true,
  },
];

export const DEFAULT_MODEL_BY_PROVIDER: Record<AiProvider, string> = {
  gemini: DEFAULT_GEMINI_MODEL,
  'agent-platform': DEFAULT_AGENT_PLATFORM_MODEL,
};

// Map các model đã khai bỏ/deprecated/auto-route sang model hiện hành tương ứng
const MODEL_ALIASES: Record<string, string> = {
  'gemini-3.7-flash': 'gemini-3.8-flash',
  'gemini-3.5-flash': 'gemini-3.6-flash',
  'gemini-3-pro-preview': 'gemini-4-hydrogen',
  'gemini-3.1-flash-lite-preview': 'gemini-3.5-flash-lite',
  'gemini-2.0-flash': 'gemini-4-hydrogen',
  'gemini-2.0-flash-lite': 'gemini-3.5-flash-lite',
  'gemini-2.5-flash-preview-05-20': 'gemini-4-hydrogen',
  'gemini-1.5-flash': 'gemini-4-hydrogen',
};

export type GeminiApiErrorType =
  | 'QUOTA_EXCEEDED'
  | 'RATE_LIMIT'
  | 'MODEL_OVERLOADED'
  | 'TRANSIENT_SERVER_ERROR'
  | 'INVALID_API_KEY'
  | 'PERMISSION_DENIED'
  | 'MODEL_NOT_FOUND'
  | 'INVALID_ARGUMENT'
  | 'UNKNOWN';

export interface ClassifiedApiError {
  type: GeminiApiErrorType;
  isPerMinute: boolean;
  retryDelaySec?: number;
  isThinkingConfigError: boolean;
}

export interface ServerProxyStatus {
  checked: boolean;
  available: boolean;
  keyCount: number;
}

export interface ApiKeyTestResult {
  ok: boolean;
  title: string;
  message: string;
  model?: string;
  errorType?: GeminiApiErrorType;
}

const hasLocalStorage = (): boolean => {
  try {
    return typeof localStorage !== 'undefined' && localStorage !== null;
  } catch {
    return false;
  }
};

// --- Tự động di trú (Migration) Model & Provider một lần khi khởi động ---
const runStorageMigrationOnce = (() => {
  let migrated = false;
  return () => {
    if (migrated || !hasLocalStorage()) return;
    migrated = true;
    try {
      for (const legacyKey of LEGACY_GEMINI_MODEL_STORAGE_KEYS) {
        localStorage.removeItem(legacyKey);
      }
      const rawProvider = localStorage.getItem(PROVIDER_STORAGE_KEY);
      if (rawProvider === 'vertex') {
        localStorage.setItem(PROVIDER_STORAGE_KEY, 'gemini');
        localStorage.removeItem(PROVIDER_SOURCE_KEY);
      }
      // Di trú Agent Platform key sang tên khóa chuẩn
      const legacyAgentKey = localStorage.getItem(LEGACY_AGENT_PLATFORM_STORAGE_KEY);
      if (legacyAgentKey && !localStorage.getItem(AGENT_PLATFORM_STORAGE_KEY)) {
        localStorage.setItem(AGENT_PLATFORM_STORAGE_KEY, normalizeGoogleAiApiKey(legacyAgentKey));
      }
    } catch {
      // ignore storage errors
    }
  };
})();

runStorageMigrationOnce();

// ═══════════ SERVER PROXY STATUS (/api/gemini) ═══════════

let serverProxyStatus: ServerProxyStatus = {
  checked: false,
  available: false,
  keyCount: 0,
};
let serverProxyCheckPromise: Promise<ServerProxyStatus> | null = null;
const serverProxyListeners = new Set<(status: ServerProxyStatus) => void>();

const notifyServerProxyListeners = () => {
  const snapshot = { ...serverProxyStatus };
  serverProxyListeners.forEach(fn => {
    try {
      fn(snapshot);
    } catch {
      // ignore
    }
  });
};

export const getServerProxyStatus = (): ServerProxyStatus => ({ ...serverProxyStatus });

export const subscribeServerProxyStatus = (listener: (status: ServerProxyStatus) => void): (() => void) => {
  serverProxyListeners.add(listener);
  listener({ ...serverProxyStatus });
  return () => {
    serverProxyListeners.delete(listener);
  };
};

export const checkServerProxyAvailable = async (force = false): Promise<ServerProxyStatus> => {
  if (typeof window === 'undefined' || typeof fetch === 'undefined') {
    return { checked: true, available: false, keyCount: 0 };
  }
  if (serverProxyStatus.checked && !force) {
    return { ...serverProxyStatus };
  }
  if (serverProxyCheckPromise && !force) {
    return serverProxyCheckPromise;
  }

  serverProxyCheckPromise = (async () => {
    try {
      const res = await fetch('/api/gemini', { method: 'GET', cache: 'no-store' });
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        const data = await res.json();
        serverProxyStatus = {
          checked: true,
          available: Boolean(data?.available),
          keyCount: Number(data?.keyCount) || 0,
        };
      } else {
        serverProxyStatus = { checked: true, available: false, keyCount: 0 };
      }
    } catch {
      serverProxyStatus = { checked: true, available: false, keyCount: 0 };
    } finally {
      serverProxyCheckPromise = null;
      notifyServerProxyListeners();
    }
    return { ...serverProxyStatus };
  })();

  return serverProxyCheckPromise;
};

// ═══════════ FALLBACK NOTICE PUB/SUB (api.md §II) ═══════════

type FallbackNoticeListener = (notice: string | null) => void;
const fallbackNoticeListeners = new Set<FallbackNoticeListener>();
let currentFallbackNotice: string | null = null;

export const setFallbackNotice = (notice: string | null): void => {
  currentFallbackNotice = notice;
  fallbackNoticeListeners.forEach(fn => {
    try {
      fn(notice);
    } catch {
      // ignore
    }
  });
};

export const getFallbackNotice = (): string | null => currentFallbackNotice;

export const subscribeFallbackNotice = (listener: FallbackNoticeListener): (() => void) => {
  fallbackNoticeListeners.add(listener);
  listener(currentFallbackNotice);
  return () => {
    fallbackNoticeListeners.delete(listener);
  };
};

export const setOnKeyChanged = (listener: () => void): (() => void) => {
  return apiKeyManager.subscribe(listener);
};

// ═══════════ CONFIG BUILDER CHO GEMINI 4 & 3 (api.md §IV) ═══════════

export const createGeminiConfig = ({
  provider = getProvider(),
  model,
  systemInstruction,
  responseMimeType,
  responseSchema,
  maxOutputTokens,
  thinkingLevel = ThinkingLevel.MEDIUM,
  temperature,
  omitThinkingConfig = false,
}: {
  provider?: AiProvider;
  model: string;
  systemInstruction?: string;
  responseMimeType?: string;
  responseSchema?: any;
  maxOutputTokens?: number;
  thinkingLevel?: ThinkingLevel;
  temperature?: number;
  omitThinkingConfig?: boolean;
}): Record<string, any> => {
  const isGen3Or4 = isGemini3Or4(model);
  const isLite = isLiteModel(model);
  const safeThinkingLevel =
    thinkingLevel === ThinkingLevel.MINIMAL ? ThinkingLevel.LOW : thinkingLevel;

  return {
    ...(systemInstruction ? { systemInstruction } : {}),
    ...(responseMimeType ? { responseMimeType } : {}),
    ...(responseSchema ? { responseSchema } : {}),
    ...(maxOutputTokens ? { maxOutputTokens } : {}),
    // TUYỆT ĐỐI KHÔNG gửi temperature/topP/topK cho Gemini 4 & Gemini 3 (đã deprecated, dễ gây lỗi 400)
    ...(!isGen3Or4 && temperature !== undefined ? { temperature } : {}),
    // Gắn thinkingConfig cho Gemini 4 & 3 (trừ -lite để giữ tốc độ cao nhất & tránh lỗi tương thích)
    ...(provider === 'gemini' && isGen3Or4 && !isLite && !omitThinkingConfig
      ? { thinkingConfig: { thinkingLevel: safeThinkingLevel } }
      : {}),
  };
};

// ═══════════ SERVER PROXY CLIENT ADAPTER (/api/gemini) ═══════════

const normalizeContentsForRest = (contents: any) => {
  if (typeof contents === 'string') {
    return [{ role: 'user', parts: [{ text: contents }] }];
  }
  if (Array.isArray(contents)) {
    if (contents.length === 0) return [];
    const first = contents[0];
    if (typeof first === 'string' || (first && typeof first === 'object' && !('parts' in first))) {
      return [{ role: 'user', parts: contents.map(item => (typeof item === 'string' ? { text: item } : item)) }];
    }
    return contents;
  }
  if (contents && typeof contents === 'object' && 'parts' in contents) {
    return [{ role: contents.role || 'user', parts: contents.parts }];
  }
  return [{ role: 'user', parts: [{ text: String(contents || '') }] }];
};

const extractTextFromRestCandidate = (data: any): string => {
  const parts = data?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) return '';
  return parts
    .filter((p: any) => p && typeof p.text === 'string' && !p.thought)
    .map((p: any) => p.text)
    .join('');
};

export const createServerProxyAiClient = (): GoogleGenAI => {
  const proxyClient = {
    models: {
      generateContent: async (params: { model: string; contents: any; config?: any }) => {
        const { systemInstruction, abortSignal, ...rest } = params.config || {};
        const generationConfig: Record<string, any> = {};
        for (const key of ['maxOutputTokens', 'temperature', 'topP', 'topK', 'responseMimeType', 'responseSchema', 'thinkingConfig']) {
          if (rest[key] !== undefined) generationConfig[key] = rest[key];
        }

        const res = await fetch('/api/gemini', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: abortSignal,
          body: JSON.stringify({
            model: params.model,
            contents: normalizeContentsForRest(params.contents),
            systemInstruction,
            generationConfig: Object.keys(generationConfig).length > 0 ? generationConfig : undefined,
            stream: false,
          }),
        });

        if (!res.ok) {
          const raw = await res.text().catch(() => '');
          let msg = raw || `HTTP ${res.status}`;
          try {
            const parsed = JSON.parse(raw);
            if (parsed?.error?.message) msg = parsed.error.message;
          } catch {
            // keep raw
          }
          const err: any = new Error(msg);
          err.status = res.status;
          err.code = res.status;
          throw err;
        }

        const data = await res.json();
        return {
          text: extractTextFromRestCandidate(data),
          candidates: data?.candidates || [],
        };
      },
    },
  };
  return proxyClient as unknown as GoogleGenAI;
};

// ═══════════ CLIENT FACTORY DUY NHẤT (api.md §III) ═══════════

export const createGoogleAiClient = (
  apiKey: string,
  provider: AiProvider = getProvider(),
): GoogleGenAI => {
  if (apiKey === SERVER_PROXY_KEY_SENTINEL && provider === 'gemini') {
    return createServerProxyAiClient();
  }
  const cleanKey = normalizeGoogleAiApiKey(apiKey);
  if (provider === 'agent-platform') {
    return new GoogleGenAI({ vertexai: true, apiKey: cleanKey });
  }
  return new GoogleGenAI({ apiKey: cleanKey });
};

// ═══════════ PROVIDER & KEY MANAGEMENT ═══════════

export const ENV_API_KEYS: string[] = ENV_BACKUP_KEY_LIST;

export const getProvider = (): AiProvider => {
  runStorageMigrationOnce();
  if (!hasLocalStorage()) return 'gemini';
  const stored = localStorage.getItem(PROVIDER_STORAGE_KEY);
  if (stored === 'agent-platform') return 'agent-platform';
  return 'gemini';
};

export const saveProvider = (provider: AiProvider): void => {
  if (!hasLocalStorage()) return;
  localStorage.setItem(PROVIDER_STORAGE_KEY, provider);
  localStorage.setItem(PROVIDER_SOURCE_KEY, 'manual');
};

export const getApiKey = (): string => {
  return apiKeyManager.getActiveKey(getSelectedModel('gemini')) || apiKeyManager.getAllKeys()[0]?.key || '';
};

export const saveApiKey = (key: string): void => {
  const normalized = normalizeGoogleAiApiKey(key);
  if (!normalized) {
    apiKeyManager.clearAllUserKeys();
    return;
  }
  apiKeyManager.addKey(normalized);
  apiKeyManager.setActiveKey(normalized);
};

export const getAgentPlatformApiKey = (): string => {
  runStorageMigrationOnce();
  if (!hasLocalStorage()) return '';
  const raw =
    localStorage.getItem(AGENT_PLATFORM_STORAGE_KEY) ||
    localStorage.getItem(LEGACY_AGENT_PLATFORM_STORAGE_KEY) ||
    '';
  return normalizeGoogleAiApiKey(raw);
};

export const saveAgentPlatformApiKey = (key: string): void => {
  if (!hasLocalStorage()) return;
  const normalized = normalizeGoogleAiApiKey(key);
  if (normalized) {
    localStorage.setItem(AGENT_PLATFORM_STORAGE_KEY, normalized);
    localStorage.setItem(LEGACY_AGENT_PLATFORM_STORAGE_KEY, normalized);
  } else {
    localStorage.removeItem(AGENT_PLATFORM_STORAGE_KEY);
    localStorage.removeItem(LEGACY_AGENT_PLATFORM_STORAGE_KEY);
  }
};

export const getSelectedModel = (providerOverride?: AiProvider): string => {
  runStorageMigrationOnce();
  const provider = providerOverride || getProvider();
  const raw = hasLocalStorage() ? localStorage.getItem(GEMINI_MODEL_STORAGE_KEY) : null;
  const normalized = raw ? MODEL_ALIASES[raw.trim()] || raw.trim() : null;

  if (provider === 'agent-platform') {
    const valid = normalized && AGENT_PLATFORM_UI_MODELS.some(m => m.id === normalized);
    return valid ? normalized : DEFAULT_AGENT_PLATFORM_MODEL;
  }

  const valid = normalized && GEMINI_UI_MODELS.some(m => m.id === normalized);
  return valid ? normalized : DEFAULT_GEMINI_MODEL;
};

export const saveSelectedModel = (model: string): void => {
  runStorageMigrationOnce();
  if (!hasLocalStorage()) return;
  const clean = (model || '').trim();
  const normalized = MODEL_ALIASES[clean] || clean || DEFAULT_GEMINI_MODEL;
  localStorage.setItem(GEMINI_MODEL_STORAGE_KEY, normalized);
};

export const getActiveApiKeyForProvider = (): string => {
  const provider = getProvider();
  if (provider === 'agent-platform') {
    return getAgentPlatformApiKey();
  }
  return getApiKey();
};

export const hasAnyKey = (providerOverride?: AiProvider): boolean => {
  const provider = providerOverride || getProvider();
  if (provider === 'agent-platform') {
    return getAgentPlatformApiKey().length > 0;
  }
  return apiKeyManager.getAllKeys().length > 0 || serverProxyStatus.available;
};

export const clearApiKey = (): void => {
  apiKeyManager.clearAllUserKeys();
};

export const markKeyExhausted = (key: string, model?: string): void => {
  if (model) {
    apiKeyManager.markKeyModelQuotaError(key, model, 'QUOTA_EXCEEDED');
  } else {
    apiKeyManager.markKeyError(key, 'QUOTA_EXCEEDED');
  }
};

export const getCurrentActiveKey = (): string => {
  return getApiKey();
};

export const getNextApiKey = (model?: string): string => {
  const res = apiKeyManager.rotateToNextKey('quota', model);
  return res.success && res.newKey ? res.newKey : '';
};

export const resetKeyRotation = (): void => {
  apiKeyManager.resetAllKeys();
};

// ═══════════ FALLBACK MODEL ORDER ═══════════

export const getOrderedModels = (selectedModel?: string, providerOverride?: AiProvider): string[] => {
  const provider = providerOverride || getProvider();
  const validModels = provider === 'agent-platform' ? AGENT_PLATFORM_UI_MODELS : GEMINI_UI_MODELS;
  const fallbackChain: readonly string[] =
    provider === 'agent-platform' ? AGENT_PLATFORM_FALLBACK_MODELS : GEMINI_FALLBACK_MODELS;

  const rawSelected = selectedModel ? MODEL_ALIASES[selectedModel.trim()] || selectedModel.trim() : getSelectedModel(provider);
  const primary = validModels.some(m => m.id === rawSelected)
    ? rawSelected
    : DEFAULT_MODEL_BY_PROVIDER[provider];

  return Array.from(new Set([primary, ...fallbackChain]));
};

// ═══════════ REQUEST TRACKING ═══════════

const REQUEST_COUNT_KEY = 'skkn-daily-request-count';
const REQUEST_DATE_KEY = 'skkn-daily-request-date';

const getTodayStr = (): string => new Date().toISOString().split('T')[0];

export const getDailyRequestCount = (): number => {
  if (!hasLocalStorage()) return 0;
  const savedDate = localStorage.getItem(REQUEST_DATE_KEY);
  if (savedDate !== getTodayStr()) {
    localStorage.setItem(REQUEST_DATE_KEY, getTodayStr());
    localStorage.setItem(REQUEST_COUNT_KEY, '0');
    return 0;
  }
  return parseInt(localStorage.getItem(REQUEST_COUNT_KEY) || '0', 10);
};

export const incrementDailyRequestCount = (): number => {
  if (!hasLocalStorage()) return 0;
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

// ═══════════ ERROR CLASSIFICATION (api.md §II) ═══════════

const getErrorText = (error: any): string => {
  const message = error?.message || error?.toString?.() || '';
  let serialized = '';
  try {
    serialized = JSON.stringify(error) || '';
  } catch {
    serialized = '';
  }
  return `${message} ${serialized}`.toLowerCase();
};

const getNumericStatus = (error: any): number | null => {
  const candidates = [error?.status, error?.code, error?.response?.status];
  for (const c of candidates) {
    const num = Number(c);
    if (Number.isInteger(num) && num >= 100 && num <= 599) return num;
  }
  return null;
};

const extractRetryDelaySeconds = (text: string): number | undefined => {
  const retryDelayJson = text.match(/retrydelay["']?\s*[:=]\s*["']?(\d+(?:\.\d+)?)s/i);
  if (retryDelayJson) return Math.ceil(parseFloat(retryDelayJson[1]));
  const retryIn = text.match(/retry in\s+(\d+(?:\.\d+)?)\s*s/i);
  if (retryIn) return Math.ceil(parseFloat(retryIn[1]));
  return undefined;
};

export const classifyApiError = (error: any): ClassifiedApiError => {
  if (!error || error instanceof SyntaxError) {
    return { type: 'UNKNOWN', isPerMinute: false, isThinkingConfigError: false };
  }
  const status = getNumericStatus(error);
  const text = getErrorText(error);
  const hasCode = (code: number) =>
    status === code || new RegExp(`(?:"code"|"status"|http|error)\\s*[:=]?\\s*${code}(?![0-9])`).test(text);
  const retryDelaySec = extractRetryDelaySeconds(text);

  // 1. Kiểm tra API_KEY_INVALID TRƯỚC 400 (Google trả key sai dưới dạng 400 INVALID_ARGUMENT + API_KEY_INVALID)
  if (
    status === 401 ||
    text.includes('api_key_invalid') ||
    text.includes('api key not valid') ||
    text.includes('api_key_expired') ||
    text.includes('invalid api key') ||
    text.includes('unauthenticated')
  ) {
    return { type: 'INVALID_API_KEY', isPerMinute: false, isThinkingConfigError: false };
  }

  // 2. Quota / Rate limit (429)
  if (
    hasCode(429) ||
    text.includes('resource_exhausted') ||
    text.includes('resource exhausted') ||
    text.includes('quota') ||
    text.includes('rate limit') ||
    text.includes('too many requests')
  ) {
    const isDaily =
      text.includes('per day') ||
      text.includes('daily') ||
      text.includes('rpd') ||
      text.includes('limit: 0') ||
      text.includes('free_tier_requests');
    const isPerMinute =
      !isDaily &&
      (text.includes('per minute') ||
        text.includes('rpm') ||
        text.includes('rate limit') ||
        text.includes('too many requests') ||
        (retryDelaySec !== undefined && retryDelaySec <= 90));
    return {
      type: isPerMinute ? 'RATE_LIMIT' : 'QUOTA_EXCEEDED',
      isPerMinute,
      retryDelaySec,
      isThinkingConfigError: false,
    };
  }

  // 3. Model Overloaded (503)
  if (
    hasCode(503) ||
    text.includes('service unavailable') ||
    text.includes('"status":"unavailable"') ||
    text.includes('high demand') ||
    text.includes('overloaded') ||
    text.includes('try again later') ||
    text.includes('temporarily unavailable')
  ) {
    return { type: 'MODEL_OVERLOADED', isPerMinute: false, isThinkingConfigError: false };
  }

  // 4. Model Not Found (404)
  if (
    hasCode(404) ||
    text.includes('not_found') ||
    text.includes('is not found for api version') ||
    text.includes('not supported for generatecontent')
  ) {
    return { type: 'MODEL_NOT_FOUND', isPerMinute: false, isThinkingConfigError: false };
  }

  // 5. Transient Server / Network Error (500, 502, 504, fetch failed)
  if (
    hasCode(500) ||
    hasCode(502) ||
    hasCode(504) ||
    text.includes('deadline_exceeded') ||
    text.includes('deadline exceeded') ||
    text.includes('bad gateway') ||
    text.includes('fetch failed') ||
    text.includes('failed to fetch') ||
    text.includes('networkerror') ||
    text.includes('econnreset') ||
    text.includes('etimedout') ||
    text.includes('"status":"internal"')
  ) {
    return { type: 'TRANSIENT_SERVER_ERROR', isPerMinute: false, isThinkingConfigError: false };
  }

  // 6. Permission Denied (403)
  if (hasCode(403) || text.includes('permission_denied') || text.includes('permission denied')) {
    return { type: 'PERMISSION_DENIED', isPerMinute: false, isThinkingConfigError: false };
  }

  // 7. Invalid Argument (400)
  if (hasCode(400) || text.includes('invalid_argument') || text.includes('invalid argument')) {
    const isThinkingConfigError =
      text.includes('thinking') || text.includes('thinkinglevel') || text.includes('thinking_config');
    return { type: 'INVALID_ARGUMENT', isPerMinute: false, isThinkingConfigError };
  }

  return { type: 'UNKNOWN', isPerMinute: false, isThinkingConfigError: false };
};

export const parseApiError = (error: any): GeminiApiErrorType => classifyApiError(error).type;

export const isInternalError = (error: any): boolean => {
  const status = getNumericStatus(error);
  const text = getErrorText(error);
  return status === 500 || text.includes('"status":"internal"');
};

export const isDeadlineExceededError = (error: any): boolean => {
  const status = getNumericStatus(error);
  const text = getErrorText(error);
  return status === 504 || text.includes('deadline_exceeded') || text.includes('deadline exceeded');
};

export const isModelOverloadedError = (error: any): boolean => {
  const t = parseApiError(error);
  return t === 'MODEL_OVERLOADED' || t === 'TRANSIENT_SERVER_ERROR';
};

export const isModelNotFoundError = (error: any): boolean => parseApiError(error) === 'MODEL_NOT_FOUND';

export const isQuotaOrRateLimitError = (error: any): boolean => {
  const t = parseApiError(error);
  return t === 'QUOTA_EXCEEDED' || t === 'RATE_LIMIT';
};

export const isInvalidKeyError = (error: any): boolean => parseApiError(error) === 'INVALID_API_KEY';

export const isPermissionDeniedError = (error: any): boolean => parseApiError(error) === 'PERMISSION_DENIED';

export const isInvalidArgumentError = (error: any): boolean => parseApiError(error) === 'INVALID_ARGUMENT';

export const canFallbackToNextModel = (error: any, providerOverride?: AiProvider): boolean => {
  const classified = classifyApiError(error);
  if (
    classified.type === 'MODEL_OVERLOADED' ||
    classified.type === 'TRANSIENT_SERVER_ERROR' ||
    classified.type === 'MODEL_NOT_FOUND' ||
    classified.type === 'QUOTA_EXCEEDED' ||
    classified.type === 'RATE_LIMIT' ||
    classified.isThinkingConfigError
  ) {
    return true;
  }
  const provider = providerOverride || getProvider();
  if (classified.type === 'PERMISSION_DENIED' && provider === 'agent-platform') return true;
  return false;
};

export const shouldRotateApiKey = (error: any, providerOverride?: AiProvider): boolean => {
  const provider = providerOverride || getProvider();
  if (provider === 'agent-platform') return false;
  const type = parseApiError(error);
  return (
    type === 'QUOTA_EXCEEDED' ||
    type === 'RATE_LIMIT' ||
    type === 'INVALID_API_KEY' ||
    type === 'PERMISSION_DENIED'
  );
};

// ═══════════ SINGLE-KEY TESTER (KHÔNG xoay key, KHÔNG dùng proxy) ═══════════

export const testApiKey = async (
  rawApiKey: string,
  provider: AiProvider = 'gemini',
  preferredModel?: string
): Promise<ApiKeyTestResult> => {
  const cleanKey = normalizeGoogleAiApiKey(rawApiKey);
  if (!isValidGoogleAiApiKey(cleanKey)) {
    return {
      ok: false,
      title: 'Sai định dạng key',
      message: 'API Key phải bắt đầu bằng "AIza..." hoặc "AQ...", không chứa khoảng trắng.',
      errorType: 'INVALID_API_KEY',
    };
  }

  const model = preferredModel || DEFAULT_MODEL_BY_PROVIDER[provider];

  try {
    const ai = createGoogleAiClient(cleanKey, provider);
    const response = await ai.models.generateContent({
      model,
      contents: 'Trả lời đúng 1 từ: OK',
      config: createGeminiConfig({
        provider,
        model,
        thinkingLevel: ThinkingLevel.LOW,
        maxOutputTokens: 32,
      }),
    });
    return {
      ok: true,
      title: 'Kết nối thành công',
      message: response?.text ? `Key hoạt động tốt với ${model}.` : `Google AI đã phản hồi hợp lệ (${model}).`,
      model,
    };
  } catch (err: any) {
    const classified = classifyApiError(err);
    if (classified.type === 'INVALID_API_KEY') {
      return {
        ok: false,
        title: 'Key không hợp lệ',
        message: 'Google từ chối API Key này (401/API_KEY_INVALID). Hãy kiểm tra lại hoặc tạo key mới.',
        errorType: classified.type,
      };
    }
    if (classified.type === 'QUOTA_EXCEEDED' || classified.type === 'RATE_LIMIT') {
      return {
        ok: false,
        title: classified.type === 'RATE_LIMIT' ? 'Vượt tốc độ (RPM)' : 'Hết quota (429)',
        message: `Key hợp lệ nhưng đang chạm hạn mức trên ${model}.`,
        errorType: classified.type,
      };
    }
    if (classified.type === 'PERMISSION_DENIED') {
      return {
        ok: false,
        title: 'Thiếu quyền truy cập (403)',
        message:
          provider === 'agent-platform'
            ? 'Key chưa có quyền gọi Agent Platform API hoặc model này.'
            : 'Key không có quyền truy cập Gemini API.',
        errorType: classified.type,
      };
    }
    if (classified.type === 'MODEL_OVERLOADED') {
      return {
        ok: false,
        title: 'Model đang quá tải (503)',
        message: `Key hợp lệ nhưng ${model} đang quá tải tạm thời.`,
        errorType: classified.type,
      };
    }
    return {
      ok: false,
      title: 'Kiểm tra thất bại',
      message: err?.message || 'Không kết nối được tới Google AI.',
      errorType: classified.type,
    };
  }
};

// ═══════════ VIETNAMESE ERROR MESSAGES ═══════════

export const getVietnameseErrorMessage = (error: any): string => {
  const classified = classifyApiError(error);

  if (classified.type === 'MODEL_OVERLOADED' || classified.type === 'TRANSIENT_SERVER_ERROR' || classified.type === 'MODEL_NOT_FOUND') {
    return (
      '⚠️ Hệ thống AI đang tạm thời quá tải ở tất cả các model dự phòng.\n\n' +
      '📝 Hướng dẫn:\n' +
      '1. API Key của bạn vẫn còn hiệu lực, không cần xóa key\n' +
      '2. Vui lòng đợi 1 phút rồi bấm "Thử lại" hoặc chọn model nhẹ hơn (Gemini 3.5 Flash-Lite)'
    );
  }

  if (classified.type === 'QUOTA_EXCEEDED' || classified.type === 'RATE_LIMIT') {
    const stats = apiKeyManager.getKeyStats();
    const soonestMs = apiKeyManager.getSoonestCooldownMs();
    const waitHint =
      soonestMs && soonestMs > 0 && soonestMs <= 120_000
        ? `\n⏱️ Dự kiến mở lại sau khoảng ${Math.ceil(soonestMs / 1000)} giây.`
        : '';
    return (
      `⚠️ Tất cả ${stats.total || 1} API key và 6 model miễn phí đều đang tạm hết hạn mức (429).${waitHint}\n\n` +
      '📝 Giải pháp nhanh:\n' +
      '1. Bấm "Đổi API Key" và dán thêm 2–5 API key miễn phí (từ các tài khoản Gmail khác nhau) vào Kho Xoay Vòng\n' +
      '2. Mỗi key miễn phí mở thêm 6 nguồn quota độc lập, tự động chuyển không bị gián đoạn\n' +
      '3. Lấy key miễn phí tại: aistudio.google.com/apikey'
    );
  }

  if (classified.type === 'PERMISSION_DENIED') {
    const provider = getProvider();
    if (provider === 'agent-platform') {
      return (
        '⚠️ API key không có quyền truy cập Agent Platform API hoặc model này.\n\n' +
        '📝 Hướng dẫn:\n' +
        '1. Kiểm tra Agent Platform API đã bật trong dự án Google Cloud\n' +
        '2. Kiểm tra billing, API restrictions và quyền sử dụng model\n' +
        '3. Thử chọn model khác (VD: Gemini 3 Flash Preview hoặc Gemini 2.5 Flash)'
      );
    }
    return (
      '⚠️ API key không có quyền truy cập Gemini API.\n\n' +
      '📝 Hướng dẫn:\n' +
      '1. Kiểm tra lại API Key trong Cài đặt\n' +
      '2. Lấy key mới tại: aistudio.google.com/apikey'
    );
  }

  if (classified.type === 'INVALID_API_KEY') {
    return (
      '❌ API Key không hợp lệ hoặc đã hết hạn.\n\n' +
      '📝 Hướng dẫn:\n' +
      '1. Kiểm tra lại API Key (bắt đầu bằng "AIzaSy..." hoặc "AQ...")\n' +
      '2. Bấm "Đổi API Key" để kiểm tra hoặc dán key mới từ aistudio.google.com/apikey'
    );
  }

  if (classified.type === 'INVALID_ARGUMENT') {
    return (
      '❌ Tham số yêu cầu không hợp lệ.\n\n' +
      '📝 Hướng dẫn:\n' +
      '1. Thử chọn model khác trong Cài đặt (mặc định khuyên dùng Gemini 4 Hydrogen)\n' +
      '2. Nếu nội dung quá dài, hãy rút gọn bớt phần phụ lục rồi thử lại'
    );
  }

  return error?.message || 'Đã xảy ra lỗi không xác định. Vui lòng thử lại sau.';
};
