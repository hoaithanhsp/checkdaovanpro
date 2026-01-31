export interface SKKNInput {
  title: string;
  level: string;
  subject: string;
  target: string;
  content: string;
  originalDocx?: OriginalDocxFile; // File Word gốc cho XML Injection
}

/**
 * File Word gốc để sử dụng trong XML Injection
 * Bảo toàn OLE Objects (MathType, hình vẽ)
 */
export interface OriginalDocxFile {
  arrayBuffer: ArrayBuffer;
  fileName: string;
}

export enum AnalysisStatus {
  IDLE = 'IDLE',
  LOADING = 'LOADING',
  SUCCESS = 'SUCCESS',
  ERROR = 'ERROR'
}

export interface SpellingError {
  line: string;
  error: string;
  correction: string;
  type: string;
}

export interface PlagiarismSegment {
  segment: string;
  source: string;
  similarity: number;
  violatedRule?: string;
  advice: string;
}

export interface ScoreDetail {
  category: string;
  strength: string;
  weakness: string;
}

export interface DevelopmentPlan {
  shortTerm: string[];
  mediumTerm: string[];
  longTerm: string[];
}

export interface Scores {
  innovation: number;
  feasibility: number;
  scientific: number;
  presentation: number;
  total: number;
}

export interface AnalysisResult {
  duplicateLevel: string;
  duplicateDetails: string;
  spellingErrors: SpellingError[];
  plagiarismRisk: string;
  plagiarismSegments: PlagiarismSegment[];
  scores: Scores;
  scoreDetails: ScoreDetail[];
  developmentPlan: DevelopmentPlan;
  overallConclusion: string;
}

/**
 * Kết quả phân tích tên đề tài SKKN
 */
export interface TitleAnalysisResult {
  structure: {
    action: string;      // Hành động (Ứng dụng, Thiết kế...)
    tool: string;        // Công cụ (AI Gemini, Kahoot...)
    subject: string;     // Môn học/Lĩnh vực
    scope: string;       // Phạm vi (lớp, cấp học)
    purpose: string;     // Mục đích
  };
  duplicateLevel: 'Cao' | 'Trung bình' | 'Thấp';
  duplicateDetails: string;
  scores: {
    specificity: number;   // Độ cụ thể (max 25)
    novelty: number;       // Tính mới (max 30)
    feasibility: number;   // Tính khả thi (max 25)
    clarity: number;       // Độ rõ ràng (max 20)
    total: number;         // Tổng điểm (max 100)
  };
  scoreDetails: Array<{
    category: string;
    score: number;
    maxScore: number;
    reason: string;
  }>;
  problems: string[];
  suggestions: Array<{
    title: string;
    strength: string;
    predictedScore: number;
  }>;
  relatedTopics: string[];
  overallVerdict: string;
}
