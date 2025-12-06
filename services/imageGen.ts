

import { GeneratedImage, AspectRatioOption, ModelOption } from "../types";

const ZIMAGE_BASE_API_URL = process.env.ZIMAGE_API_URL || "https://luca115-z-image-turbo.hf.space";
const QWEN_IMAGE_BASE_API_URL = process.env.QWEN_IMAGE_API_URL || "https://mcp-tools-qwen-image-fast.hf.space";
const POLLINATIONS_API_URL = process.env.POLLINATIONS_API_URL || "https://text.pollinations.ai/openai";

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
         // Fix: Handle potentially null or messy error strings
         let serverMsg = "Unknown error";
         if (dataStr && dataStr !== "null") {
             serverMsg = dataStr.replace(/^['"]|['"]$/g, '');
         }
         throw new Error(serverMsg || "Your today's quota has been used up. You can set up Hugging Face Token to get more quota.");
      }
    }
  }
  return null;
}

// Helper to resolve Gradio return values which might be file paths instead of URLs
function resolveGradioUrl(fileObj: any, baseUrl: string): string {
    if (!fileObj) return "";
    // If it's already a full URL
    if (fileObj.url) return fileObj.url;
    // If it's a file path structure (common in Gradio 4+)
    if (fileObj.path) {
        // Construct full URL using the /file= endpoint
        return `${baseUrl}/file=${fileObj.path}`;
    }
    // Fallback if it's just a string path
    if (typeof fileObj === 'string') {
        return `${baseUrl}/file=${fileObj}`;
    }
    return "";
}

const generateZImage = async (
  prompt: string,
  aspectRatio: AspectRatioOption,
  seed?: number,
  enableHD: boolean = false
): Promise<GeneratedImage> => {
  let { width, height } = getDimensions(aspectRatio, enableHD);

  try {
    const queue = await fetch(ZIMAGE_BASE_API_URL + '/gradio_api/call/generate_image', {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({
        data: [prompt, height, width, 8, seed || 42, seed === undefined]
      })
    })
    
    if (!queue.ok) {
        throw new Error(`Queue error: ${queue.status} ${queue.statusText}`);
    }

    const { event_id } = await queue.json();
    const response = await fetch(ZIMAGE_BASE_API_URL + '/gradio_api/call/generate_image/' + event_id, {
      headers: getAuthHeaders()
    });
    
    if (!response.ok) {
         throw new Error(`Response error: ${response.status} ${response.statusText}`);
    }

    const result = await response.text();
    const data = extractCompleteEventData(result);

    if (!data) throw new Error("Failed to extract data from event stream");
    
    // Resolve URL from data[0] which is the file object
    const imageUrl = resolveGradioUrl(data[0], ZIMAGE_BASE_API_URL);
    if (!imageUrl) throw new Error("Failed to resolve image URL from response");

    return {
      id: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(),
      url: imageUrl,
      model: 'z-image-turbo',
      prompt,
      aspectRatio,
      timestamp: Date.now(),
      seed: data[1]
    };
  } catch (error) {
    console.error("Z-Image Turbo Generation Error:", error);
    throw error;
  }
};

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

    // Resolve URL from data[0] which is the file object
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

const generatePollinationsImage = async (
  prompt: string,
  aspectRatio: AspectRatioOption,
  seed?: number,
  enableHD: boolean = false
): Promise<GeneratedImage> => {
  // Pollinations doesn't need a complex handshake, just a URL construction
  const { width, height } = getDimensions(aspectRatio, enableHD);
  const safeSeed = seed || Math.floor(Math.random() * 1000000);
  
  const encodedPrompt = encodeURIComponent(prompt);
  // Construct URL directly. Adding nologo to clean it up.
  const url = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=${width}&height=${height}&seed=${safeSeed}&nologo=true`;

  // Return the constructed URL object immediately
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
            content: `I am a master AI image prompt engineering advisor. My core purpose is to meticulously rewrite, expand, and enhance user's image prompts into an Abstract anime Art style.
IMPORTANT: You must translate any non-English input into English. The final output must be 100% in English.
Focus on abstract expressionism, geometric shapes, and conceptual representation. My generated prompt output will be strictly under 300 words.`
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
