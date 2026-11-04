// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { StrictMode } from 'react';
import { ToastProvider, useToast } from './Toaster';
let retained: ReturnType<typeof useToast>;
function Harness() { retained=useToast();return <button onClick={()=>retained.success({title:'Saved',duration:1000})}>Save</button>; }
function mount(){return render(<StrictMode><ToastProvider><Harness/></ToastProvider></StrictMode>);}
beforeEach(()=>vi.useFakeTimers());
afterEach(()=>{cleanup();vi.clearAllTimers();vi.useRealTimers();});
test('auto-dismiss removes the visible toast at its deadline',()=>{mount();fireEvent.click(screen.getByText('Save'));expect(screen.getByRole('status').textContent).toContain('Saved');act(()=>vi.advanceTimersByTime(1000));expect(screen.queryByRole('status')).toBeNull();expect(vi.getTimerCount()).toBe(0);});
test('manual dismissal cancels its pending deadline',()=>{mount();fireEvent.click(screen.getByText('Save'));fireEvent.click(screen.getByRole('button',{name:'关闭提示'}));expect(screen.queryByRole('status')).toBeNull();expect(vi.getTimerCount()).toBe(0);});
test('unmount cancels deadlines and a retained callback cannot schedule updates',()=>{const view=mount();fireEvent.click(screen.getByText('Save'));expect(vi.getTimerCount()).toBe(1);view.unmount();expect(vi.getTimerCount()).toBe(0);act(()=>{retained.success({title:'Late',duration:1000});vi.runAllTimers();});expect(vi.getTimerCount()).toBe(0);});
