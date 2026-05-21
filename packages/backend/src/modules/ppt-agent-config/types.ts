export type PptAiProviderType = "openai_compatible";

export type PptAiConfig = {
  id?: string;
  name: string;
  providerType: PptAiProviderType;
  baseUrl: string;
  apiKey?: string | null;
  apiKeyEnvVar: string;
  textModel: string;
  textEndpoint: string;
  imageModel: string;
  imageEndpoint: string;
  imageAspectRatio: string;
  imageResponseFormat: "base64";
  imagePromptOptimizer: boolean;
  temperature: number;
  maxCompletionTokens: number;
  textTimeoutMs: number;
  imageTimeoutMs: number;
  isActive: boolean;
  createdAt?: Date;
  updatedAt?: Date;
};

export type PptAiConfigUpdate = Partial<
  Pick<
    PptAiConfig,
    | "name"
    | "providerType"
    | "baseUrl"
    | "apiKey"
    | "apiKeyEnvVar"
    | "textModel"
    | "textEndpoint"
    | "imageModel"
    | "imageEndpoint"
    | "imageAspectRatio"
    | "imageResponseFormat"
    | "imagePromptOptimizer"
    | "temperature"
    | "maxCompletionTokens"
    | "textTimeoutMs"
    | "imageTimeoutMs"
    | "isActive"
  >
>;

export type PptAiRuntimeConfig = PptAiConfig & {
  apiKey?: string;
};

export type PptAiPublicConfig = Omit<PptAiConfig, "apiKey" | "createdAt" | "updatedAt"> & {
  createdAt?: string;
  updatedAt?: string;
  apiKeyConfigured: boolean;
};
