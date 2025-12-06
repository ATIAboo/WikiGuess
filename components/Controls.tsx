
import React, { useState, useRef } from 'react';
import { Sparkles, Eye, Send, AlertCircle, AlertTriangle, Info, Shuffle } from 'lucide-react';
import { GameStatus } from '../types';
import { Feedback } from '../App';

interface ControlsProps {
  onGuess: (char: string) => void;
  onNewGame: () => void;
  onRandomGame: () => void;
  onGiveUp: () => void;
  guessCount: number;
  status: GameStatus;
  isLoading: boolean;
  feedback: Feedback | null;
}

const Controls: React.FC<ControlsProps> = ({ 
  onGuess, 
  onNewGame, 
  onRandomGame,
  onGiveUp, 
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
    inputRef.current?.focus();
  };

  return (
    <div className="w-full bg-white rounded-2xl shadow-sm border border-gray-100 p-4 space-y-4">
        
        {/* Status Message */}
        <div className="h-8 flex justify-center items-center text-sm font-medium transition-all">
             {feedback ? (
                <span className={`flex items-center gap-2 px-4 py-1.5 rounded-full border shadow-sm animate-in fade-in slide-in-from-bottom-1 duration-300 ${
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
        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            disabled={status !== GameStatus.PLAYING || isLoading}
            placeholder={status === GameStatus.PLAYING ? "输入一个字 (例如: 水)" : "游戏结束"}
            className="flex-1 px-4 py-3 rounded-xl border border-gray-300 bg-gray-50 shadow-inner focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-lg transition-all disabled:opacity-60"
            autoComplete="off"
          />
          <button
            type="submit"
            disabled={!inputValue.trim() || status !== GameStatus.PLAYING}
            className="px-5 py-2 bg-gray-900 text-white rounded-xl font-bold shadow-md hover:bg-gray-800 disabled:opacity-50 disabled:shadow-none active:scale-95 transition-all flex items-center justify-center min-w-[60px]"
          >
            <Send size={20} />
          </button>
        </form>

        <div className="h-px bg-gray-100 w-full" />

        {/* Control Buttons Grid */}
        <div className="flex flex-col-reverse sm:flex-row sm:items-center justify-between gap-3">
            
            {/* Stats */}
            <div className="flex items-center justify-center sm:justify-start p-2 bg-gray-50 rounded-xl">
                 <div className="flex items-center gap-1.5 text-gray-900 px-2">
                    <span className="text-xs text-gray-500">已猜测</span>
                    <span className="font-bold text-lg leading-none">{guessCount}</span>
                    <span className="text-xs text-gray-500">次</span>
                </div>
            </div>

            {/* Game Actions */}
            <div className="flex items-center justify-end gap-2 flex-1">
                 <button 
                    onClick={onGiveUp}
                    disabled={status !== GameStatus.PLAYING}
                    className="p-3 text-gray-500 bg-gray-50 hover:bg-red-50 hover:text-red-600 rounded-xl transition-colors"
                    title="看答案"
                >
                    <Eye size={20} />
                </button>

                <button 
                    onClick={onRandomGame}
                    disabled={isLoading}
                    className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-3 text-sm font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-xl transition-all disabled:opacity-70 active:scale-95"
                >
                    <Shuffle size={16} />
                    <span>随机题</span>
                </button>

                <button 
                    onClick={onNewGame}
                    disabled={isLoading}
                    className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-3 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-md shadow-blue-100 transition-all disabled:opacity-70 active:scale-95"
                >
                    {isLoading ? (
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                        <Sparkles size={16} />
                    )}
                    <span>AI出题</span>
                </button>
            </div>
        </div>
    </div>
  );
};

export default Controls;
