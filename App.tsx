import React, { useState, useRef, useEffect, useCallback } from 'react';
import InputForm from './components/InputForm';
import ResultsDashboard from './components/ResultsDashboard';
import HistoryPanel from './components/HistoryPanel';
import ComparePanel from './components/ComparePanel';
import ApiKeyModal, { ApiKeySettingsButton } from './components/ApiKeyModal';
import LoginPage from './components/LoginPage';
import { SKKNInput, AnalysisResult, AnalysisStatus } from './types';
import { analyzeSKKNWithGemini } from './services/geminiService';
import { saveToHistory, HistoryItem } from './services/historyService';
import { getLoggedInUser, logout, VIPAccount, isTrialAccount, saveLoginState } from './data/accounts';
import { useTheme } from './contexts/ThemeContext';
import { ShieldCheck, BookOpen, History, Sun, Moon, GitCompare, LogOut, Save, FolderOpen } from 'lucide-react';
import { hasAnyKey, getSelectedModel, getDailyRequestCount } from './services/apiKeyService';

// Session persistence keys
const SESSION_SAVE_KEY = 'skkn_checker_session';
interface CheckerSessionData {
  input: SKKNInput;
  result: AnalysisResult | null;
  status: AnalysisStatus;
  savedAt: string;
}

const App: React.FC = () => {
  const { isDark, toggleTheme } = useTheme();
  const [status, setStatus] = useState<AnalysisStatus>(AnalysisStatus.IDLE);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [showCompare, setShowCompare] = useState(false);
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [hasApiKey, setHasApiKey] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loggedInUser, setLoggedInUser] = useState<{ username: string; displayName: string } | null>(null);
  const [isTrial, setIsTrial] = useState(false);
  const [showTrialExpiredModal, setShowTrialExpiredModal] = useState(false);
  const [progress, setProgress] = useState(0);
  const currentInputRef = useRef<SKKNInput | null>(null);

  // Kiểm tra đăng nhập và API key khi load
  useEffect(() => {
    // Kiểm tra đăng nhập
    const user = getLoggedInUser();
    if (user) {
      setIsLoggedIn(true);
      setLoggedInUser(user);
      setIsTrial(isTrialAccount(user.username));
    }

    // Kiểm tra có API key nào không (hỗ trợ nhiều key)
    const hasKey = hasAnyKey();
    setHasApiKey(hasKey);
    if (!hasKey && user) {
      setShowApiKeyModal(true);
    }
  }, []);

  const handleLoginSuccess = (account: VIPAccount) => {
    setIsLoggedIn(true);
    setIsTrial(!!account.isTrial);
    setLoggedInUser({
      username: account.username,
      displayName: account.displayName || account.username
    });
  };

  const handleLogout = () => {
    logout();
    setIsLoggedIn(false);
    setLoggedInUser(null);
    setIsTrial(false);
  };

  // Khi trial user đăng nhập VIP thành công từ popup inline
  const handleUpgradeFromTrial = () => {
    const user = getLoggedInUser();
    if (user) {
      setLoggedInUser(user);
      setIsTrial(false);
    }
  };

  // ═══════════ SESSION PERSISTENCE ═══════════
  const [sessionSavedAt, setSessionSavedAt] = useState<string | null>(null);
  const [showRestoreModal, setShowRestoreModal] = useState(false);
  const [pendingSession, setPendingSession] = useState<CheckerSessionData | null>(null);

  // Kiểm tra phiên đã lưu khi mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(SESSION_SAVE_KEY);
      if (saved) {
        const session: CheckerSessionData = JSON.parse(saved);
        if (session.status === AnalysisStatus.SUCCESS && session.result) {
          setPendingSession(session);
          setShowRestoreModal(true);
        }
      }
    } catch (e) {
      console.warn('Không thể đọc phiên đã lưu:', e);
      localStorage.removeItem(SESSION_SAVE_KEY);
    }
  }, []);

  // Auto-save khi có kết quả
  const saveSession = useCallback(() => {
    if (status !== AnalysisStatus.SUCCESS || !result) return;
    try {
      const sessionData: CheckerSessionData = {
        input: currentInputRef.current || { title: '', level: '', subject: '', target: '', content: '' },
        result,
        status,
        savedAt: new Date().toISOString(),
      };
      localStorage.setItem(SESSION_SAVE_KEY, JSON.stringify(sessionData));
      setSessionSavedAt(new Date().toLocaleTimeString('vi-VN'));
    } catch (e) {
      console.warn('Không thể lưu phiên:', e);
    }
  }, [status, result]);

  // Auto-save debounce
  useEffect(() => {
    if (status !== AnalysisStatus.SUCCESS || !result) return;
    const timer = setTimeout(() => saveSession(), 3000);
    return () => clearTimeout(timer);
  }, [status, result, saveSession]);

  const restoreSession = () => {
    if (!pendingSession) return;
    if (pendingSession.result) setResult(pendingSession.result);
    if (pendingSession.input) currentInputRef.current = pendingSession.input;
    setStatus(pendingSession.status);
    setShowRestoreModal(false);
    setPendingSession(null);
  };

  const clearSavedSession = () => {
    localStorage.removeItem(SESSION_SAVE_KEY);
    setSessionSavedAt(null);
    setShowRestoreModal(false);
    setPendingSession(null);
  };

  const handleApiKeySave = (_apiKey: string, _model: string, _provider?: string) => {
    // Refresh trạng thái key sau khi save
    setHasApiKey(hasAnyKey());
  };

  const handleSubmit = async (data: SKKNInput) => {
    setStatus(AnalysisStatus.LOADING);
    setErrorMsg(null);
    setProgress(0);
    currentInputRef.current = data;

    // Simulate progress bar since AI generation takes time
    const progressInterval = setInterval(() => {
      setProgress((prev) => {
        if (prev < 40) return prev + Math.floor(Math.random() * 5) + 3; // 0-40%: fast
        if (prev < 70) return prev + Math.floor(Math.random() * 3) + 2; // 40-70%: medium 
        if (prev < 90) return prev + 1; // 70-90%: slow
        if (prev < 98) return prev + 0.5; // 90-98%: very slow
        return prev;
      });
    }, 1000);

    try {
      const analysis = await analyzeSKKNWithGemini(data);
      clearInterval(progressInterval);
      setProgress(100);

      // Small delay so user can see 100%
      setTimeout(() => {
        setResult(analysis);
        setStatus(AnalysisStatus.SUCCESS);
        // Tự động lưu vào lịch sử
        saveToHistory(data, analysis);
      }, 500);
    } catch (error: any) {
      clearInterval(progressInterval);
      console.error(error);
      setStatus(AnalysisStatus.ERROR);
      setErrorMsg(error.message || "Đã xảy ra lỗi trong quá trình phân tích. Vui lòng kiểm tra API Key hoặc thử lại sau.");
    }
  };

  const handleReset = () => {
    setStatus(AnalysisStatus.IDLE);
    setResult(null);
    setErrorMsg(null);
    setProgress(0);
    currentInputRef.current = null;
  };

  const handleViewHistoryResult = (item: HistoryItem) => {
    setResult(item.result);
    currentInputRef.current = item.input;
    setStatus(AnalysisStatus.SUCCESS);
    setShowHistory(false);
  };

  // Hiển thị LoginPage nếu chưa đăng nhập
  if (!isLoggedIn) {
    return <LoginPage onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className={`min-h-screen flex flex-col font-sans transition-colors duration-300 ${isDark ? 'bg-gray-900 text-gray-100' : 'bg-gray-50 text-gray-800'}`}>
      {/* History Panel Modal */}
      {showHistory && (
        <HistoryPanel
          onViewResult={handleViewHistoryResult}
          onClose={() => setShowHistory(false)}
        />
      )}

      {/* Compare Panel Modal */}
      {showCompare && (
        <ComparePanel onClose={() => setShowCompare(false)} />
      )}

      {/* API Key Modal */}
      <ApiKeyModal
        isOpen={showApiKeyModal}
        onClose={() => setShowApiKeyModal(false)}
        onSave={handleApiKeySave}
        isRequired={!hasApiKey}
      />

      {/* Guide Modal */}
      {showGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setShowGuide(false)}>
          <div
            className={`relative w-full max-w-3xl max-h-[85vh] overflow-y-auto rounded-2xl shadow-2xl ${isDark ? 'bg-gray-800' : 'bg-white'}`}
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-indigo-600 p-6 rounded-t-2xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                    <BookOpen size={24} className="text-white" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-white">Hướng dẫn sử dụng</h2>
                    <p className="text-blue-100 text-sm">Trợ Lý SKKN v1.4</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowGuide(false)}
                  className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Content */}
            <div className={`p-6 space-y-6 ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>
              {/* Bước 1 */}
              <div className={`p-4 rounded-xl ${isDark ? 'bg-gray-700' : 'bg-blue-50'}`}>
                <h3 className={`font-bold text-lg mb-2 flex items-center gap-2 ${isDark ? 'text-blue-300' : 'text-blue-700'}`}>
                  <span className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm">1</span>
                  Nhập thông tin SKKN
                </h3>
                <ul className="space-y-1 ml-10 list-disc">
                  <li>Điền <b>Tên đề tài</b> và chọn <b>Lĩnh vực</b></li>
                  <li>Nhập nội dung SKKN hoặc <b>tải file Word/PDF</b></li>
                  <li>Sau đó bấm <b>"Phân tích SKKN"</b></li>
                </ul>
              </div>

              {/* Bước 2 */}
              <div className={`p-4 rounded-xl ${isDark ? 'bg-gray-700' : 'bg-green-50'}`}>
                <h3 className={`font-bold text-lg mb-2 flex items-center gap-2 ${isDark ? 'text-green-300' : 'text-green-700'}`}>
                  <span className="w-8 h-8 bg-green-600 text-white rounded-full flex items-center justify-center text-sm">2</span>
                  Đọc kết quả phân tích
                </h3>
                <div className="ml-10 space-y-3">
                  <div>
                    <p className="font-semibold">📊 Điểm số tổng quan (100 điểm):</p>
                    <ul className="list-disc ml-5">
                      <li><b>Tính mới (30đ):</b> Sáng tạo, độc đáo của giải pháp</li>
                      <li><b>Khả thi (40đ):</b> Khả năng áp dụng thực tế</li>
                      <li><b>Khoa học (20đ):</b> Cơ sở lý luận, số liệu minh chứng</li>
                      <li><b>Hình thức (10đ):</b> Trình bày, chính tả, ngữ pháp</li>
                    </ul>
                  </div>
                  <div>
                    <p className="font-semibold">⚠️ Nguy cơ đạo văn:</p>
                    <ul className="list-disc ml-5">
                      <li><span className="text-green-600 font-semibold">Thấp:</span> Nội dung sáng tạo, ít trùng lặp</li>
                      <li><span className="text-yellow-600 font-semibold">Trung bình:</span> Có một số đoạn cần viết lại</li>
                      <li><span className="text-red-600 font-semibold">Cao/Rất cao:</span> Cần viết lại nhiều đoạn</li>
                    </ul>
                  </div>
                  <div>
                    <p className="font-semibold">📝 Các mục phân tích:</p>
                    <ul className="list-disc ml-5">
                      <li><b>Lỗi chính tả:</b> Danh sách lỗi cần sửa</li>
                      <li><b>Đoạn nghi đạo văn:</b> Các đoạn giống nguồn khác</li>
                      <li><b>Kế hoạch phát triển:</b> Gợi ý cải thiện SKKN</li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Bước 3 */}
              <div className={`p-4 rounded-xl ${isDark ? 'bg-gray-700' : 'bg-purple-50'}`}>
                <h3 className={`font-bold text-lg mb-2 flex items-center gap-2 ${isDark ? 'text-purple-300' : 'text-purple-700'}`}>
                  <span className="w-8 h-8 bg-purple-600 text-white rounded-full flex items-center justify-center text-sm">3</span>
                  Tự động sửa SKKN
                </h3>
                <ul className="space-y-1 ml-10 list-disc">
                  <li>Bấm <b>"Tự động Sửa SKKN"</b> để AI tự sửa lỗi</li>
                  <li>Xem preview với <b>chữ đỏ = đã sửa</b></li>
                  <li><b>"Xuất Word (Giữ gốc)"</b>: Giữ nguyên format, hình ảnh, công thức</li>
                  <li><b>"Sao chép"</b>: Copy HTML để dán vào Word</li>
                </ul>
              </div>

              {/* Tips */}
              <div className={`p-4 rounded-xl border-2 border-dashed ${isDark ? 'border-yellow-600 bg-yellow-900/20' : 'border-yellow-400 bg-yellow-50'}`}>
                <h3 className={`font-bold text-lg mb-2 ${isDark ? 'text-yellow-300' : 'text-yellow-700'}`}>💡 Mẹo sử dụng</h3>
                <ul className="space-y-1 ml-4 list-disc">
                  <li>Sử dụng <b>"Lịch sử"</b> để xem lại các SKKN đã phân tích</li>
                  <li>Dùng <b>"So sánh"</b> để đối chiếu 2 phiên bản SKKN</li>
                  <li>Khi xuất Word, chọn <b>"Giữ gốc"</b> để bảo toàn hình ảnh, công thức</li>
                  <li>Nếu paste vào Word không có màu, dùng <b>Ctrl+Shift+V</b> hoặc Paste Special</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Session Restore Modal */}
      {showRestoreModal && pendingSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className={`rounded-2xl shadow-2xl max-w-md w-full overflow-hidden ${isDark ? 'bg-gray-800' : 'bg-white'}`}>
            <div className="bg-gradient-to-r from-emerald-600 to-teal-600 p-6 text-center">
              <div className="w-14 h-14 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-3">
                <span className="text-3xl">💾</span>
              </div>
              <h3 className="text-xl font-bold text-white">Khôi phục phiên làm việc?</h3>
              <p className="text-emerald-100 text-sm mt-1">
                Đã lưu lúc {new Date(pendingSession.savedAt).toLocaleString('vi-VN')}
              </p>
            </div>
            <div className={`p-6 space-y-4 ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>
              <p className="text-center text-sm">
                Phát hiện phiên phân tích SKKN trước đó. Bạn muốn tiếp tục hay bắt đầu mới?
              </p>
              <div className="flex gap-3">
                <button
                  onClick={restoreSession}
                  className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2"
                >
                  <FolderOpen size={18} /> Khôi phục
                </button>
                <button
                  onClick={clearSavedSession}
                  className={`flex-1 py-3 font-medium rounded-xl transition-colors ${isDark ? 'bg-gray-700 hover:bg-gray-600 text-gray-200' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'}`}
                >
                  Bắt đầu mới
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <header className={`shadow-sm sticky top-0 z-40 transition-colors ${isDark ? 'bg-gray-800' : 'bg-white'}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 cursor-pointer" onClick={handleReset}>
            <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center text-white">
              <ShieldCheck size={24} />
            </div>
            <div>
              <h1 className={`text-xl font-bold tracking-tight leading-none ${isDark ? 'text-white' : 'text-gray-900'}`}>Trợ Lý SKKN</h1>
              <p className={`text-xs font-medium tracking-wide ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>TRỢ LÝ THẨM ĐỊNH SKKN</p>
            </div>
          </div>
          <div className={`flex items-center gap-2 text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
            <button
              onClick={toggleTheme}
              className={`p-2 rounded-lg transition-colors ${isDark ? 'hover:bg-gray-700' : 'hover:bg-gray-100'}`}
              title={isDark ? 'Chế độ sáng' : 'Chế độ tối'}
            >
              {isDark ? <Sun size={18} /> : <Moon size={18} />}
            </button>

            {/* Nút Lưu phiên */}
            {status === AnalysisStatus.SUCCESS && result && (
              <button
                onClick={saveSession}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg transition-colors ${isDark ? 'hover:bg-gray-700 text-emerald-400' : 'hover:bg-emerald-50 text-emerald-600'}`}
                title={sessionSavedAt ? `Đã lưu lúc ${sessionSavedAt}` : 'Lưu phiên làm việc'}
              >
                <Save size={18} />
                <span className="hidden sm:inline">
                  {sessionSavedAt ? `Đã lưu ${sessionSavedAt}` : 'Lưu phiên'}
                </span>
              </button>
            )}

            <button
              onClick={() => setShowHistory(true)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg transition-colors ${isDark ? 'hover:bg-gray-700' : 'hover:bg-gray-100'}`}
            >
              <History size={18} />
              <span className="hidden sm:inline">Lịch sử</span>
            </button>
            <button
              onClick={() => setShowCompare(true)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg transition-colors ${isDark ? 'hover:bg-gray-700' : 'hover:bg-gray-100'}`}
              title="So sánh phiên bản"
            >
              <GitCompare size={18} />
              <span className="hidden sm:inline">So sánh</span>
            </button>
            <button
              onClick={() => setShowGuide(true)}
              className={`hidden md:flex items-center gap-1 px-3 py-2 rounded-lg transition-colors ${isDark ? 'hover:bg-gray-700 hover:text-blue-400' : 'hover:bg-gray-100 hover:text-blue-600'}`}
            >
              <BookOpen size={16} /> Hướng dẫn
            </button>
            <ApiKeySettingsButton
              onClick={() => setShowApiKeyModal(true)}
              hasKey={hasApiKey}
            />
            <span className={`px-2 py-1 rounded-full text-xs ${isDark ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-500'}`} title="Số lần phân tích hôm nay">
              {getDailyRequestCount()} lượt
            </span>
            <span className={`px-3 py-1 rounded-full text-xs font-bold ${isDark ? 'bg-blue-900 text-blue-300' : 'bg-blue-50 text-blue-700'}`}>v1.4</span>

            {/* Nút Đăng xuất */}
            <button
              onClick={handleLogout}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg transition-colors text-red-500 ${isDark ? 'hover:bg-red-900/30' : 'hover:bg-red-50'}`}
              title="Đăng xuất"
            >
              <LogOut size={18} />
              <span className="hidden sm:inline">Đăng xuất</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-grow p-4 md:p-8">
        {status === AnalysisStatus.IDLE && (
          <div className="flex flex-col items-center justify-center space-y-8 py-10">
            <div className="text-center max-w-3xl mx-auto mb-8">
              {/* Title with gradient */}
              <h1 className="text-5xl md:text-6xl font-black mb-4 tracking-tight">
                <span className="bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent animate-pulse">
                  TRỢ
                </span>
                {' '}
                <span className="bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 bg-clip-text text-transparent">
                  LÝ
                </span>
                {' '}
                <span className="bg-gradient-to-r from-orange-500 via-red-500 to-rose-500 bg-clip-text text-transparent">
                  SKKN
                </span>
              </h1>

              {/* Subtitle */}
              <h2 className="text-2xl md:text-3xl font-bold mb-4">
                <span className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
                  NÂNG TẦM SÁNG KIẾN KINH NGHIỆM CỦA BẠN
                </span>
              </h2>

              {/* Description */}
              <p className="text-lg md:text-xl text-gray-600 dark:text-gray-300 mb-4 leading-relaxed">
                Công cụ <span className="font-bold text-blue-600">AI</span> hỗ trợ
                <span className="font-semibold text-red-500"> kiểm tra đạo văn</span>,
                <span className="font-semibold text-green-600"> soát lỗi chính tả</span> và
                <span className="font-semibold text-purple-600"> tư vấn chiến lược</span>.
              </p>

              {/* Author */}
              <p className="text-sm md:text-base">
                <span className="text-gray-500">Phát triển bởi thầy </span>
                <span className="font-bold bg-gradient-to-r from-blue-600 to-cyan-500 bg-clip-text text-transparent">
                  Trần Hoài Thanh
                </span>
              </p>

              {/* Browser recommendation */}
              <p className="text-xs md:text-sm font-semibold text-orange-600 dark:text-orange-400 mt-3">
                KHUYẾN NGHỊ SỬ DỤNG TRÌNH DUYỆT MICROSOFT EDGE ĐỂ TRÁNH CÁC THÔNG BÁO SAI VỀ BẢO MẬT
              </p>

              {/* Security notice */}
              <p className="text-xs md:text-sm font-medium text-emerald-700 dark:text-emerald-400 mt-1 leading-relaxed max-w-2xl">
                APP ĐẢM BẢO BẢO MẬT NỘI DUNG SKKN CỦA THẦY CÔ, CHỈ LƯU CỤC BỘ TRÊN MÁY THẦY CÔ, KHÔNG CÓ HỆ THỐNG LƯU TRỮ NÀO KHÁC, THẦY CÔ HOÀN TOÀN YÊN TÂM!
              </p>
            </div>
            <InputForm onSubmit={handleSubmit} isLoading={false} />
          </div>
        )}

        {status === AnalysisStatus.LOADING && (
          <div className="flex flex-col items-center justify-center min-h-[50vh]">
            <div className="relative w-24 h-24 mb-6">
              <div className="absolute top-0 left-0 w-full h-full border-4 border-blue-200 rounded-full"></div>
              <div className="absolute top-0 left-0 w-full h-full border-4 border-blue-600 rounded-full animate-spin border-t-transparent"></div>
              {/* Progress text inside the spinner */}
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="font-bold text-blue-700 text-lg">{Math.floor(progress)}%</span>
              </div>
            </div>
            <h3 className="text-2xl font-bold text-gray-800 animate-pulse">Đang thẩm định SKKN...</h3>
            <p className="text-gray-500 mt-2 max-w-md text-center">Hệ thống đang đối chiếu với cơ sở dữ liệu, kiểm tra lỗi ngữ pháp và tính toán điểm số sáng tạo.</p>

            {/* Progress Bar Container */}
            <div className="w-full max-w-md mt-8">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium text-blue-600">Tiến độ phân tích</span>
                <span className="text-sm font-bold text-blue-800">{Math.floor(progress)}%</span>
              </div>
              <div className="w-full bg-blue-100 rounded-full h-3 overflow-hidden shadow-inner">
                <div
                  className="bg-gradient-to-r from-blue-500 to-indigo-600 h-full rounded-full transition-all duration-700 ease-out relative"
                  style={{ width: `${progress}%` }}
                >
                  <div className="absolute inset-0 bg-white/20 animate-[shimmer_2s_infinite]"></div>
                </div>
              </div>
              <p className="text-xs text-center text-gray-400 mt-3 italic">
                {progress < 30 && "Đang đọc nội dung và phân tích cấu trúc..."}
                {progress >= 30 && progress < 60 && "Đang đối chiếu dữ liệu đạo văn..."}
                {progress >= 60 && progress < 90 && "Đang đánh giá tiêu chí khoa học & tính mới..."}
                {progress >= 90 && "Đang tổng hợp điểm số và hoàn thiện báo cáo..."}
              </p>
              <p className="text-xs text-center text-blue-400 mt-2">
                Model: <span className="font-semibold">{getSelectedModel()}</span>
                <span className="text-gray-400 ml-1">(tự động chuyển model dự phòng nếu lỗi)</span>
              </p>
            </div>
          </div>
        )}

        {status === AnalysisStatus.ERROR && (
          <div className="max-w-2xl mx-auto mt-10 p-8 bg-red-50 rounded-2xl border border-red-200">
            <div className="text-center mb-6">
              <div className="inline-flex p-4 bg-red-100 rounded-full text-red-600 mb-4">
                <ShieldCheck size={40} />
              </div>
              <h3 className="text-2xl font-bold text-red-800 mb-2">Rất tiếc, đã có lỗi xảy ra</h3>
            </div>

            {/* Hiển thị thông báo lỗi dạng pre để giữ format */}
            <div className="bg-white p-4 rounded-xl border border-red-200 mb-6">
              <pre className="text-red-700 whitespace-pre-wrap text-sm leading-relaxed font-sans">
                {errorMsg}
              </pre>
            </div>

            {/* Nút hành động */}
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={() => setShowApiKeyModal(true)}
                className="flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-medium"
              >
                🔑 Đổi API Key
              </button>
              <button
                onClick={() => {
                  setErrorMsg(null);
                  setStatus(AnalysisStatus.IDLE);
                }}
                className="flex items-center justify-center gap-2 px-6 py-3 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-colors font-medium"
              >
                🔄 Thử lại
              </button>
            </div>
          </div>
        )}

        {/* Trial Expired Modal */}
        {showTrialExpiredModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden">
              <div className="bg-gradient-to-r from-orange-500 to-red-500 p-6 text-center">
                <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-3">
                  <span className="text-3xl">⏰</span>
                </div>
                <h3 className="text-xl font-black text-white">Hết Lượt Dùng Thử</h3>
              </div>
              <div className="p-6 text-center">
                <p className="text-gray-700 text-base leading-relaxed mb-6">
                  Thầy cô hết lượt dùng thử, liên hệ{' '}
                  <span className="font-bold text-blue-600">zalo 0348296773</span>
                  {' '}hoặc{' '}
                  <span className="font-bold text-blue-600">facebook Trần Hoài Thanh</span>
                  {' '}để đăng ký sử dụng full tính năng và không giới hạn.
                </p>
                <div className="flex flex-col gap-3">
                  <a href="https://zalo.me/0348296773" target="_blank" rel="noreferrer"
                    className="w-full py-3 bg-blue-500 hover:bg-blue-600 text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2">
                    💬 Liên hệ Zalo 0348296773
                  </a>
                  <a href="https://www.facebook.com/tranhoaithanhvicko/" target="_blank" rel="noreferrer"
                    className="w-full py-3 bg-indigo-500 hover:bg-indigo-600 text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2">
                    👤 Facebook Trần Hoài Thanh
                  </a>
                  <button onClick={() => setShowTrialExpiredModal(false)}
                    className="w-full py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-xl transition-colors">
                    Đóng
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {status === AnalysisStatus.SUCCESS && result && (
          <ResultsDashboard result={result} input={currentInputRef.current || undefined} onReset={handleReset} isTrial={isTrial} onUpgradeSuccess={handleUpgradeFromTrial} />
        )}
      </main>

      {/* Footer Promotion */}
      <footer className="bg-slate-800 text-slate-300 py-8 px-4 mt-auto border-t border-slate-700 no-print">
        <div className="max-w-5xl mx-auto text-center">
          <div className="mb-6 p-6 bg-gradient-to-r from-blue-900/40 to-indigo-900/40 rounded-2xl border border-blue-500/20 backdrop-blur-sm">
            <p className="font-bold text-lg md:text-xl text-blue-200 mb-3 leading-relaxed">
              ĐĂNG KÝ KHOÁ HỌC THỰC CHIẾN VIẾT SKKN, TẠO APP DẠY HỌC, TẠO MÔ PHỎNG TRỰC QUAN <br className="hidden md:block" />
              <span className="text-yellow-400">CHỈ VỚI 1 CÂU LỆNH</span>
            </p>
            <a
              href="https://forms.gle/19fbZmmHW5rEtxxG7"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 px-8 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-full transition-all transform hover:-translate-y-1 shadow-lg shadow-blue-900/50"
            >
              ĐĂNG KÝ NGAY
            </a>
          </div>

          <div className="space-y-2 text-sm md:text-base">
            <p className="font-medium text-slate-400">Mọi thông tin vui lòng liên hệ:</p>
            <div className="flex flex-col md:flex-row items-center justify-center gap-2 md:gap-6">
              <a
                href="https://www.facebook.com/tranhoaithanhvicko/"
                target="_blank"
                rel="noreferrer"
                className="hover:text-blue-400 transition-colors duration-200 flex items-center gap-2"
              >
                <span className="font-bold">Facebook:</span> tranhoaithanhvicko
              </a>
              <div className="hidden md:block w-1.5 h-1.5 rounded-full bg-slate-600"></div>
              <span className="hover:text-emerald-400 transition-colors duration-200 cursor-default flex items-center gap-2">
                <span className="font-bold">Zalo:</span> 0348296773
              </span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default App;

