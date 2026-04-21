/**
 * qwen-cli-client — invokes the standalone `qwen` CLI (Alibaba Coding
 * Plan wrapper) as an LLM call.
 *
 * Rationale: Bailian Coding Plan keys (sk-sp-*) cannot be used via
 * direct HTTPS to DashScope — they authenticate through the `qwen` CLI
 * which handles auth + quota internally. This client just shells out.
 *
 * Env:
 *   QWEN_MODEL           optional -m override (e.g. "qwen3-coder-plus")
 *   CLAUDE_MOCK=1        bypass the CLI; requires mockResponse
 */
export type QwenCliCallOptions = {
  prompt: string;
  systemPrompt?: string;
  mockResponse?: string;
  mock?: boolean;
};

export type QwenCliCallResult = {
  content: string;
  durationMs: number;
  mode: "mock" | "live";
};

function isMockMode(opts: QwenCliCallOptions): boolean {
  if (opts.mock) return true;
  return process.env.CLAUDE_MOCK === "1" || process.env.CLAUDE_MOCK === "true";
}

async function runQwen(args: string[]): Promise<string> {
  const proc = Bun.spawn(["qwen", ...args], {
    stdout: "pipe",
    stderr: "pipe",
  });
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  if (exitCode !== 0) {
    throw new Error(`qwen cli exited ${exitCode}: ${stderr.slice(0, 300)}`);
  }
  return stdout;
}

export async function callQwenCli(opts: QwenCliCallOptions): Promise<QwenCliCallResult> {
  const t0 = Date.now();
  if (isMockMode(opts)) {
    if (typeof opts.mockResponse !== "string") {
      throw new Error("qwen-cli mock mode active but no mockResponse supplied.");
    }
    return { content: opts.mockResponse, durationMs: Date.now() - t0, mode: "mock" };
  }

  const args: string[] = [];
  const model = process.env.QWEN_MODEL;
  if (model) {
    args.push("-m", model);
  }
  if (opts.systemPrompt) {
    args.push("--system-prompt", opts.systemPrompt);
  }
  // The prompt is passed as a positional argument. `qwen` treats it as a
  // one-shot when no -i flag is given.
  args.push(opts.prompt);

  const raw = await runQwen(args);
  const content = raw.trim();
  if (!content) {
    throw new Error(`qwen cli returned empty output: ${raw.slice(0, 300)}`);
  }
  return { content, durationMs: Date.now() - t0, mode: "live" };
}
