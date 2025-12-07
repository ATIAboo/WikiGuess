
import React from 'react';
import { Sparkles, Eye, Shuffle } from 'lucide-react';
import { GameStatus } from '../types';

interface GameActionsProps {
  onNewGame: () => void;
  onRandomGame: () => void;
  onGiveUp: () => void;
  status: GameStatus;
  isLoading: boolean;
}

const GameActions: React.FC<GameActionsProps> = ({
  onNewGame,
  onRandomGame,
  onGiveUp,
  status,
  isLoading
}) => {
  return (
    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3 w-full mt-2">
       <button
            onClick={onGiveUp}
            disabled={status !== GameStatus.PLAYING}
            className="flex-1 sm:flex-none px-4 py-3 text-sm font-medium text-gray-600 bg-white border border-gray-200 hover:bg-red-50 hover:text-red-600 hover:border-red-200 rounded-xl transition-all flex items-center justify-center gap-2 shadow-sm disabled:opacity-50"
        >
            <Eye size={16} />
            <span>看答案</span>
        </button>

        <button
            onClick={onRandomGame}
            disabled={isLoading}
            className="flex-1 sm:flex-none px-4 py-3 text-sm font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-100 rounded-xl transition-all disabled:opacity-70 active:scale-95 flex items-center justify-center gap-2 shadow-sm"
        >
            <Shuffle size={16} />
            <span>随机题</span>
        </button>

        <button
            onClick={onNewGame}
            disabled={isLoading}
            className="flex-1 sm:flex-none px-4 py-3 text-sm font-medium text-white bg-gray-900 hover:bg-gray-800 rounded-xl shadow-md transition-all disabled:opacity-70 active:scale-95 flex items-center justify-center gap-2"
        >
            {isLoading ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
                <Sparkles size={16} />
            )}
            <span>AI出题</span>
        </button>
    </div>
  );
};

export default GameActions;
