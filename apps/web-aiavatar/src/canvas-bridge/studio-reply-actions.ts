// Replies written before the server parsed the model's fallback action protocol (2026-10-18) kept the raw action blocks in
// their text: `<tool_call>{"tool":…}</tool_call>` or a `<<<studio-actions>>>` line followed by a JSON array. They are
// not prose and must not read as the assistant talking (production 2026-10-19, IPP-6658ccda). The same two spellings the
// server recognises (DialogueActionProtocol) are folded away here; the original stays available for audit.
const MARKER = "<<<studio-actions>>>";

export function splitReplyActions(text: string): { prose: string; actions: string } {
  const actions: string[] = [];
  let prose = text.replace(/<tool_call>[\s\S]*?(?:<\/tool_call>|$)/g, block => { actions.push(block.trim()); return ""; });
  const at = prose.indexOf(MARKER);
  if (at >= 0) { actions.push(prose.slice(at).trim()); prose = prose.slice(0, at); }
  return { prose: actions.length ? prose.replace(/\n{3,}/g, "\n\n").trim() : text, actions: actions.join("\n") };
}
