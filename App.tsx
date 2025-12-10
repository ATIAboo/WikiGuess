
import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { Article, GameStatus, isSymbol, ScoreRecord, AspectRatioOption, ModelOption } from './types';
import { generateAiPuzzle, fetchDailyPuzzle } from './services/api';
import { generateImage, optimizePrompt } from './services/imageGen';
import { encodePuzzle, decodePuzzle, getStoredUsername, saveScore, getScores } from './services/storage';
import ArticleRenderer from './components/ArticleRenderer';
import Controls from './components/Controls';
import GameActions from './components/GameActions';
import Leaderboard from './components/Leaderboard';
import { BookOpen, AlertCircle, Calendar, Settings, Image as ImageIcon, Loader2, Share2, Trophy, X, Save, Sparkles, Frown } from 'lucide-react';

const FALLBACK_PUZZLE: Article = {
  title: "大熊猫",
  content: "大熊猫（Giant Panda），也称熊猫，属于食肉目、熊科、大熊猫亚科、大熊猫属唯一的哺乳动物。仅有二个亚种。雄性个体稍大于雌性。体型肥硕似熊、丰腴富态，头圆尾短，头躯长1.2-1.8米，尾长10-12厘米。体重80-120千克，最重可达180千克，体色为黑白两色，脸颊圆，有很大的黑眼圈，标志性的内八字的行走方式，也有解剖刀般锋利的爪子。大熊猫皮肤厚，最厚处可达10毫米。黑白相间的外表，有利于隐蔽在密林的树上和积雪的地面而不易被天敌发现。"
};

export type FeedbackType = 'neutral' | 'success' | 'error' | 'warning' | 'info';

export interface Feedback {
  text: string;
  type: FeedbackType;
}

function App() {
  // Game State
  const [article, setArticle] = useState<Article | null>(null);
  const [guessedChars, setGuessedChars] = useState<Set<string>>(new Set());
  const [guessCount, setGuessCount] = useState(0);
  const [status, setStatus] = useState<GameStatus>(GameStatus.PLAYING);
  const [isLoading, setIsLoading] = useState(true);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  
  // Image Generation State
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null);
  const [finalPrompt, setFinalPrompt] = useState<string | null>(null);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [aspectRatio, setAspectRatio] = useState<AspectRatioOption>('1:1');
  // Default to z-image-turbo (Gitee AI)
  const [imageModel, setImageModel] = useState<ModelOption>('z-image-turbo');

  // UI State
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showGiveUpModal, setShowGiveUpModal] = useState(false);
  const [giveUpStep, setGiveUpStep] = useState(0); // Kept for potential future use or varying text, but logic simplified

  const [username, setUsername] = useState("匿名玩家");
  const [scores, setScores] = useState<ScoreRecord[]>([]);

  // Settings State 
  // Priority: Local Storage -> Env Var -> Default
  const [customBaseUrl, setCustomBaseUrl] = useState(() => 
    localStorage.getItem("wikiguess_custom_base_url") || (import.meta as any).env?.VITE_API_BASE_URL || "https://api.siliconflow.cn/v1"
  );
  const [customApiKey, setCustomApiKey] = useState(() => 
    localStorage.getItem("wikiguess_custom_api_key") || (import.meta as any).env?.VITE_API_KEY || ""
  );
  const [customModelName, setCustomModelName] = useState(() => 
    localStorage.getItem("wikiguess_custom_model_name") || (import.meta as any).env?.VITE_API_MODEL_NAME || "deepseek-ai/DeepSeek-V3"
  );
  const [hfToken, setHfToken] = useState(() => 
    localStorage.getItem("huggingFaceToken") || (import.meta as any).env?.VITE_HF_TOKEN || ""
  );
  const [giteeApiKey, setGiteeApiKey] = useState(() => 
    localStorage.getItem("gitee_ai_api_key") || (import.meta as any).env?.VITE_GITEE_AI_API_KEY || ""
  );

  // Initialize Game Logic
  const initGame = useCallback(async () => {
    setIsLoading(true);
    // Load User Data
    setUsername(getStoredUsername());
    setScores(getScores());

    // 1. Check URL for Shared Puzzle
    const params = new URLSearchParams(window.location.search);
    const sharedPuzzle = params.get('p');
    
    if (sharedPuzzle) {
        const decoded = decodePuzzle(sharedPuzzle);
        if (decoded) {
            setArticle(decoded);
            setGuessedChars(new Set());
            setGuessCount(0);
            setStatus(GameStatus.PLAYING);
            setFeedback({ text: '已加载分享的谜题', type: 'info' });
            setIsLoading(false);
            
            // Clean URL without refresh
            try {
                const newUrl = window.location.pathname;
                window.history.pushState({}, '', newUrl);
            } catch (e) {
                console.warn("Could not update URL history", e);
            }
            return;
        }
    }

    // 2. Load Daily Puzzle
    try {
        const daily = await fetchDailyPuzzle();
        setArticle(daily);
        setGuessedChars(new Set());
        setGuessCount(0);
        setStatus(GameStatus.PLAYING);
        setFeedback(null);
    } catch (e) {
        console.error("Failed to load daily puzzle, using fallback", e);
        setArticle(FALLBACK_PUZZLE);
        setFeedback({ text: '加载每日谜题失败，已加载离线题库', type: 'warning' });
    } finally {
        setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    initGame();
  }, [initGame]);

  // Derived State: Wrong Guesses
  const wrongGuesses = useMemo(() => {
    if (!article) return [];
    const articleTextLower = (article.title + article.content).toLowerCase();
    const result: string[] = [];
    guessedChars.forEach(char => {
        if (!articleTextLower.includes(char)) {
            result.push(char);
        }
    });
    return result;
  }, [article, guessedChars]);

  // Handle Guess
  const handleGuess = (char: string) => {
    if (!article || status !== GameStatus.PLAYING) return;
    
    const lowerChar = char.toLowerCase();
    
    if (guessedChars.has(lowerChar)) {
        setFeedback({ text: `"${char}" 已经猜过了`, type: 'warning' });
        return;
    }

    const newGuessed = new Set(guessedChars);
    newGuessed.add(lowerChar);
    setGuessedChars(newGuessed);
    setGuessCount(prev => prev + 1);

    const fullText = article.title + article.content;
    const isHit = fullText.toLowerCase().includes(lowerChar);

    if (isHit) {
        setFeedback({ text: `猜对了！"${char}" 在内容中`, type: 'success' });
    } else {
        setFeedback({ text: `遗憾，"${char}" 不在内容中`, type: 'error' });
    }

    // Check Win Condition
    const titleChars = article.title.split('');
    const allTitleGuessed = titleChars.every(c => {
        return isSymbol(c) || newGuessed.has(c.toLowerCase());
    });

    if (allTitleGuessed) {
        setStatus(GameStatus.WON);
        setFeedback({ text: '恭喜你！猜出了标题！', type: 'success' });
        
        // Save Score
        const record: ScoreRecord = {
            id: Date.now().toString(),
            puzzleTitle: article.title,
            attempts: guessCount + 1,
            date: new Date().toISOString(),
            username: username
        };
        saveScore(record);
        setScores(getScores());
    }
  };

  const handleGiveUpClick = () => {
    if (status === GameStatus.PLAYING) {
        setGiveUpStep(0);
        setShowGiveUpModal(true);
    }
  };

  // The "Fake" confirm that actually closes the modal
  const handleGiveUpConfirm = () => {
      setShowGiveUpModal(false);
      setGiveUpStep(0);
  };

  // The "Cancel" button that also closes the modal
  const handleGiveUpCancel = () => {
      setShowGiveUpModal(false);
      setGiveUpStep(0);
  };

  // The Secret Easter Egg Reveal (Clicking the face)
  const handleSecretReveal = () => {
      setShowGiveUpModal(false);
      setStatus(GameStatus.GAVE_UP);
      if (article) {
        setFeedback({ text: `游戏结束。答案是：${article.title}`, type: 'info' });
      }
  };

  const handleNewGame = async () => {
    if (isLoading) return;
    setIsLoading(true);
    setFeedback({ text: 'AI 正在出题中...', type: 'info' });
    setGeneratedImageUrl(null);
    setFinalPrompt(null);

    try {
        const newArticle = await generateAiPuzzle();
        setArticle(newArticle);
        setGuessedChars(new Set());
        setGuessCount(0);
        setStatus(GameStatus.PLAYING);
        setFeedback({ text: 'AI 出题成功！', type: 'success' });
    } catch (e: any) {
        console.error(e);
        let msg = 'AI 出题失败，请检查设置或重试';
        if (e.message) msg = e.message;
        
        // Auto-open settings if key is missing
        if (msg.includes("API Key is missing")) {
            setShowSettings(true);
        }
        setFeedback({ text: msg, type: 'error' });
        // Don't reset article, keep current
    } finally {
        setIsLoading(false);
    }
  };

  const handleDateSelection = async (date: string) => {
    if (isLoading) return;
    // Format YYYY-MM-DD to YYYYMMDD
    const dateStr = date.replace(/-/g, '');
    
    setIsLoading(true);
    setFeedback({ text: `正在加载 ${date} 的题目...`, type: 'info' });
    setGeneratedImageUrl(null);
    setFinalPrompt(null);

    try {
        const puzzle = await fetchDailyPuzzle(dateStr);
        setArticle(puzzle);
        setGuessedChars(new Set());
        setGuessCount(0);
        setStatus(GameStatus.PLAYING);
        setFeedback({ text: `已加载 ${date} 的题目`, type: 'success' });
    } catch (e) {
        setFeedback({ text: '获取该日期题目失败，可能当天没有数据', type: 'error' });
    } finally {
        setIsLoading(false);
    }
  }

  const handleRandomDateGame = async () => {
    if (isLoading) return;
    setIsLoading(true);
    setFeedback({ text: '正在抽取历史题目...', type: 'info' });
    setGeneratedImageUrl(null);
    setFinalPrompt(null);
    
    // Get random date from last 150 days
    const today = new Date();
    const pastDate = new Date();
    pastDate.setDate(today.getDate() - Math.floor(Math.random() * 150));
    const yyyy = pastDate.getFullYear();
    const mm = String(pastDate.getMonth() + 1).padStart(2, '0');
    const dd = String(pastDate.getDate()).padStart(2, '0');
    const dateStr = `${yyyy}${mm}${dd}`;

    try {
        const puzzle = await fetchDailyPuzzle(dateStr);
        setArticle(puzzle);
        setGuessedChars(new Set());
        setGuessCount(0);
        setStatus(GameStatus.PLAYING);
        setFeedback({ text: `已加载 ${yyyy}-${mm}-${dd} 的题目`, type: 'success' });
    } catch (e) {
        setFeedback({ text: '获取历史题目失败', type: 'error' });
    } finally {
        setIsLoading(false);
    }
  };

  const handleGenerateImage = async () => {
    if (!article) return;
    setIsGeneratingImage(true);
    setFeedback({ text: 'AI 正在构思画面...', type: 'info' });
    setFinalPrompt(null);

    try {
        // 1. Optimize Prompt (Translate to English / Abstract Style)
        // Pass a structured context for the new "Abstract Metaphor" method
        const concept = `Concept: ${article.title}. Context: ${article.content.substring(0, 200)}`;
        const optimizedPrompt = await optimizePrompt(concept);
        setFinalPrompt(optimizedPrompt);
        
        // 2. Generate
        setFeedback({ text: 'AI 正在绘制...', type: 'info' });
        // Clean prompt (remove newlines) to prevent URL issues
        const cleanPrompt = optimizedPrompt.replace(/\n/g, " ");
        
        const image = await generateImage(imageModel, cleanPrompt, aspectRatio, undefined, true);
        
        if (image && image.url) {
            setGeneratedImageUrl(image.url);
            setFeedback({ text: '图片生成成功！', type: 'success' });
        } else {
             throw new Error("Failed to get image URL");
        }
    } catch (e: any) {
        console.error("Image Gen Error", e);
        let msg = "生成图片失败，请重试";
        if (e.message && (e.message.includes("Quota") || e.message.includes("Token") || e.message.includes("API Key"))) {
             msg = e.message;
             setShowSettings(true); // Guide user to settings
        }
        setFeedback({ text: msg, type: 'error' });
    } finally {
        setIsGeneratingImage(false);
    }
  };

  const handleInputError = (msg: string) => {
      setFeedback({ text: msg, type: 'warning' });
  };

  const handleShare = async () => {
    if (!article) return;
    const code = encodePuzzle(article);
    const url = `${window.location.origin}${window.location.pathname}?p=${code}`;
    
    try {
        await navigator.clipboard.writeText(url);
        setFeedback({ text: '链接已复制！发给朋友挑战吧', type: 'success' });
    } catch (e) {
        setFeedback({ text: '复制失败，请手动复制地址栏', type: 'error' });
    }
  };

  const handleSaveSettings = () => {
    localStorage.setItem("wikiguess_custom_base_url", customBaseUrl);
    localStorage.setItem("wikiguess_custom_api_key", customApiKey);
    localStorage.setItem("wikiguess_custom_model_name", customModelName);
    localStorage.setItem("huggingFaceToken", hfToken);
    localStorage.setItem("gitee_ai_api_key", giteeApiKey);
    setShowSettings(false);
    setFeedback({ text: '设置已保存', type: 'success' });
  };

  return (
    <div className="min-h-screen bg-[#f8f9fa] flex flex-col font-sans text-gray-900 pb-10">
      
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10 shadow-sm px-4 h-14 flex items-center justify-between">
        <div className="flex items-center gap-2">
            <div className="bg-black text-white p-1.5 rounded-lg">
                <BookOpen size={20} />
            </div>
            <h1 className="font-bold text-lg tracking-tight">猜百科</h1>
        </div>
        <div className="flex items-center gap-2">
             <button onClick={handleShare} className="p-2 text-gray-600 hover:bg-gray-100 rounded-full transition-colors" title="分享题目">
                <Share2 size={20} />
            </button>
             <button onClick={() => setShowLeaderboard(true)} className="p-2 text-gray-600 hover:bg-gray-100 rounded-full transition-colors relative" title="排行榜">
                <Trophy size={20} />
                {scores.length > 0 && <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full"></span>}
            </button>
            <button onClick={() => setShowSettings(true)} className="p-2 text-gray-600 hover:bg-gray-100 rounded-full transition-colors" title="设置">
                <Settings size={20} />
            </button>
        </div>
      </header>

      <main className="flex-1 w-full max-w-3xl mx-auto p-4 flex flex-col gap-6">
        
        {/* 1. Controls (Input & Stats) */}
        <Controls 
            onGuess={handleGuess}
            guessCount={guessCount}
            status={status}
            isLoading={isLoading}
            feedback={feedback}
            onInputError={handleInputError}
        />

        {/* 2. Puzzle Article */}
        {article && (
             <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 md:p-8 min-h-[300px]">
                <ArticleRenderer 
                    text={article.title} 
                    guessedChars={guessedChars} 
                    status={status}
                    isTitle={true}
                />
                <div className="border-t border-gray-100 my-4 w-12 mx-auto"></div>
                <ArticleRenderer 
                    text={article.content} 
                    guessedChars={guessedChars} 
                    status={status}
                />
             </div>
        )}

        {/* 3. Game Action Buttons */}
        <GameActions 
            onNewGame={handleNewGame}
            onRandomGame={handleRandomDateGame}
            onGiveUp={handleGiveUpClick}
            onDateChange={handleDateSelection}
            status={status}
            isLoading={isLoading}
        />

        {/* 4. Incorrect Guesses */}
        {wrongGuesses.length > 0 && (
            <div className="bg-red-50/50 rounded-xl p-4 border border-red-100 text-center">
                <h3 className="text-xs font-bold text-red-400 uppercase tracking-wider mb-2">未命中的字</h3>
                <div className="flex flex-wrap justify-center gap-1">
                    {wrongGuesses.map((char, i) => (
                        <span key={i} className="inline-flex items-center justify-center w-6 h-6 bg-white border border-red-200 text-red-500 rounded text-sm font-medium shadow-sm">
                            {char}
                        </span>
                    ))}
                </div>
            </div>
        )}

        {/* 5. Image Generation */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
             <div className="p-4 border-b border-gray-50 flex flex-col sm:flex-row items-center justify-between gap-3 bg-gray-50/50">
                <div className="flex items-center gap-2 text-sm font-bold text-gray-700">
                    <ImageIcon size={18} className="text-purple-600" />
                    <span>AI 灵感绘图</span>
                </div>
                
                <div className="flex items-center gap-2 w-full sm:w-auto">
                     <select 
                        value={imageModel}
                        onChange={(e) => setImageModel(e.target.value as ModelOption)}
                        className="text-xs py-1.5 px-2 rounded-lg border border-gray-200 bg-white focus:ring-2 focus:ring-purple-500 outline-none"
                    >
                        <option value="z-image-turbo">Z-Image (Gitee AI)</option>
                        <option value="pollinations">Pollinations (Default)</option>
                        <option value="qwen-image-fast">Qwen Fast (HF)</option>
                    </select>

                    <select 
                        value={aspectRatio}
                        onChange={(e) => setAspectRatio(e.target.value as AspectRatioOption)}
                        className="text-xs py-1.5 px-2 rounded-lg border border-gray-200 bg-white focus:ring-2 focus:ring-purple-500 outline-none"
                    >
                        <option value="1:1">1:1 方形</option>
                        <option value="16:9">16:9 横屏</option>
                        <option value="9:16">9:16 竖屏</option>
                        <option value="4:3">4:3 标准</option>
                        <option value="3:2">3:2 经典</option>
                    </select>

                    <button 
                        onClick={handleGenerateImage}
                        disabled={isGeneratingImage || !article}
                        className="flex-1 sm:flex-none px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-lg shadow-sm transition-all disabled:opacity-50 flex items-center justify-center gap-1.5"
                    >
                        {isGeneratingImage ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                        生成
                    </button>
                </div>
             </div>
             
             <div className="min-h-[200px] flex flex-col items-center justify-center bg-gray-100/50 p-4 gap-4">
                 {generatedImageUrl ? (
                    <>
                        <div className="relative group rounded-lg overflow-hidden shadow-md max-w-full">
                            <img 
                                src={generatedImageUrl} 
                                alt="AI Generated Hint" 
                                className="max-w-full h-auto max-h-[500px] object-contain"
                                loading="lazy"
                            />
                            <a 
                                href={generatedImageUrl} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="absolute bottom-2 right-2 p-1.5 bg-black/60 text-white rounded-md opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/80"
                            >
                                <Share2 size={16} />
                            </a>
                        </div>
                        {finalPrompt && (
                            <div className="w-full max-w-lg bg-white border border-gray-200 rounded-lg p-3 text-xs text-gray-500 leading-relaxed font-mono break-words shadow-sm">
                                <span className="font-bold text-gray-700 block mb-1">Prompt:</span>
                                {finalPrompt}
                            </div>
                        )}
                    </>
                 ) : (
                    <div className="text-gray-400 text-sm flex flex-col items-center gap-2">
                        <ImageIcon size={32} className="opacity-20" />
                        <p>点击生成，获取关于谜题的抽象艺术线索</p>
                    </div>
                 )}
             </div>
        </div>

      </main>

      {/* Give Up Confirmation Modal */}
      {showGiveUpModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in">
             <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden text-center">
                <div className="p-6">
                    {/* Easter Egg Trigger: Click the face to reveal answer */}
                    <div 
                        onClick={handleSecretReveal}
                        title="点我试试？"
                        className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4 text-yellow-600 cursor-pointer hover:scale-110 active:scale-95 transition-transform duration-200 select-none"
                    >
                        <Frown size={32} />
                    </div>
                    
                    <h3 className="text-xl font-bold text-gray-900 mb-2">
                        这就放弃了？
                    </h3>
                    
                    <p className="text-gray-500 mb-6">
                        万一再猜一个字就想到了呢？百科全书在看着你！
                    </p>
                    
                    <div className="flex gap-3">
                         <button 
                            onClick={handleGiveUpCancel}
                            className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-xl font-bold hover:bg-gray-200 transition-colors"
                        >
                            我不看了
                        </button>
                        <button 
                            onClick={handleGiveUpConfirm}
                            className="flex-1 py-3 bg-red-50 text-red-600 rounded-xl font-bold hover:bg-red-100 border border-red-100 transition-colors"
                        >
                            手滑了
                        </button>
                    </div>
                </div>
             </div>
        </div>
      )}

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in">
             <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
                <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                    <h3 className="font-bold text-gray-900 flex items-center gap-2">
                        <Settings size={18} /> API 设置
                    </h3>
                    <button onClick={() => setShowSettings(false)} className="p-1 hover:bg-gray-200 rounded-full">
                        <X size={20} />
                    </button>
                </div>
                <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
                    
                    <div className="space-y-1">
                        <label className="text-xs font-bold text-gray-500 uppercase">Gitee AI API Key (用于绘图)</label>
                        <input 
                            type="password" 
                            value={giteeApiKey}
                            onChange={(e) => setGiteeApiKey(e.target.value)}
                            placeholder="sk-..."
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 outline-none"
                        />
                         <p className="text-[10px] text-gray-400">使用 z-image-turbo 模型生成图片需要此 Key。</p>
                    </div>

                    <hr className="border-gray-100" />

                    <div className="space-y-1">
                        <label className="text-xs font-bold text-gray-500 uppercase">AI 文字出题 API Key</label>
                        <input 
                            type="password" 
                            value={customApiKey}
                            onChange={(e) => setCustomApiKey(e.target.value)}
                            placeholder="sk-..."
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                    </div>
                    
                    <div className="space-y-1">
                        <label className="text-xs font-bold text-gray-500 uppercase">AI 文字出题 Base URL</label>
                        <input 
                            type="text" 
                            value={customBaseUrl}
                            onChange={(e) => setCustomBaseUrl(e.target.value)}
                            placeholder="https://api.siliconflow.cn/v1"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                    </div>

                    <div className="space-y-1">
                        <label className="text-xs font-bold text-gray-500 uppercase">AI 文字模型名称</label>
                        <input 
                            type="text" 
                            value={customModelName}
                            onChange={(e) => setCustomModelName(e.target.value)}
                            placeholder="deepseek-ai/DeepSeek-V3"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                    </div>

                    <hr className="border-gray-100" />

                    <div className="space-y-1">
                        <label className="text-xs font-bold text-gray-500 uppercase">HuggingFace Token (可选)</label>
                        <input 
                            type="password" 
                            value={hfToken}
                            onChange={(e) => setHfToken(e.target.value)}
                            placeholder="hf_..."
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-pink-500 outline-none"
                        />
                        <p className="text-[10px] text-gray-400">用于 Qwen Image Fast 等 HF Spaces 模型，增加配额。</p>
                    </div>

                </div>
                <div className="p-4 bg-gray-50 border-t border-gray-100">
                    <button 
                        onClick={handleSaveSettings}
                        className="w-full py-2 bg-gray-900 text-white rounded-xl font-bold hover:bg-gray-800 transition-colors flex items-center justify-center gap-2"
                    >
                        <Save size={16} /> 保存设置
                    </button>
                </div>
             </div>
        </div>
      )}

      {/* Leaderboard Modal */}
      <Leaderboard 
         isOpen={showLeaderboard}
         onClose={() => setShowLeaderboard(false)}
         scores={scores}
         username={username}
         onUsernameChange={setUsername}
      />
      
    </div>
  );
}

export default App;
