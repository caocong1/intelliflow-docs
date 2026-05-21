import type { PptAiConfig } from "./types";

export const DEFAULT_PPT_AI_CONFIG: PptAiConfig = {
  name: "MiniMax PPT",
  providerType: "openai_compatible",
  baseUrl: "https://api.minimaxi.com/v1",
  apiKey: null,
  apiKeyEnvVar: "MINIMAX_API_KEY",
  textModel: "MiniMax-M2.7-highspeed",
  textEndpoint: "/chat/completions",
  imageModel: "image-01",
  imageEndpoint: "/image_generation",
  imageAspectRatio: "16:9",
  imageResponseFormat: "base64",
  imagePromptOptimizer: true,
  temperature: 0.35,
  maxCompletionTokens: 9000,
  textTimeoutMs: 30_000,
  imageTimeoutMs: 35_000,
  isActive: true,
};
