export type Difficulty = 'easy' | 'medium' | 'hard';
export type Category = 'geometry' | 'math' | 'physics' | 'biology' | 'chemistry';

export type Question = {
  id: string;
  category: Category;
  difficulty: Difficulty;
  points: number;
  question: string;
  svg?: string;
  options: [string, string, string, string, string];
  correctIndex: number;
  solution: string;
};

export type CategoryInfo = {
  id: Category;
  label: string;
  icon: string;
  color: string;
  bgColor: string;
  ringColor: string;
};

export const CATEGORIES: CategoryInfo[] = [
  { id: 'geometry', label: 'Geometry', icon: '△', color: 'text-blue-700', bgColor: 'bg-blue-100', ringColor: 'ring-blue-300' },
  { id: 'math', label: 'Mathematics', icon: 'Σ', color: 'text-purple-700', bgColor: 'bg-purple-100', ringColor: 'ring-purple-300' },
  { id: 'physics', label: 'Physics', icon: '⚛', color: 'text-amber-700', bgColor: 'bg-amber-100', ringColor: 'ring-amber-300' },
  { id: 'biology', label: 'Biology', icon: '🧬', color: 'text-emerald-700', bgColor: 'bg-emerald-100', ringColor: 'ring-emerald-300' },
  { id: 'chemistry', label: 'Chemistry', icon: '⚗', color: 'text-red-700', bgColor: 'bg-red-100', ringColor: 'ring-red-300' },
];

export const DIFFICULTY_COLORS: Record<Difficulty, string> = {
  easy: 'bg-emerald-100 text-emerald-700 ring-emerald-300',
  medium: 'bg-amber-100 text-amber-700 ring-amber-300',
  hard: 'bg-red-100 text-red-700 ring-red-300',
};

// Achievement thresholds (% of max possible points per category)
// Max per category = 8×10 + 7×20 + 5×30 = 370
export const MAX_POINTS_PER_CATEGORY = 370;
export const ACHIEVEMENTS = [
  { level: 0, name: 'Initiation', threshold: 0, label: 'Complete first quiz' },
  { level: 1, name: 'Bronze', threshold: 0.25, label: '25% mastery' },
  { level: 2, name: 'Silver', threshold: 0.50, label: '50% mastery' },
  { level: 3, name: 'Gold', threshold: 0.75, label: '75% mastery' },
  { level: 4, name: 'Diamond', threshold: 1.0, label: '100% mastery' },
];

export type CategoryProgress = {
  totalPoints: number;
  questionsAnswered: string[];
  achievementLevel: number; // 0-4
  quizzesTaken: number;
};
