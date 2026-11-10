/**
 * Landing section heading in the AI 艺人孵化 homepage style: a bordered eyebrow pill with a glowing
 * dot, a large left-aligned display title, and an optional mono meta on the right.
 * Authored with the homepage's dark classes, which light-ui.css remaps in light mode.
 */
import React from 'react';

interface Props {
  eyebrow: string;
  title: React.ReactNode;
  desc?: string;
  accent: string;
  /** Mono label on the right, e.g. "CAPABILITIES / 02". */
  meta?: string;
  align?: 'left' | 'center';
}

export const SectionHead = ({ eyebrow, title, desc, accent, meta, align = 'left' }: Props) => (
  <div className={`mb-12 flex flex-wrap gap-6 ${align === 'center' ? 'flex-col items-center text-center' : 'items-end justify-between'}`}>
    <div className={align === 'center' ? 'max-w-3xl' : 'max-w-3xl min-w-0'}>
      <span className="inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[11px] font-medium" style={{ color: accent, borderColor: `${accent}55`, background: `${accent}12` }}>
        <span className="h-1.5 w-1.5 rounded-full" style={{ background: accent, boxShadow: `0 0 8px ${accent}` }} />
        {eyebrow}
      </span>
      <h2 className="mt-4 text-4xl md:text-5xl font-black tracking-tight text-white [text-wrap:balance]" style={{ fontFamily: 'var(--font-display)' }}>{title}</h2>
      {desc && <p className="mt-3 text-gray-400 leading-relaxed">{desc}</p>}
    </div>
    {meta && align === 'left' && (
      <div className="hidden md:flex items-center gap-3 text-gray-500">
        <span className="h-px w-12" style={{ background: `linear-gradient(90deg, transparent, ${accent})` }} />
        <span className="eyebrow-mono">{meta}</span>
      </div>
    )}
  </div>
);
