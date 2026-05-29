import type { ScriptAsset } from "./types";

export function scriptOwnerLabel(script: ScriptAsset): string {
  return script.owner_display_name ?? script.owner_username ?? script.source?.author ?? "系统";
}
