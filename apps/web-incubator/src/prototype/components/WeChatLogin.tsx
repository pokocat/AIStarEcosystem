import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { CheckCircle2, RefreshCw, Smartphone } from 'lucide-react';
import type { Lang } from '../translations';

export const WECHAT_GREEN = '#07C160';

/** WeChat brand mark (two chat bubbles). */
export const WeChatIcon = ({ className = 'w-5 h-5', color = 'currentColor' }: { className?: string; color?: string }) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden fill={color}>
    <path d="M9.1 3.5C4.9 3.5 1.5 6.3 1.5 9.8c0 2 1.1 3.8 2.9 5l-.7 2.2 2.6-1.4c.9.3 1.9.4 2.8.4h.5a5.6 5.6 0 0 1-.2-1.5c0-3.4 3.2-6.1 7.2-6.1h.5C16.4 5.6 13.1 3.5 9.1 3.5Zm-2.6 4.6a1 1 0 1 1 0-2 1 1 0 0 1 0 2Zm5.2 0a1 1 0 1 1 0-2 1 1 0 0 1 0 2Z" />
    <path d="M22.5 14.4c0-2.9-2.9-5.2-6.4-5.2s-6.4 2.3-6.4 5.2 2.9 5.2 6.4 5.2c.8 0 1.5-.1 2.2-.3l2 1.1-.5-1.8c1.6-1 2.7-2.5 2.7-4.2Zm-8.6-.9a.85.85 0 1 1 0-1.7.85.85 0 0 1 0 1.7Zm4.4 0a.85.85 0 1 1 0-1.7.85.85 0 0 1 0 1.7Z" />
  </svg>
);

const QR_SIZE = 25;

/** Decorative QR-style matrix: three finder patterns plus seeded noise, regenerated per session. */
const buildMatrix = (seed: number) => {
  let s = seed;
  const rand = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  const inFinder = (x: number, y: number) => {
    const corners = [[0, 0], [QR_SIZE - 7, 0], [0, QR_SIZE - 7]];
    return corners.some(([cx, cy]) => x >= cx - 1 && x <= cx + 7 && y >= cy - 1 && y <= cy + 7);
  };
  const centre = (x: number, y: number) => Math.abs(x - 12) <= 3 && Math.abs(y - 12) <= 3;
  const cells: Array<[number, number]> = [];
  for (let y = 0; y < QR_SIZE; y++) for (let x = 0; x < QR_SIZE; x++) {
    if (!inFinder(x, y) && !centre(x, y) && rand() > 0.52) cells.push([x, y]);
  }
  return cells;
};

const Finder = ({ x, y }: { x: number; y: number }) => (
  <g>
    <rect x={x} y={y} width="7" height="7" rx="1.6" fill="#111827" />
    <rect x={x + 1} y={y + 1} width="5" height="5" rx="1.1" fill="#fff" />
    <rect x={x + 2} y={y + 2} width="3" height="3" rx=".7" fill="#111827" />
  </g>
);

type Status = 'waiting' | 'scanned' | 'confirmed' | 'expired';
const EXPIRY_SECONDS = 120;

/**
 * Demo WeChat QR login. There is no real WeChat Open Platform integration:
 * clicking the QR code simulates "scan → confirm on phone → signed in".
 */
export const WeChatQrPanel = ({ lang, onSuccess }: { lang: Lang; onSuccess: () => void }) => {
  const zh = lang === 'zh';
  const [seed, setSeed] = useState(() => Math.floor(Math.random() * 100000));
  const [status, setStatus] = useState<Status>('waiting');
  const [left, setLeft] = useState(EXPIRY_SECONDS);
  const cells = useMemo(() => buildMatrix(seed), [seed]);
  const successRef = useRef(onSuccess);
  successRef.current = onSuccess;

  useEffect(() => {
    if (status !== 'waiting') return;
    const timer = window.setInterval(() => setLeft(v => {
      if (v <= 1) { setStatus('expired'); return 0; }
      return v - 1;
    }), 1000);
    return () => window.clearInterval(timer);
  }, [status, seed]);

  useEffect(() => {
    if (status === 'scanned') {
      const t = window.setTimeout(() => setStatus('confirmed'), 1600);
      return () => window.clearTimeout(t);
    }
    if (status === 'confirmed') {
      const t = window.setTimeout(() => successRef.current(), 900);
      return () => window.clearTimeout(t);
    }
  }, [status]);

  const refresh = () => { setSeed(Math.floor(Math.random() * 100000)); setLeft(EXPIRY_SECONDS); setStatus('waiting'); };
  const simulateScan = () => { if (status === 'waiting') setStatus('scanned'); };

  const mm = String(Math.floor(left / 60));
  const ss = String(left % 60).padStart(2, '0');

  return (
    <div className="flex flex-col items-center text-center">
      <div className="flex items-center gap-2 text-sm font-semibold" style={{ color: WECHAT_GREEN }}>
        <WeChatIcon className="w-5 h-5" color={WECHAT_GREEN} />
        {zh ? '微信扫码登录' : 'Scan with WeChat'}
      </div>
      <p className="text-xs text-gray-400 mt-1.5">
        {zh ? '打开手机微信，扫一扫下方二维码' : 'Open WeChat on your phone and scan the code'}
      </p>

      <div className="relative mt-5 w-52 h-52 rounded-2xl p-3"
        style={{ background: '#ffffff', boxShadow: `0 0 0 1px ${WECHAT_GREEN}33, 0 18px 48px -18px ${WECHAT_GREEN}66` }}>
        <svg viewBox={`-1 -1 ${QR_SIZE + 2} ${QR_SIZE + 2}`} className="w-full h-full">
          {cells.map(([x, y]) => <rect key={`${x}-${y}`} x={x + .08} y={y + .08} width=".84" height=".84" rx=".22" fill="#111827" />)}
          <Finder x={0} y={0} /><Finder x={QR_SIZE - 7} y={0} /><Finder x={0} y={QR_SIZE - 7} />
          <rect x="9.3" y="9.3" width="6.4" height="6.4" rx="1.6" fill="#fff" />
          <rect x="9.9" y="9.9" width="5.2" height="5.2" rx="1.3" fill={WECHAT_GREEN} />
        </svg>
        <span aria-hidden className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
          <WeChatIcon className="w-5 h-5" color="#ffffff" />
        </span>
        {status === 'waiting' && (
          <button type="button" onClick={simulateScan} aria-label={zh ? '模拟扫码登录' : 'Simulate scan to sign in'}
            className="absolute inset-0 rounded-2xl cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2"
            style={{ outlineColor: WECHAT_GREEN }} />
        )}
        {status === 'waiting' && (
          <motion.span aria-hidden className="pointer-events-none absolute left-3 right-3 h-0.5 rounded-full"
            style={{ background: `linear-gradient(90deg, transparent, ${WECHAT_GREEN}, transparent)`, boxShadow: `0 0 12px ${WECHAT_GREEN}` }}
            initial={{ top: '12%' }} animate={{ top: ['12%', '86%', '12%'] }} transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut' }} />
        )}

        <AnimatePresence>
          {status !== 'waiting' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 rounded-2xl flex flex-col items-center justify-center gap-2"
              style={{ background: 'rgba(255,255,255,.94)', color: '#111827' }}>
              {status === 'expired' && (
                <>
                  <span className="text-sm font-semibold" style={{ color: '#111827' }}>{zh ? '二维码已过期' : 'QR code expired'}</span>
                  <button type="button" onClick={refresh}
                    className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold"
                    style={{ background: WECHAT_GREEN, color: '#fff' }}>
                    <RefreshCw className="w-3.5 h-3.5" /> {zh ? '点击刷新' : 'Refresh'}
                  </button>
                </>
              )}
              {status === 'scanned' && (
                <>
                  <motion.span animate={{ y: [0, -4, 0] }} transition={{ duration: 1.2, repeat: Infinity }}>
                    <Smartphone className="w-9 h-9" style={{ color: WECHAT_GREEN }} />
                  </motion.span>
                  <span className="text-sm font-semibold" style={{ color: '#111827' }}>{zh ? '扫码成功' : 'Scanned'}</span>
                  <span className="text-xs" style={{ color: '#6b7280' }}>{zh ? '请在手机上确认登录' : 'Confirm sign-in on your phone'}</span>
                </>
              )}
              {status === 'confirmed' && (
                <>
                  <motion.span initial={{ scale: .5 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 260, damping: 14 }}>
                    <CheckCircle2 className="w-10 h-10" style={{ color: WECHAT_GREEN }} />
                  </motion.span>
                  <span className="text-sm font-semibold" style={{ color: '#111827' }}>{zh ? '授权成功，正在进入…' : 'Authorized, signing in…'}</span>
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="mt-4 h-5 text-xs text-gray-500">
        {status === 'waiting' && (zh ? `二维码 ${mm}:${ss} 后失效` : `Expires in ${mm}:${ss}`)}
      </div>
      <p className="mt-1 text-[11px] text-gray-500">
        {zh ? '演示环境：点击二维码即可模拟手机扫码授权' : 'Demo: click the QR code to simulate scanning'}
      </p>
    </div>
  );
};
