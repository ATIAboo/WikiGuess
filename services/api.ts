
import { Article } from "../types";

// Helpers to get configuration dynamically
const getBaseUrl = () => {
  return localStorage.getItem("wikiguess_custom_base_url") || "https://api.openai.com/v1";
};

const getApiKey = () => {
  return localStorage.getItem("wikiguess_custom_api_key") || process.env.API_KEY;
};

export const generateAiPuzzle = async (): Promise<Article> => {
  const apiKey = getApiKey();
  const baseUrl = getBaseUrl();

  if (!apiKey) {
    throw new Error("API Key is missing");
  }

  const prompt = `生成一个类似于 'Redactle' 游戏的百科词条猜测谜题。请选择一个常见的、广为人知的概念（如历史、科学、流行文化、地理、成语、日常物品、名胜古迹）。

要求：
1. 语言必须是简体中文。
2. 标题(title)应该是该词条的名词。
3. 内容(content)是对该词条的客观描述，长度约200-300字，包含标点符号。
4. 内容中可以出现标题本身，直接保留（游戏会自动隐藏）。
5. 必须返回纯 JSON 格式。`;

  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "gpt-4o-mini", // Use a standard model name
        messages: [
           { role: "system", content: "You are a helpful assistant that generates encyclopedia puzzles. You must output valid JSON." },
           { role: "user", content: prompt }
        ],
        response_format: { type: "json_object" },
        temperature: 0.9
      })
    });

    if (!response.ok) {
        throw new Error(`AI API Error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const contentStr = data.choices?.[0]?.message?.content;
    
    if (!contentStr) throw new Error("No content received from AI");

    const parsed = JSON.parse(contentStr);
    
    // Validate structure
    if (!parsed.title || !parsed.content) {
        throw new Error("Invalid JSON structure from AI");
    }

    return {
        title: parsed.title,
        content: parsed.content
    };

  } catch (error) {
    console.error("AI Generation Error", error);
    // Fallback if AI fails
    return {
      title: "人工智能",
      content: "人工智能（Artificial Intelligence），英文缩写为AI。它是研究、开发用于模拟、延伸和扩展人的智能的理论、方法、技术及应用系统的一门新的技术科学。人工智能是计算机科学的一个分支，它企图了解智能的实质，并生产出一种新的能以人类智能相似的方式做出反应的智能机器。"
    };
  }
};

export const fetchDailyPuzzle = async (): Promise<Article> => {
   // Format date as YYYYMMDD
   const date = new Date();
   const yyyy = date.getFullYear();
   const mm = String(date.getMonth() + 1).padStart(2, '0');
   const dd = String(date.getDate()).padStart(2, '0');
   const dateStr = `${yyyy}${mm}${dd}`;

   // Fetch from the external API
   try {
       const res = await fetch(`https://xiaoce.fun/api/v0/quiz/daily/baike/get?date=${dateStr}`);
       
       if (!res.ok) {
           throw new Error(`Daily Puzzle API Error: ${res.status}`);
       }
       
       const json = await res.json();
       
       if (!json.success || !json.data?.data) {
           throw new Error("Invalid daily puzzle data format");
       }

       const puzzleData = json.data.data;
       
       // The API returns paragraphs in a nested array structure: [ ["Para 1", "Para 2"] ]
       const paragraphGroups = puzzleData.content.paragraphs;
       let content = "";

       if (Array.isArray(paragraphGroups) && paragraphGroups.length > 0) {
           // Assuming the first group contains the main text segments
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
