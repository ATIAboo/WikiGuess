

export interface Article {
  title: string;
  content: string;
}

export enum GameStatus {
  PLAYING,
  WON,
  GAVE_UP
}

export interface GameState {
  article: Article | null;
  guessedChars: Set<string>;
  guessCount: number;
  status: GameStatus;
  isLoading: boolean;
  error: string | null;
  lastGuessedChar: string | null;
}

export interface ScoreRecord {
  id: string;
  puzzleTitle: string;
  attempts: number;
  date: string;
  username: string;
}

export type AspectRatioOption = "1:1" | "16:9" | "9:16" | "4:3" | "3:4" | "3:2" | "2:3" | "5:4" | "4:5";
export type ModelOption = "z-image-turbo" | "qwen-image-fast";

export interface GeneratedImage {
  id: string;
  url: string;
  model: string;
  prompt: string;
  aspectRatio: AspectRatioOption;
  timestamp: number;
  seed: number;
}

// Helper to check if a character is a punctuation or symbol that should be revealed by default.
// Alphanumeric characters (0-9, a-z) are now treated as hidden characters to be guessed.
export const isSymbol = (char: string): boolean => {
  // Regex includes standard punctuation and CJK punctuation/symbols. 
  // Excludes 0-9 and a-z/A-Z so they are hidden.
  const symbols = /[ \t\n`!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~！@#￥%……&*（）——+|{}【】‘；：”“’。，、？《》]/;
  return symbols.test(char) || char.trim() === '';
};