// Replies written before the server parsed the model's fallback action protocol (2026-10-18) kept the raw action blocks in
// their text: `<tool_call>{"tool":…}</tool_call>` or a `<<<studio-actions>>>` line followed by a JSON array. They are
// not prose and must not read as the assistant talking (production 2026-10-19, IPP-6658ccda). The same spellings the
// server recognises (DialogueActionProtocol) are folded away here, including `<studio-actions>[…]</studio-actions>`
// (2026-10-20, IPT-2f13c2ed42994624907d); the original stays available for audit. A folded block in an old reply never
// ran: these are exactly the replies whose actions the server did not parse.
const MARKER = "<<<studio-actions>>>";

export function splitReplyActions(text: string): { prose: string; actions: string } {
  const actions: string[] = [];
  // The marker contains the tag spelling (`<<<studio-actions>>>`), so it is cut first.
  let prose = text, marker = "";
  const at = prose.indexOf(MARKER);
  if (at >= 0) { marker = prose.slice(at).trim(); prose = prose.slice(0, at); }
  prose = prose.replace(/<(tool_call|studio[-_]actions)>[\s\S]*?(?:<\/\1>|$)/gi, block => { actions.push(block.trim()); return ""; });
  if (marker) actions.push(marker);
  return { prose: actions.length ? prose.replace(/\n{3,}/g, "\n\n").trim() : text, actions: actions.join("\n") };
}
