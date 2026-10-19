"use client";

import { useRef, type ReactNode } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(useGSAP, ScrollTrigger);

/** Keep saved assets fully readable; animation only introduces the current page. */
export function LibraryGridMotion({ children, motionKey }: { children: ReactNode; motionKey: string }) {
  const root = useRef<HTMLDivElement>(null);
  useGSAP(() => {
    const media = gsap.matchMedia();
    media.add('(prefers-reduced-motion: no-preference)', () => {
      const cards = root.current?.querySelectorAll('.library-card');
      if (!cards?.length) return;
      gsap.from(cards, { y: 12, opacity: 0, duration: .35, stagger: .025, ease: 'power2.out', clearProps: 'transform,opacity' });
      root.current?.querySelectorAll<HTMLImageElement>('.library-card-visual > img').forEach(image => {
        gsap.fromTo(image, { scale: .98 }, { scale: 1, duration: .5, ease: 'power2.out', clearProps: 'transform', scrollTrigger: { trigger: image, start: 'top 95%', once: true } });
      });
    });
    return () => media.revert();
  }, { scope: root, dependencies: [motionKey], revertOnUpdate: true });
  return <div ref={root} className="library-grid">{children}</div>;
}
