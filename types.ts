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

export interface SKKNStructure {
  hasIntro: boolean;
  hasTheory: boolean;
  hasReality: boolean;
  hasSolution: boolean;
  hasResult: boolean;
  hasConclusion: boolean;
  missing: string[];
}

export interface QualityCriterion {
  criteria: string;
  score: number;
  comment: string;
}

export interface AIRiskDetails {
  perplexityScore: number;
  burstinessScore: number;
  patternDensity: number;
  overallAIPercent: number;
  suspiciousPatterns: string[];
  recommendations: string[];
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
  structure?: SKKNStructure;
  qualityCriteria?: QualityCriterion[];
  aiRiskScore?: number;
  aiRiskLevel?: string;
  aiRiskDetails?: AIRiskDetails;
  usedModel?: string;
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

// ========== IMPROVEMENT ANALYSIS TYPES ==========

export interface ImprovementCriterion {
  criteriaId: string;
  criteriaName: string;
  score: number;
  maxScore: number;
  status: 'excellent' | 'good' | 'average' | 'weak' | 'critical';
  feedback: string;
}

export interface ImprovementSolution {
  solutionId: string;
  solutionType: 'rewrite' | 'add' | 'fix' | 'enhance';
  actionType: string;
  targetSection: string;
  exampleContent: string;
  estimatedTime: string;
  difficulty: 'low' | 'medium' | 'high';
  impactScore: number;
}

export interface DetectedIssue {
  issueId: string;
  issueCode: string;
  issueName: string;
  criteriaId: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  priority: number;
  description: string;
  solutions: ImprovementSolution[];
}

export interface ImprovementRoadmapItem {
  issue: DetectedIssue;
  estimatedTime: string;
  impact: number;
}

export interface ImprovementRoadmap {
  urgent: ImprovementRoadmapItem[];
  high: ImprovementRoadmapItem[];
  medium: ImprovementRoadmapItem[];
  low: ImprovementRoadmapItem[];
}

export interface ImprovementAnalysisResult {
  totalScore: number;
  maxScore: number;
  rating: string;
  colorCode: string;
  criteria: ImprovementCriterion[];
  detectedIssues: DetectedIssue[];
  roadmap: ImprovementRoadmap;
  estimatedScoreAfterFix: number;
  recommendation: string;
}

export interface ImprovementFixChange {
  issueId: string;
  issueName: string;
  actionType: string;
  targetSection: string;
  original: string;
  fixed: string;
  type: 'rewrite' | 'add' | 'fix' | 'enhance';
}

export interface AutoImprovementFixResult {
  fixedContent: string;
  changes: ImprovementFixChange[];
  summary: {
    sectionsRewritten: number;
    sectionsAdded: number;
    errorsFixed: number;
    totalChanges: number;
  };
  newEstimatedScore: number;
}

// ========== AI REDUCTION ==========

export interface AIReductionChange {
  technique: 'sentence_restructure' | 'lexical_diversify' | 'syntactic_variation' | 'density_adjust' | 'micro_variation';
  techniqueName: string;
  original: string;
  fixed: string;
  reason: string;
}

// ========== AI VERIFICATION & CONFIDENCE ==========

/**
 * Kết quả quick AI detection (dùng cùng tiêu chí với analyzeSKKN)
 */
export interface QuickAIDetectionResult {
  aiRiskScore: number;
  perplexityScore: number;
  burstinessScore: number;
  patternDensity: number;
  overallAIPercent: number;
}

export interface AIReductionResult {
  fixedContent: string;
  changes: AIReductionChange[];
  stats: {
    sentencesRestructured: number;
    wordsReplaced: number;
    patternsRemoved: number;
    syntacticChanges: number;
    microVariations: number;
  };
  beforeMetrics: {
    aiScore: number;
    perplexity: number;
    burstiness: number;
    patternDensity: number;
  };
  afterMetrics: {
    estimatedAIScore: number;
    estimatedPerplexity: number;
    estimatedBurstiness: number;
    estimatedPatternDensity: number;
    /** true nếu afterMetrics đã được verify bằng quickAIDetection */
    verified: boolean;
  };
  /** Số lần đã retry để đảm bảo score giảm */
  retryCount?: number;
  /** Cảnh báo nếu không giảm được score sau N lần retry */
  verificationWarning?: string;
}
