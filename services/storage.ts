import { ScoreRecord, Article } from "../types";

const STORAGE_KEY_SCORES = 'wikiguess_scores_v1';
const STORAGE_KEY_USERNAME = 'wikiguess_username';

// --- Encoding for URL Sharing ---

export const encodePuzzle = (article: Article): string => {
  try {
    const jsonStr = JSON.stringify(article);
    // Use TextEncoder to handle UTF-8 characters correctly before Base64
    const bytes = new TextEncoder().encode(jsonStr);
    const binString = Array.from(bytes, (byte) => String.fromCharCode(byte)).join("");
    return btoa(binString);
  } catch (e) {
    console.error("Failed to encode puzzle", e);
    return "";
  }
};

export const decodePuzzle = (base64Str: string): Article | null => {
  try {
    const binString = atob(base64Str);
    const bytes = Uint8Array.from(binString, (c) => c.charCodeAt(0));
    const jsonStr = new TextDecoder().decode(bytes);
    return JSON.parse(jsonStr) as Article;
  } catch (e) {
    console.error("Failed to decode puzzle", e);
    return null;
  }
};

// --- Local Storage Management ---

export const getStoredUsername = (): string => {
  return localStorage.getItem(STORAGE_KEY_USERNAME) || "匿名玩家";
};

export const setStoredUsername = (name: string) => {
  localStorage.setItem(STORAGE_KEY_USERNAME, name);
};

export const saveScore = (record: ScoreRecord) => {
  const existing = getScores();
  const updated = [record, ...existing].slice(0, 50); // Keep last 50
  localStorage.setItem(STORAGE_KEY_SCORES, JSON.stringify(updated));
};

export const getScores = (): ScoreRecord[] => {
  try {
    const data = localStorage.getItem(STORAGE_KEY_SCORES);
    return data ? JSON.parse(data) : [];
  } catch (e) {
    return [];
  }
};
