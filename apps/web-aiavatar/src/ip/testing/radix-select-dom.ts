import { afterAll, beforeAll, vi } from 'vitest';

/** Browser geometry APIs used by the real Radix popup, absent from jsdom. */
export function setupRadixSelectDom() {
  const scroll = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollIntoView');
  beforeAll(() => {
    vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value() {} });
  });
  afterAll(() => {
    vi.unstubAllGlobals();
    if (scroll) Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', scroll);
    else delete (HTMLElement.prototype as Partial<HTMLElement>).scrollIntoView;
  });
}
