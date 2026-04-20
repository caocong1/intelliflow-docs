export type MvpPageType =
  | "cover"
  | "toc"
  | "comparison"
  | "timeline"
  | "process"
  | "device_overview";
export type MvpVariantId =
  | "cover_hero_image"
  | "toc_card_grid_8"
  | "comparison_dual_image"
  | "timeline_horizontal_5"
  | "process_flow_5"
  | "device_triptych_3";
export type PageFamilyId = string;
export type ExportComplexity = "native_editable" | "hybrid_candidate";
export type PageExportStrategy = "native_editable" | "hybrid";

export type PresentationOutline = {
  version: "presentation_outline/v1";
  title: string;
  audience: string;
  language: string;
  sections: Array<{
    id: string;
    title: string;
    intent: string;
    priority: "high" | "medium" | "low";
  }>;
};

export type VisualBrief = {
  version: "visual_brief/v1";
  deckTone: string;
  colorMode: string;
  imageLanguage: string;
  iconLanguage: string;
  shapeLanguage: string;
  density: "low" | "medium" | "high";
  avoid: string[];
};

export type PagePlan = {
  version: "page_plan/v1";
  pages: MvpPageDefinition[];
};

export type MvpPageDefinition =
  | {
      pageId: string;
      pageType: "cover";
      variantHint: MvpVariantId & "cover_hero_image";
      title: string;
      subtitle: string;
      eyebrow: string;
      audienceLine: string;
      speakerNote?: string;
    }
  | {
      pageId: string;
      pageType: "toc";
      variantHint: MvpVariantId & "toc_card_grid_8";
      title: string;
      eyebrow: string;
      items: Array<{ index: string; title: string; subtitle: string }>;
      speakerNote?: string;
    }
  | {
      pageId: string;
      pageType: "comparison";
      variantHint: MvpVariantId & "comparison_dual_image";
      title: string;
      eyebrow: string;
      leftTitle: string;
      rightTitle: string;
      leftBullets: string[];
      rightBullets: string[];
      speakerNote?: string;
    }
  | {
      pageId: string;
      pageType: "timeline";
      variantHint: MvpVariantId & "timeline_horizontal_5";
      title: string;
      eyebrow: string;
      summary: string;
      nodes: Array<{ year: string; title: string; detail: string }>;
      speakerNote?: string;
    }
  | {
      pageId: string;
      pageType: "process";
      variantHint: MvpVariantId & "process_flow_5";
      title: string;
      eyebrow: string;
      summary: string;
      steps: Array<{ index: string; title: string; detail: string }>;
      speakerNote?: string;
    }
  | {
      pageId: string;
      pageType: "device_overview";
      variantHint: MvpVariantId & "device_triptych_3";
      title: string;
      eyebrow: string;
      summary: string;
      devices: Array<{ name: string; scenario: string; note: string }>;
      speakerNote?: string;
    };

export type AssetPlan = {
  version: "asset_plan/v1";
  pageAssets: Array<{
    pageId: string;
    assets: Array<{
      slot: string;
      kind: "background_photo" | "illustration" | "icon";
      source:
        | {
            type: "pptx_media";
            pptxPath: string;
            mediaPath: string;
          }
        | {
            type: "file";
            path: string;
          };
    }>;
  }>;
};

export type SlotValueKind =
  | "string"
  | "stringArray"
  | "tocItems"
  | "timelineNodes"
  | "processSteps"
  | "deviceItems"
  | "asset";

export type SlotRule = {
  name: string;
  kind: SlotValueKind;
  required: boolean;
  maxChars?: number;
  maxItems?: number;
  maxItemChars?: number;
};

export type ArchetypeSlotSchema = {
  variantId: MvpVariantId;
  pageType: MvpPageType;
  slots: SlotRule[];
};

export type VariantDefinition = {
  variantId: MvpVariantId;
  familyId: PageFamilyId;
  pageType: MvpPageType;
  narrativeRole: string;
  exportComplexity: ExportComplexity;
  schema: ArchetypeSlotSchema;
};

export type PageFamilyDefinition = {
  familyId: PageFamilyId;
  name: string;
  benchmarkSources: string[];
  description: string;
  visualContract: {
    backgroundMode: "muted_texture";
    titleBlock: "top_left";
    notePolicy: "speaker_notes_first";
    cardStyle: "soft_white_cards";
    imageContainer: "white_panel_image";
  };
  variants: VariantDefinition[];
};

export type FittedPageSlots = {
  pageId: string;
  pageType: MvpPageType;
  variantId: MvpVariantId;
  familyId: PageFamilyId;
  slots: Record<string, unknown>;
  warnings: string[];
  speakerNote?: string;
};

export type CanvasPageFrame = {
  pageId: string;
  pageType: MvpPageType;
  familyId: PageFamilyId;
  variantId: MvpVariantId;
  narrativeRole: string;
  exportComplexity: ExportComplexity;
  frameContract: {
    backgroundMode: "muted_texture";
    titleBlock: "top_left";
    notePolicy: "speaker_notes_first";
  };
};

export type CanvasRenderModel = {
  version: "canvas_render_model/v1";
  deckTitle: string;
  language: string;
  familyId: PageFamilyId;
  familyName: string;
  theme: {
    colors: {
      bg: string;
      surface: string;
      text: string;
      textMuted: string;
      primary: string;
      accent: string;
      outline: string;
      success: string;
    };
    fonts: {
      title: string;
      body: string;
      mono: string;
    };
  };
  pageFrames: CanvasPageFrame[];
  pages: FittedPageSlots[];
};

export type DeckExportPlan = {
  primaryStrategy: PageExportStrategy;
  notesMode: "ppt_speaker_notes";
  pageStrategies: Array<{
    pageId: string;
    variantId: MvpVariantId;
    strategy: PageExportStrategy;
    exportComplexity: ExportComplexity;
  }>;
};

export type NativeTemplateSource =
  | {
      kind: "hand_authored";
      label: string;
    }
  | {
      kind: "ingested_template";
      templateJsonPath: string;
      presetId?: string;
    }
  | {
      kind: "visual_brief";
      briefPath: string;
    };

export type NativeTemplatePrimitiveKind =
  | "title_block"
  | "hero_panel"
  | "info_rail"
  | "card"
  | "image_frame"
  | "badge"
  | "timeline_node"
  | "process_step"
  | "footer_summary";

export type NativeTemplatePrimitive = {
  id: string;
  kind: NativeTemplatePrimitiveKind;
  description: string;
  requiredSlots?: string[];
  defaults?: Record<string, string | number | boolean>;
};

export type NativeTemplateVariantBinding = {
  variantId: MvpVariantId;
  pageType: MvpPageType;
  requiredPrimitives: string[];
  optionalPrimitives: string[];
  requiredAssetSlots: string[];
  contentRules: string[];
  notesPolicy: "speaker_notes_first";
};

export type NativeTemplateAssetRule = {
  slot: string;
  usage: "required" | "optional";
  treatment:
    | "background_cover"
    | "texture_overlay"
    | "image_panel"
    | "image_contain"
    | "icon_badge";
  variantIds: MvpVariantId[];
};

export type NativeTemplateLayoutShape = {
  id: number;
  kind: "text" | "image" | "group" | "chart" | "shape";
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
  placeholderType?: string;
  textSample?: string;
  mediaTarget?: string;
};

export type NativeTemplateLayoutBinding = {
  variantId: MvpVariantId;
  sourceSlideIndex: number;
  sourceSlidePath: string;
  sourceLayoutPath?: string;
  sourceLayoutType?: string;
  sourceLayoutName?: string;
  candidateRole?: string;
  shapes: NativeTemplateLayoutShape[];
};

export type NativeTemplate = {
  version: "native_template/v1";
  templateId: string;
  familyId: string;
  familyName: string;
  source: NativeTemplateSource;
  tokens: {
    colors: {
      bg: string;
      surface: string;
      text: string;
      textMuted: string;
      primary: string;
      accent: string;
      outline: string;
      success: string;
    };
    typography: {
      title: string;
      body: string;
      mono: string;
      eyebrow?: string;
    };
    spacing: {
      pagePadding: number;
      sectionGap: number;
      cardGap: number;
      titleGap: number;
    };
    radius: {
      card: number;
      pill: number;
      image: number;
    };
    stroke: {
      thin: number;
      strong: number;
    };
    shadow: {
      cardOpacity: number;
      cardBlur: number;
      cardOffset: number;
    };
  };
  primitives: NativeTemplatePrimitive[];
  variantBindings: NativeTemplateVariantBinding[];
  assetRules: NativeTemplateAssetRule[];
  layoutBindings: NativeTemplateLayoutBinding[];
  notes: string[];
};

export type IngestedTemplateDescriptor = {
  template_id: string;
  source_file: string;
  source_basename: string;
  ingested_at: string;
  design_tokens: {
    color_palette: {
      primary: string | null;
      secondary: string | null;
      accent: string[];
      neutral: string[];
      link: string | null;
      followed_link: string | null;
      raw_scheme: Record<string, string | undefined>;
      override_scheme: Record<string, string | undefined> | null;
      direct_palette_top10: Array<{ color: string; uses: number }>;
    };
    typography: {
      title_font_latin: string | null;
      body_font_latin: string | null;
      title_font_ea: string | null;
      body_font_ea: string | null;
      additional_fonts: string[];
    };
    layout_rhythm: {
      page_count: number;
      layout_count: number;
      avg_text_density: "low" | "mid" | "high";
      page_xml_size_distribution: {
        min: number;
        max: number;
        median: number;
      };
    };
  };
  layouts_extracted: Array<{
    fileName: string;
    layoutType: string;
    matchingName: string;
    placeholderTypes: string[];
    shapeCount: number;
  }>;
  slide_examples: Array<{
    fileName: string;
    index: number;
    shapeCount: number;
    groupCount: number;
    picCount: number;
    textBoxCount: number;
    hasChart: boolean;
    directColors: string[];
    rawSize: number;
  }>;
  asset_library: {
    media_count: number;
    media_total_bytes: number;
    images: Array<{ path: string; fileName: string; size: number; ext: string; kind: string }>;
    icons: Array<{ path: string; fileName: string; size: number; ext: string; kind: string }>;
    audio: Array<{ path: string; fileName: string; size: number; ext: string; kind: string }>;
    other: Array<{ path: string; fileName: string; size: number; ext: string; kind: string }>;
    has_charts: boolean;
    chart_count: number;
  };
  ai_consumable_summary: string;
  notes?: string[];
};
