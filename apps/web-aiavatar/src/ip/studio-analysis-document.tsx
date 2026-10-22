'use client';
import type { ComponentProps } from 'react';
import { StudioDocumentEditor } from './studio-document-editor';

type Props = Omit<ComponentProps<typeof StudioDocumentEditor>, 'title'> & { title?: string };
/** Analysis and plain text use the same document editor. */
export function StudioAnalysisDocument({ title = '全片创作拆解', ...props }: Props) {
  return <StudioDocumentEditor title={title} editorLabel="创作拆解文档" {...props}/>;
}
