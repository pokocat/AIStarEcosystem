import React, { useEffect, useRef, useState } from 'react';
import { motion, useMotionValue, useSpring } from 'motion/react';
import type { Lang } from '../translations';

interface TypewriterHighlightProps {
  phrases: Array<{ zh: string; en: string }>;
  lang: Lang;
  gradient: string;
  className?: string;
}

export const TypewriterHighlight = ({ phrases, lang, gradient, className = '' }: TypewriterHighlightProps) => {
  const [phraseIndex, setPhraseIndex] = useState(0);
  const [displayed, setDisplayed] = useState('');
  const [deleting, setDeleting] = useState(false);
  const fullText = phrases[phraseIndex % phrases.length][lang];

  useEffect(() => {
    setPhraseIndex(0);
    setDisplayed('');
    setDeleting(false);
  }, [lang]);

  useEffect(() => {
    let delay = deleting ? 45 : 88;
    if (!deleting && displayed === fullText) delay = 1900;
    if (deleting && displayed === '') delay = 220;

    const timer = window.setTimeout(() => {
      if (!deleting && displayed === fullText) {
        setDeleting(true);
        return;
      }
      if (deleting && displayed === '') {
        setDeleting(false);
        setPhraseIndex(index => (index + 1) % phrases.length);
        return;
      }
      setDisplayed(current => deleting ? current.slice(0, -1) : fullText.slice(0, current.length + 1));
    }, delay);

    return () => window.clearTimeout(timer);
  }, [deleting, displayed, fullText, phrases.length]);

  // Reserve the space of the longest phrase so the headline never re-wraps while typing.
  const longest = phrases.reduce((max, phrase) => (phrase[lang].length > max.length ? phrase[lang] : max), '');
  const cursorColor = gradient.includes('#06b6d4') ? '#22d3ee' : '#c084fc';

  return (
    <span className={`inline-grid align-top ${className}`}>
      <span aria-hidden className="invisible [grid-area:1/1]">{longest}<span className="ml-1">|</span></span>
      <span className="[grid-area:1/1]" aria-live="polite">
        <span className="text-transparent bg-clip-text" style={{ backgroundImage: gradient }}>
          {displayed}
        </span>
        <motion.span
          aria-hidden
          animate={{ opacity: [1, 0, 1] }}
          transition={{ duration: .8, repeat: Infinity }}
          className="ml-1"
          style={{ color: cursorColor }}
        >
          |
        </motion.span>
      </span>
    </span>
  );
};

interface MagneticCTAProps {
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
  style?: React.CSSProperties;
}

export const MagneticCTA = ({ children, onClick, className = '', style }: MagneticCTAProps) => {
  const ref = useRef<HTMLButtonElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const springX = useSpring(x, { stiffness: 220, damping: 18 });
  const springY = useSpring(y, { stiffness: 220, damping: 18 });

  return (
    <motion.button
      ref={ref}
      onClick={onClick}
      style={{ ...style, x: springX, y: springY }}
      onMouseMove={event => {
        const rect = ref.current?.getBoundingClientRect();
        if (!rect) return;
        x.set((event.clientX - rect.left - rect.width / 2) * .16);
        y.set((event.clientY - rect.top - rect.height / 2) * .16);
      }}
      onMouseLeave={() => {
        x.set(0);
        y.set(0);
      }}
      whileTap={{ scale: .97 }}
      className={`group relative overflow-hidden ${className}`}
    >
      <motion.span
        className="absolute inset-y-0 -left-1/3 w-1/3 skew-x-[-18deg] bg-gradient-to-r from-transparent via-white/30 to-transparent"
        animate={{ left: ['-40%', '130%'] }}
        transition={{ duration: 2.8, repeat: Infinity, repeatDelay: 1.1, ease: 'easeInOut' }}
      />
      <span className="relative z-10 flex items-center justify-center gap-2">{children}</span>
    </motion.button>
  );
};

export const AnimatedArrow = ({ className = '' }: { className?: string }) => (
  <motion.span animate={{ x: [0, 5, 0] }} transition={{ duration: 1.45, repeat: Infinity, ease: 'easeInOut' }}>
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14" />
      <path d="m13 6 6 6-6 6" />
    </svg>
  </motion.span>
);
