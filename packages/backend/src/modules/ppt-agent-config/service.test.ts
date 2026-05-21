import { describe, expect, it } from "vitest";
import { DEFAULT_PPT_AI_CONFIG } from "./defaults";
import {
  normalizePptAiConfigUpdate,
  resolvePptAiRuntimeConfig,
  toPublicPptAiConfig,
} from "./service";

describe("ppt-agent-config", () => {
  it("resolves API key from the configured backend env var", () => {
    const runtime = resolvePptAiRuntimeConfig(
      { ...DEFAULT_PPT_AI_CONFIG, apiKeyEnvVar: "PPT_TEST_KEY" },
      { PPT_TEST_KEY: "secret-value" },
    );

    expect(runtime.apiKey).toBe("secret-value");
  });

  it("prefers database API key over the configured env var", () => {
    const runtime = resolvePptAiRuntimeConfig(
      { ...DEFAULT_PPT_AI_CONFIG, apiKey: "db-secret", apiKeyEnvVar: "PPT_TEST_KEY" },
      { PPT_TEST_KEY: "env-secret" },
    );

    expect(runtime.apiKey).toBe("db-secret");
  });

  it("public config exposes only apiKeyConfigured and never the secret", () => {
    const publicConfig = toPublicPptAiConfig(
      { ...DEFAULT_PPT_AI_CONFIG, apiKeyEnvVar: "PPT_TEST_KEY" },
      { PPT_TEST_KEY: "secret-value" },
    );

    expect(publicConfig.apiKeyConfigured).toBe(true);
    expect(JSON.stringify(publicConfig)).not.toContain("secret-value");
  });

  it("public config hides database API key", () => {
    const publicConfig = toPublicPptAiConfig({ ...DEFAULT_PPT_AI_CONFIG, apiKey: "db-secret" }, {});

    expect(publicConfig.apiKeyConfigured).toBe(true);
    expect(JSON.stringify(publicConfig)).not.toContain("db-secret");
  });

  it("normalizes base url, endpoints, and bounded numeric options", () => {
    const normalized = normalizePptAiConfigUpdate({
      baseUrl: "https://example.com/v1///",
      textEndpoint: "chat/completions",
      imageEndpoint: "image_generation",
      temperature: 8,
      textTimeoutMs: 0,
    });

    expect(normalized.baseUrl).toBe("https://example.com/v1");
    expect(normalized.textEndpoint).toBe("/chat/completions");
    expect(normalized.imageEndpoint).toBe("/image_generation");
    expect(normalized.temperature).toBe(2);
    expect(normalized.textTimeoutMs).toBe(1);
  });
});
