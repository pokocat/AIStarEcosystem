/**
 * 视频裂变的图标：左边一条视频，分成右边三条（2026-11-09 用户要好看的图标）。现成图标库里没有「一变多」的视频图形，按 lucide 的线宽和圆角自己画。
 */
export function FissionIcon({ size = 16, strokeWidth = 1.7 }: { size?: number; strokeWidth?: number }) {
  return <svg className="fission-icon" aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
    <rect x="2.5" y="7.75" width="8" height="8.5" rx="2.2"/>
    <path d="M5.65 10.2v3.6l2.85-1.8z" fill="currentColor" stroke="none"/>
    <path d="M10.5 12h2.4"/>
    <path d="M12.9 12c2.3 0 2.2-6.5 4.7-6.5"/>
    <path d="M12.9 12h4.7"/>
    <path d="M12.9 12c2.3 0 2.2 6.5 4.7 6.5"/>
    <rect x="18.4" y="4" width="3.1" height="3" rx="0.9" fill="currentColor" stroke="none"/>
    <rect x="18.4" y="10.5" width="3.1" height="3" rx="0.9" fill="currentColor" stroke="none"/>
    <rect x="18.4" y="17" width="3.1" height="3" rx="0.9" fill="currentColor" stroke="none"/>
  </svg>;
}
