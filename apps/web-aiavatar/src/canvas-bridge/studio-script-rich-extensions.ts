import StarterKit from '@tiptap/starter-kit';
import { Markdown, MarkdownManager } from '@tiptap/markdown';
import { TableKit } from '@tiptap/extension-table';
import type { JSONContent } from '@tiptap/core';

/** Both editable documents and AI proposals use the same schema and serializer. */
export function scriptRichExtensions() {
  return [
    StarterKit.configure({
      heading: { levels: [1, 2, 3, 4] },
      link: { openOnClick: false, protocols: ['http', 'https', 'mailto'] },
    }),
    // Script labels often share a paragraph: retain their visible line breaks.
    Markdown.configure({ markedOptions: { gfm: true, breaks: true } }),
    TableKit.configure({ table: { resizable: false } }),
  ];
}

let headingParser: MarkdownManager | undefined;
/** Heading identity comes from visible text, never from its inline formatting delimiters. */
export function scriptHeadingText(markdown: string): string {
  headingParser ??= new MarkdownManager({ extensions: scriptRichExtensions() });
  const text = (node: JSONContent): string => node.text ?? (node.content ?? []).map(text).join('');
  return text(headingParser.parse(`# ${markdown}`)).trim();
}
