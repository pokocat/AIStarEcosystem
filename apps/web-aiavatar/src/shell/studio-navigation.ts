/** One vocabulary for the desktop header and the mobile workspace switcher. */
export const studioNavigation = [
  { href: '/dashboard', label: '首页' },
  { href: '/projects', label: '项目' },
  { href: '/create', label: '画布·自由创作' },
  { href: '/scenes', label: '场景·专项创作' },
  { href: '/templates', label: '灵感' },
  { href: '/assets', label: '资产' },
  { href: '/distribution', label: '发行' },
] as const;

export function studioNavigationCurrent(href: string, pathname: string) {
  if (href === '/dashboard') return pathname === '/' || pathname === href;
  if (href === '/create') return pathname === href;
  if (href === '/projects') return pathname === href || /^\/projects\/(?!demos(?:\/|$))/.test(pathname);
  if (href === '/templates') return pathname.startsWith(href) || pathname.startsWith('/projects/demos');
  if (href === '/assets') return pathname.startsWith(href) || pathname === '/ips';
  return pathname === href || pathname.startsWith(href + '/');
}
