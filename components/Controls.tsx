import React, { useState, useRef } from 'react';
import { Sparkles, Eye, Send, AlertCircle, AlertTriangle, Info, Trophy, Share2 } from 'lucide-react';
import { GameStatus } from '../types';
import { Feedback } from '../App';

interface ControlsProps {
  onGuess: (char: string) => void;
  onNewGame: () => void;
  onGiveUp: () => void;
  onShowLeaderboard: () => void;
  onShare: () => void;
  guessCount: number;
  status: GameStatus;
  isLoading: boolean;
  feedback: Feedback | null;
}

const Controls: React.FC<ControlsProps> = ({ 
  onGuess, 
  onNewGame, 
  onGiveUp, 
  onShowLeaderboard,
  onShare,
  guessCount, 
  status,
  isLoading,
  feedback
}) => {
  const [inputValue, setInputValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!inputValue.trim()) return;
    
    const chars = inputValue.split('');
    chars.forEach(c => onGuess(c));
    
    setInputValue('');
    // Keep focus for fast typing
    inputRef.current?.focus();
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-xl border-t border-gray-200 p-4 shadow-[0_-4px_20px_rgba(0,0,0,0.05)] z-50">
      <div className="max-w-3xl mx-auto space-y-4">
        
        {/* Status Message */}
        <div className="h-8 flex justify-center items-center text-sm font-medium transition-all">
             {feedback ? (
                <span className={`flex items-center gap-2 px-4 py-1.5 rounded-full border shadow-sm animate-in fade-in slide-in-from-bottom-2 duration-300 ${
                    feedback.type === 'success' ? 'bg-green-50 text-green-700 border-green-200' :
                    feedback.type === 'error' ? 'bg-red-50 text-red-700 border-red-200' :
                    feedback.type === 'warning' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                    feedback.type === 'info' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                    'bg-gray-100 text-gray-700 border-gray-200'
                }`}>
                  {feedback.type === 'success' && <Sparkles size={14} />}
                  {feedback.type === 'error' && <AlertCircle size={14} />}
                  {feedback.type === 'warning' && <AlertTriangle size={14} />}
                  {feedback.type === 'info' && <Info size={14} />}
                  {feedback.text}
                </span>
             ) : (
                <span className="text-gray-400 flex items-center gap-2">
                   <Info size={14}/> 请输入一个字开始猜测
                </span>
             )}
        </div>

        {/* Input Area */}
        <form onSubmit={handleSubmit} className="flex gap-2 relative">
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            disabled={status !== GameStatus.PLAYING || isLoading}
            placeholder={status === GameStatus.PLAYING ? "输入一个字 (例如: 水)" : "游戏结束"}
            className="flex-1 px-4 py-3 rounded-xl border border-gray-300 bg-gray-50 shadow-inner focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-lg transition-all disabled:opacity-60"
            autoFocus
          />
          <button
            type="submit"
            disabled={!inputValue.trim() || status !== GameStatus.PLAYING}
            className="px-6 py-2 bg-gray-900 text-white rounded-xl font-bold shadow-lg shadow-gray-200 hover:bg-gray-800 hover:shadow-xl disabled:opacity-50 disabled:shadow-none active:scale-95 transition-all flex items-center gap-2"
          >
            <Send size={18} />
            <span className="hidden sm:inline">猜一猜</span>
          </button>
        </form>

        {/* Action Buttons */}
        <div className="flex justify-between items-center pt-1 px-1">
            <div className="flex items-center gap-3">
                 <button 
                    onClick={onShowLeaderboard}
                    className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors relative group"
                    title="排行榜"
                >
                    <Trophy size={20} />
                    <span className="absolute -top-8 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                        排行榜
                    </span>
                </button>
                <button 
                    onClick={onShare}
                    className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors relative group"
                    title="分享题目"
                >
                    <Share2 size={20} />
                    <span className="absolute -top-8 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                        分享题目
                    </span>
                </button>
                <div className="text-gray-500 text-sm font-medium border-l border-gray-200 pl-3 ml-1">
                    猜测: <span className="font-bold text-gray-900 text-lg ml-1">{guessCount}</span>
                </div>
            </div>

            <div className="flex gap-2">
                 <button 
                    onClick={onGiveUp}
                    disabled={status !== GameStatus.PLAYING}
                    className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600 bg-white hover:bg-red-50 hover:text-red-600 hover:border-red-200 rounded-lg border border-gray-200 transition-all disabled:opacity-50"
                >
                    <Eye size={16} />
                    <span className="hidden sm:inline">看答案</span>
                </button>
                
                <button 
                    onClick={onNewGame}
                    disabled={isLoading}
                    className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-md shadow-blue-100 transition-all disabled:opacity-70 active:scale-95"
                >
                    {isLoading ? (
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                        <Sparkles size={16} />
                    )}
                    <span>AI 出题</span>
                </button>
            </div>
        </div>
      </div>
    </div>
  );
};

export default Controls;