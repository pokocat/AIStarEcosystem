// @vitest-environment jsdom
import { cleanup,render,screen } from '@testing-library/react';
import { afterEach,beforeEach,expect,test,vi } from 'vitest';
import { AssetsLibrary } from './assets-library';
const route=vi.hoisted(()=>({query:new URLSearchParams(),push:vi.fn()}));
vi.mock('next/navigation',()=>({useSearchParams:()=>route.query,useRouter:()=>route,usePathname:()=>'/assets'}));
vi.mock('next/link',()=>({default:({children,...p}:any)=><a {...p}>{children}</a>}));
vi.mock('antd',()=>({App:({children}:any)=>children,ConfigProvider:({children}:any)=>children}));
vi.mock('@/proto/api',()=>({AssetApi:{starGrants:vi.fn()},AvatarApi:{list:vi.fn()},LicenseApi:{list:vi.fn()},VoiceApi:{mine:vi.fn()}}));
vi.mock('./auth',()=>({useRequireAuth:()=> 'ok',PlatformGateScreen:()=>null}));
vi.mock('./data',()=>({useHubData:()=>({data:[],loading:false,error:null})}));
vi.mock('./ui',()=>({HubTabBar:()=>null}));
vi.mock('@/ip/ip-management',()=>({IpManagement:({embedded}:any)=><div data-testid="ip-view">{String(embedded)}</div>}));
vi.mock('@/ip/personal-asset-library',()=>({PersonalAssetLibrary:({initialTab,hideTabs}:any)=><div data-testid="personal-view">{initialTab}:{String(hideTabs)}</div>}));
vi.mock('@/ip/supplementary-asset-library',()=>({AvatarLibrary:()=>null,VoiceLibrary:()=>null}));
beforeEach(()=>{route.query=new URLSearchParams();});afterEach(cleanup);
test('bare assets defaults to the complete embedded IP view as its first category',()=>{
  render(<AssetsLibrary/>);expect(screen.getByTestId('ip-view').textContent).toBe('true');
  const category=screen.getByRole('group',{name:'资产分类'});expect(category.querySelector('button')?.getAttribute('aria-pressed')).toBe('true');
  expect(screen.queryByTestId('personal-view')).toBeNull();
});
test('explicit material deep links bypass the default and keep the original material library',()=>{
  route.query=new URLSearchParams('tab=materials');render(<AssetsLibrary/>);
  expect(screen.getByTestId('personal-view').textContent).toBe('materials:true');expect(screen.queryByTestId('ip-view')).toBeNull();
});
