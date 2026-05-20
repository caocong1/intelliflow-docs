import { resolve, sep } from "node:path";
import { AppError } from "./errors.js";

/**
 * Sanitizes a user-supplied filename into a safe basename.
 *
 * Rules (applied in order):
 * 1. Strip all null bytes (\x00) from the input string.
 * 2. Remove any path separators (/ and \) so only a bare basename remains.
 * 3. Strip all leading dot characters (prevents .bashrc-style hidden files).
 * 4. If the result is empty or all whitespace, return "uploaded_file".
 * 5. Replace remaining whitespace with underscores.
 * 6. Return only the sanitized basename (never a path).
 *
 * This function is pure TypeScript with no Node.js dependencies,
 * making it safe to use and test in any environment.
 */
export function sanitizeFilename(input: string): string {
  // Step 1: Strip null bytes
  let sanitized = input.replace(/\x00/g, "");

  // Step 2: Remove path separators (both forward and back slash)
  sanitized = sanitized.replace(/\/|\\/g, "");

  // Step 3: Strip leading dot(s)
  sanitized = sanitized.replace(/^\.+/, "");

  // Step 4: Default to "uploaded_file" if empty or all whitespace
  if (sanitized.trim() === "") {
    return "uploaded_file";
  }

  // Step 5: Replace whitespace with underscores
  sanitized = sanitized.replace(/\s+/g, "_");

  // Step 6: Return only the basename (strip any trailing dots that might remain)
  sanitized = sanitized.replace(/\.+$/, "");

  return sanitized;
}

/**
 * Defends against path traversal attacks by resolving a requested path
 * against a root directory and verifying the result stays within that root.
 *
 * @param root - The allowed root directory (e.g. "/data/exports")
 * @param requestedPath - The user-supplied path to access within root
 * @returns The resolved absolute path (safe to use for file operations)
 * @throws AppError 400 if the resolved path escapes the root (traversal attempt)
 */
export function assertWithinRoot(root: string, requestedPath: string): string {
  const resolvedRoot = resolve(root);
  const requestedAsPath = resolve(requestedPath);
  const rootPrefix = resolvedRoot.endsWith(sep) ? resolvedRoot : resolvedRoot + sep;

  // Storage paths in older rows may already include WORKSPACE_ROOT. Treat those
  // as full paths after normalization; otherwise resolve the requested basename
  // relative to the allowed root.
  const resolved =
    requestedAsPath === resolvedRoot || requestedAsPath.startsWith(rootPrefix)
      ? requestedAsPath
      : resolve(resolvedRoot, requestedPath);

  // Strict prefix check: resolved path must be inside root directory.
  if (resolved !== resolvedRoot && !resolved.startsWith(rootPrefix)) {
    throw new AppError("Path traversal denied", 400);
  }

  return resolved;
}
