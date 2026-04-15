import { buildChatCompletionsUrl } from "./openai-compatible-url";

describe("buildChatCompletionsUrl", () => {
  it("adds /v1/chat/completions for ollama roots without a v1 segment", () => {
    expect(buildChatCompletionsUrl("http://localhost:11434", "ollama")).toBe(
      "http://localhost:11434/v1/chat/completions",
    );
  });

  it("avoids duplicating /v1 for ollama bases that already include it", () => {
    expect(buildChatCompletionsUrl("http://localhost:11434/v1", "ollama")).toBe(
      "http://localhost:11434/v1/chat/completions",
    );
  });

  it("appends /chat/completions for openai-compatible providers", () => {
    expect(
      buildChatCompletionsUrl("https://ark.cn-beijing.volces.com/api/coding/v3", "openai_compatible"),
    ).toBe("https://ark.cn-beijing.volces.com/api/coding/v3/chat/completions");
  });

  it("keeps a fully qualified chat completions endpoint unchanged", () => {
    expect(buildChatCompletionsUrl("http://localhost:11434/v1/chat/completions", "ollama")).toBe(
      "http://localhost:11434/v1/chat/completions",
    );
  });

  it("strips trailing slashes before appending the endpoint", () => {
    expect(buildChatCompletionsUrl("http://localhost:11434/v1/", "ollama")).toBe(
      "http://localhost:11434/v1/chat/completions",
    );
  });
});
