export interface Point {
  x: number;
  y: number;
  z: number;
}

export interface Landmark {
  x: number;
  y: number;
  z: number;
}

export type GestureType = "alphabet" | "number" | "word" | "emergency";

export interface StaticGesture {
  name: string;
  type: GestureType;
  description: string;
}

export interface CustomGestureTemplate {
  id: string;
  name: string;
  landmarks: Landmark[]; // vector of 21 core hand landmark positions
  recordedAt: number;
}

export interface TranslationHistoryItem {
  id: string;
  rawInput: string;
  correctedText: string;
  originalGestureChain: string[];
  confidence: number;
  emotion: string;
  language: string;
  timestamp: number;
  context: string;
  isEmergency: boolean;
}

export interface QuizQuestion {
  id: string;
  prompt: string; // e.g. "Pose the alphabet 'A'" or "Choose the correct gesture for 'HELP'"
  type: "pose" | "multiple-choice";
  targetGesture: string; // "A", "SOS", etc.
  options?: string[]; // for multiple choice
  correctAnswer?: string;
}

export interface LearningLesson {
  id: string;
  title: string;
  category: "alphabets" | "numbers" | "common-words" | "emergency";
  duration: string;
  difficulty: "Beginner" | "Intermediate" | "Advanced";
  gestures: string[];
  description: string;
}

export interface UserStats {
  sessionsCreated: number;
  gesturesTranslatedCount: number;
  correctlyLearnedCount: number;
  accuracyRate: number; // percentage
  dailyDistribution: { date: string; count: number }[];
  categoryDistribution: { name: string; value: number }[];
}

export interface SavedHistory {
  items: TranslationHistoryItem[];
  customGestures: CustomGestureTemplate[];
}
