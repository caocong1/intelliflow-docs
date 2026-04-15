const TEMPLATE_SLOT_KEYS = [
  "TITLE",
  "SUBTITLE",
  "BODY",
  "LEFT",
  "RIGHT",
  "TABLE",
  "IMAGE",
  "CAPTION",
  "NOTES",
  "FOOTER",
  "PAGE_NUM",
] as const;

const IMAGE_VISUAL_TYPES = new Set([
  "picture",
  "svgImage",
  "imageFilledShape",
  "bitmap",
  "pictogram",
  "3dModel",
]);

const SAMPLE_TITLE_PATTERNS = [
  /输入标题文字/i,
  /过渡页标题/i,
  /thankyou/i,
  /谢谢观看/i,
  /thanks/i,
] as const;

const SAMPLE_BODY_PATTERNS = [
  /您的内容打在这里/i,
  /只保留文字/i,
  /复制您的文本/i,
  /输入正文/i,
  /输入内容/i,
] as const;

const SAMPLE_SUBTITLE_PATTERNS = [
  /20xx/i,
  /theme/i,
  /businesspowerpoint/i,
  /standardtemplate/i,
  /20\d{2}/i,
] as const;

export type TemplateSlotTag = (typeof TEMPLATE_SLOT_KEYS)[number];
export type TemplateSelector =
  | string
  | {
      creationId?: string;
      name: string;
      nameIdx?: number;
    };

export type TemplatePosition = { x: number; y: number; cx: number; cy: number };

export type NativeTemplateSlot = {
  selector: TemplateSelector;
  position: TemplatePosition;
  explicitTag?: TemplateSlotTag;
  visualType?: string;
  source?: "explicit" | "slide" | "layout" | "sample";
};

export type NativeTemplateProfileSlide = {
  slideId: number;
  slideNumber: number;
  layoutName: string;
  hasFullBleedImage: boolean;
  selectors: TemplateSelector[];
  roleHints: Array<"title" | "content" | "two_column" | "table" | "image" | "blank">;
  titleSlot?: NativeTemplateSlot;
  subtitleSlot?: NativeTemplateSlot;
  bodySlot?: NativeTemplateSlot;
  leftSlot?: NativeTemplateSlot;
  rightSlot?: NativeTemplateSlot;
  tableSlot?: NativeTemplateSlot;
  imageSlot?: NativeTemplateSlot;
  captionSlot?: NativeTemplateSlot;
  notesSlot?: NativeTemplateSlot;
  footerSlot?: NativeTemplateSlot;
  pageNumSlot?: NativeTemplateSlot;
};

export type NativeTemplateProfile = {
  kind: "native_template_profile_v1";
  version: 1;
  summary: {
    slideCount: number;
    placeholderTags: TemplateSlotTag[];
    recognizedRoleCounts: Record<string, number>;
  };
  slides: NativeTemplateProfileSlide[];
};

export type NativeTemplateElement = {
  creationId?: string;
  name: string;
  nameIdx?: number;
  position: TemplatePosition;
  type?: string;
  hasTextBody: boolean;
  getText: () => string[];
  getPlaceholderInfo?: () => { type?: string };
  visualType: string;
};

export type NativeTemplateLayoutPlaceholder = {
  type: string;
  idx: number;
  position?: TemplatePosition;
};

export type NativeTemplateInfo = {
  name: string;
  slides: Array<{
    id: number;
    number: number;
    info?: {
      layoutName?: string;
      layoutPlaceholders?: NativeTemplateLayoutPlaceholder[];
    };
    elements: NativeTemplateElement[];
  }>;
};

function selectorKey(selector: TemplateSelector): string {
  if (typeof selector === "string") return selector;
  return selector.creationId ?? `${selector.name}:${selector.nameIdx ?? 0}`;
}

function buildTemplateSelector(element: {
  creationId?: string;
  name: string;
  nameIdx?: number;
}): TemplateSelector {
  if (element.creationId) {
    return {
      creationId: element.creationId,
      name: element.name,
      nameIdx: element.nameIdx,
    };
  }
  if (element.nameIdx && element.nameIdx > 0) {
    return { name: element.name, nameIdx: element.nameIdx };
  }
  return element.name;
}

function uniqueSlots(slots: NativeTemplateSlot[]): NativeTemplateSlot[] {
  const seen = new Set<string>();
  const unique: NativeTemplateSlot[] = [];
  for (const slot of slots) {
    const key = selectorKey(slot.selector);
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(slot);
  }
  return unique;
}

function normalizeSlots(slots?: NativeTemplateSlot[]): NativeTemplateSlot[] {
  return uniqueSlots(slots ?? []);
}

function sortSlotsByPosition(slots: NativeTemplateSlot[]): NativeTemplateSlot[] {
  return [...slots].sort((a, b) => {
    if (a.position.y !== b.position.y) return a.position.y - b.position.y;
    return a.position.x - b.position.x;
  });
}

function pickFirstSlot(
  ...slotGroups: Array<NativeTemplateSlot[] | undefined>
): NativeTemplateSlot | undefined {
  for (const group of slotGroups) {
    if (group && group.length > 0) return group[0];
  }
  return undefined;
}

function isTemplateTag(value: string): value is TemplateSlotTag {
  return (TEMPLATE_SLOT_KEYS as readonly string[]).includes(value);
}

function extractTemplateTags(texts: string[]): TemplateSlotTag[] {
  const tags: TemplateSlotTag[] = [];
  for (const text of texts) {
    const matches = text.matchAll(/\{\{([A-Z_]+)\}\}/g);
    for (const match of matches) {
      if (match[1] && isTemplateTag(match[1])) {
        tags.push(match[1]);
      }
    }
  }
  return tags;
}

function normalizeTemplateText(text: string): string {
  return text.replace(/\s+/g, "").toLowerCase();
}

function textMatchesAny(text: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(text));
}

function deriveSlotTagFromPlaceholderType(
  placeholderType: string,
): TemplateSlotTag | null {
  switch (placeholderType) {
    case "title":
    case "ctrTitle":
      return "TITLE";
    case "subTitle":
      return "SUBTITLE";
    case "body":
      return "BODY";
    case "pic":
      return "IMAGE";
    case "tbl":
      return "TABLE";
    case "ftr":
      return "FOOTER";
    case "sldNum":
      return "PAGE_NUM";
    default:
      return null;
  }
}

export function derivePlaceholderNamesFromLayoutPlaceholders(
  layoutPlaceholders:
    | Array<{
        type?: string;
      }>
    | undefined,
): Set<string> {
  const derived = new Set<string>();
  if (!layoutPlaceholders || layoutPlaceholders.length === 0) return derived;

  let bodyCount = 0;
  for (const placeholder of layoutPlaceholders) {
    const slotTag = deriveSlotTagFromPlaceholderType(placeholder.type ?? "");
    if (slotTag) {
      derived.add(slotTag);
    }
    if (placeholder.type === "body") {
      bodyCount += 1;
    }
  }

  if (bodyCount >= 2) {
    derived.add("LEFT");
    derived.add("RIGHT");
  }

  return derived;
}

function getElementBoundingBox(position?: TemplatePosition | null) {
  if (!position) return null;
  return {
    left: position.x,
    right: position.x + position.cx,
    top: position.y,
    bottom: position.y + position.cy,
    centerX: position.x + position.cx / 2,
    centerY: position.y + position.cy / 2,
    area: Math.max(position.cx, 1) * Math.max(position.cy, 1),
  };
}

function computeBoxOverlapScore(
  placeholderPosition?: TemplatePosition | null,
  elementPosition?: TemplatePosition | null,
) {
  const placeholderBox = getElementBoundingBox(placeholderPosition);
  const elementBox = getElementBoundingBox(elementPosition);
  if (!placeholderBox || !elementBox) return -Infinity;

  const intersectionWidth = Math.max(
    0,
    Math.min(placeholderBox.right, elementBox.right) -
      Math.max(placeholderBox.left, elementBox.left),
  );
  const intersectionHeight = Math.max(
    0,
    Math.min(placeholderBox.bottom, elementBox.bottom) -
      Math.max(placeholderBox.top, elementBox.top),
  );
  const intersectionArea = intersectionWidth * intersectionHeight;
  const overlapRatio = intersectionArea / Math.max(placeholderBox.area, elementBox.area, 1);
  const centerDistance = Math.hypot(
    placeholderBox.centerX - elementBox.centerX,
    placeholderBox.centerY - elementBox.centerY,
  );
  const distancePenalty =
    centerDistance / Math.max(placeholderPosition?.cx ?? 1, placeholderPosition?.cy ?? 1, 1);

  return overlapRatio * 100 - distancePenalty * 10;
}

function getPlaceholderTypeMatchBonus(
  placeholderType: string,
  element: NativeTemplateElement,
) {
  switch (placeholderType) {
    case "title":
    case "ctrTitle":
    case "subTitle":
    case "body":
    case "ftr":
    case "sldNum":
      return element.hasTextBody ? 40 : -60;
    case "pic":
      return IMAGE_VISUAL_TYPES.has(element.visualType) ? 50 : -30;
    case "tbl":
      return element.visualType === "table" ? 55 : element.hasTextBody ? 15 : -30;
    default:
      return element.hasTextBody ? 10 : 0;
  }
}

function deriveSlotsFromLayoutPlaceholders(
  layoutPlaceholders: NativeTemplateLayoutPlaceholder[] | undefined,
  elements: NativeTemplateElement[],
): Partial<Record<TemplateSlotTag, NativeTemplateSlot[]>> {
  if (!layoutPlaceholders || layoutPlaceholders.length === 0) return {};

  const usedSelectors = new Set<string>();
  const derived: Partial<Record<TemplateSlotTag, NativeTemplateSlot[]>> = {};
  const placeholders = [...layoutPlaceholders].sort((a, b) => {
    const ay = a.position?.y ?? 0;
    const by = b.position?.y ?? 0;
    if (ay !== by) return ay - by;
    return (a.position?.x ?? 0) - (b.position?.x ?? 0);
  });

  for (const placeholder of placeholders) {
    const mappedTag = deriveSlotTagFromPlaceholderType(placeholder.type);
    if (!mappedTag || !placeholder.position) continue;

    let bestElement: NativeTemplateElement | null = null;
    let bestScore = -Infinity;

    for (const element of elements) {
      const selector = buildTemplateSelector(element);
      const selectorId = selectorKey(selector);
      if (usedSelectors.has(selectorId)) continue;

      const score =
        getPlaceholderTypeMatchBonus(placeholder.type, element) +
        computeBoxOverlapScore(placeholder.position, element.position);
      if (score > bestScore) {
        bestScore = score;
        bestElement = element;
      }
    }

    if (!bestElement || bestScore < 10) continue;

    const selector = buildTemplateSelector(bestElement);
    usedSelectors.add(selectorKey(selector));

    if (!derived[mappedTag]) {
      derived[mappedTag] = [];
    }
    derived[mappedTag]?.push({
      selector,
      position: bestElement.position,
      visualType: bestElement.visualType,
      source: "layout",
    });
  }

  const bodySlots = sortSlotsByPosition(derived.BODY ?? []);
  if (bodySlots.length >= 2) {
    derived.LEFT = [{ ...bodySlots[0] }];
    derived.RIGHT = [{ ...bodySlots[1] }];
  }

  return derived;
}

function deriveSlotsFromSampleTexts(
  elements: NativeTemplateElement[],
): Partial<Record<TemplateSlotTag, NativeTemplateSlot[]>> {
  const derived: Partial<Record<TemplateSlotTag, NativeTemplateSlot[]>> = {};

  for (const element of elements) {
    if (!element.hasTextBody) continue;
    const texts = element.getText();
    const joined = normalizeTemplateText(texts.join(" "));
    if (!joined) continue;

    let mappedTag: TemplateSlotTag | null = null;
    if (textMatchesAny(joined, [...SAMPLE_TITLE_PATTERNS])) {
      mappedTag = "TITLE";
    } else if (textMatchesAny(joined, [...SAMPLE_BODY_PATTERNS])) {
      mappedTag = "BODY";
    } else if (textMatchesAny(joined, [...SAMPLE_SUBTITLE_PATTERNS])) {
      mappedTag = "SUBTITLE";
    }

    if (!mappedTag) continue;

    if (!derived[mappedTag]) {
      derived[mappedTag] = [];
    }
    derived[mappedTag]?.push({
      selector: buildTemplateSelector(element),
      position: element.position,
      visualType: element.visualType,
      source: "sample",
    });
  }

  return derived;
}

function hasFullBleedImage(elements: NativeTemplateElement[]): boolean {
  return elements.some((element) => {
    if (!IMAGE_VISUAL_TYPES.has(element.visualType)) return false;
    return element.position.x <= 914400 * 0.1 && element.position.y <= 914400 * 0.1;
  });
}

function classifySlideRoles(
  slide: Omit<NativeTemplateProfileSlide, "roleHints">,
): NativeTemplateProfileSlide["roleHints"] {
  const roles: NativeTemplateProfileSlide["roleHints"] = [];

  if (slide.titleSlot && (slide.subtitleSlot || slide.hasFullBleedImage)) {
    roles.push("title");
  }
  if (slide.titleSlot && slide.bodySlot) {
    roles.push("content");
  }
  if (
    slide.titleSlot &&
    ((slide.leftSlot &&
      slide.rightSlot &&
      selectorKey(slide.leftSlot.selector) !== selectorKey(slide.rightSlot.selector)) ||
      slide.bodySlot)
  ) {
    roles.push("two_column");
  }
  if (slide.titleSlot && (slide.tableSlot || slide.bodySlot)) {
    roles.push("table");
  }
  if (slide.titleSlot && (slide.imageSlot || slide.bodySlot || slide.hasFullBleedImage)) {
    roles.push("image");
  }
  if (
    roles.length === 0 &&
    !slide.titleSlot &&
    !slide.bodySlot &&
    !slide.leftSlot &&
    !slide.rightSlot &&
    !slide.tableSlot &&
    !slide.imageSlot
  ) {
    roles.push("blank");
  }

  return roles;
}

function collectSlideSlotTags(slide: NativeTemplateProfileSlide): TemplateSlotTag[] {
  const tags: TemplateSlotTag[] = [];
  const maybeAdd = (tag: TemplateSlotTag, slot: NativeTemplateSlot | undefined) => {
    if (slot) tags.push(tag);
  };
  maybeAdd("TITLE", slide.titleSlot);
  maybeAdd("SUBTITLE", slide.subtitleSlot);
  maybeAdd("BODY", slide.bodySlot);
  maybeAdd("LEFT", slide.leftSlot);
  maybeAdd("RIGHT", slide.rightSlot);
  maybeAdd("TABLE", slide.tableSlot);
  maybeAdd("IMAGE", slide.imageSlot);
  maybeAdd("CAPTION", slide.captionSlot);
  maybeAdd("NOTES", slide.notesSlot);
  maybeAdd("FOOTER", slide.footerSlot);
  maybeAdd("PAGE_NUM", slide.pageNumSlot);
  return [...new Set(tags)];
}

export function buildAvailableLayoutsFromProfile(
  profile: NativeTemplateProfile,
): string[] {
  const summaries = new Map<string, Set<TemplateSlotTag>>();

  for (const slide of profile.slides) {
    const tags = collectSlideSlotTags(slide);
    if (tags.length === 0) continue;

    if (!summaries.has(slide.layoutName)) {
      summaries.set(slide.layoutName, new Set());
    }
    const bucket = summaries.get(slide.layoutName);
    if (!bucket) continue;

    for (const tag of tags) {
      bucket.add(tag);
    }
  }

  return [...summaries.entries()].map(
    ([layoutName, tags]) => `${layoutName}:${[...tags].sort().join(",")}`,
  );
}

export function buildNativeTemplateProfile(
  templateInfos: NativeTemplateInfo[],
): NativeTemplateProfile {
  const templateInfo =
    templateInfos.find((info) => info.name === "__native_template__") ??
    [...templateInfos].sort((a, b) => (b.slides?.length ?? 0) - (a.slides?.length ?? 0))[0];
  const slides: NativeTemplateProfileSlide[] = (templateInfo?.slides ?? []).map((slide) => {
    const taggedSlots: Partial<Record<TemplateSlotTag, NativeTemplateSlot[]>> = {};
    const titleFallback: NativeTemplateSlot[] = [];
    const subtitleFallback: NativeTemplateSlot[] = [];
    const bodyFallback: NativeTemplateSlot[] = [];
    const footerFallback: NativeTemplateSlot[] = [];
    const pageNumFallback: NativeTemplateSlot[] = [];
    const tableAnchors: NativeTemplateSlot[] = [];
    const imageAnchors: NativeTemplateSlot[] = [];
    const selectors: TemplateSelector[] = [];
    const layoutDerivedSlots = deriveSlotsFromLayoutPlaceholders(
      slide.info?.layoutPlaceholders,
      slide.elements,
    );
    const sampleDerivedSlots = deriveSlotsFromSampleTexts(slide.elements);

    for (const element of slide.elements) {
      const selector = buildTemplateSelector(element);
      const slot: NativeTemplateSlot = {
        selector,
        position: element.position,
        visualType: element.visualType,
        source: "slide",
      };
      selectors.push(selector);

      if (element.hasTextBody) {
        for (const tag of extractTemplateTags(element.getText())) {
          if (!taggedSlots[tag]) {
            taggedSlots[tag] = [];
          }
          taggedSlots[tag]?.push({ ...slot, explicitTag: tag, source: "explicit" });
        }
      }

      let placeholderType: string | undefined;
      try {
        placeholderType = element.getPlaceholderInfo?.()?.type;
      } catch {
        placeholderType = undefined;
      }

      switch (placeholderType) {
        case "title":
        case "ctrTitle":
          titleFallback.push(slot);
          break;
        case "subTitle":
          subtitleFallback.push(slot);
          break;
        case "body":
          bodyFallback.push(slot);
          break;
        case "ftr":
          footerFallback.push(slot);
          break;
        case "sldNum":
          pageNumFallback.push(slot);
          break;
        case "tbl":
          tableAnchors.push(slot);
          break;
        case "pic":
          imageAnchors.push(slot);
          break;
      }

      if (element.visualType === "table") {
        tableAnchors.push(slot);
      }
      if (IMAGE_VISUAL_TYPES.has(element.visualType)) {
        imageAnchors.push(slot);
      }
    }

    const sortedBodySlots = sortSlotsByPosition(
      uniqueSlots([
        ...bodyFallback,
        ...(layoutDerivedSlots.BODY ?? []),
        ...(sampleDerivedSlots.BODY ?? []),
      ]),
    );

    const baseSlide = {
      slideId: slide.id,
      slideNumber: slide.number,
      layoutName: slide.info?.layoutName ?? `Slide ${slide.number}`,
      hasFullBleedImage: hasFullBleedImage(slide.elements),
      selectors: uniqueSlots(
        selectors.map((selector) => ({
          selector,
          position: { x: 0, y: 0, cx: 0, cy: 0 },
        })),
      ).map((slot) => slot.selector),
      titleSlot: pickFirstSlot(
        normalizeSlots(taggedSlots.TITLE),
        normalizeSlots(sampleDerivedSlots.TITLE),
        normalizeSlots(titleFallback),
        normalizeSlots(layoutDerivedSlots.TITLE),
      ),
      subtitleSlot: pickFirstSlot(
        normalizeSlots(taggedSlots.SUBTITLE),
        normalizeSlots(sampleDerivedSlots.SUBTITLE),
        normalizeSlots(subtitleFallback),
        normalizeSlots(layoutDerivedSlots.SUBTITLE),
        sortedBodySlots,
      ),
      bodySlot: pickFirstSlot(normalizeSlots(taggedSlots.BODY), sortedBodySlots),
      leftSlot: pickFirstSlot(
        normalizeSlots(taggedSlots.LEFT),
        normalizeSlots(layoutDerivedSlots.LEFT),
        sortedBodySlots,
      ),
      rightSlot: pickFirstSlot(
        normalizeSlots(taggedSlots.RIGHT),
        normalizeSlots(layoutDerivedSlots.RIGHT),
        sortSlotsByPosition(
          sortedBodySlots.filter(
            (slot) => selectorKey(slot.selector) !== selectorKey(pickFirstSlot(
              normalizeSlots(taggedSlots.LEFT),
              normalizeSlots(layoutDerivedSlots.LEFT),
              sortedBodySlots,
            )?.selector ?? ""),
          ),
        ),
      ),
      tableSlot: pickFirstSlot(
        normalizeSlots(taggedSlots.TABLE),
        normalizeSlots(layoutDerivedSlots.TABLE),
        normalizeSlots(tableAnchors),
      ),
      imageSlot: pickFirstSlot(
        normalizeSlots(taggedSlots.IMAGE),
        normalizeSlots(layoutDerivedSlots.IMAGE),
        normalizeSlots(imageAnchors),
      ),
      captionSlot: pickFirstSlot(normalizeSlots(taggedSlots.CAPTION)),
      notesSlot: pickFirstSlot(normalizeSlots(taggedSlots.NOTES)),
      footerSlot: pickFirstSlot(
        normalizeSlots(taggedSlots.FOOTER),
        normalizeSlots(layoutDerivedSlots.FOOTER),
        normalizeSlots(footerFallback),
      ),
      pageNumSlot: pickFirstSlot(
        normalizeSlots(taggedSlots.PAGE_NUM),
        normalizeSlots(layoutDerivedSlots.PAGE_NUM),
        normalizeSlots(pageNumFallback),
      ),
    } satisfies Omit<NativeTemplateProfileSlide, "roleHints">;

    return {
      ...baseSlide,
      roleHints: classifySlideRoles(baseSlide),
    };
  });

  const placeholderTags = [...new Set(slides.flatMap((slide) => collectSlideSlotTags(slide)))].sort();
  const recognizedRoleCounts: Record<string, number> = {};
  for (const slide of slides) {
    for (const role of slide.roleHints) {
      recognizedRoleCounts[role] = (recognizedRoleCounts[role] ?? 0) + 1;
    }
  }

  return {
    kind: "native_template_profile_v1",
    version: 1,
    summary: {
      slideCount: slides.length,
      placeholderTags,
      recognizedRoleCounts,
    },
    slides,
  };
}

export function extractNativeTemplateProfile(
  themeConfig: unknown,
): NativeTemplateProfile | null {
  if (!themeConfig || typeof themeConfig !== "object") return null;
  const candidate = themeConfig as Partial<NativeTemplateProfile>;
  if (candidate.kind !== "native_template_profile_v1") return null;
  if (candidate.version !== 1) return null;
  if (!Array.isArray(candidate.slides)) return null;
  return candidate as NativeTemplateProfile;
}
