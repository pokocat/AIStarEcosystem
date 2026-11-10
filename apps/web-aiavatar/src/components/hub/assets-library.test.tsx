// @vitest-environment jsdom
import { cleanup,render,screen } from '@testing-library/react';
import { afterEach,beforeEach,expect,test,vi } from 'vitest';
import { AssetsLibrary } from './assets-library';
const state=vi.hoisted(()=>({auth:'ok'}));
vi.mock('@/ip/assets-hub',()=>({AssetsHub:()=><div data-testid="hub-view"/>}));
vi.mock('next/navigation',()=>({usePathname:()=>'/assets'}));
vi.mock('./auth',()=>({useRequireAuth:()=>state.auth,PlatformGateScreen:()=><div data-testid="gate"/>}));
vi.mock('./ui',()=>({HubTabBar:()=>null}));
beforeEach(()=>{state.auth='ok';});afterEach(cleanup);
test('the assets route opens the media-type asset page',()=>{
  render(<AssetsLibrary/>);
  expect(screen.getByTestId('hub-view')).toBeDefined();
});
test('while sign-in is being checked the page says so instead of showing an empty library',()=>{
  state.auth='checking';render(<AssetsLibrary/>);
  expect(screen.getByRole('status')).toBeDefined();expect(screen.queryByTestId('hub-view')).toBeNull();
});
test('an account without the product sees the enrolment gate',()=>{
  state.auth='no-platform';render(<AssetsLibrary/>);
  expect(screen.getByTestId('gate')).toBeDefined();expect(screen.queryByTestId('hub-view')).toBeNull();
});
