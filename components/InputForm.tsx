import React, { useState, ChangeEvent } from 'react';
import { SKKNInput } from '../types';
import { BookOpen, Target, GraduationCap, FileText, Sparkles, Upload, Type, AlertCircle } from 'lucide-react';
import FileUpload from './FileUpload';

interface InputFormProps {
  onSubmit: (data: SKKNInput) => void;
  isLoading: boolean;
}

type InputMode = 'text' | 'file';

const InputForm: React.FC<InputFormProps> = ({ onSubmit, isLoading }) => {
  const [formData, setFormData] = useState<SKKNInput>({
    title: '',
    level: 'Tiểu học',
    subject: '',
    target: 'Cấp Huyện',
    content: ''
  });
  const [inputMode, setInputMode] = useState<InputMode>('file');
  const [fileError, setFileError] = useState<string | null>(null);

  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (name === 'content') setFileError(null);
  };

  const handleTextExtracted = (text: string) => {
    setFormData(prev => ({ ...prev, content: text }));
    setFileError(null);
  };

  const handleFileError = (error: string) => {
    setFileError(error);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.content.length < 50) {
      alert("Vui lòng nhập nội dung dài hơn để hệ thống có thể phân tích chính xác.");
      return;
    }
    onSubmit(formData);
  };

  const handleSampleData = () => {
    setFormData({
      title: "Một số biện pháp giúp học sinh lớp 5 học tốt môn Lịch sử qua việc sử dụng bản đồ tư duy",
      level: "Tiểu học",
      subject: "Lịch sử",
      target: "Cấp Tỉnh",
      content: `I. ĐẶT VẤN ĐỀ
Trong bối cảnh đổi mới giáo dục hiện nay, việc phát huy tính tích cực, chủ động của học sinh là vô cùng quan trọng. Môn Lịch sử ở tiểu học thường bị coi là khô khan, khó nhớ. Học sinh thường học vẹt, nhớ trước quên sau.

II. GIẢI QUYẾT VẤN ĐỀ
1. Cơ sở lý luận
Theo quan điểm dạy học hiện đại, học sinh là trung tâm. Bản đồ tư duy (Mindmap) là công cụ ghi nhớ ưu việt được Tony Buzan phát triển.
2. Thực trạng
Qua khảo sát đầu năm, chỉ có 30% học sinh yêu thích môn Lịch sử. Các em thường ngại học bài cũ vì nhiều số liệu.
3. Các biện pháp thực hiện
Biện pháp 1: Hướng dẫn học sinh làm quen với bản đồ tư duy.
Biện pháp 2: Ứng dụng bản đồ tư duy trong khâu kiểm tra bài cũ.
Biện pháp 3: Sử dụng bản đồ tư duy để tổng kết bài học.
Ví dụ: Khi dạy bài "Chiến thắng Bạch Đằng", tôi cho học sinh vẽ sơ đồ diễn biến trận đánh...

III. KẾT LUẬN
Qua áp dụng sáng kiến, chất lượng môn Lịch sử lớp 5A đã được nâng lên rõ rệt. Số học sinh đạt điểm Giỏi tăng từ 20% lên 55%. Hiệu qủa của phương páp này là rất khả quan.`
    });
  };

  return (
    <div className="w-full max-w-4xl mx-auto bg-white rounded-2xl shadow-xl overflow-hidden animate-fade-in-up">
      <div className="bg-gradient-to-r from-blue-700 to-indigo-800 p-6 text-white text-center">
        <h2 className="text-2xl font-bold mb-2">Nhập thông tin SKKN</h2>
        <p className="text-blue-100 opacity-90">Hệ thống sẽ phân tích và đưa ra báo cáo chi tiết trong vài giây</p>
      </div>

      <form onSubmit={handleSubmit} className="p-8 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Title */}
          <div className="md:col-span-2">
            <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
              <FileText size={18} className="text-blue-600" /> Tên đề tài SKKN
            </label>
            <input
              type="text"
              name="title"
              value={formData.title}
              onChange={handleChange}
              placeholder="Ví dụ: Một số biện pháp giúp học sinh..."
              className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
            />
          </div>

          {/* Level */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
              <GraduationCap size={18} className="text-blue-600" /> Cấp học
            </label>
            <select
              name="level"
              value={formData.level}
              onChange={handleChange}
              className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
            >
              <option value="Mầm non">Mầm non</option>
              <option value="Tiểu học">Tiểu học</option>
              <option value="THCS">THCS</option>
              <option value="THPT">THPT</option>
              <option value="GDTX">GDTX</option>
            </select>
          </div>

          {/* Subject */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
              <BookOpen size={18} className="text-blue-600" /> Môn học / Lĩnh vực
            </label>
            <input
              type="text"
              name="subject"
              value={formData.subject}
              onChange={handleChange}
              placeholder="VD: Toán, Ngữ Văn, Quản lý..."
              className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
            />
          </div>

          {/* Target */}
          <div className="md:col-span-2">
            <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
              <Target size={18} className="text-red-600" /> Mục tiêu thi đạt giải
            </label>
            <select
              name="target"
              value={formData.target}
              onChange={handleChange}
              className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-red-500 focus:border-red-500 bg-white"
            >
              <option value="Cấp Trường">Cấp Trường</option>
              <option value="Cấp Huyện">Cấp Huyện</option>
              <option value="Cấp Tỉnh">Cấp Tỉnh</option>
              <option value="Cấp Quốc gia">Cấp Quốc gia</option>
            </select>
          </div>

          {/* Content */}
          <div className="md:col-span-2">
            <label className="block text-sm font-semibold text-gray-700 mb-3 flex items-center justify-between">
              <span className="flex items-center gap-2"><FileText size={18} className="text-blue-600" /> Nội dung SKKN</span>
              <button
                type="button"
                onClick={handleSampleData}
                className="text-xs text-blue-600 hover:text-blue-800 underline font-normal"
              >
                Dùng dữ liệu mẫu
              </button>
            </label>

            {/* Toggle Tabs */}
            <div className="flex mb-4 bg-gray-100 rounded-lg p-1">
              <button
                type="button"
                onClick={() => setInputMode('file')}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-md font-medium text-sm transition-all ${inputMode === 'file'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-800'
                  }`}
              >
                <Upload size={16} /> Tải file lên
              </button>
              <button
                type="button"
                onClick={() => setInputMode('text')}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-md font-medium text-sm transition-all ${inputMode === 'text'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-800'
                  }`}
              >
                <Type size={16} /> Nhập văn bản
              </button>
            </div>

            {/* File Upload Mode */}
            {inputMode === 'file' && (
              <div className="space-y-4">
                <FileUpload
                  onTextExtracted={handleTextExtracted}
                  onError={handleFileError}
                />
                {fileError && (
                  <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                    <AlertCircle size={18} className="mt-0.5 flex-shrink-0" />
                    <span>{fileError}</span>
                  </div>
                )}
                {formData.content && (
                  <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                    <p className="text-sm text-gray-600 mb-2 font-medium">Nội dung đã trích xuất ({formData.content.length} ký tự):</p>
                    <div className="max-h-40 overflow-y-auto">
                      <p className="text-sm text-gray-700 whitespace-pre-wrap line-clamp-6">{formData.content.substring(0, 500)}...</p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Text Input Mode */}
            {inputMode === 'text' && (
              <>
                <textarea
                  name="content"
                  value={formData.content}
                  onChange={handleChange}
                  placeholder="Dán nội dung SKKN của bạn vào đây (ít nhất 200 từ để có kết quả tốt nhất)..."
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-h-[300px] font-mono text-sm"
                  required={inputMode === 'text'}
                />
                <p className="text-xs text-gray-500 mt-2 text-right">
                  {formData.content.length} ký tự
                </p>
              </>
            )}
          </div>
        </div>

        <div className="pt-4 flex justify-center">
          <button
            type="submit"
            disabled={isLoading}
            className={`
              flex items-center gap-3 px-8 py-4 rounded-full text-lg font-bold text-white shadow-lg transform transition-all hover:scale-105
              ${isLoading ? 'bg-gray-400 cursor-not-allowed' : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:shadow-xl'}
            `}
          >
            {isLoading ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                Đang phân tích...
              </>
            ) : (
              <>
                <Sparkles size={24} />
                KIỂM TRA NGAY
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default InputForm;
