export type PptAgentJobStatus = "queued" | "running" | "completed" | "failed";

export type PptAgentStage =
  | "queued"
  | "outline_planner"
  | "style_director"
  | "slide_composer"
  | "deck_reviewer"
  | "design_director"
  | "design_critic"
  | "visual_generator"
  | "renderer"
  | "qa"
  | "completed"
  | "failed";

export type PptAgentCreateInput = {
  prompt: string;
  slideCount?: number;
  style?: string;
};

export type DeckTheme = {
  palette: string[];
  mood: string;
  referenceKeywords: string[];
  visualMotif: string;
  paletteDominance: string;
};

export type DeckContentBlock = {
  heading?: string;
  body: string;
  emphasis?: "normal" | "strong" | "metric";
};

export type DeckChart = {
  title: string;
  labels: string[];
  values: number[];
  unit?: string;
};

export type DeckTable = {
  title?: string;
  headers: string[];
  rows: string[][];
};

export type DeckTimelineItem = {
  label: string;
  description: string;
  date?: string;
};

export type DeckSlide = {
  id: string;
  pageType:
    | "cover"
    | "agenda"
    | "section"
    | "problem"
    | "strategy"
    | "architecture"
    | "capability"
    | "governance"
    | "scenario"
    | "timeline"
    | "metrics"
    | "table"
    | "risk"
    | "summary"
    | "closing";
  layoutPattern: string;
  title: string;
  subtitle?: string;
  keyMessage: string;
  contentBlocks: DeckContentBlock[];
  chart?: DeckChart;
  table?: DeckTable;
  timeline?: DeckTimelineItem[];
  visualPrompt: string;
  speakerNotes: string;
  layoutIntent: string;
  contentDensity: "low" | "medium" | "high";
  visualHierarchy: string;
};

export type DeckPlan = {
  title: string;
  subtitle: string;
  audience: string;
  visualDirection: string;
  theme: DeckTheme;
  slides: DeckSlide[];
};

export type VisualAsset = {
  slideId: string;
  dataUri: string;
  source: "minimax" | "fallback";
  warning?: string;
};

export type PptAgentTraceEvent = {
  stage: PptAgentStage;
  message: string;
  timestamp: string;
  details?: Record<string, unknown>;
};

export type PptAgentJob = {
  id: string;
  userId: string;
  prompt: string;
  status: PptAgentJobStatus;
  progress: number | null;
  stage: PptAgentStage | string | null;
  errorMessage: string | null;
  deckPlan: DeckPlan | null;
  resultStoragePath: string | null;
  resultFilename: string | null;
  warnings: string[];
  trace: PptAgentTraceEvent[];
  createdAt: Date;
  updatedAt: Date;
  completedAt: Date | null;
};

export type PptAgentJobPatch = Partial<
  Pick<
    PptAgentJob,
    | "status"
    | "progress"
    | "stage"
    | "errorMessage"
    | "deckPlan"
    | "resultStoragePath"
    | "resultFilename"
    | "warnings"
    | "trace"
    | "completedAt"
  >
>;

export type PptAgentRepository = {
  createJob(input: {
    userId: string;
    prompt: string;
    warnings?: string[];
    trace?: PptAgentTraceEvent[];
  }): Promise<PptAgentJob>;
  updateJob(jobId: string, patch: PptAgentJobPatch): Promise<PptAgentJob>;
  getJobForUser(jobId: string, userId: string): Promise<PptAgentJob | null>;
  listJobsForUser(userId: string): Promise<PptAgentJob[]>;
};

export type PptAiClient = {
  assertReady(): void;
  createDeckPlan(input: {
    prompt: string;
    slideCount: number;
    style: string;
    validationErrors?: string[];
  }): Promise<unknown>;
  rewriteDeckPlan(input: {
    prompt: string;
    slideCount: number;
    style: string;
    deckPlan: DeckPlan;
    critique: string[];
  }): Promise<unknown>;
  generateImage(input: { prompt: string; slide: DeckSlide; deckPlan: DeckPlan }): Promise<string>;
  composeSlide?(input: {
    prompt: string;
    style: string;
    slide: DeckSlide;
    deckPlan: DeckPlan;
    styleDnaSummary: string;
    validationErrors?: string[];
    fixReason?: string;
  }): Promise<unknown>;
  reviewDeck?(input: { deckPlan: DeckPlan; style: string; prompt: string }): Promise<unknown>;
};

export type RenderedPpt = {
  buffer: Buffer;
  warnings: string[];
};

export type QaReport = {
  warnings: string[];
  slideCount: number;
  notesCount: number;
};

export const PPTX_MIME_TYPE =
  "application/vnd.openxmlformats-officedocument.presentationml.presentation";
