import type { StatusTone as StatusMetaTone } from "@/constants/status";
import type { StatusTone as BadgeTone } from "./StatusBadge";

/** 把 constants/status.ts 的 tone 映射到新 StatusBadge 的 tone。 */
export function mapTone(t: StatusMetaTone): BadgeTone {
  switch (t) {
    case "primary": return "violet";
    case "danger":  return "danger";
    case "warning": return "warning";
    case "success": return "success";
    case "info":    return "info";
    case "neutral":
    default:        return "neutral";
  }
}
