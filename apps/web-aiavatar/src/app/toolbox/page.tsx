"use client";

import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { StudioPage } from '@/ip/studio-page';
import { CLONE_SOURCE_LIMIT, CloneModeFacts, VIDEO_CLONE_TOOLS, cloneToolHref } from '@/ip/scenes/scene-video-clone';

export default function ToolboxPage() {
  return <StudioPage title="工具箱" description="放入参考视频和素材，制作你自己的版本。">
    <section className="studio-toolbox-section" aria-labelledby="toolbox-clone">
      <header><h2 id="toolbox-clone">爆款复刻</h2><p>按参考视频的类型选择复刻方式。{CLONE_SOURCE_LIMIT}</p></header>
      <div className="studio-toolbox">
        {VIDEO_CLONE_TOOLS.map(tool => <Link key={tool.mode} className="studio-toolbox-card" href={cloneToolHref(tool.mode)}>
          <figure className="studio-toolbox-media"><img src={tool.image} alt="" loading="lazy" decoding="async"/><figcaption aria-hidden="true">示意图</figcaption></figure>
          <div className="studio-toolbox-body">
            <h3>{tool.title}</h3><p>{tool.description}</p>
            <CloneModeFacts mode={tool.mode}/>
            <span>开始制作<ArrowUpRight size={15}/></span>
          </div>
        </Link>)}
      </div>
    </section>
  </StudioPage>;
}
