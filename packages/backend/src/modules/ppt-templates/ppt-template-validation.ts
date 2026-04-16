import type { NativeTemplateProfile } from "./native-template-profile";

export type ParsedTemplateValidationInput = {
  layouts: Map<string, Set<string>>;
  allPlaceholders: Set<string>;
  warnings: string[];
  profile: NativeTemplateProfile | null;
};

export type NativeTemplateValidationResult = {
  usable: boolean;
  warnings: string[];
  details: {
    hasPlaceholderTitle: boolean;
    hasPlaceholderBody: boolean;
    hasProfileTitleLikeSlide: boolean;
    hasProfileContentLikeSlide: boolean;
    hasAnyRecognizedSlide: boolean;
  };
};

export function validateParsedNativeTemplate(
  parsed: ParsedTemplateValidationInput,
): NativeTemplateValidationResult {
  let hasPlaceholderTitle = false;
  let hasPlaceholderBody = false;

  for (const [, placeholders] of parsed.layouts) {
    if (placeholders.has("TITLE")) hasPlaceholderTitle = true;
    if (placeholders.has("BODY")) hasPlaceholderBody = true;
  }

  const slides = parsed.profile?.slides ?? [];
  const hasProfileTitleLikeSlide = slides.some(
    (slide) =>
      Boolean(slide.titleSlot || slide.subtitleSlot) ||
      slide.semanticRole === "cover" ||
      slide.semanticRole === "toc" ||
      slide.semanticRole === "section_break" ||
      slide.semanticRole === "closing" ||
      slide.sampleTextSummary.length > 0,
  );
  const hasProfileContentLikeSlide = slides.some(
    (slide) =>
      Boolean(
        slide.bodySlot ||
          slide.leftSlot ||
          slide.rightSlot ||
          slide.tableSlot ||
          slide.imageSlot,
      ) ||
      slide.semanticRole === "bullet_list" ||
      slide.semanticRole === "comparison" ||
      slide.semanticRole === "timeline" ||
      slide.semanticRole === "table" ||
      slide.semanticRole === "image_focus" ||
      slide.semanticRole === "summary" ||
      slide.semanticRole === "qna" ||
      slide.sampleTextSummary.length >= 2,
  );
  const hasAnyRecognizedSlide = slides.some(
    (slide) => slide.autoUse !== false && slide.sampleTextSummary.length > 0,
  );

  const warnings = [...parsed.warnings];
  if (!hasPlaceholderTitle || !hasPlaceholderBody) {
    warnings.push("模板未显式提供 {{TITLE}}/{{BODY}} 占位符，将依赖自动画像识别与后续人工校正。");
  }
  if (!hasPlaceholderTitle && hasProfileTitleLikeSlide) {
    warnings.push("标题区域通过自动识别推断获得，建议上传后检查封面/章节页语义。");
  }
  if (!hasPlaceholderBody && hasProfileContentLikeSlide) {
    warnings.push("正文区域通过自动识别推断获得，建议上传后检查正文页槽位映射。");
  }

  const usable =
    (hasPlaceholderTitle && hasPlaceholderBody) ||
    (hasAnyRecognizedSlide && hasProfileTitleLikeSlide && hasProfileContentLikeSlide);

  return {
    usable,
    warnings: [...new Set(warnings)],
    details: {
      hasPlaceholderTitle,
      hasPlaceholderBody,
      hasProfileTitleLikeSlide,
      hasProfileContentLikeSlide,
      hasAnyRecognizedSlide,
    },
  };
}

