import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "../../db";
import { documentVersions, documents, projectMembers, users } from "../../db/schema";
import type { VersionDiffLine, VersionDiffResult } from "@intelliflow/shared";

// ─── Types ───────────────────────────────────────────────────────────────────

type VersionRow = {
  id: string;
  documentId: string;
  versionNumber: number;
  nodeId: string;
  nodeLabel: string;
  snapshotData: Record<string, unknown>;
  createdBy: string;
  createdAt: Date;
  creatorName?: string;
};

// ─── Snapshot creation ──────────────────────────────────────────────────────

export async function createVersionSnapshot(
  documentId: string,
  nodeId: string,
  nodeLabel: string,
  snapshotData: Record<string, unknown>,
  userId: string,
): Promise<VersionRow> {
  // Compute next version number
  const [maxResult] = await db
    .select({ maxVersion: sql<number>`COALESCE(MAX(${documentVersions.versionNumber}), 0)` })
    .from(documentVersions)
    .where(eq(documentVersions.documentId, documentId));

  const nextVersion = (maxResult?.maxVersion ?? 0) + 1;

  const [version] = await db
    .insert(documentVersions)
    .values({
      documentId,
      versionNumber: nextVersion,
      nodeId,
      nodeLabel,
      snapshotData,
      createdBy: userId,
    })
    .returning();

  return version as VersionRow;
}

// ─── List versions ──────────────────────────────────────────────────────────

export async function listVersions(documentId: string): Promise<VersionRow[]> {
  const rows = await db
    .select({
      id: documentVersions.id,
      documentId: documentVersions.documentId,
      versionNumber: documentVersions.versionNumber,
      nodeId: documentVersions.nodeId,
      nodeLabel: documentVersions.nodeLabel,
      snapshotData: documentVersions.snapshotData,
      createdBy: documentVersions.createdBy,
      createdAt: documentVersions.createdAt,
      creatorName: users.displayName,
    })
    .from(documentVersions)
    .innerJoin(users, eq(documentVersions.createdBy, users.id))
    .where(eq(documentVersions.documentId, documentId))
    .orderBy(desc(documentVersions.versionNumber));

  return rows as VersionRow[];
}

// ─── Get single version ─────────────────────────────────────────────────────

export async function getVersion(versionId: string): Promise<VersionRow | null> {
  const rows = await db
    .select({
      id: documentVersions.id,
      documentId: documentVersions.documentId,
      versionNumber: documentVersions.versionNumber,
      nodeId: documentVersions.nodeId,
      nodeLabel: documentVersions.nodeLabel,
      snapshotData: documentVersions.snapshotData,
      createdBy: documentVersions.createdBy,
      createdAt: documentVersions.createdAt,
      creatorName: users.displayName,
    })
    .from(documentVersions)
    .innerJoin(users, eq(documentVersions.createdBy, users.id))
    .where(eq(documentVersions.id, versionId))
    .limit(1);

  return (rows[0] as VersionRow) ?? null;
}

// ─── Diff computation ───────────────────────────────────────────────────────

/**
 * Simple LCS-based diff algorithm.
 * Computes the longest common subsequence of lines, then marks
 * lines as added, removed, or unchanged.
 */
function computeLineDiff(oldText: string, newText: string): VersionDiffLine[] {
  const oldLines = oldText.split("\n");
  const newLines = newText.split("\n");
  const m = oldLines.length;
  const n = newLines.length;

  // Build LCS table
  const lcs: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (oldLines[i - 1] === newLines[j - 1]) {
        lcs[i][j] = lcs[i - 1][j - 1] + 1;
      } else {
        lcs[i][j] = Math.max(lcs[i - 1][j], lcs[i][j - 1]);
      }
    }
  }

  // Backtrack to produce diff
  const result: VersionDiffLine[] = [];
  let i = m;
  let j = n;

  const stack: VersionDiffLine[] = [];
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
      stack.push({ type: "unchanged", content: oldLines[i - 1], oldLineNumber: i, newLineNumber: j });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || lcs[i][j - 1] >= lcs[i - 1][j])) {
      stack.push({ type: "added", content: newLines[j - 1], newLineNumber: j });
      j--;
    } else {
      stack.push({ type: "removed", content: oldLines[i - 1], oldLineNumber: i });
      i--;
    }
  }

  // Reverse since we built it backwards
  for (let k = stack.length - 1; k >= 0; k--) {
    result.push(stack[k]);
  }

  return result;
}

/**
 * Extract all string values from snapshotData for diffing.
 */
function extractTextFields(data: Record<string, unknown>): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(data)) {
    if (typeof value === "string") {
      result[key] = value;
    }
  }
  return result;
}

export async function getVersionDiff(
  versionIdA: string,
  versionIdB: string,
): Promise<VersionDiffResult | null> {
  const versionA = await getVersion(versionIdA);
  const versionB = await getVersion(versionIdB);

  if (!versionA || !versionB) return null;

  const fieldsA = extractTextFields(versionA.snapshotData);
  const fieldsB = extractTextFields(versionB.snapshotData);

  // Collect all field keys from both versions
  const allKeys = new Set([...Object.keys(fieldsA), ...Object.keys(fieldsB)]);

  const diffs: Record<string, VersionDiffLine[]> = {};

  for (const key of allKeys) {
    const textA = fieldsA[key] ?? "";
    const textB = fieldsB[key] ?? "";
    diffs[key] = computeLineDiff(textA, textB);
  }

  return {
    versionA: {
      id: versionA.id,
      documentId: versionA.documentId,
      versionNumber: versionA.versionNumber,
      nodeId: versionA.nodeId,
      nodeLabel: versionA.nodeLabel,
      snapshotData: versionA.snapshotData,
      createdBy: versionA.createdBy,
      createdAt: versionA.createdAt.toISOString(),
      creatorName: versionA.creatorName,
    },
    versionB: {
      id: versionB.id,
      documentId: versionB.documentId,
      versionNumber: versionB.versionNumber,
      nodeId: versionB.nodeId,
      nodeLabel: versionB.nodeLabel,
      snapshotData: versionB.snapshotData,
      createdBy: versionB.createdBy,
      createdAt: versionB.createdAt.toISOString(),
      creatorName: versionB.creatorName,
    },
    diffs,
  };
}

// ─── Permission helper ──────────────────────────────────────────────────────

export async function isDocumentProjectMember(documentId: string, userId: string): Promise<boolean> {
  const rows = await db
    .select({ id: projectMembers.id })
    .from(documents)
    .innerJoin(projectMembers, and(
      eq(projectMembers.projectId, documents.projectId),
      eq(projectMembers.userId, userId),
    ))
    .where(eq(documents.id, documentId))
    .limit(1);

  return rows.length > 0;
}
