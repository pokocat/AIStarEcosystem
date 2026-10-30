import type { UiVersion } from './ui-version';

/** One vocabulary for the desktop bar / rail and the mobile workspace switcher. 旧版是改版前线上那一排，新版见 ui-version.ts。 */
const classicNavigation = [
  { href: '/dashboard', label: '首页' },
  { href: '/projects', label: '项目' },
  { href: '/create', label: '画布·自由创作' },
  { href: '/director', label: 'AI 导演台' },
  { href: '/scenes', label: '场景·专项创作' },
  { href: '/templates', label: '灵感' },
  { href: '/assets', label: '资产' },
  { href: '/distribution', label: '发行' },
] as const;

const nextNavigation = [
  { href: '/dashboard', label: '首页' },
  { href: '/video', label: 'AI 视频' },
  { href: '/image', label: 'AI 图片' },
  { href: '/create', label: '画布' },
  { href: '/director', label: '导演台' },
  { href: '/projects', label: '项目' },
  { href: '/assets', label: '资产' },
  { href: '/distribution', label: '发行' },
] as const;

export const studioNavigation = (version: UiVersion) => version === 'next' ? nextNavigation : classicNavigation;

export function studioNavigationCurrent(href: string, pathname: string, version: UiVersion) {
  // 新版把灵感（模板与案例）放到了首页，/templates 只是首页「更多灵感」的落点。
  if (href === '/dashboard') return pathname === '/' || pathname === href
    || version === 'next' && (pathname.startsWith('/templates') || pathname.startsWith('/projects/demos'));
  if (href === '/create') return pathname === href;
  if (href === '/projects') return pathname === href || /^\/projects\/(?!demos(?:\/|$))/.test(pathname);
  if (href === '/templates') return pathname.startsWith(href) || pathname.startsWith('/projects/demos');
  if (href === '/assets') return pathname.startsWith(href) || pathname === '/ips';
  return pathname === href || pathname.startsWith(href + '/');
}
