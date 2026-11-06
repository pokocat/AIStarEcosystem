import React from 'react';
import { Menu, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import type { Lang } from '../translations';

export interface LandingNavLink {
  label: string;
  href?: string;
  onClick?: () => void;
}

interface Props {
  open: boolean;
  onToggle: (open: boolean) => void;
  links: LandingNavLink[];
  lang: Lang;
  setLang: (lang: Lang) => void;
  enterLabel: string;
  onEnter: () => void;
  gradient: string;
}

/** Hamburger toggle + slide-down panel for landing pages on small screens. */
export const LandingMobileMenu = ({ open, onToggle, links, lang, setLang, enterLabel, onEnter, gradient }: Props) => {
  const zh = lang === 'zh';
  const close = () => onToggle(false);

  return (
    <>
      <button
        type="button"
        className="md:hidden w-10 h-10 -mr-2 flex items-center justify-center text-gray-300 hover:text-white"
        aria-label={open ? (zh ? '关闭菜单' : 'Close menu') : (zh ? '打开菜单' : 'Open menu')}
        aria-expanded={open}
        onClick={() => onToggle(!open)}
      >
        {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            className="md:hidden fixed top-16 inset-x-0 z-40 border-b border-white/10 bg-black/95 backdrop-blur-xl px-6 py-5 flex flex-col"
          >
            {links.map(link => (
              <a
                key={link.label}
                href={link.href ?? '#'}
                onClick={event => {
                  if (link.onClick) {
                    event.preventDefault();
                    link.onClick();
                  }
                  close();
                }}
                className="py-3 text-sm text-gray-300 hover:text-white border-b border-white/5"
              >
                {link.label}
              </a>
            ))}
            <div className="grid grid-cols-1 gap-3 mt-5">
              <button type="button" onClick={() => { close(); onEnter(); }} className="h-11 rounded-xl text-sm text-white font-semibold" style={{ background: gradient }}>
                {enterLabel}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default LandingMobileMenu;
