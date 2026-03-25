/** Format duration between two ISO timestamps as human-readable Chinese text */
export function formatDuration(startIso: string | null, endIso: string | null): string {
  if (!startIso || !endIso) return "-";
  const ms = new Date(endIso).getTime() - new Date(startIso).getTime();
  if (ms < 0) return "-";
  const totalSeconds = Math.round(ms / 1000);
  if (totalSeconds < 60) return `${totalSeconds}秒`;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes < 60) {
    return seconds > 0 ? `${minutes}分${seconds}秒` : `${minutes}分`;
  }
  const hours = Math.floor(minutes / 60);
  const remainMinutes = minutes % 60;
  return remainMinutes > 0 ? `${hours}小时${remainMinutes}分` : `${hours}小时`;
}

/** Format file size in bytes to human-readable string */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Get Tailwind color classes for file extension badge */
export function getFileExtColor(ext: string): string {
  const map: Record<string, string> = {
    pdf: "bg-red-100 text-red-700",
    docx: "bg-blue-100 text-blue-700",
    doc: "bg-blue-100 text-blue-700",
    txt: "bg-gray-100 text-gray-600",
    png: "bg-purple-100 text-purple-700",
    jpg: "bg-purple-100 text-purple-700",
    jpeg: "bg-purple-100 text-purple-700",
    mp3: "bg-amber-100 text-amber-700",
    mp4: "bg-amber-100 text-amber-700",
    md: "bg-indigo-100 text-indigo-700",
  };
  return map[ext.toLowerCase()] ?? "bg-indigo-100 text-indigo-700";
}

/** Format ISO timestamp to localized Chinese string */
export function formatTime(iso: string | null): string {
  if (!iso) return "-";
  return new Date(iso).toLocaleString("zh-CN");
}

/** Format ISO timestamp to short time string (HH:MM:SS) */
export function formatShortTime(iso: string | null): string {
  if (!iso) return "-";
  const d = new Date(iso);
  return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}:${d.getSeconds().toString().padStart(2, "0")}`;
}

/** Truncate text to maxLen characters (including "…" if truncated) */
export function truncateText(text: string, maxLen: number): string {
  if (!text) return "";
  if (maxLen <= 0) return "";
  if (text.length <= maxLen) return text;
  if (maxLen === 1) return "…";
  return `${text.slice(0, maxLen - 1)}…`;
}
