import React, { useState } from 'react';
import { X, Share2, Facebook, Link, Check, MessageCircle } from 'lucide-react';
import { AnalysisResult, SKKNInput } from '../types';

interface SharePanelProps {
    result: AnalysisResult;
    input: SKKNInput;
    onClose: () => void;
}

const SharePanel: React.FC<SharePanelProps> = ({ result, input, onClose }) => {
    const [copied, setCopied] = useState(false);

    // Tạo nội dung chia sẻ
    const getShareText = () => {
        const gradeText = result.scores.total >= 80 ? 'Xuất sắc' :
            result.scores.total >= 65 ? 'Tốt' :
                result.scores.total >= 50 ? 'Khá' : 'Cần cải thiện';

        return `📚 SKKN của tôi: "${input.title}"
📊 Điểm đánh giá: ${result.scores.total}/100 (${gradeText})
✨ Tính mới: ${result.scores.innovation}/30
🎯 Khả thi: ${result.scores.feasibility}/40
🔬 Khoa học: ${result.scores.scientific}/20
📝 Hình thức: ${result.scores.presentation}/10

🔍 Đã kiểm tra với SKKN Checker Pro - Trợ lý thẩm định SKKN bằng AI`;
    };

    const shareUrl = window.location.href;

    // Chia sẻ qua Facebook
    const shareToFacebook = () => {
        const url = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}&quote=${encodeURIComponent(getShareText())}`;
        window.open(url, '_blank', 'width=600,height=400');
    };

    // Chia sẻ qua Zalo
    const shareToZalo = () => {
        const text = encodeURIComponent(getShareText() + '\n\n' + shareUrl);
        const url = `https://zalo.me/share?text=${text}`;
        window.open(url, '_blank', 'width=600,height=400');
    };

    // Sao chép link
    const copyToClipboard = () => {
        const fullText = getShareText() + '\n\n' + shareUrl;
        navigator.clipboard.writeText(fullText);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    // Web Share API (cho mobile)
    const nativeShare = async () => {
        if (navigator.share) {
            try {
                await navigator.share({
                    title: `SKKN: ${input.title}`,
                    text: getShareText(),
                    url: shareUrl,
                });
            } catch (err) {
                console.log('Share cancelled');
            }
        } else {
            copyToClipboard();
        }
    };

    const gradeClass = result.scores.total >= 80 ? 'from-green-500 to-emerald-500' :
        result.scores.total >= 65 ? 'from-blue-500 to-cyan-500' :
            result.scores.total >= 50 ? 'from-yellow-500 to-orange-500' : 'from-red-500 to-pink-500';

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-fade-in">
                {/* Header */}
                <div className="bg-gradient-to-r from-pink-600 to-rose-600 p-5 text-white">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-white/20 rounded-lg">
                                <Share2 size={24} />
                            </div>
                            <div>
                                <h2 className="text-xl font-bold">Chia sẻ kết quả</h2>
                                <p className="text-pink-100 text-sm">Khoe thành tích SKKN của bạn</p>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                        >
                            <X size={24} />
                        </button>
                    </div>
                </div>

                {/* Preview Card */}
                <div className="p-6">
                    <div className="bg-gray-50 rounded-xl p-4 mb-6 border border-gray-200">
                        <div className={`bg-gradient-to-r ${gradeClass} text-white rounded-lg p-4 mb-4`}>
                            <p className="text-sm opacity-80 mb-1">Tổng điểm SKKN</p>
                            <p className="text-4xl font-black">{result.scores.total}<span className="text-lg opacity-60">/100</span></p>
                        </div>
                        <h3 className="font-semibold text-gray-800 text-sm mb-2 line-clamp-2">{input.title}</h3>
                        <div className="grid grid-cols-4 gap-2 text-center text-xs">
                            <div className="bg-blue-50 rounded p-2">
                                <p className="text-blue-600 font-bold">{result.scores.innovation}</p>
                                <p className="text-blue-500">Mới</p>
                            </div>
                            <div className="bg-green-50 rounded p-2">
                                <p className="text-green-600 font-bold">{result.scores.feasibility}</p>
                                <p className="text-green-500">Khả thi</p>
                            </div>
                            <div className="bg-purple-50 rounded p-2">
                                <p className="text-purple-600 font-bold">{result.scores.scientific}</p>
                                <p className="text-purple-500">KH</p>
                            </div>
                            <div className="bg-orange-50 rounded p-2">
                                <p className="text-orange-600 font-bold">{result.scores.presentation}</p>
                                <p className="text-orange-500">HT</p>
                            </div>
                        </div>
                    </div>

                    {/* Share Buttons */}
                    <div className="space-y-3">
                        <button
                            onClick={shareToFacebook}
                            className="w-full py-3 bg-[#1877F2] text-white rounded-xl font-semibold flex items-center justify-center gap-2 hover:bg-[#1565C0] transition-colors"
                        >
                            <Facebook size={20} />
                            Chia sẻ lên Facebook
                        </button>

                        <button
                            onClick={shareToZalo}
                            className="w-full py-3 bg-[#0068FF] text-white rounded-xl font-semibold flex items-center justify-center gap-2 hover:bg-[#0055CC] transition-colors"
                        >
                            <MessageCircle size={20} />
                            Chia sẻ qua Zalo
                        </button>

                        <button
                            onClick={copyToClipboard}
                            className={`w-full py-3 rounded-xl font-semibold flex items-center justify-center gap-2 transition-all ${copied
                                ? 'bg-green-600 text-white'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                }`}
                        >
                            {copied ? <Check size={20} /> : <Link size={20} />}
                            {copied ? 'Đã sao chép!' : 'Sao chép nội dung'}
                        </button>

                        {typeof navigator.share !== 'undefined' && (
                            <button
                                onClick={nativeShare}
                                className="w-full py-3 bg-gradient-to-r from-pink-600 to-rose-600 text-white rounded-xl font-semibold flex items-center justify-center gap-2 hover:shadow-lg transition-all"
                            >
                                <Share2 size={20} />
                                Chia sẻ khác...
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SharePanel;
