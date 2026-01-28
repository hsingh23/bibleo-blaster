export interface CitationReview {
  originalText: string;
  status: 'correct' | 'incorrect';
  correction?: string;
  feedback: string; // A short, fun explanation
  emoji: string; // A reaction emoji
  primaryAuthor?: string; // Extracted last name for checking against body text
  foundInText?: boolean; // Client-side computed flag
  section?: 'bibliography' | 'footnote'; // identifying where this came from
}

export interface AnalysisResult {
  overallScore: number;
  bibliographyReviews: CitationReview[];
  footnoteReviews: CitationReview[];
  summaryMessage: string;
}

export enum AppStatus {
  IDLE = 'IDLE',
  READING_IMAGE = 'READING_IMAGE', // OCR step
  ANALYZING_TEXT = 'ANALYZING_TEXT', // Client side regex work
  FETCHING_AI = 'FETCHING_AI', // Waiting for Gemini
  COMPLETE = 'COMPLETE',
  ERROR = 'ERROR'
}