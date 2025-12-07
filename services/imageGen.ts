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
            content: `I am a master AI image prompt engineering advisor. My core purpose is to meticulously rewrite, expand, and enhance user's image prompts into a Surrealism/Dreamlike style (Salvador Dali style).
Core Logic: Break physical laws, blend object features into the environment, making it feel familiar yet identifiable only as a concept, not a literal object.
Template: A surreal dreamscape featuring the concept of [Subject], Salvador Dali style, melting forms, floating objects, misty atmosphere, impossible geometry, oil painting texture, mysterious and abstract --no text.
IMPORTANT: You must translate any non-English input into English. The final output must be 100% in English. My generated prompt output will be strictly under 300 words.Ensure the image is abstract and artistic, do not depict the object literally, make it a visual riddle.`
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
