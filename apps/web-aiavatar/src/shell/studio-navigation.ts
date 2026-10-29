/** One vocabulary for the desktop rail and the mobile workspace switcher. */
export const studioNavigation = [
  { href: '/dashboard', label: '首页' },
  { href: '/video', label: 'AI 视频' },
  { href: '/image', label: 'AI 图片' },
  { href: '/create', label: '画布' },
  { href: '/director', label: '导演台' },
  { href: '/projects', label: '项目' },
  { href: '/assets', label: '资产' },
  { href: '/distribution', label: '发行' },
] as const;

export function studioNavigationCurrent(href: string, pathname: string) {
  // 灵感（模板与案例）放到了首页，/templates 只是首页「更多灵感」的落点。
  if (href === '/dashboard') return pathname === '/' || pathname === href || pathname.startsWith('/templates') || pathname.startsWith('/projects/demos');
  if (href === '/create') return pathname === href;
  if (href === '/projects') return pathname === href || /^\/projects\/(?!demos(?:\/|$))/.test(pathname);
  if (href === '/assets') return pathname.startsWith(href) || pathname === '/ips';
  return pathname === href || pathname.startsWith(href + '/');
}
