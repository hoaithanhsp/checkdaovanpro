export interface SKKNInput {
  title: string;
  level: string;
  subject: string;
  target: string;
  content: string;
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
