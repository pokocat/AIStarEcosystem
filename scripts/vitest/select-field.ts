import { beforeAll, afterAll, vi } from 'vitest';

export function setupSelectFieldDom() {
  const scroll = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollIntoView');
  beforeAll(() => {
    vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable:true, writable:true, value(){} });
  });
  afterAll(() => {
    vi.unstubAllGlobals();
    if(scroll) Object.defineProperty(HTMLElement.prototype,'scrollIntoView',scroll);
    else delete (HTMLElement.prototype as Partial<HTMLElement>).scrollIntoView;
  });
}
/** Keep business assertions expressed in wire values; interact with the visible
 * popup option, whose accessible label comes from the existing option catalogue. */
export function createSelectFieldUser({fireEvent,screen}: {
  fireEvent: {change:(element:HTMLElement,props:unknown)=>boolean;keyDown:(element:HTMLElement,props:unknown)=>boolean;click:(element:HTMLElement)=>boolean};
  screen: {findByRole:(role:string,options:{name:string;exact:boolean})=>Promise<HTMLElement>};
}) { return async function selectFieldValue(trigger: HTMLElement, value: string) {
  if(trigger instanceof HTMLSelectElement) { fireEvent.change(trigger,{target:{value}});return; }
  const select=document.getElementById(trigger.dataset.selectNative!) as HTMLSelectElement;
  const label=Array.from(select.options).find(option=>option.value===value)?.textContent || '';
  if(!label) throw new Error(`Missing select option: ${value}`);
  fireEvent.keyDown(trigger,{key:'ArrowDown'});
  fireEvent.click(await screen.findByRole('option',{name:label,exact:true}));
}

}
