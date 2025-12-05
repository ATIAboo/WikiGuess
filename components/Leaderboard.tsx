import React, { useState } from 'react';
import { X, Trophy, User } from 'lucide-react';
import { ScoreRecord } from '../types';
import { setStoredUsername } from '../services/storage';

interface LeaderboardProps {
  isOpen: boolean;
  onClose: () => void;
  scores: ScoreRecord[];
  username: string;
  onUsernameChange: (name: string) => void;
}

const Leaderboard: React.FC<LeaderboardProps> = ({ 
  isOpen, 
  onClose, 
  scores,
  username,
  onUsernameChange
}) => {
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState(username);

  if (!isOpen) return null;

  const handleSaveName = () => {
    if (tempName.trim()) {
        onUsernameChange(tempName.trim());
        setStoredUsername(tempName.trim());
        setIsEditingName(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[80vh]">
        
        {/* Header */}
        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
          <div className="flex items-center gap-2 text-gray-900 font-bold text-xl">
             <div className="bg-yellow-100 p-2 rounded-lg text-yellow-600">
                <Trophy size={20} />
             </div>
             排行榜 / 历史记录
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        {/* User Profile Section */}
        <div className="p-4 bg-blue-50 border-b border-blue-100 flex items-center justify-between">
            <div className="flex items-center gap-3">
                <div className="bg-blue-200 p-2 rounded-full text-blue-700">
                    <User size={18} />
                </div>
                {isEditingName ? (
                    <div className="flex gap-2">
                        <input 
                            className="px-2 py-1 rounded border border-blue-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            value={tempName}
                            onChange={(e) => setTempName(e.target.value)}
                            autoFocus
                        />
                        <button onClick={handleSaveName} className="text-xs bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700">
                            保存
                        </button>
                    </div>
                ) : (
                    <div className="flex flex-col">
                        <span className="text-xs text-blue-600 font-semibold uppercase tracking-wide">当前玩家</span>
                        <span className="font-bold text-gray-800">{username}</span>
                    </div>
                )}
            </div>
            {!isEditingName && (
                <button 
                    onClick={() => setIsEditingName(true)}
                    className="text-xs text-blue-600 underline hover:text-blue-800"
                >
                    修改名字
                </button>
            )}
        </div>

        {/* Scores List */}
        <div className="flex-1 overflow-y-auto p-0">
            {scores.length === 0 ? (
                <div className="p-8 text-center text-gray-400 flex flex-col items-center">
                    <Trophy size={48} className="mb-4 opacity-20" />
                    <p>暂无记录</p>
                    <p className="text-sm mt-2">猜对谜题后记录会自动出现在这里</p>
                </div>
            ) : (
                <table className="w-full text-sm text-left">
                    <thead className="bg-gray-50 text-gray-500 font-medium sticky top-0">
                        <tr>
                            <th className="px-6 py-3">题目</th>
                            <th className="px-6 py-3 text-center">猜测次数</th>
                            <th className="px-6 py-3 text-right">时间</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {scores.map((score) => (
                            <tr key={score.id} className="hover:bg-gray-50 transition-colors">
                                <td className="px-6 py-4 font-medium text-gray-900">
                                    {score.puzzleTitle}
                                    <div className="text-xs text-gray-400 font-normal">{score.username}</div>
                                </td>
                                <td className="px-6 py-4 text-center">
                                    <span className={`inline-block px-2 py-1 rounded text-xs font-bold ${
                                        score.attempts < 10 ? 'bg-green-100 text-green-700' : 
                                        score.attempts < 20 ? 'bg-yellow-100 text-yellow-700' : 
                                        'bg-gray-100 text-gray-700'
                                    }`}>
                                        {score.attempts}
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-right text-gray-500 text-xs">
                                    {new Date(score.date).toLocaleDateString()}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
        </div>

        <div className="p-4 border-t border-gray-100 bg-gray-50 text-xs text-gray-500 text-center">
             记录仅保存在本地浏览器中
        </div>
      </div>
    </div>
  );
};

export default Leaderboard;
