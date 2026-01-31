import React, { useState, useRef, useEffect } from 'react';
import InputForm from './components/InputForm';
import ResultsDashboard from './components/ResultsDashboard';
import HistoryPanel from './components/HistoryPanel';
import ComparePanel from './components/ComparePanel';
import ApiKeyModal, { getStoredApiKey, ApiKeySettingsButton } from './components/ApiKeyModal';
import { SKKNInput, AnalysisResult, AnalysisStatus } from './types';
import { analyzeSKKNWithGemini } from './services/geminiService';
import { saveToHistory, HistoryItem } from './services/historyService';
import { useTheme } from './contexts/ThemeContext';
import { ShieldCheck, BookOpen, History, Sun, Moon, GitCompare } from 'lucide-react';

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
  const currentInputRef = useRef<SKKNInput | null>(null);

  // Kiểm tra API key khi load
  useEffect(() => {
    const key = getStoredApiKey();
    setHasApiKey(!!key);
    if (!key) {
      setShowApiKeyModal(true);
    }
  }, []);

  const handleApiKeySave = (_apiKey: string, _model: string) => {
    setHasApiKey(true);
  };

  const handleSubmit = async (data: SKKNInput) => {
    setStatus(AnalysisStatus.LOADING);
    setErrorMsg(null);
    currentInputRef.current = data;
    try {
      const analysis = await analyzeSKKNWithGemini(data);
      setResult(analysis);
      setStatus(AnalysisStatus.SUCCESS);
      // Tự động lưu vào lịch sử
      saveToHistory(data, analysis);
    } catch (error: any) {
      console.error(error);
      setStatus(AnalysisStatus.ERROR);
      setErrorMsg(error.message || "Đã xảy ra lỗi trong quá trình phân tích. Vui lòng kiểm tra API Key hoặc thử lại sau.");
    }
  };

  const handleReset = () => {
    setStatus(AnalysisStatus.IDLE);
    setResult(null);
    setErrorMsg(null);
    currentInputRef.current = null;
  };

  const handleViewHistoryResult = (item: HistoryItem) => {
    setResult(item.result);
    currentInputRef.current = item.input;
    setStatus(AnalysisStatus.SUCCESS);
    setShowHistory(false);
  };

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
                    <p className="text-blue-100 text-sm">SKKN Checker Pro v1.4</p>
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

      {/* Header */}
      <header className={`shadow-sm sticky top-0 z-40 transition-colors ${isDark ? 'bg-gray-800' : 'bg-white'}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 cursor-pointer" onClick={handleReset}>
            <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center text-white">
              <ShieldCheck size={24} />
            </div>
            <div>
              <h1 className={`text-xl font-bold tracking-tight leading-none ${isDark ? 'text-white' : 'text-gray-900'}`}>SKKN Checker Pro</h1>
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
            <span className={`px-3 py-1 rounded-full text-xs font-bold ${isDark ? 'bg-blue-900 text-blue-300' : 'bg-blue-50 text-blue-700'}`}>v1.4</span>
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
                  SKKN
                </span>
                {' '}
                <span className="bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 bg-clip-text text-transparent">
                  CHECKER
                </span>
                {' '}
                <span className="bg-gradient-to-r from-orange-500 via-red-500 to-rose-500 bg-clip-text text-transparent">
                  PRO
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
                <span className="font-semibold text-purple-600"> tư vấn chiến lược đạt giải cao</span>.
              </p>

              {/* Author */}
              <p className="text-sm md:text-base">
                <span className="text-gray-500">Phát triển bởi thầy </span>
                <span className="font-bold bg-gradient-to-r from-blue-600 to-cyan-500 bg-clip-text text-transparent">
                  Trần Hoài Thanh
                </span>
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
            </div>
            <h3 className="text-2xl font-bold text-gray-800 animate-pulse">Đang thẩm định SKKN...</h3>
            <p className="text-gray-500 mt-2 max-w-md text-center">Hệ thống đang đối chiếu với cơ sở dữ liệu, kiểm tra lỗi ngữ pháp và tính toán điểm số sáng tạo.</p>
          </div>
        )}

        {status === AnalysisStatus.ERROR && (
          <div className="max-w-2xl mx-auto mt-10 p-8 bg-red-50 rounded-2xl border border-red-200 text-center">
            <div className="inline-flex p-4 bg-red-100 rounded-full text-red-600 mb-4">
              <ShieldCheck size={40} />
            </div>
            <h3 className="text-2xl font-bold text-red-800 mb-2">Rất tiếc, đã có lỗi xảy ra</h3>
            <p className="text-red-600 mb-6">{errorMsg}</p>
            <button
              onClick={handleReset}
              className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              Thử lại
            </button>
          </div>
        )}

        {status === AnalysisStatus.SUCCESS && result && (
          <ResultsDashboard result={result} input={currentInputRef.current || undefined} onReset={handleReset} />
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
              href="https://forms.gle/d7AmcT9MTyGy7bJd8"
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

