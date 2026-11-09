import type { StudioScriptSuggestion } from "@ai-star-eco/types/ip-studio-workflow";

/** Also check persisted/older documents; never substitute fixed prompts or truncate their meaning. */
export function studioScriptSuggestions(value: unknown): StudioScriptSuggestion[] {
  if (!Array.isArray(value)) return [];
  const accepted: StudioScriptSuggestion[] = [];
  const labels = new Set<string>(), instructions = new Set<string>();
  const valid = (text: string, max: number) => !!text && [...text].length <= max && !/[\u0000-\u001f\u007f-\u009f\u2028\u2029]/u.test(text);
  for (const item of value) {
    if (typeof item?.label !== "string" || typeof item?.instruction !== "string") continue;
    const label = item.label.trim(), instruction = item.instruction.trim();
    if (!valid(label, 8) || !valid(instruction, 80) || labels.has(label) || instructions.has(instruction)) continue;
    accepted.push({ label, instruction }); labels.add(label); instructions.add(instruction);
    if (accepted.length === 3) break;
  }
  return accepted;
}
