import React, { useRef, useState, DragEvent, ChangeEvent } from 'react';
import { Upload, FileText, X, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import { extractTextFromFile, FileReadResult } from '../services/fileService';

interface FileUploadProps {
    onTextExtracted: (text: string) => void;
    onError: (error: string) => void;
}

const FileUpload: React.FC<FileUploadProps> = ({ onTextExtracted, onError }) => {
    const [isDragging, setIsDragging] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [uploadedFile, setUploadedFile] = useState<{ name: string; pageCount?: number } | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFile = async (file: File) => {
        setIsProcessing(true);
        setUploadedFile(null);

        const result: FileReadResult = await extractTextFromFile(file);

        setIsProcessing(false);

        if (result.success) {
            setUploadedFile({
                name: result.fileName || file.name,
                pageCount: result.pageCount
            });
            onTextExtracted(result.content);
        } else {
            onError(result.error || 'Đã xảy ra lỗi khi đọc file');
        }
    };

    const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setIsDragging(false);
    };

    const handleDrop = (e: DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setIsDragging(false);

        const files = e.dataTransfer.files;
        if (files.length > 0) {
            handleFile(files[0]);
        }
    };

    const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (files && files.length > 0) {
            handleFile(files[0]);
        }
    };

    const handleClick = () => {
        fileInputRef.current?.click();
    };

    const handleRemoveFile = () => {
        setUploadedFile(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    return (
        <div className="w-full">
            <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.docx"
                onChange={handleFileChange}
                className="hidden"
            />

            {uploadedFile ? (
                <div className="flex items-center justify-between p-4 bg-green-50 border-2 border-green-200 rounded-xl">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-green-100 rounded-lg">
                            <CheckCircle className="text-green-600" size={24} />
                        </div>
                        <div>
                            <p className="font-semibold text-green-800">{uploadedFile.name}</p>
                            <p className="text-sm text-green-600">
                                Đã trích xuất nội dung thành công
                                {uploadedFile.pageCount && ` (${uploadedFile.pageCount} trang)`}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={handleRemoveFile}
                        className="p-2 hover:bg-green-100 rounded-lg transition-colors"
                        title="Xóa file"
                    >
                        <X className="text-green-600" size={20} />
                    </button>
                </div>
            ) : (
                <div
                    onClick={handleClick}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    className={`
            relative flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-xl cursor-pointer transition-all
            ${isDragging
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50'
                        }
            ${isProcessing ? 'pointer-events-none opacity-70' : ''}
          `}
                >
                    {isProcessing ? (
                        <>
                            <Loader2 className="text-blue-500 animate-spin mb-3" size={40} />
                            <p className="text-gray-600 font-medium">Đang đọc file...</p>
                        </>
                    ) : (
                        <>
                            <div className={`p-3 rounded-full mb-3 ${isDragging ? 'bg-blue-100' : 'bg-gray-100'}`}>
                                <Upload className={`${isDragging ? 'text-blue-600' : 'text-gray-500'}`} size={32} />
                            </div>
                            <p className="text-gray-700 font-semibold mb-1">
                                Kéo thả file hoặc click để chọn
                            </p>
                            <p className="text-sm text-gray-500">
                                Hỗ trợ file <span className="font-medium">.pdf</span> và <span className="font-medium">.docx</span>
                            </p>
                            <div className="flex items-center gap-4 mt-4 text-xs text-gray-400">
                                <span className="flex items-center gap-1">
                                    <FileText size={14} /> Word (.docx)
                                </span>
                                <span className="flex items-center gap-1">
                                    <FileText size={14} /> PDF
                                </span>
                            </div>
                        </>
                    )}
                </div>
            )}
        </div>
    );
};

export default FileUpload;
