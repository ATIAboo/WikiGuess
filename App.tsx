
import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { Article, GameStatus, isSymbol, ScoreRecord, AspectRatioOption, ModelOption } from './types';
import { generateAiPuzzle, fetchDailyPuzzle } from './services/api';
import { generateImage, optimizePrompt } from './services/imageGen';
import { encodePuzzle, decodePuzzle, getStoredUsername, saveScore, getScores } from './services/storage';
import ArticleRenderer from './components/ArticleRenderer';
import Controls from './components/Controls';
import GameActions from './components/GameActions';
import Leaderboard from './components/Leaderboard';
import { BookOpen, AlertCircle, Calendar, Settings, Image as ImageIcon, Loader2, Share2, Trophy } from 'lucide-react';

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
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [aspectRatio, setAspectRatio] = useState<AspectRatioOption>('1:1');
  // Default to Pollinations
  const [imageModel, setImageModel] = useState<ModelOption>('pollinations');

  // UI State
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
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
            setFeedback({ text: "已加载分享的谜题，开始挑战吧！", type: 'info' });
            setIsLoading(false);
            return;
        }
    }

    // 2. Try Fetching Daily Puzzle
    try {
        setFeedback({ text: "正在获取今日题目...", type: 'neutral' });
        const daily = await fetchDailyPuzzle();
        setArticle(daily);
        setFeedback({ text: "今日百科挑战", type: 'info' });
    } catch (e) {
        console.error("Failed to load daily puzzle, using fallback", e);
        setArticle(FALLBACK_PUZZLE);
        setFeedback({ text: "每日题目加载失败，已加载默认题目", type: 'warning' });
    } finally {
        setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    initGame();
  }, [initGame]);

  // Update scores when modal opens
  useEffect(() => {
     if (showLeaderboard) {
         setScores(getScores());
     }
  }, [showLeaderboard]);

  // Derive wrong guesses for display
  const wrongGuesses = useMemo(() => {
    if (!article) return [];
    return Array.from(guessedChars).filter(char => {
       const lowerChar = char.toLowerCase();
       const titleLower = article.title.toLowerCase();
       const contentLower = article.content.toLowerCase();
       return !titleLower.includes(lowerChar) && !contentLower.includes(lowerChar);
    });
  }, [guessedChars, article]);

  const resetGame = (newArticle: Article) => {
    setArticle(newArticle);
    setGuessedChars(new Set());
    setGuessCount(0);
    setStatus(GameStatus.PLAYING);
    setFeedback(null);
    setGeneratedImageUrl(null); // Reset image
    
    // Clear URL params safely
    try {
        const url = new URL(window.location.href);
        url.search = '';
        window.history.pushState({}, '', url.toString());
    } catch (e) {
        console.warn("Failed to update URL history:", e);
    }
  };

  const checkWinCondition = (currentGuessed: Set<string>, currentArticle: Article, currentCount: number) => {
    const titleChars = currentArticle.title.split('');
    const allTitleRevealed = titleChars.every(char => 
      isSymbol(char) || currentGuessed.has(char.toLowerCase())
    );

    if (allTitleRevealed) {
      setStatus(GameStatus.WON);
      setFeedback({ text: `🎉 恭喜！你猜对了：${currentArticle.title}`, type: 'success' });
      
      // Save Score
      const newScore: ScoreRecord = {
          id: Date.now().toString(),
          puzzleTitle: currentArticle.title,
          attempts: currentCount,
          date: new Date().toISOString(),
          username: username
      };
      saveScore(newScore);
      setScores(prev => [newScore, ...prev]);
      
      setTimeout(() => setShowLeaderboard(true), 1500);
    }
  };

  const handleInputError = (msg: string) => {
      setFeedback({ text: msg, type: 'warning' });
  };

  const handleGuess = useCallback((char: string) => {
    if (status !== GameStatus.PLAYING || !article) return;
    
    const normalizedChar = char.toLowerCase().trim();

    if (!normalizedChar || isSymbol(normalizedChar)) return;

    // Check for duplicates
    if (guessedChars.has(normalizedChar)) {
       setFeedback({ text: `"${char}" 已经猜过了`, type: 'warning' });
       return; 
    }

    const newGuessed = new Set<string>(guessedChars);
    newGuessed.add(normalizedChar);
    const newCount = guessCount + 1;
    
    setGuessedChars(newGuessed);
    setGuessCount(newCount);
    
    const titleLower = article.title.toLowerCase();
    const contentLower = article.content.toLowerCase();
    const hit = titleLower.includes(normalizedChar) || contentLower.includes(normalizedChar);
    
    if (hit) {
      setFeedback({ text: `"${char}" 在内容中！`, type: 'success' });
      checkWinCondition(newGuessed, article, newCount);
    } else {
      setFeedback({ text: `"${char}" 不在内容中`, type: 'error' });
    }

  }, [guessedChars, article, status, guessCount, username]);

  const handleNewGame = async () => {
    setIsLoading(true);
    setFeedback({ text: "AI 正在生成新题目...", type: 'neutral' });
    try {
      const newPuzzle = await generateAiPuzzle();
      resetGame(newPuzzle);
      setFeedback({ text: "AI 出题成功！", type: 'success' });
    } catch (e) {
      console.error(e);
      // More informative alert
      alert("生成题目失败。请检查设置中的 API 配置。");
      setFeedback({ text: "生成失败，请检查设置", type: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRandomDateGame = async () => {
    setIsLoading(true);
    setFeedback({ text: "正在抽取历史题目...", type: 'neutral' });
    
    try {
        const today = new Date();
        // Generate a random number of days to go back (0 to 150 days ~ 5 months)
        const daysBack = Math.floor(Math.random() * 150);
        const targetDate = new Date(today);
        targetDate.setDate(today.getDate() - daysBack);

        const yyyy = targetDate.getFullYear();
        const mm = String(targetDate.getMonth() + 1).padStart(2, '0');
        const dd = String(targetDate.getDate()).padStart(2, '0');
        const dateStr = `${yyyy}${mm}${dd}`;

        const puzzle = await fetchDailyPuzzle(dateStr);
        resetGame(puzzle);
        setFeedback({ text: `已加载 ${yyyy}年${mm}月${dd}日 的题目`, type: 'success' });
    } catch (e) {
        console.error("Failed to load random puzzle", e);
        setFeedback({ text: "加载历史题目失败，请重试", type: 'error' });
    } finally {
        setIsLoading(false);
    }
  };

  const handleGenerateImage = async () => {
    if (!article) return;
    setIsGeneratingImage(true);
    setFeedback({ text: "AI 正在构思画面 (英文翻译)...", type: 'info' });
    try {
      // 1. Construct raw concept
      let rawConcept = `Abstract art style, conceptual interpretation of title: "${article.title}". Content: "${article.content.substring(0, 100)}...". Create an abstract expressionist masterpiece.`;
      
      // Clean up newlines for safety
      rawConcept = rawConcept.replace(/\n/g, " ");

      // 2. Optimize and Translate to English
      const optimizedPrompt = await optimizePrompt(rawConcept);
      
      setFeedback({ text: "AI 正在绘制...", type: 'info' });

      // 3. Generate Image using English prompt
      const result = await generateImage(imageModel, optimizedPrompt, aspectRatio);
      
      // Check for valid URL
      if (!result.url || result.url === "undefined") {
          throw new Error("Generated image URL is invalid");
      }

      setGeneratedImageUrl(result.url);
      setFeedback({ text: "图片生成成功！", type: 'success' });
    } catch (e: any) {
      console.error(e);
      let msg = "生成失败";
      // Check for quota or token errors and guide the user
      if (e.message?.includes("quota") || e.message?.includes("Hugging Face Token")) {
          msg = "配额用尽，请在设置中配置 HuggingFace Token";
          setShowSettings(true); // Automatically open settings
      }
      setFeedback({ text: msg, type: 'error' });
    } finally {
      setIsGeneratingImage(false);
    }
  };

  const handleGiveUp = () => {
    if (!article) return;
    if (window.confirm("确定要放弃并查看答案吗？")) {
        setStatus(GameStatus.GAVE_UP);
        setFeedback({ text: `答案是：${article.title}`, type: 'info' });
    }
  };

  const handleShare = () => {
      if (!article) return;
      const encoded = encodePuzzle(article);
      const url = `${window.location.origin}${window.location.pathname}?p=${encoded}`;
      
      navigator.clipboard.writeText(`来猜猜这个百科词条：${url}`).then(() => {
          setFeedback({ text: "链接已复制！发送给朋友来挑战吧", type: 'success' });
      }).catch(() => {
          setFeedback({ text: "复制失败，请手动复制地址栏链接", type: 'error' });
      });
  };

  const saveSettings = () => {
    localStorage.setItem("wikiguess_custom_base_url", customBaseUrl);
    localStorage.setItem("wikiguess_custom_api_key", customApiKey);
    localStorage.setItem("wikiguess_custom_model_name", customModelName);
    localStorage.setItem("huggingFaceToken", hfToken);
    setShowSettings(false);
    setFeedback({ text: "设置已保存", type: 'success' });
  };

  // 1. Loading Puzzle
  if (!article && isLoading) {
     return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
           <div className="flex flex-col items-center gap-4">
              <Loader2 className="animate-spin text-blue-600" size={32} />
              <p className="text-gray-500 font-medium">加载题目中...</p>
           </div>
        </div>
     );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#fdfdfd] text-gray-900 font-sans">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 py-3 shadow-sm sticky top-0 z-40">
        <div className="max-w-3xl mx-auto px-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="bg-gray-900 text-white p-1.5 rounded-lg shadow-sm">
                <BookOpen size={18} />
            </div>
            <h1 className="text-lg font-bold tracking-tight text-gray-900 hidden sm:block">
                <span className="text-blue-600">Wiki</span>Guess 猜百科
            </h1>
          </div>
          <div className="flex items-center gap-2 text-sm">
             <button
                onClick={handleShare}
                className="p-2 text-gray-500 hover:bg-gray-100 rounded-full transition-colors"
                title="分享"
             >
                <Share2 size={18} />
             </button>
             <button 
                onClick={() => setShowLeaderboard(true)}
                className="flex items-center gap-2 text-gray-600 hover:bg-gray-100 pl-2 pr-3 py-1.5 rounded-full transition-colors"
                title="排行榜"
             >
                <Trophy size={16} className="text-yellow-500" />
                <span className="font-medium max-w-[80px] truncate hidden sm:inline">{username}</span>
             </button>
             <button
                onClick={() => setShowSettings(true)}
                className="p-2 text-gray-500 hover:bg-gray-100 rounded-full transition-colors"
                title="设置"
             >
                <Settings size={18} />
             </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-3xl w-full mx-auto px-4 py-6">
        
        {/* Controls (Input) - Sticky just below header or normal flow */}
        <div className="mb-4">
            <Controls 
                onGuess={handleGuess}
                guessCount={guessCount}
                status={status}
                isLoading={isLoading}
                feedback={feedback}
                onInputError={handleInputError}
            />
        </div>

        {/* Puzzle Article */}
        {article && (
            <div className="bg-white p-4 sm:p-8 rounded-2xl shadow-sm border border-gray-100 min-h-[30vh] transition-all mb-4 relative overflow-hidden">
                {/* Date Badge if likely daily puzzle */}
                {article.content.length > 300 && !isLoading && (
                <div className="absolute top-0 right-0 p-4 opacity-50 pointer-events-none">
                    <Calendar className="text-gray-300" size={48} />
                </div>
                )}
                
                <ArticleRenderer 
                    text={article.title} 
                    guessedChars={guessedChars} 
                    status={status}
                    isTitle={true}
                />
                
                <div className="h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent my-6" />
                
                <div className="font-serif">
                    <ArticleRenderer 
                        text={article.content} 
                        guessedChars={guessedChars} 
                        status={status}
                        isTitle={false}
                    />
                </div>
            </div>
        )}

        {/* Game Action Buttons - Moved Below Article */}
        <GameActions 
            onNewGame={handleNewGame}
            onRandomGame={handleRandomDateGame}
            onGiveUp={handleGiveUp}
            status={status}
            isLoading={isLoading}
        />

        <div className="h-8"></div>

        {/* Incorrect Guesses Section */}
        {wrongGuesses.length > 0 && (
          <div className="mb-8 bg-white p-4 rounded-2xl shadow-sm border border-red-50">
             <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                <AlertCircle className="text-red-500" size={14}/>
                错误猜测 ({wrongGuesses.length})
             </h3>
             <div className="flex flex-wrap gap-2">
                {wrongGuesses.map((char, idx) => (
                   <span key={idx} className="w-8 h-8 flex items-center justify-center bg-red-50 text-red-600 border border-red-100 rounded-lg font-bold shadow-sm text-sm">
                      {char}
                   </span>
                ))}
             </div>
          </div>
        )}

        {/* Image Generation Section */}
        {article && (
          <div className="mb-10 flex flex-col items-center">
             {generatedImageUrl ? (
                <div className="relative w-full rounded-2xl overflow-hidden shadow-lg border border-gray-200 group">
                   <img src={generatedImageUrl} alt="Generated Hint" className="w-full h-auto object-cover max-h-[500px]" />
                   <button 
                     onClick={() => setGeneratedImageUrl(null)}
                     className="absolute top-2 right-2 bg-black/50 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                     title="移除图片"
                   >
                      <Settings size={14} className="rotate-45" /> 
                   </button>
                   <div className="absolute bottom-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded">
                      {imageModel === 'pollinations' ? 'Pollinations' : imageModel === 'qwen-image-fast' ? 'Qwen' : 'Z-Image'} ({aspectRatio})
                   </div>
                </div>
             ) : (
                <div className="w-full p-4 bg-indigo-50 border border-indigo-100 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-4">
                   <div className="flex items-center gap-3 text-indigo-800 self-start md:self-center">
                      <div className="bg-indigo-200 p-2 rounded-lg">
                        <ImageIcon size={20} />
                      </div>
                      <div className="text-sm font-medium">
                        需要提示？生成一张 AI 线索图
                      </div>
                   </div>
                   
                   <div className="flex flex-col sm:flex-row items-center gap-2 w-full md:w-auto">
                      <div className="flex gap-2 w-full sm:w-auto">
                        <select 
                            value={imageModel}
                            onChange={(e) => setImageModel(e.target.value as ModelOption)}
                            className="text-xs border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 px-2 py-2 bg-white border shadow-sm outline-none flex-1"
                            disabled={isGeneratingImage}
                        >
                            <option value="pollinations">Pollinations (Default)</option>
                            <option value="z-image-turbo">Turbo (Fast)</option>
                            <option value="qwen-image-fast">Qwen (Detail)</option>
                        </select>
                        <select 
                            value={aspectRatio}
                            onChange={(e) => setAspectRatio(e.target.value as AspectRatioOption)}
                            className="text-xs border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 px-2 py-2 bg-white border shadow-sm outline-none w-20"
                            disabled={isGeneratingImage}
                        >
                            <option value="1:1">1:1</option>
                            <option value="16:9">16:9</option>
                            <option value="4:3">4:3</option>
                            <option value="3:4">3:4</option>
                        </select>
                      </div>

                      <button
                        onClick={handleGenerateImage}
                        disabled={isGeneratingImage}
                        className="w-full sm:w-auto px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg shadow hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                         {isGeneratingImage && <Loader2 size={14} className="animate-spin" />}
                         生成图片
                      </button>
                   </div>
                </div>
             )}
          </div>
        )}

      </main>

      {/* Leaderboard Modal */}
      <Leaderboard 
        isOpen={showLeaderboard}
        onClose={() => setShowLeaderboard(false)}
        scores={scores}
        username={username}
        onUsernameChange={setUsername}
      />

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
           <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">
              <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50 flex-shrink-0">
                  <h3 className="font-bold text-gray-900 flex items-center gap-2">
                      <Settings size={18} /> 设置
                  </h3>
                  <button onClick={() => setShowSettings(false)} className="text-gray-400 hover:text-gray-600"><Settings size={18} className="rotate-45" /></button>
              </div>
              <div className="p-6 space-y-4 overflow-y-auto">
                  <div className="space-y-3">
                      <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider">AI 出题配置</h4>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">API Base URL</label>
                        <input 
                            type="text" 
                            value={customBaseUrl} 
                            onChange={(e) => setCustomBaseUrl(e.target.value)}
                            placeholder="https://api.siliconflow.cn/v1"
                            className="w-full px-3 py-2 border rounded-lg text-sm bg-gray-50"
                        />
                        <p className="text-xs text-gray-500 mt-1">默认: https://api.siliconflow.cn/v1</p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">API Key</label>
                        <input 
                            type="password" 
                            value={customApiKey} 
                            onChange={(e) => setCustomApiKey(e.target.value)}
                            placeholder="sk-..."
                            className="w-full px-3 py-2 border rounded-lg text-sm bg-gray-50"
                        />
                      </div>
                       <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Model Name</label>
                        <input 
                            type="text" 
                            value={customModelName} 
                            onChange={(e) => setCustomModelName(e.target.value)}
                            placeholder="deepseek-ai/DeepSeek-V3"
                            className="w-full px-3 py-2 border rounded-lg text-sm bg-gray-50"
                        />
                      </div>
                  </div>

                  <hr className="border-gray-100"/>

                  <div className="space-y-3">
                      <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider">AI 绘图配置</h4>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">HuggingFace Token</label>
                        <input 
                            type="password" 
                            value={hfToken} 
                            onChange={(e) => setHfToken(e.target.value)}
                            placeholder="hf_..."
                            className="w-full px-3 py-2 border rounded-lg text-sm bg-gray-50"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                            可选。Turbo/Qwen 模型配置 Token 可获得更多额度。Pollinations 不需要。
                        </p>
                      </div>
                  </div>
              </div>
              <div className="p-4 bg-gray-50 flex justify-end flex-shrink-0">
                  <button 
                    onClick={saveSettings}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 shadow-sm"
                  >
                      保存设置
                  </button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
}

export default App;
