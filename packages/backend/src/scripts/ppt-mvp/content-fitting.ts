import type {
  ArchetypeSlotSchema,
  FittedPageSlots,
  MvpPageDefinition,
  SlotRule,
} from "./types";
import { MVP_FAMILY_ID } from "./family-library";

function truncateText(text: string, maxChars: number | undefined): string {
  if (!maxChars || text.length <= maxChars) return text;
  return `${text.slice(0, Math.max(0, maxChars - 1))}…`;
}

function fitStringArray(values: string[], rule: SlotRule): { value: string[]; warnings: string[] } {
  const warnings: string[] = [];
  let next = [...values];
  if (rule.maxItems && next.length > rule.maxItems) {
    warnings.push(`Slot "${rule.name}" truncated from ${next.length} to ${rule.maxItems} items.`);
    next = next.slice(0, rule.maxItems);
  }
  if (rule.maxItemChars) {
    next = next.map((item) => {
      const fitted = truncateText(item, rule.maxItemChars);
      if (fitted !== item) {
        warnings.push(`Slot "${rule.name}" item truncated: "${item.slice(0, 24)}..."`);
      }
      return fitted;
    });
  }
  return { value: next, warnings };
}

function fitValue(value: unknown, rule: SlotRule): { value: unknown; warnings: string[] } {
  if (value == null) return { value, warnings: [] };
  switch (rule.kind) {
    case "string":
    case "asset": {
      if (typeof value !== "string") return { value, warnings: [] };
      const fitted = truncateText(value, rule.maxChars);
      return {
        value: fitted,
        warnings: fitted !== value ? [`Slot "${rule.name}" truncated.`] : [],
      };
    }
    case "stringArray": {
      if (!Array.isArray(value)) return { value, warnings: [] };
      return fitStringArray(value.filter((item): item is string => typeof item === "string"), rule);
    }
    case "tocItems": {
      if (!Array.isArray(value)) return { value, warnings: [] };
      const warnings: string[] = [];
      let items = value.slice(0, rule.maxItems ?? value.length);
      if ((rule.maxItems ?? value.length) < value.length) {
        warnings.push(`Slot "${rule.name}" truncated to ${rule.maxItems} TOC items.`);
      }
      items = items.map((item) => {
        if (typeof item !== "object" || !item) return item;
        const record = item as Record<string, unknown>;
        return {
          index: truncateText(String(record.index ?? ""), 4),
          title: truncateText(String(record.title ?? ""), 18),
          subtitle: truncateText(String(record.subtitle ?? ""), 36),
        };
      });
      return { value: items, warnings };
    }
    case "timelineNodes": {
      if (!Array.isArray(value)) return { value, warnings: [] };
      const warnings: string[] = [];
      let nodes = value.slice(0, rule.maxItems ?? value.length);
      if ((rule.maxItems ?? value.length) < value.length) {
        warnings.push(`Slot "${rule.name}" truncated to ${rule.maxItems} timeline nodes.`);
      }
      nodes = nodes.map((node) => {
        if (typeof node !== "object" || !node) return node;
        const record = node as Record<string, unknown>;
        return {
          year: truncateText(String(record.year ?? ""), 6),
          title: truncateText(String(record.title ?? ""), 22),
          detail: truncateText(String(record.detail ?? ""), 36),
        };
      });
      return { value: nodes, warnings };
    }
    case "processSteps": {
      if (!Array.isArray(value)) return { value, warnings: [] };
      const warnings: string[] = [];
      let steps = value.slice(0, rule.maxItems ?? value.length);
      if ((rule.maxItems ?? value.length) < value.length) {
        warnings.push(`Slot "${rule.name}" truncated to ${rule.maxItems} process steps.`);
      }
      steps = steps.map((step) => {
        if (typeof step !== "object" || !step) return step;
        const record = step as Record<string, unknown>;
        return {
          index: truncateText(String(record.index ?? ""), 4),
          title: truncateText(String(record.title ?? ""), 22),
          detail: truncateText(String(record.detail ?? ""), 36),
        };
      });
      return { value: steps, warnings };
    }
    case "deviceItems": {
      if (!Array.isArray(value)) return { value, warnings: [] };
      const warnings: string[] = [];
      let devices = value.slice(0, rule.maxItems ?? value.length);
      if ((rule.maxItems ?? value.length) < value.length) {
        warnings.push(`Slot "${rule.name}" truncated to ${rule.maxItems} device items.`);
      }
      devices = devices.map((device) => {
        if (typeof device !== "object" || !device) return device;
        const record = device as Record<string, unknown>;
        return {
          name: truncateText(String(record.name ?? ""), 22),
          scenario: truncateText(String(record.scenario ?? ""), 28),
          note: truncateText(String(record.note ?? ""), 42),
        };
      });
      return { value: devices, warnings };
    }
    default:
      return { value, warnings: [] };
  }
}

export function fitPageToSchema(
  page: MvpPageDefinition,
  schema: ArchetypeSlotSchema,
  familyId = MVP_FAMILY_ID,
): FittedPageSlots {
  const warnings: string[] = [];
  const fitted: Record<string, unknown> = {};
  const raw = page as Record<string, unknown>;

  for (const rule of schema.slots) {
    const value = raw[rule.name];
    if (rule.required && (value == null || value === "" || (Array.isArray(value) && value.length === 0))) {
      warnings.push(`Required slot "${rule.name}" is missing.`);
      continue;
    }

    const next = fitValue(value, rule);
    fitted[rule.name] = next.value;
    warnings.push(...next.warnings);
  }

  return {
    pageId: page.pageId,
    pageType: page.pageType,
    familyId,
    variantId: schema.variantId,
    slots: fitted,
    warnings,
    speakerNote:
      typeof raw.speakerNote === "string"
        ? truncateText(raw.speakerNote, 300)
        : undefined,
  };
}
