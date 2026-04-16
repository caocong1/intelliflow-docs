// ─── Built-in PPT Style Packs ────────────────────────────────────────────────
// Code-only definitions — no DB, no user upload.
// Each pack fully specifies palette, fonts, cover treatment, shape language,
// and table styling so the archetype renderer can produce consistent output.

export interface StylePackFont {
  face: string;
  size: number;
  bold: boolean;
}

export interface StylePack {
  id: string;
  label: string;
  palette: {
    primary: string; // hex without #
    secondary: string;
    accent: string;
    text: string;
    textLight: string;
    background: string;
    surface: string;
    tableHeader: string;
    tableStripe: string;
    divider: string;
  };
  fonts: {
    title: StylePackFont;
    subtitle: StylePackFont;
    body: StylePackFont;
    caption: StylePackFont;
    kpi: StylePackFont;
  };
  cover: {
    backgroundFill: "solid" | "gradient" | "accent_bar";
    gradientStops?: Array<{ position: number; color: string }>;
    titleAlign: "center" | "left";
  };
  shapes: {
    cornerRadius: number; // inches, 0 = sharp
    cardShadow: boolean;
    dividerStyle: "line" | "dot" | "none";
  };
  table: {
    headerFill: string;
    stripeFill: string;
    borderColor: string;
    borderWidth: number; // pt
  };
}

// ─── 6 Built-in Style Packs ─────────────────────────────────────────────────

const corporateBlue: StylePack = {
  id: "corporate_blue",
  label: "商务深蓝",
  palette: {
    primary: "1E3A5F",
    secondary: "3B82F6",
    accent: "F59E0B",
    text: "1F2937",
    textLight: "6B7280",
    background: "FFFFFF",
    surface: "F8FAFC",
    tableHeader: "1E3A5F",
    tableStripe: "F1F5F9",
    divider: "E2E8F0",
  },
  fonts: {
    title: { face: "Microsoft YaHei", size: 32, bold: true },
    subtitle: { face: "Microsoft YaHei", size: 18, bold: false },
    body: { face: "Microsoft YaHei", size: 14, bold: false },
    caption: { face: "Microsoft YaHei", size: 10, bold: false },
    kpi: { face: "Microsoft YaHei", size: 44, bold: true },
  },
  cover: {
    backgroundFill: "gradient",
    gradientStops: [
      { position: 0, color: "1E3A5F" },
      { position: 100, color: "2563EB" },
    ],
    titleAlign: "center",
  },
  shapes: { cornerRadius: 0.08, cardShadow: true, dividerStyle: "line" },
  table: { headerFill: "1E3A5F", stripeFill: "F1F5F9", borderColor: "E2E8F0", borderWidth: 0.5 },
};

const minimalGold: StylePack = {
  id: "minimal_gold",
  label: "极简白金",
  palette: {
    primary: "78716C",
    secondary: "A8A29E",
    accent: "B8860B",
    text: "292524",
    textLight: "78716C",
    background: "FAFAF9",
    surface: "F5F5F4",
    tableHeader: "44403C",
    tableStripe: "F5F5F4",
    divider: "E7E5E4",
  },
  fonts: {
    title: { face: "Microsoft YaHei", size: 30, bold: true },
    subtitle: { face: "Microsoft YaHei", size: 16, bold: false },
    body: { face: "Microsoft YaHei", size: 13, bold: false },
    caption: { face: "Microsoft YaHei", size: 10, bold: false },
    kpi: { face: "Microsoft YaHei", size: 42, bold: true },
  },
  cover: {
    backgroundFill: "accent_bar",
    titleAlign: "left",
  },
  shapes: { cornerRadius: 0, cardShadow: false, dividerStyle: "line" },
  table: { headerFill: "44403C", stripeFill: "F5F5F4", borderColor: "E7E5E4", borderWidth: 0.5 },
};

const techDark: StylePack = {
  id: "tech_dark",
  label: "科技深色",
  palette: {
    primary: "6366F1",
    secondary: "818CF8",
    accent: "22D3EE",
    text: "F1F5F9",
    textLight: "94A3B8",
    background: "0F172A",
    surface: "1E293B",
    tableHeader: "334155",
    tableStripe: "1E293B",
    divider: "334155",
  },
  fonts: {
    title: { face: "Microsoft YaHei", size: 32, bold: true },
    subtitle: { face: "Microsoft YaHei", size: 18, bold: false },
    body: { face: "Microsoft YaHei", size: 14, bold: false },
    caption: { face: "Microsoft YaHei", size: 10, bold: false },
    kpi: { face: "Microsoft YaHei", size: 46, bold: true },
  },
  cover: {
    backgroundFill: "gradient",
    gradientStops: [
      { position: 0, color: "0F172A" },
      { position: 100, color: "312E81" },
    ],
    titleAlign: "center",
  },
  shapes: { cornerRadius: 0.1, cardShadow: true, dividerStyle: "line" },
  table: { headerFill: "334155", stripeFill: "1E293B", borderColor: "475569", borderWidth: 0.5 },
};

const consultingGray: StylePack = {
  id: "consulting_gray",
  label: "咨询灰蓝",
  palette: {
    primary: "475569",
    secondary: "64748B",
    accent: "2563EB",
    text: "1E293B",
    textLight: "64748B",
    background: "FFFFFF",
    surface: "F8FAFC",
    tableHeader: "475569",
    tableStripe: "F8FAFC",
    divider: "CBD5E1",
  },
  fonts: {
    title: { face: "Microsoft YaHei", size: 28, bold: true },
    subtitle: { face: "Microsoft YaHei", size: 16, bold: false },
    body: { face: "Microsoft YaHei", size: 13, bold: false },
    caption: { face: "Microsoft YaHei", size: 10, bold: false },
    kpi: { face: "Microsoft YaHei", size: 40, bold: true },
  },
  cover: {
    backgroundFill: "solid",
    titleAlign: "left",
  },
  shapes: { cornerRadius: 0, cardShadow: false, dividerStyle: "dot" },
  table: { headerFill: "475569", stripeFill: "F8FAFC", borderColor: "CBD5E1", borderWidth: 0.5 },
};

const highContrast: StylePack = {
  id: "high_contrast",
  label: "高对比演示",
  palette: {
    primary: "111827",
    secondary: "374151",
    accent: "EF4444",
    text: "111827",
    textLight: "4B5563",
    background: "FFFFFF",
    surface: "F9FAFB",
    tableHeader: "111827",
    tableStripe: "F3F4F6",
    divider: "D1D5DB",
  },
  fonts: {
    title: { face: "Microsoft YaHei", size: 34, bold: true },
    subtitle: { face: "Microsoft YaHei", size: 20, bold: false },
    body: { face: "Microsoft YaHei", size: 15, bold: false },
    caption: { face: "Microsoft YaHei", size: 11, bold: false },
    kpi: { face: "Microsoft YaHei", size: 48, bold: true },
  },
  cover: {
    backgroundFill: "solid",
    titleAlign: "center",
  },
  shapes: { cornerRadius: 0, cardShadow: false, dividerStyle: "line" },
  table: { headerFill: "111827", stripeFill: "F3F4F6", borderColor: "D1D5DB", borderWidth: 1 },
};

const warmReview: StylePack = {
  id: "warm_review",
  label: "暖色复盘",
  palette: {
    primary: "9A3412",
    secondary: "C2410C",
    accent: "D97706",
    text: "292524",
    textLight: "78716C",
    background: "FFFBEB",
    surface: "FEF3C7",
    tableHeader: "9A3412",
    tableStripe: "FEF3C7",
    divider: "FDE68A",
  },
  fonts: {
    title: { face: "Microsoft YaHei", size: 30, bold: true },
    subtitle: { face: "Microsoft YaHei", size: 17, bold: false },
    body: { face: "Microsoft YaHei", size: 14, bold: false },
    caption: { face: "Microsoft YaHei", size: 10, bold: false },
    kpi: { face: "Microsoft YaHei", size: 42, bold: true },
  },
  cover: {
    backgroundFill: "gradient",
    gradientStops: [
      { position: 0, color: "9A3412" },
      { position: 100, color: "D97706" },
    ],
    titleAlign: "center",
  },
  shapes: { cornerRadius: 0.12, cardShadow: true, dividerStyle: "none" },
  table: { headerFill: "9A3412", stripeFill: "FEF3C7", borderColor: "FDE68A", borderWidth: 0.5 },
};

// ─── Registry ────────────────────────────────────────────────────────────────

export const STYLE_PACKS: readonly StylePack[] = [
  corporateBlue,
  minimalGold,
  techDark,
  consultingGray,
  highContrast,
  warmReview,
];

const packMap = new Map(STYLE_PACKS.map((p) => [p.id, p]));

export const DEFAULT_STYLE_PACK_ID = "corporate_blue";

export function getStylePack(id: string): StylePack | undefined {
  return packMap.get(id);
}

export function listStylePacks(): Array<{ id: string; label: string }> {
  return STYLE_PACKS.map((p) => ({ id: p.id, label: p.label }));
}
