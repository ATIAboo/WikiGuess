import OpenAI from "openai";
import { GeneratedImage, AspectRatioOption, ModelOption } from "../types";

const QWEN_IMAGE_BASE_API_URL = (import.meta as any).env?.VITE_QWEN_IMAGE_API_URL || "https://mcp-tools-qwen-image-fast.hf.space";
const POLLINATIONS_API_URL = (import.meta as any).env?.VITE_POLLINATIONS_API_URL || "https://text.pollinations.ai/openai";
const GITEE_AI_BASE_URL = "https://ai.gitee.com/v1";

// Helper to get Gitee API Key
const getGiteeApiKey = () => {
  return localStorage.getItem("gitee_ai_api_key") || (import.meta as any).env?.VITE_GITEE_AI_API_KEY || "";
};

const getDimensions = (ratio: AspectRatioOption, enableHD: boolean): { width: number; height: number } => {
  if (enableHD) {
    switch (ratio) {
      case "16:9":
        return { width: 2048, height: 1152 };
      case "5:4":
        return { width: 1920, height: 1536 };
      case "4:3":
        return { width: 2048, height: 1536 };
      case "3:2":
        return { width: 1920, height: 1280 };
      case "9:16":
        return { width: 1152, height: 2048 };
      case "4:5":
        return { width: 1536, height: 1920 };
      case "3:4":
        return { width: 1536, height: 2048 };
      case "2:3":
        return { width: 1280, height: 1920 };
      case "1:1":
      default:
        return { width: 2048, height: 2048 };
    }
  } else {
      switch (ratio) {
      case "16:9":
        return { width: 1280, height: 720 };
      case "5:4":
        return { width: 1280, height: 1024 };
      case "4:3":
        return { width: 1024, height: 768 };
      case "3:2":
        return { width: 1536, height: 1024 };
      case "9:16":
        return { width: 720, height: 1280 };
      case "4:5":
        return { width: 1024, height: 1280 };
      case "3:4":
        return { width: 768, height: 1024 };
      case "2:3":
        return { width: 1024, height: 1536 };
      case "1:1":
      default:
        return { width: 1024, height: 1024 };
    }
  }
};

const getAuthHeaders = (): Record<string, string> => {
  const token = typeof localStorage !== 'undefined' ? localStorage.getItem('huggingFaceToken') : null;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return headers;
};

function extractCompleteEventData(sseStream: string): any | null {
  const lines = sseStream.split('\n');
  let currentEvent = null;

  for (const line of lines) {
    if (line.startsWith('event:')) {
      currentEvent = line.substring(6).trim();
    } else if (line.startsWith('data:')) {
      const dataStr = line.substring(5).trim();
      
      if (currentEvent === 'complete') {
        try {
          return JSON.parse(dataStr);
        } catch (e) {
          console.error("Error parsing JSON data:", e);
          return null;
        }
      } else if (currentEvent === 'error') {
         let serverMsg = "Unknown error";
         if (dataStr && dataStr !== "null") {
             serverMsg = dataStr.replace(/^['"]|['"]$/g, '');
         }
         throw new Error(serverMsg || "Quota exceeded or API error.");
      }
    }
  }
  return null;
}

function resolveGradioUrl(fileObj: any, baseUrl: string): string {
    if (!fileObj) return "";
    if (fileObj.url) return fileObj.url;
    if (fileObj.path) {
        return `${baseUrl}/file=${fileObj.path}`;
    }
    if (typeof fileObj === 'string') {
        return `${baseUrl}/file=${fileObj}`;
    }
    return "";
}

// --- Gitee AI / Z-Image Turbo Implementation ---

const generateZImage = async (
  prompt: string,
  aspectRatio: AspectRatioOption,
  seed?: number,
  enableHD: boolean = false
): Promise<GeneratedImage> => {
  const apiKey = getGiteeApiKey();
  if (!apiKey) {
    throw new Error("Gitee AI API Key is missing. Please configure it in Settings.");
  }

  // Calculate resolution string (e.g. "1024x1024")
  const { width, height } = getDimensions(aspectRatio, enableHD);
  const sizeString = `${width}x${height}`;

  const client = new OpenAI({
    baseURL: GITEE_AI_BASE_URL,
    apiKey: apiKey,
    dangerouslyAllowBrowser: true // Required for client-side use
  });

  try {
    const response = await client.images.generate({
      prompt: prompt,
      model: "z-image-turbo",
      size: sizeString as any, // Cast to any because OpenAI SDK types are strict about specific enums
      // The Gitee API supports num_inference_steps via standard or extra params, 
      // but usually the default is fine. The user provided example implies standard OpenAI call structure.
    });

    const data = response.data[0];
    let imageUrl = data.url;

    // Handle b64_json if url is missing (though Gitee usually returns URL)
    if (!imageUrl && data.b64_json) {
        imageUrl = `data:image/jpeg;base64,${data.b64_json}`;
    }

    if (!imageUrl) {
        throw new Error("No image URL or data returned from Gitee AI");
    }

    return {
      id: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(),
      url: imageUrl,
      model: 'z-image-turbo',
      prompt,
      aspectRatio,
      timestamp: Date.now(),
      seed: seed || 0 // API might not return the seed used
    };

  } catch (error: any) {
    console.error("Gitee AI Image Generation Error:", error);
    // Extract helpful error message if possible
    const msg = error?.response?.data?.error?.message || error.message;
    throw new Error(`Gitee AI Error: ${msg}`);
  }
};

// --- Qwen Image Fast (HuggingFace) ---

const generateQwenImage = async (
  prompt: string,
  aspectRatio: AspectRatioOption,
  seed?: number,
  enableHD: boolean = false
): Promise<GeneratedImage> => {
  try {
    const queue = await fetch(QWEN_IMAGE_BASE_API_URL + '/gradio_api/call/generate_image', {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({
        data: [prompt, seed || 42, seed === undefined, aspectRatio, 3, 8]
      })
    })

    if (!queue.ok) {
        throw new Error(`Queue error: ${queue.status} ${queue.statusText}`);
    }

    const { event_id } = await queue.json();
    const response = await fetch(QWEN_IMAGE_BASE_API_URL + '/gradio_api/call/generate_image/' + event_id, {
      headers: getAuthHeaders()
    });

    if (!response.ok) {
         throw new Error(`Response error: ${response.status} ${response.statusText}`);
    }

    const result = await response.text();
    const data = extractCompleteEventData(result);

    if (!data) throw new Error("Failed to extract data from event stream");

    const imageUrl = resolveGradioUrl(data[0], QWEN_IMAGE_BASE_API_URL);
    if (!imageUrl) throw new Error("Failed to resolve image URL from response");

    return {
      id: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(),
      url: imageUrl,
      model: 'qwen-image-fast',
      prompt,
      aspectRatio,
      timestamp: Date.now(),
      seed: parseInt(data[1].replace('Seed used for generation: ', ''))
    };
  } catch (error) {
    console.error("Qwen Image Fast Generation Error:", error);
    throw error;
  }
};

// --- Pollinations AI ---

const generatePollinationsImage = async (
  prompt: string,
  aspectRatio: AspectRatioOption,
  seed?: number,
  enableHD: boolean = false
): Promise<GeneratedImage> => {
  const { width, height } = getDimensions(aspectRatio, enableHD);
  const safeSeed = seed || Math.floor(Math.random() * 1000000);
  
  const encodedPrompt = encodeURIComponent(prompt);
  const url = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=${width}&height=${height}&seed=${safeSeed}&nologo=true`;

  return {
    id: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(),
    url: url,
    model: 'pollinations',
    prompt,
    aspectRatio,
    timestamp: Date.now(),
    seed: safeSeed
  };
};

export const generateImage = async (
  model: ModelOption,
  prompt: string,
  aspectRatio: AspectRatioOption,
  seed?: number,
  enableHD: boolean = false
): Promise<GeneratedImage> => {
  if (model === 'pollinations') {
    return generatePollinationsImage(prompt, aspectRatio, seed, enableHD);
  } else if (model === 'qwen-image-fast') {
    return generateQwenImage(prompt, aspectRatio, seed, enableHD);
  } else {
    // z-image-turbo now uses Gitee AI
    return generateZImage(prompt, aspectRatio, seed, enableHD);
  }
};

export const optimizePrompt = async (originalPrompt: string): Promise<string> => {
  try {
    const response = await fetch(POLLINATIONS_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'openai-fast',
        messages: [
          {
            role: 'system',
            content: `【角色设定】 你现在是一位世界顶级的概念艺术指导和视觉谜题设计专家。你正在为一款高难度的“看图猜词”游戏设计图像提示（Image Prompts）。
【核心目标】 你的任务是接收一个我提供的“目标词”（可能是一个物体、一个抽象概念或一种社会现象），然后编写一个用于生成图像的英文 Prompt。 关键要求：这个图像绝不能直接、字面地展示目标词。它必须是一个极其抽象、充满艺术感和隐喻的“视觉谜题”。
【你的思考方法论 (The "Abstract Metaphor" Method)】
不要直接描述物体！请严格按照以下步骤进行思考：
核心解构： 深入挖掘这个词背后的情绪、氛围、权力动态、冲突或哲学含义。
坏例子（词：加班）： 一个人在电脑前打哈欠。
好例子（词：加班）： 核心是“精力的耗尽”、“时间的模糊”和“机械般的重复”。
寻找视觉隐喻 (Visual Metaphor)： 将上述抽象内核转化为视觉元素。
利用强烈的对比：大与小、冷与暖、动与静、坚硬与柔软。
利用艺术风格与质感：用油画厚涂表现压抑，用模糊摄影表现时间流逝，用超现实主义表现梦境。
构建场景 (Crafting the Scene)： 描述一个具体的艺术画面，专注于色彩、光影、材质和构图之间的冲突，而不是叙事。
【学习范例 (Few-Shot Examples)】
为了让你更好地理解，这里有两个成功的范例：
范例一：
用户输入： “加班” (Overtime Work)
你的思考： 不能画人。核心是“疲惫”和“时间的停滞”。我要用微距摄影，聚焦于一个冰冷的、带有油渍漩涡的咖啡杯，旁边是一个模糊到看不清数字的发光时钟。重点是那种能量被抽干的感觉。
你输出的 Prompt： Abstract macro photography showing a blurred, glowing digital clock display where the numbers are unrecognizable streaks of red light. Next to it, a half-empty, cold cup of coffee has a swirling, oily surface that looks like a draining vortex. The colors are dark tones of blue, grey, and tired orange. Grainy film texture. Focus on the feeling of exhaustion. --no people
范例二 (最高难度)：
用户输入： “赘婿” (Matrilocal Son-in-law)
你的思考： 这是一个社会概念。核心是“压抑”、“权力的不对等”和“无法融入”。我不能画家庭。我要用极端的油画厚涂风格。画一堵巨大的、古老的、深红色的墙（代表庞大的家族势力），在角落里挤压、吞没一个小小的、苍白的灰色色块（代表个体）。
你输出的 Prompt： A sculptural abstract oil painting with extreme impasto texture. A massive, overwhelming wall of deep, oppressive ancestral reds, heavy oxidized golds, and dark monolithic browns dominates the canvas. In a restricted lower corner, a small, isolated, thin patch of muted, pale cool grey pigment is being physically swallowed by the encroaching thick layers of warm, heavy paint. The texture conveys immense weight and suffocation. No figures. --ar 16:9Ensure the image is abstract and artistic, do not depict the object literally, make it a visual riddle.
注意，只输出promt即可`
          },
          {
            role: 'user',
            content: originalPrompt
          }
        ],
        stream: false
      }),
    });

    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    
    return content || originalPrompt;
  } catch (error) {
    console.error("Prompt Optimization Error:", error);
    return originalPrompt;
  }
};
