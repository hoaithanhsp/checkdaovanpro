import React, { useState } from 'react';
import { AnalysisResult, SpellingError, PlagiarismSegment, SKKNInput, ImprovementAnalysisResult } from '../types';
import {
  RadialBarChart, RadialBar, Legend, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, Cell
} from 'recharts';
import {
  AlertTriangle, CheckCircle, Search, FileText,
  TrendingUp, Award, BookOpen, AlertOctagon, Download, Sparkles, FileDown, Loader2, PenLine, CheckSquare, BookMarked, Share2, Wand2, BarChart3, Wrench, Bot, User, Lock, Eye, EyeOff, X
} from 'lucide-react';
import { exportToWord } from '../services/exportService';
import { authenticateVIPUser, saveLoginState } from '../data/accounts';
import RewritePanel from './RewritePanel';
import ChecklistPanel from './ChecklistPanel';
import ReferencesPanel from './ReferencesPanel';
import SharePanel from './SharePanel';
import AutoFixPanel from './AutoFixPanel';
import ImprovementPanel from './ImprovementPanel';
import AutoImprovementFixPanel from './AutoImprovementFixPanel';
import AIReductionPanel from './AIReductionPanel';
import AnalysisDashboard from './AnalysisDashboard';

interface ResultsDashboardProps {
  result: AnalysisResult;
  input?: SKKNInput;
  onReset: () => void;
  isTrial?: boolean;
  onUpgradeSuccess?: () => void;
}

const ResultsDashboard: React.FC<ResultsDashboardProps> = ({ result, input, onReset, isTrial = false, onUpgradeSuccess }) => {
  const [isExporting, setIsExporting] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [selectedSegment, setSelectedSegment] = useState<PlagiarismSegment | null>(null);
  const [showChecklist, setShowChecklist] = useState(false);
  const [showReferences, setShowReferences] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [showAutoFix, setShowAutoFix] = useState(false);
  const [showImprovement, setShowImprovement] = useState(false);
  const [showAutoImprovement, setShowAutoImprovement] = useState(false);
  const [showAIReduction, setShowAIReduction] = useState(false);
  const [improvementResult, setImprovementResult] = useState<ImprovementAnalysisResult | null>(null);
  const [showVIPModal, setShowVIPModal] = useState(false);

  // VIP Login inline states
  const [vipUsername, setVipUsername] = useState('');
  const [vipPassword, setVipPassword] = useState('');
  const [vipShowPassword, setVipShowPassword] = useState(false);
  const [vipLoginError, setVipLoginError] = useState('');
  const [vipLoginLoading, setVipLoginLoading] = useState(false);

  const handleTrialBlock = () => {
    if (isTrial) {
      setShowVIPModal(true);
      setVipLoginError('');
      setVipUsername('');
      setVipPassword('');
      return true;
    }
    return false;
  };

  const handleVIPLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setVipLoginError('');
    setVipLoginLoading(true);

    await new Promise(resolve => setTimeout(resolve, 600));

    const account = authenticateVIPUser(vipUsername, vipPassword);
    if (account) {
      saveLoginState(account);
      setShowVIPModal(false);
      if (onUpgradeSuccess) onUpgradeSuccess();
    } else {
      setVipLoginError('Tên đăng nhập hoặc mật khẩu không đúng!');
    }
    setVipLoginLoading(false);
  };

  // Safe defaults cho các trường mảng có thể undefined từ API
  const spellingErrors = result.spellingErrors || [];
  const plagiarismSegments = result.plagiarismSegments || [];
  const scoreDetails = result.scoreDetails || [];
  const developmentPlan = result.developmentPlan || { shortTerm: [], mediumTerm: [], longTerm: [] };
  const scores = result.scores || { innovation: 0, feasibility: 0, scientific: 0, presentation: 0, total: 0 };

  const handleExportWord = async () => {
    if (!input) {
      alert('Không có dữ liệu đầu vào để xuất báo cáo');
      return;
    }
    setIsExporting(true);
    setShowExportMenu(false);
    try {
      await exportToWord(input, result);
    } catch (error) {
      console.error('Export error:', error);
      alert('Đã xảy ra lỗi khi xuất file');
    }
    setIsExporting(false);
  };

  const scoreData = [
    { name: 'Tính Mới', value: scores.innovation, fullMark: 30, fill: '#3B82F6' },
    { name: 'Khả Thi', value: scores.feasibility, fullMark: 40, fill: '#10B981' },
    { name: 'Khoa Học', value: scores.scientific, fullMark: 20, fill: '#8B5CF6' },
    { name: 'Hình Thức', value: scores.presentation, fullMark: 10, fill: '#F59E0B' },
  ];

  const getRiskColor = (risk: string) => {
    switch (risk.toLowerCase()) {
      case 'cao': return 'text-red-600 bg-red-100 border-red-200';
      case 'rất cao': return 'text-red-700 bg-red-200 border-red-300';
      case 'trung bình': return 'text-yellow-600 bg-yellow-100 border-yellow-200';
      default: return 'text-green-600 bg-green-100 border-green-200';
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-fade-in pb-20">

      {/* VIP Upgrade Modal with Inline Login */}
      {showVIPModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden relative" onClick={e => e.stopPropagation()}>
            {/* Nút X đóng popup */}
            <button
              onClick={() => setShowVIPModal(false)}
              className="absolute top-4 right-4 z-10 w-8 h-8 rounded-full bg-white/20 hover:bg-white/40 flex items-center justify-center text-white transition-colors"
              title="Đóng"
            >
              <X size={18} />
            </button>

            {/* Header */}
            <div className="bg-gradient-to-r from-purple-600 to-pink-600 p-6 text-center">
              <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-3">
                <span className="text-3xl">⭐</span>
              </div>
              <h3 className="text-xl font-black text-white">Nâng cấp VIP</h3>
              <p className="text-white/80 text-sm mt-1">Chỉ với <span className="font-bold text-yellow-300 text-lg">199.000đ</span> để mở khóa full tính năng</p>
            </div>

            {/* Content */}
            <div className="p-6 space-y-5">
              {/* Form đăng nhập VIP */}
              <form onSubmit={handleVIPLogin} className="space-y-4">
                <p className="text-center text-gray-700 font-semibold text-sm">
                  ✨ Nhập tài khoản VIP để kích hoạt ngay
                </p>

                {/* Username */}
                <div className="space-y-1">
                  <label className="text-gray-600 text-xs font-medium flex items-center gap-1.5">
                    <User size={14} /> Tên đăng nhập
                  </label>
                  <input
                    type="text"
                    value={vipUsername}
                    onChange={(e) => setVipUsername(e.target.value)}
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all text-sm"
                    placeholder="Nhập tên đăng nhập VIP"
                    required
                  />
                </div>

                {/* Password */}
                <div className="space-y-1">
                  <label className="text-gray-600 text-xs font-medium flex items-center gap-1.5">
                    <Lock size={14} /> Mật khẩu
                  </label>
                  <div className="relative">
                    <input
                      type={vipShowPassword ? 'text' : 'password'}
                      value={vipPassword}
                      onChange={(e) => setVipPassword(e.target.value)}
                      className="w-full px-3 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all text-sm pr-10"
                      placeholder="Nhập mật khẩu"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setVipShowPassword(!vipShowPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {vipShowPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                {/* Error */}
                {vipLoginError && (
                  <div className="p-2.5 bg-red-50 border border-red-200 rounded-xl text-red-600 text-xs text-center font-medium">
                    {vipLoginError}
                  </div>
                )}

                {/* Submit */}
                <button
                  type="submit"
                  disabled={vipLoginLoading}
                  className="w-full py-3 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-bold rounded-xl transition-all shadow-lg disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {vipLoginLoading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      Đang xác thực...
                    </>
                  ) : (
                    <>
                      <Sparkles size={18} />
                      ĐĂNG NHẬP VIP
                    </>
                  )}
                </button>
              </form>

              {/* Divider */}
              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-gray-200"></div>
                <span className="text-gray-400 text-xs">hoặc liên hệ đăng ký</span>
                <div className="flex-1 h-px bg-gray-200"></div>
              </div>

              {/* Links liên hệ */}
              <div className="flex flex-col gap-2">
                <a href="https://zalo.me/0348296773" target="_blank" rel="noreferrer"
                  className="w-full py-2.5 bg-blue-500 hover:bg-blue-600 text-white font-semibold rounded-xl transition-all flex items-center justify-center gap-2 text-sm shadow">
                  💬 Zalo 0348296773
                </a>
                <a href="https://www.facebook.com/tranhoaithanhvicko/" target="_blank" rel="noreferrer"
                  className="w-full py-2.5 bg-indigo-500 hover:bg-indigo-600 text-white font-semibold rounded-xl transition-all flex items-center justify-center gap-2 text-sm shadow">
                  👤 Facebook Trần Hoài Thanh
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Trial Banner */}
      {isTrial && (
        <div className="bg-gradient-to-r from-amber-50 to-orange-50 border-2 border-amber-300 rounded-2xl p-4 flex items-center gap-4">
          <div className="text-3xl flex-shrink-0">🌟</div>
          <div className="flex-1">
            <p className="font-bold text-amber-800">Chế độ Dùng Thử</p>
            <p className="text-amber-700 text-sm">Kích hoạt tài khoản <strong>VIP 199k</strong> để mở khóa Viết lại AI, Xuất báo cáo, Đề xuất cải thiện và nhiều hơn. Liên hệ Zalo <strong>0348296773</strong>.</p>
          </div>
          <button onClick={() => setShowVIPModal(true)}
            className="flex-shrink-0 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl transition-colors text-sm whitespace-nowrap">
            Nâng cấp VIP
          </button>
        </div>
      )}
      {/* Rewrite Panel Modal */}
      {selectedSegment && (
        <RewritePanel
          segment={selectedSegment}
          onClose={() => setSelectedSegment(null)}
        />
      )}

      {/* Checklist Panel Modal */}
      {showChecklist && input && (
        <ChecklistPanel
          result={result}
          skknTitle={input.title}
          onClose={() => setShowChecklist(false)}
        />
      )}

      {/* References Panel Modal */}
      {showReferences && input && (
        <ReferencesPanel
          title={input.title}
          subject={input.subject}
          content={input.content}
          onClose={() => setShowReferences(false)}
        />
      )}

      {/* Share Panel Modal */}
      {showShare && input && (
        <SharePanel
          result={result}
          input={input}
          onClose={() => setShowShare(false)}
        />
      )}

      {/* Auto Fix Panel Modal */}
      {showAutoFix && input && (
        <AutoFixPanel
          isOpen={showAutoFix}
          onClose={() => setShowAutoFix(false)}
          originalContent={input.content}
          analysisResult={result}
          originalDocx={input.originalDocx}
        />
      )}

      {/* Improvement Panel Modal */}
      {showImprovement && input && (
        <ImprovementPanel
          isOpen={showImprovement}
          onClose={() => setShowImprovement(false)}
          originalContent={input.content}
          input={input}
          originalDocx={input.originalDocx}
          onStartAutoFix={(impResult) => {
            setImprovementResult(impResult);
            setShowImprovement(false);
            setShowAutoImprovement(true);
          }}
        />
      )}

      {/* Auto Improvement Fix Panel Modal */}
      {showAutoImprovement && input && improvementResult && (
        <AutoImprovementFixPanel
          isOpen={showAutoImprovement}
          onClose={() => setShowAutoImprovement(false)}
          originalContent={input.content}
          improvementResult={improvementResult}
          input={input}
          originalDocx={input.originalDocx}
        />
      )}

      {/* AI Reduction Panel Modal */}
      {showAIReduction && input && result.aiRiskDetails && (
        <AIReductionPanel
          isOpen={showAIReduction}
          onClose={() => setShowAIReduction(false)}
          originalContent={input.content}
          aiRiskScore={result.aiRiskScore || 0}
          aiRiskDetails={result.aiRiskDetails}
          originalDocx={input.originalDocx}
        />
      )}

      {/* Header Summary */}
      <div className="bg-white rounded-2xl shadow-lg p-6 md:p-8 border-l-8 border-blue-600">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-6">
          <div>
            <h2 className="text-3xl font-bold text-gray-800 mb-1">Kết quả Thẩm định SKKN</h2>
          </div>
          <div className="text-center md:text-right">
            <p className="text-sm text-gray-500 uppercase font-semibold">Tổng điểm dự kiến</p>
            <p className="text-5xl font-black text-blue-600">{scores.total}<span className="text-2xl text-gray-400">/100</span></p>
          </div>
        </div>

        {/* Action Buttons Grid — 2 hàng, icon + text */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {/* Checklist */}
          <button
            onClick={() => { if (!handleTrialBlock()) setShowChecklist(true); }}
            className={`flex items-center gap-2 px-4 py-3 rounded-xl text-white text-sm font-semibold transition-all ${
              isTrial
                ? 'bg-gray-400 opacity-60 cursor-not-allowed'
                : 'bg-emerald-600 hover:bg-emerald-700 hover:shadow-md'
            }`}
          >
            <CheckSquare size={18} />
            <span>{isTrial ? '🔒 ' : ''}Checklist</span>
          </button>

          {/* Tài liệu tham khảo */}
          <button
            onClick={() => { if (!handleTrialBlock()) setShowReferences(true); }}
            className={`flex items-center gap-2 px-4 py-3 rounded-xl text-white text-sm font-semibold transition-all ${
              isTrial
                ? 'bg-gray-400 opacity-60 cursor-not-allowed'
                : 'bg-indigo-600 hover:bg-indigo-700 hover:shadow-md'
            }`}
          >
            <BookMarked size={18} />
            <span>{isTrial ? '🔒 ' : ''}Tài liệu TK</span>
          </button>

          {/* Chia sẻ */}
          <button
            onClick={() => { if (!handleTrialBlock()) setShowShare(true); }}
            className={`flex items-center gap-2 px-4 py-3 rounded-xl text-white text-sm font-semibold transition-all ${
              isTrial
                ? 'bg-gray-400 opacity-60 cursor-not-allowed'
                : 'bg-pink-600 hover:bg-pink-700 hover:shadow-md'
            }`}
          >
            <Share2 size={18} />
            <span>{isTrial ? '🔒 ' : ''}Chia sẻ</span>
          </button>

          {/* Tự động sửa SKKN */}
          <button
            onClick={() => { if (!handleTrialBlock()) setShowAutoFix(true); }}
            className={`flex items-center gap-2 px-4 py-3 rounded-xl text-white text-sm font-semibold transition-all ${
              isTrial
                ? 'bg-gray-400 opacity-60 cursor-not-allowed'
                : 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 hover:shadow-md'
            }`}
          >
            <Wand2 size={18} />
            <span>{isTrial ? '🔒 ' : ''}Tự động sửa</span>
          </button>

          {/* Đề xuất cải thiện */}
          <button
            onClick={() => { if (!handleTrialBlock()) setShowImprovement(true); }}
            className={`flex items-center gap-2 px-4 py-3 rounded-xl text-white text-sm font-semibold transition-all ${
              isTrial
                ? 'bg-gray-400 opacity-60 cursor-not-allowed'
                : 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 hover:shadow-md'
            }`}
          >
            <BarChart3 size={18} />
            <span>{isTrial ? '🔒 ' : ''}Đề xuất cải thiện</span>
          </button>

          {/* Sửa từ đề xuất */}
          <button
            onClick={() => {
              if (handleTrialBlock()) return;
              if (improvementResult) {
                setShowAutoImprovement(true);
              } else {
                setShowImprovement(true);
              }
            }}
            className={`flex items-center gap-2 px-4 py-3 rounded-xl text-white text-sm font-semibold transition-all ${
              isTrial
                ? 'bg-gray-400 opacity-60 cursor-not-allowed'
                : 'bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 hover:shadow-md'
            }`}
          >
            <Wrench size={18} />
            <span>{isTrial ? '🔒 ' : ''}Sửa từ đề xuất</span>
          </button>

          {/* Giảm AI (chỉ hiện khi rủi ro AI > 20) */}
          {((result.aiRiskScore || 0) > 20) && (
            <button
              onClick={() => { if (!handleTrialBlock()) setShowAIReduction(true); }}
              className={`flex items-center gap-2 px-4 py-3 rounded-xl text-white text-sm font-semibold transition-all ${
                isTrial
                  ? 'bg-gray-400 opacity-60 cursor-not-allowed'
                  : 'bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600 hover:shadow-md'
              }`}
            >
              <Bot size={18} />
              <span>{isTrial ? '🔒 ' : ''}Giảm AI ({result.aiRiskScore}%)</span>
            </button>
          )}

          {/* Xuất báo cáo */}
          <div className="relative">
            <button
              onClick={() => { if (!handleTrialBlock()) setShowExportMenu(!showExportMenu); }}
              disabled={isExporting}
              className={`w-full flex items-center gap-2 px-4 py-3 rounded-xl text-white text-sm font-semibold transition-all disabled:bg-gray-400 ${
                isTrial
                  ? 'bg-gray-400 opacity-60 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700 hover:shadow-md'
              }`}
            >
              {isExporting ? <Loader2 size={18} className="animate-spin" /> : <FileDown size={18} />}
              <span>{isTrial ? '🔒 ' : ''}Xuất báo cáo</span>
            </button>
            {showExportMenu && (
              <div className="absolute left-0 top-full mt-2 bg-white rounded-lg shadow-xl border border-gray-200 py-2 min-w-[200px] z-10">
                <button
                  onClick={handleExportWord}
                  className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2"
                >
                  <FileText size={16} className="text-blue-600" />
                  Xuất file Word (.docx)
                </button>
                <button
                  onClick={() => { window.print(); setShowExportMenu(false); }}
                  className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2"
                >
                  <Download size={16} className="text-gray-600" />
                  In / Lưu PDF
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Analysis Dashboard - Visual Overview */}
      <AnalysisDashboard result={result} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

        {/* Left Column: Scores & Charts */}
        <div className="lg:col-span-1 space-y-8">
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
              <Award className="text-blue-500" /> Biểu đồ điểm số
            </h3>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <RadialBarChart cx="50%" cy="50%" innerRadius="10%" outerRadius="100%" barSize={10} data={scoreData}>
                  <RadialBar
                    background
                    dataKey="value"
                  />
                  <Legend iconSize={10} layout="vertical" verticalAlign="middle" wrapperStyle={{ top: '50%', right: 0, transform: 'translate(0, -50%)', lineHeight: '24px' }} />
                  <RechartsTooltip />
                </RadialBarChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-4 space-y-3">
              {scoreData.map((item) => (
                <div key={item.name} className="flex justify-between items-center text-sm">
                  <span className="font-medium text-gray-600">{item.name}</span>
                  <div className="flex-1 mx-3 h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${(item.value / item.fullMark) * 100}%`, backgroundColor: item.fill }}
                    ></div>
                  </div>
                  <span className="font-bold text-gray-800">{item.value}/{item.fullMark}</span>
                </div>
              ))}
            </div>
          </div>

          <div className={`rounded-2xl shadow-lg p-6 border-2 ${getRiskColor(result.duplicateLevel)}`}>
            <h3 className="text-lg font-bold mb-2 flex items-center gap-2">
              <Search size={20} /> Trùng lặp đề tài: {result.duplicateLevel}
            </h3>
            <p className="text-sm opacity-90">{result.duplicateDetails}</p>
          </div>

          <div className={`rounded-2xl shadow-lg p-6 border-2 ${getRiskColor(result.plagiarismRisk)}`}>
            <h3 className="text-lg font-bold mb-2 flex items-center gap-2">
              <AlertOctagon size={20} /> Nguy cơ đạo văn: {result.plagiarismRisk}
            </h3>
            <p className="text-sm opacity-90">Phát hiện {plagiarismSegments.length} đoạn có dấu hiệu trùng lặp theo phân tích ngôn ngữ. Đây không phải kết quả đối chiếu với cơ sở dữ liệu đạo văn.</p>
          </div>

          {/* Plagiarism Segments with Rewrite */}
          {plagiarismSegments.length > 0 && (
            <div className="bg-white rounded-2xl shadow-lg p-6">
              <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                <AlertTriangle className="text-red-500" /> Đoạn văn cần xem xét
              </h3>
              <div className="space-y-4">
                {plagiarismSegments.map((seg, idx) => (
                  <div key={idx} className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <p className="text-gray-800 italic mb-2">"{seg.segment}"</p>
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                      <div className="flex flex-wrap gap-2">
                        <span className="px-2 py-1 bg-red-100 text-red-700 rounded">
                          Dấu hiệu trùng lặp do AI ước lượng — không phải % đối chiếu thật
                        </span>
                        <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded">
                          Nguồn cần tự kiểm chứng: {seg.source}
                        </span>
                      </div>
                      <button
                        onClick={() => { if (!handleTrialBlock()) setSelectedSegment(seg); }}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1 ${
                          isTrial
                            ? 'bg-gray-300 text-gray-500 cursor-not-allowed opacity-70'
                            : 'bg-purple-600 text-white hover:bg-purple-700'
                        }`}
                        title={isTrial ? 'Kích hoạt VIP để sử dụng' : 'Viết lại bằng AI'}
                      >
                        <PenLine size={14} /> {isTrial ? '🔒 Viết lại bằng AI' : 'Viết lại bằng AI'}
                      </button>
                    </div>
                    <p className="text-xs text-gray-600 mt-2">💡 {seg.advice}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Detailed Analysis */}
        <div className="lg:col-span-2 space-y-8">

          {/* Detailed Scores */}
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
              <TrendingUp className="text-indigo-500" /> Chi tiết đánh giá
            </h3>
            <div className="space-y-4">
              {scoreDetails.map((detail, idx) => (
                <div key={idx} className="border-b border-gray-100 last:border-0 pb-4 last:pb-0">
                  <h4 className="font-bold text-gray-700 mb-1">{detail.category}</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div className="bg-green-50 p-3 rounded-lg text-green-800">
                      <span className="font-bold">Điểm mạnh:</span> {detail.strength}
                    </div>
                    <div className="bg-red-50 p-3 rounded-lg text-red-800">
                      <span className="font-bold">Cần khắc phục:</span> {detail.weakness}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Spelling & Grammar */}
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
              <BookOpen className="text-orange-500" /> Lỗi Chính tả & Diễn đạt ({spellingErrors.length})
            </h3>
            {spellingErrors.length > 0 ? (
              <div className="max-h-60 overflow-y-auto space-y-2 pr-2">
                {spellingErrors.map((err, idx) => (
                  <div key={idx} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg group hover:bg-orange-50 transition-colors">
                    <span className="bg-orange-200 text-orange-800 text-xs font-bold px-2 py-1 rounded mt-0.5">{err.type}</span>
                    <div className="text-sm">
                      <p className="text-gray-600 mb-1"><span className="font-semibold text-gray-800">{err.line}:</span> "{err.error}"</p>
                      <p className="text-green-600 font-medium">Suggestion: "{err.correction}"</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-green-600 flex items-center gap-2"><CheckCircle size={18} /> Không phát hiện lỗi nghiêm trọng.</p>
            )}
          </div>

          {/* Development Plan */}
          <div className="bg-gradient-to-br from-indigo-900 to-blue-900 rounded-2xl shadow-lg p-6 text-white">
            <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
              <Sparkles className="text-yellow-400" /> Kế hoạch nâng cấp SKKN
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white/10 p-4 rounded-xl backdrop-blur-sm border border-white/10">
                <h4 className="font-bold text-yellow-300 mb-3 border-b border-white/20 pb-2">Ngắn hạn (1-2 tuần)</h4>
                <ul className="list-disc list-inside space-y-2 text-sm text-indigo-100">
                  {(developmentPlan.shortTerm || []).map((item, i) => <li key={i}>{item}</li>)}
                </ul>
              </div>
              <div className="bg-white/10 p-4 rounded-xl backdrop-blur-sm border border-white/10">
                <h4 className="font-bold text-blue-300 mb-3 border-b border-white/20 pb-2">Trung hạn (1 tháng)</h4>
                <ul className="list-disc list-inside space-y-2 text-sm text-indigo-100">
                  {(developmentPlan.mediumTerm || []).map((item, i) => <li key={i}>{item}</li>)}
                </ul>
              </div>
              <div className="bg-white/10 p-4 rounded-xl backdrop-blur-sm border border-white/10">
                <h4 className="font-bold text-green-300 mb-3 border-b border-white/20 pb-2">Dài hạn (2-3 tháng)</h4>
                <ul className="list-disc list-inside space-y-2 text-sm text-indigo-100">
                  {(developmentPlan.longTerm || []).map((item, i) => <li key={i}>{item}</li>)}
                </ul>
              </div>
            </div>

            <div className="mt-6 pt-6 border-t border-white/20">
              <h4 className="font-bold text-lg mb-2">Lời khuyên chuyên gia</h4>
              <p className="text-indigo-100 italic">"{result.overallConclusion}"</p>
            </div>
          </div>

        </div>
      </div>

      <div className="flex justify-center pt-8">
        <button
          onClick={onReset}
          className="px-8 py-3 bg-white border border-gray-300 text-gray-700 font-semibold rounded-full hover:bg-gray-50 hover:shadow-md transition-all flex items-center gap-2"
        >
          <Search size={18} /> Kiểm tra SKKN khác
        </button>
      </div>
    </div>
  );
};

export default ResultsDashboard;
