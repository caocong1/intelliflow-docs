import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { assertWithinRoot, sanitizeFilename } from "../../common/sanitize";
import { getActivePptAiRuntimeConfig } from "../ppt-agent-config/service";
import { critiqueDeckPlan, defaultSlideCount, validateDeckPlan } from "./deck-plan-schema";
import { reviewDeckDesign, shouldGenerateImageForSlide } from "./design-assets";
import { buildFallbackDeckPlan } from "./fallback-deck-plan";
import { buildFallbackVisual } from "./fallback-visuals";
import { MiniMaxClient, MiniMaxConfigError } from "./minimax-client";
import { qaPptx } from "./qa";
import { renderDeckToPptx } from "./renderer";
import type {
  DeckPlan,
  PptAgentCreateInput,
  PptAgentJob,
  PptAgentJobPatch,
  PptAgentRepository,
  PptAgentStage,
  PptAgentTraceEvent,
  PptAiClient,
  VisualAsset,
} from "./types";
import { PPTX_MIME_TYPE } from "./types";

export class PptAgentPublicError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "PptAgentPublicError";
    this.status = status;
  }
}

export type PptAgentService = ReturnType<typeof createPptAgentService>;

export function createPptAgentService(options: {
  repository: PptAgentRepository;
  client?: PptAiClient;
  workspaceRoot?: string;
}) {
  const repository = options.repository;
  const client = options.client ?? new MiniMaxClient();
  const workspaceRoot = resolve(
    options.workspaceRoot ?? process.env.WORKSPACE_ROOT ?? "./data/workspaces",
  );

  async function createAndStartJob(
    userId: string,
    input: PptAgentCreateInput,
  ): Promise<PptAgentJob> {
    client.assertReady();
    const normalized = normalizeInput(input);
    const trace = [
      traceEvent("queued", "PPT 生成任务已创建", { slideCount: normalized.slideCount }),
    ];
    const job = await repository.createJob({
      userId,
      prompt: normalized.prompt,
      warnings: [],
      trace,
    });

    void runJob(job.id, userId, normalized).catch(() => {
      // runJob already records public failure state; keep the route fire-and-forget.
    });

    return job;
  }

  async function runJob(
    jobId: string,
    userId: string,
    input: PptAgentCreateInput & { slideCount?: number },
  ): Promise<PptAgentJob> {
    const normalized = normalizeInput(input);
    const current = await getRequiredJob(jobId, userId);
    let warnings = [...current.warnings];
    let trace = [...current.trace];

    const update = async (
      stage: PptAgentStage,
      progress: number,
      message: string,
      patch?: PptAgentJobPatch,
    ) => {
      trace = [...trace, traceEvent(stage, message)];
      return repository.updateJob(jobId, {
        status: stage === "completed" ? "completed" : stage === "failed" ? "failed" : "running",
        stage,
        progress,
        warnings,
        trace,
        ...patch,
      });
    };

    try {
      await update("design_director", 8, "Design Director 开始生成结构化 DeckPlan");
      let deckPlan = await generateValidatedDeckPlan(
        normalized.prompt,
        normalized.slideCount,
        normalized.style,
        warnings,
      );
      await update("design_critic", 28, "Design Critic 开始检查 DeckPlan", { deckPlan });

      const critique = [
        ...critiqueDeckPlan(deckPlan, normalized.slideCount),
        ...reviewDeckDesign(deckPlan),
      ];
      if (critique.length > 0) {
        trace = [
          ...trace,
          traceEvent("design_critic", "DeckPlan 触发一次 evaluator-optimizer 重写", { critique }),
        ];
        let rewritten: unknown;
        try {
          rewritten = await client.rewriteDeckPlan({
            prompt: normalized.prompt,
            slideCount: normalized.slideCount,
            style: normalized.style,
            deckPlan,
            critique,
          });
        } catch (err) {
          warnings = [
            ...warnings,
            `DeckPlan 重写失败，已保留当前方案继续：${err instanceof Error ? err.message : String(err)}`,
          ];
          rewritten = null;
        }

        if (rewritten) {
          const result = validateDeckPlan(rewritten, normalized.slideCount);
          if (!result.ok) {
            warnings = [
              ...warnings,
              `DeckPlan 重写未通过结构校验，已保留原始方案继续：${result.errors.join("；")}`,
            ];
          } else {
            deckPlan = result.deckPlan;
            const remainingCritique = critiqueDeckPlan(deckPlan, normalized.slideCount);
            if (remainingCritique.length > 0) {
              warnings = [
                ...warnings,
                ...remainingCritique.map((item) => `Design Critic 警告：${item}`),
              ];
            }
          }
        }
      }

      await update("visual_generator", 38, "Visual Generator 开始生成每页无文字视觉素材", {
        deckPlan,
      });
      const visuals = await generateVisuals(deckPlan, warnings, async (progress) => {
        await update("visual_generator", progress, "Visual Generator 正在处理页面视觉素材", {
          deckPlan,
        });
      });

      await update("renderer", 78, "Renderer 开始输出 PPTX", { deckPlan });
      const outputDir = await ensureJobOutputDir(userId, jobId);
      const filename = buildResultFilename(deckPlan);
      const storagePath = join(outputDir, filename);
      const rendered = await renderDeckToPptx(deckPlan, visuals);
      warnings = [...warnings, ...rendered.warnings];
      const designWarnings = reviewDeckDesign(deckPlan, visuals);
      if (designWarnings.length > 0) {
        warnings = [...warnings, ...designWarnings.map((item) => `Design Review 警告：${item}`)];
      }
      await writeFile(storagePath, rendered.buffer);

      await update("qa", 90, "QA 开始检查 PPTX zip/xml/notes/placeholder", {
        deckPlan,
        resultFilename: filename,
        resultStoragePath: storagePath,
      });
      const qaReport = await qaPptx(rendered.buffer, storagePath, deckPlan);
      warnings = [...warnings, ...qaReport.warnings];

      return await update("completed", 100, "PPT 生成任务完成", {
        deckPlan,
        resultFilename: filename,
        resultStoragePath: storagePath,
        completedAt: new Date(),
      });
    } catch (err) {
      const message = publicErrorMessage(err);
      trace = [...trace, traceEvent("failed", "PPT 生成任务失败", { error: message })];
      return repository.updateJob(jobId, {
        status: "failed",
        stage: "failed",
        progress: 100,
        errorMessage: message,
        warnings,
        trace,
        completedAt: new Date(),
      });
    }
  }

  async function listJobs(userId: string): Promise<PptAgentJob[]> {
    return repository.listJobsForUser(userId);
  }

  async function getJob(userId: string, jobId: string): Promise<PptAgentJob | null> {
    return repository.getJobForUser(jobId, userId);
  }

  async function getDownload(userId: string, jobId: string) {
    const job = await repository.getJobForUser(jobId, userId);
    if (!job) throw new PptAgentPublicError("PPT 生成任务不存在", 404);
    if (job.status !== "completed" || !job.resultStoragePath || !job.resultFilename) {
      throw new PptAgentPublicError("PPT 生成任务尚未完成，无法下载", 400);
    }

    const userRoot = join(workspaceRoot, "ppt-agent", userId);
    const safePath = assertWithinRoot(userRoot, job.resultStoragePath);
    const fileInfo = await stat(safePath).catch(() => null);
    if (!fileInfo?.isFile()) throw new PptAgentPublicError("PPTX 文件不存在，请重新生成", 404);

    return {
      filename: job.resultFilename,
      mimeType: PPTX_MIME_TYPE,
      buffer: await readFile(safePath),
      size: fileInfo.size,
    };
  }

  async function generateValidatedDeckPlan(
    prompt: string,
    slideCount: number,
    style: string,
    warningsRef: string[],
  ): Promise<DeckPlan> {
    let lastErrors: string[] | undefined;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const raw = await client.createDeckPlan({
          prompt,
          slideCount,
          style,
          validationErrors: lastErrors,
        });
        const result = validateDeckPlan(raw, slideCount);
        if (result.ok) return result.deckPlan;
        lastErrors = result.errors;
      } catch (err) {
        lastErrors = [err instanceof Error ? err.message : String(err)];
      }
    }

    const reason = lastErrors?.join("；") ?? "unknown";
    warningsRef.push(`Design Director 生成 DeckPlan 失败，已使用保底方案继续：${reason}`);
    return buildFallbackDeckPlan({ prompt, slideCount, style, reason });
  }

  async function generateVisuals(
    deckPlan: DeckPlan,
    warningsRef: string[],
    onProgress: (progress: number) => Promise<void>,
  ): Promise<VisualAsset[]> {
    const visuals: VisualAsset[] = [];
    for (const [index, slide] of deckPlan.slides.entries()) {
      if (!shouldGenerateImageForSlide(slide, index, deckPlan.slides.length)) {
        const progress = 38 + Math.round(((index + 1) / deckPlan.slides.length) * 34);
        await onProgress(progress);
        continue;
      }

      try {
        const dataUri = await client.generateImage({
          prompt: slide.visualPrompt,
          slide,
          deckPlan,
        });
        visuals.push({ slideId: slide.id, dataUri, source: "minimax" });
      } catch (err) {
        const warning = `第 ${index + 1} 页图片生成失败，已使用本地设计背景 fallback：${
          err instanceof Error ? err.message : String(err)
        }`;
        warningsRef.push(warning);
        visuals.push({
          ...buildFallbackVisual(deckPlan, slide, index),
          warning,
        });
      }

      const progress = 38 + Math.round(((index + 1) / deckPlan.slides.length) * 34);
      await onProgress(progress);
    }
    return visuals;
  }

  async function ensureJobOutputDir(userId: string, jobId: string): Promise<string> {
    const root = join(workspaceRoot, "ppt-agent", userId);
    const dir = assertWithinRoot(root, join(root, jobId));
    await mkdir(dir, { recursive: true });
    return dir;
  }

  async function getRequiredJob(jobId: string, userId: string): Promise<PptAgentJob> {
    const job = await repository.getJobForUser(jobId, userId);
    if (!job) throw new PptAgentPublicError("PPT 生成任务不存在", 404);
    return job;
  }

  return {
    createAndStartJob,
    runJob,
    listJobs,
    getJob,
    getDownload,
  };
}

export async function createDefaultPptAgentService(): Promise<PptAgentService> {
  return createPptAgentService({
    repository: await createDbPptAgentRepository(),
    client: new MiniMaxClient(await getActivePptAiRuntimeConfig()),
  });
}

export async function createDbPptAgentRepository(): Promise<PptAgentRepository> {
  const [{ db }, schema, drizzle] = await Promise.all([
    import("../../db"),
    import("../../db/schema"),
    import("drizzle-orm"),
  ]);

  const mapRow = (row: typeof schema.pptAgentJobs.$inferSelect): PptAgentJob => ({
    id: row.id,
    userId: row.userId,
    prompt: row.prompt,
    status: row.status,
    progress: row.progress,
    stage: row.stage,
    errorMessage: row.errorMessage,
    deckPlan: (row.deckPlan as DeckPlan | null) ?? null,
    resultStoragePath: row.resultStoragePath,
    resultFilename: row.resultFilename,
    warnings: Array.isArray(row.warnings) ? row.warnings : [],
    trace: Array.isArray(row.trace) ? (row.trace as PptAgentTraceEvent[]) : [],
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    completedAt: row.completedAt,
  });

  return {
    async createJob(input) {
      const [row] = await db
        .insert(schema.pptAgentJobs)
        .values({
          userId: input.userId,
          prompt: input.prompt,
          status: "queued",
          progress: 0,
          stage: "queued",
          warnings: input.warnings ?? [],
          trace: input.trace ?? [],
        })
        .returning();
      return mapRow(row);
    },

    async updateJob(jobId, patch) {
      const [row] = await db
        .update(schema.pptAgentJobs)
        .set({
          ...patch,
          updatedAt: new Date(),
        })
        .where(drizzle.eq(schema.pptAgentJobs.id, jobId))
        .returning();
      return mapRow(row);
    },

    async getJobForUser(jobId, userId) {
      const [row] = await db
        .select()
        .from(schema.pptAgentJobs)
        .where(
          drizzle.and(
            drizzle.eq(schema.pptAgentJobs.id, jobId),
            drizzle.eq(schema.pptAgentJobs.userId, userId),
          ),
        )
        .limit(1);
      return row ? mapRow(row) : null;
    },

    async listJobsForUser(userId) {
      const rows = await db
        .select()
        .from(schema.pptAgentJobs)
        .where(drizzle.eq(schema.pptAgentJobs.userId, userId))
        .orderBy(drizzle.desc(schema.pptAgentJobs.createdAt))
        .limit(50);
      return rows.map(mapRow);
    },
  };
}

export function createMemoryPptAgentRepository(seed: PptAgentJob[] = []): PptAgentRepository & {
  rows: Map<string, PptAgentJob>;
} {
  const rows = new Map(seed.map((job) => [job.id, job]));
  return {
    rows,
    async createJob(input) {
      const now = new Date();
      const job: PptAgentJob = {
        id: `job-${rows.size + 1}`,
        userId: input.userId,
        prompt: input.prompt,
        status: "queued",
        progress: 0,
        stage: "queued",
        errorMessage: null,
        deckPlan: null,
        resultStoragePath: null,
        resultFilename: null,
        warnings: input.warnings ?? [],
        trace: input.trace ?? [],
        createdAt: now,
        updatedAt: now,
        completedAt: null,
      };
      rows.set(job.id, job);
      return job;
    },
    async updateJob(jobId, patch) {
      const existing = rows.get(jobId);
      if (!existing) throw new Error("JOB_NOT_FOUND");
      const updated: PptAgentJob = {
        ...existing,
        ...patch,
        updatedAt: new Date(),
      };
      rows.set(jobId, updated);
      return updated;
    },
    async getJobForUser(jobId, userId) {
      const job = rows.get(jobId);
      return job?.userId === userId ? job : null;
    },
    async listJobsForUser(userId) {
      return Array.from(rows.values())
        .filter((job) => job.userId === userId)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    },
  };
}

function normalizeInput(input: PptAgentCreateInput): Required<PptAgentCreateInput> {
  const prompt = input.prompt.trim();
  if (!prompt) throw new PptAgentPublicError("请输入 PPT 生成提示词");
  return {
    prompt,
    slideCount: defaultSlideCount(input.slideCount),
    style: input.style?.trim() || "auto",
  };
}

function buildResultFilename(deckPlan: DeckPlan): string {
  const base = sanitizeFilename(deckPlan.title).slice(0, 80) || "ppt-agent";
  return base.endsWith(".pptx") ? base : `${base}.pptx`;
}

function traceEvent(
  stage: PptAgentStage,
  message: string,
  details?: Record<string, unknown>,
): PptAgentTraceEvent {
  return {
    stage,
    message,
    timestamp: new Date().toISOString(),
    details,
  };
}

function publicErrorMessage(err: unknown): string {
  if (err instanceof MiniMaxConfigError) return err.message;
  if (err instanceof PptAgentPublicError) return err.message;

  const raw = err instanceof Error ? err.message : String(err);
  const apiKey = process.env.MINIMAX_API_KEY;
  return apiKey ? raw.replaceAll(apiKey, "[REDACTED]") : raw;
}
