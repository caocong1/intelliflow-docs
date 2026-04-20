import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { CanvasRenderModel, MvpVariantId, NativeTemplate } from "./types";
import { validateNativeTemplate } from "./native-template-schema";

export const DEFAULT_NATIVE_TEMPLATE_PATH =
  "docs/design/ppt-mvp/templates/doubao-light-tech-v1.native-template.json";

export function nativeTemplateToTheme(template: NativeTemplate): CanvasRenderModel["theme"] {
  return {
    colors: {
      bg: template.tokens.colors.bg,
      surface: template.tokens.colors.surface,
      text: template.tokens.colors.text,
      textMuted: template.tokens.colors.textMuted,
      primary: template.tokens.colors.primary,
      accent: template.tokens.colors.accent,
      outline: template.tokens.colors.outline,
      success: template.tokens.colors.success,
    },
    fonts: {
      title: template.tokens.typography.title,
      body: template.tokens.typography.body,
      mono: template.tokens.typography.mono,
    },
  };
}

export async function loadNativeTemplate(path: string): Promise<NativeTemplate> {
  const inputPath = resolve(process.cwd(), path);
  const parsed = JSON.parse(await readFile(inputPath, "utf-8")) as NativeTemplate;
  const result = validateNativeTemplate(parsed);
  if (!result.valid || !result.template) {
    throw new Error(
      `Invalid native template at ${inputPath}\n${(result.errors ?? []).join("\n")}`,
    );
  }
  return result.template;
}

export function getVariantBinding(
  template: NativeTemplate,
  variantId: MvpVariantId,
) {
  return template.variantBindings.find((binding) => binding.variantId === variantId);
}

export function getPrimitiveDefaults(
  template: NativeTemplate | undefined,
  primitiveId: string,
): Record<string, string | number | boolean> {
  return template?.primitives.find((primitive) => primitive.id === primitiveId)?.defaults ?? {};
}

export function getPrimitiveBoolean(
  template: NativeTemplate | undefined,
  primitiveId: string,
  key: string,
  fallback: boolean,
): boolean {
  const value = getPrimitiveDefaults(template, primitiveId)[key];
  return typeof value === "boolean" ? value : fallback;
}

export function getPrimitiveNumber(
  template: NativeTemplate | undefined,
  primitiveId: string,
  key: string,
  fallback: number,
): number {
  const value = getPrimitiveDefaults(template, primitiveId)[key];
  return typeof value === "number" ? value : fallback;
}

export function getPrimitiveString(
  template: NativeTemplate | undefined,
  primitiveId: string,
  key: string,
  fallback: string,
): string {
  const value = getPrimitiveDefaults(template, primitiveId)[key];
  return typeof value === "string" ? value : fallback;
}

export function hasTemplatePrimitive(
  template: NativeTemplate,
  variantId: MvpVariantId,
  primitiveId: string,
): boolean {
  const binding = getVariantBinding(template, variantId);
  if (!binding) return false;
  return [...binding.requiredPrimitives, ...binding.optionalPrimitives].includes(primitiveId);
}

export function getRequiredAssetSlots(
  template: NativeTemplate,
  variantId: MvpVariantId,
): string[] {
  return getVariantBinding(template, variantId)?.requiredAssetSlots ?? [];
}
