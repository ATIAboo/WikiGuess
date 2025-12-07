
import React, { useState, useRef } from 'react';
import { Send, AlertCircle, AlertTriangle, Info, Sparkles } from 'lucide-react';
import { GameStatus } from '../types';
import { Feedback } from '../App';

interface ControlsProps {
  onGuess: (char: string) => void;
  guessCount: number;
  status: GameStatus;
  isLoading: boolean;
  feedback: Feedback | null;
  onInputError?: (msg: string) => void;
}

const Controls: React.FC<ControlsProps> = ({ 
  onGuess, 
  guessCount, 
  status,
  isLoading,
  feedback,
  onInputError
}) => {
  const [inputValue, setInputValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!inputValue.trim()) return;

    if (inputValue.trim().length > 1) {
       onInputError?.("每次只能输入一个字哦");
       setInputValue('');
       return;
    }
    
    const chars = inputValue.split('');
    chars.forEach(c => onGuess(c));
    
    setInputValue('');
    inputRef.current?.focus();
  };

  return (
    <div className="w-full bg-white rounded-2xl shadow-sm border border-gray-100 p-4 space-y-3">
        
        {/* Status Message */}
        <div className="h-6 flex justify-center items-center text-xs sm:text-sm font-medium transition-all">
             {feedback ? (
                <span className={`flex items-center gap-1.5 px-3 py-1 rounded-full border shadow-sm animate-in fade-in slide-in-from-bottom-1 duration-300 ${
                    feedback.type === 'success' ? 'bg-green-50 text-green-700 border-green-200' :
                    feedback.type === 'error' ? 'bg-red-50 text-red-700 border-red-200' :
                    feedback.type === 'warning' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                    feedback.type === 'info' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                    'bg-gray-100 text-gray-700 border-gray-200'
                }`}>
                  {feedback.type === 'success' && <Sparkles size={12} />}
                  {feedback.type === 'error' && <AlertCircle size={12} />}
                  {feedback.type === 'warning' && <AlertTriangle size={12} />}
                  {feedback.type === 'info' && <Info size={12} />}
                  {feedback.text}
                </span>
             ) : (
                <span className="text-gray-400 flex items-center gap-2">
                   <Info size={12}/> 请输入一个字开始猜测
                </span>
             )}
        </div>

        {/* Input Area */}
        <div className="flex gap-2">
          <form onSubmit={handleSubmit} className="flex-1 flex gap-2 relative">
             <input
                ref={inputRef}
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                disabled={status !== GameStatus.PLAYING || isLoading}
                placeholder={status === GameStatus.PLAYING ? "输入一个字" : "游戏结束"}
                className="flex-1 px-4 py-3 rounded-xl border border-gray-300 bg-gray-50 shadow-inner focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-lg text-center transition-all disabled:opacity-60"
                autoComplete="off"
            />
             <button
                type="submit"
                disabled={!inputValue.trim() || status !== GameStatus.PLAYING}
                className="px-5 py-2 bg-gray-900 text-white rounded-xl font-bold shadow-md hover:bg-gray-800 disabled:opacity-50 disabled:shadow-none active:scale-95 transition-all flex items-center justify-center min-w-[50px]"
            >
                <Send size={20} />
            </button>
          </form>

          {/* Compact Stats */}
          <div className="flex items-center justify-center px-3 bg-gray-50 rounded-xl border border-gray-100 min-w-[70px]">
                <div className="flex flex-col items-center leading-none">
                    <span className="font-bold text-lg text-gray-900">{guessCount}</span>
                    <span className="text-[10px] text-gray-400 uppercase">次数</span>
                </div>
           </div>
        </div>
    </div>
  );
};

export default Controls;
