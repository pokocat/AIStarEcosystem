"use client";

import Link from 'next/link';
import { ArrowUpRight, Layers, Replace, ScanLine } from 'lucide-react';
import { StudioPage } from '@/ip/studio-page';
import { VIDEO_CLONE_TOOLS, cloneToolHref } from '@/ip/scenes/scene-video-clone';

const icons = { depth: ScanLine, recreation: Layers, replacement: Replace };
export default function ToolboxPage() {
  return <StudioPage title="工具箱" description="放入参考视频和素材，制作你自己的版本。">
    <section className="studio-toolbox" aria-label="视频工具">
      {VIDEO_CLONE_TOOLS.map(tool => { const Icon = icons[tool.mode]; return <Link key={tool.mode} className="studio-toolbox-card" href={cloneToolHref(tool.mode)}>
        <Icon size={25} strokeWidth={1.4}/><h2>{tool.title}</h2><p>{tool.description}</p><small>{tool.detail}</small><span>开始制作<ArrowUpRight size={15}/></span>
      </Link>; })}
    </section>
  </StudioPage>;
}
