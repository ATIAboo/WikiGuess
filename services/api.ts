
import { Article } from "../types";

// Helpers to get configuration dynamically
const getBaseUrl = () => {
  return localStorage.getItem("wikiguess_custom_base_url") || (import.meta as any).env?.VITE_API_BASE_URL || "https://api.siliconflow.cn/v1";
};

const getApiKey = () => {
  const key = localStorage.getItem("wikiguess_custom_api_key") || (import.meta as any).env?.VITE_API_KEY;
  // Default to empty to prevent leakage. User must set this in Settings.
  return key || "";
};

const getModelName = () => {
  return localStorage.getItem("wikiguess_custom_model_name") || (import.meta as any).env?.VITE_API_MODEL_NAME || "deepseek-ai/DeepSeek-V3";
};

export const generateAiPuzzle = async (): Promise<Article> => {
  const apiKey = getApiKey();
  const baseUrl = getBaseUrl();
  const modelName = getModelName();

  if (!apiKey && !baseUrl.includes("pollinations.ai")) {
    throw new Error("API Key is missing. Please check your settings.");
  }

  // Refined prompt for DeepSeek to ensure strictly valid JSON
  const prompt = `你是一个出题助手。请生成一个“猜词游戏”的百科谜题。

请严格遵守以下 JSON 格式返回，不要包含任何 markdown 格式标记（如 \`\`\`json）：
{
  "title": "词条标题（名词）",
  "content": "词条的客观描述（200-300字，包含标点）。描述中可以直接包含标题词汇。"
}

要求：
1. 语言：简体中文。
2. 主题：选择一个广为人知的概念，（地理、历史、科学、文化、日常物品、成语、名胜、游戏等各种名词均可）。
3. 注意同样的问题问你很多次了，不要出现长城...。
3. 必须是纯 JSON 字符串，不能有其他废话。`;

  try {
    // URL Construction Logic
    let fetchUrl = baseUrl;
    // If user entered just the base (e.g. https://api.siliconflow.cn/v1), we append /chat/completions
    // If they entered the full path, we use it.
    if (!fetchUrl.endsWith("/chat/completions") && !fetchUrl.endsWith("/chat/completions/")) {
        fetchUrl = `${fetchUrl.replace(/\/+$/, "")}/chat/completions`;
    }

    const headers: Record<string, string> = {
        "Content-Type": "application/json",
    };
    
    if (apiKey) {
        headers["Authorization"] = `Bearer ${apiKey}`;
    }

    const response = await fetch(fetchUrl, {
      method: "POST",
      headers: headers,
      body: JSON.stringify({
        model: modelName,
        messages: [
           { role: "system", content: "You are a helpful assistant. Output valid JSON only." },
           { role: "user", content: prompt }
        ],
        // Try to enforce JSON mode if supported by the provider
        response_format: { type: "json_object" },
        temperature: 1.0, 
        max_tokens: 1000,
        stream: false
      })
    });

    if (!response.ok) {
        const errText = await response.text();
        throw new Error(`AI API Error: ${response.status} ${response.statusText} - ${errText}`);
    }

    const data = await response.json();
    const contentStr = data.choices?.[0]?.message?.content;
    
    if (!contentStr) throw new Error("No content received from AI");

    // Clean up contentStr in case it has markdown code blocks
    const cleanJsonStr = contentStr.replace(/```json\n?|```/g, "").trim();

    try {
        const parsed = JSON.parse(cleanJsonStr);
        
        if (!parsed.title || !parsed.content) {
            throw new Error("Invalid JSON structure: missing title or content");
        }

        return {
            title: parsed.title,
            content: parsed.content
        };
    } catch (parseError) {
        console.error("JSON Parse Error", parseError, "Raw content:", contentStr);
        throw new Error("AI returned invalid JSON format.");
    }

  } catch (error) {
    console.error("AI Generation Error", error);
    throw error;
  }
};

export const fetchDailyPuzzle = async (dateStr?: string): Promise<Article> => {
   // Validate and format dateStr to YYYYMMDD if needed
   let targetDate = dateStr;

   if (!targetDate) {
       const date = new Date();
       const yyyy = date.getFullYear();
       const mm = String(date.getMonth() + 1).padStart(2, '0');
       const dd = String(date.getDate()).padStart(2, '0');
       targetDate = `${yyyy}${mm}${dd}`;
   }

   // Ensure format is numeric only (handle YYYY-MM-DD from input)
   targetDate = targetDate.replace(/-/g, '');

   try {
       const res = await fetch(`https://xiaoce.fun/api/v0/quiz/daily/baike/get?date=${targetDate}`);
       
       if (!res.ok) {
           throw new Error(`Daily Puzzle API Error: ${res.status}`);
       }
       
       const json = await res.json();
       
       if (!json.success || !json.data?.data) {
           throw new Error("Invalid daily puzzle data format or no data for this date");
       }

       const puzzleData = json.data.data;
       
       const paragraphGroups = puzzleData.content.paragraphs;
       let content = "";

       if (Array.isArray(paragraphGroups) && paragraphGroups.length > 0) {
           const textSegments = paragraphGroups[0];
           if (Array.isArray(textSegments)) {
               content = textSegments.join("\n\n");
           } else {
               content = JSON.stringify(textSegments);
           }
       } else {
           content = "暂无内容";
       }

       return {
         title: puzzleData.title,
         content: content
       };
   } catch (error) {
       console.error("Daily Puzzle Fetch Error", error);
       throw error;
   }
}
