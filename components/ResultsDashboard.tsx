import React, { useState } from 'react';
import { AnalysisResult, SpellingError, PlagiarismSegment, SKKNInput, ImprovementAnalysisResult } from '../types';
import {
  RadialBarChart, RadialBar, Legend, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, Cell
} from 'recharts';
import {
  AlertTriangle, CheckCircle, Search, FileText,
  TrendingUp, Award, BookOpen, AlertOctagon, Download, Sparkles, FileDown, Loader2, PenLine, CheckSquare, BookMarked, Share2, Wand2, BarChart3, Wrench, Bot
} from 'lucide-react';
import { exportToWord } from '../services/exportService';
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
}

const ResultsDashboard: React.FC<ResultsDashboardProps> = ({ result, input, onReset }) => {
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
      <div className="bg-white rounded-2xl shadow-lg p-8 border-l-8 border-blue-600 flex flex-col md:flex-row justify-between items-center gap-6">
        <div>
          <h2 className="text-3xl font-bold text-gray-800 mb-2">Kết quả Thẩm định SKKN</h2>
          <p className="text-gray-500">Dựa trên tiêu chí Thông tư 27/2020/TT-BGDĐT</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-sm text-gray-500 uppercase font-semibold">Tổng điểm dự kiến</p>
            <p className="text-5xl font-black text-blue-600">{scores.total}<span className="text-2xl text-gray-400">/100</span></p>
          </div>
          <div className="h-16 w-px bg-gray-200"></div>
          {/* Checklist Button */}
          <button
            onClick={() => setShowChecklist(true)}
            className="p-3 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white transition-colors"
            title="Checklist cải thiện"
          >
            <CheckSquare size={24} />
          </button>
          {/* References Button */}
          <button
            onClick={() => setShowReferences(true)}
            className="p-3 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white transition-colors"
            title="Gợi ý tài liệu tham khảo"
          >
            <BookMarked size={24} />
          </button>
          {/* Share Button */}
          <button
            onClick={() => setShowShare(true)}
            className="p-3 rounded-full bg-pink-600 hover:bg-pink-700 text-white transition-colors"
            title="Chia sẻ kết quả"
          >
            <Share2 size={24} />
          </button>
          {/* Auto Fix Button */}
          <button
            onClick={() => setShowAutoFix(true)}
            className="p-3 rounded-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white transition-all shadow-lg hover:shadow-xl"
            title="Tự động sửa SKKN"
          >
            <Wand2 size={24} />
          </button>
          {/* Improvement Panel Button */}
          <button
            onClick={() => setShowImprovement(true)}
            className="p-3 rounded-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white transition-all shadow-lg hover:shadow-xl"
            title="Đề xuất cải thiện SKKN"
          >
            <BarChart3 size={24} />
          </button>
          {/* Auto Improvement Fix Button */}
          <button
            onClick={() => {
              if (improvementResult) {
                setShowAutoImprovement(true);
              } else {
                setShowImprovement(true);
              }
            }}
            className="p-3 rounded-full bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white transition-all shadow-lg hover:shadow-xl"
            title="Sửa chữa SKKN từ đề xuất"
          >
            <Wrench size={24} />
          </button>
          {/* AI Reduction Button (chỉ hiện khi có rủi ro AI) */}
          {((result.aiRiskScore || 0) > 20) && (
            <button
              onClick={() => setShowAIReduction(true)}
              className="p-3 rounded-full bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600 text-white transition-all shadow-lg hover:shadow-xl"
              title={`Giảm độ AI (${result.aiRiskScore}%)`}
            >
              <Bot size={24} />
            </button>
          )}
          <div className="relative">
            <button
              onClick={() => setShowExportMenu(!showExportMenu)}
              disabled={isExporting}
              className="p-3 rounded-full bg-blue-600 hover:bg-blue-700 text-white transition-colors disabled:bg-gray-400"
              title="Xuất báo cáo"
            >
              {isExporting ? <Loader2 size={24} className="animate-spin" /> : <FileDown size={24} />}
            </button>
            {showExportMenu && (
              <div className="absolute right-0 top-full mt-2 bg-white rounded-lg shadow-xl border border-gray-200 py-2 min-w-[180px] z-10">
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
            <p className="text-sm opacity-90">Phát hiện {plagiarismSegments.length} đoạn văn bản có nguy cơ cao.</p>
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
                          Tương đồng: {seg.similarity}%
                        </span>
                        <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded">
                          Nguồn: {seg.source}
                        </span>
                      </div>
                      <button
                        onClick={() => setSelectedSegment(seg)}
                        className="px-3 py-1.5 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 transition-colors flex items-center gap-1"
                      >
                        <PenLine size={14} /> Viết lại bằng AI
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
