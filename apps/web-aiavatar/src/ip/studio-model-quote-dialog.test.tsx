// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { StudioModelQuoteDialog } from './studio-model-quote-dialog';
import type { ModelBillingQuote } from '@ai-star-eco/types/model-billing';
vi.mock('./studio-errors',()=>({normalizeStudioError:(e:Error)=>({message:e.message})}));
vi.mock('antd',()=>({
  ConfigProvider:({children}:any)=>children,
  Modal:({children,title,onOk,onCancel,okText,cancelText,okButtonProps}:any)=><section role="dialog" aria-label={title}>{children}<button onClick={onCancel}>{cancelText}</button><button onClick={onOk} disabled={okButtonProps.disabled}>{okText}</button></section>,
  Checkbox:({children,checked,onChange}:any)=><label><input type="checkbox" checked={checked} onChange={onChange}/>{children}</label>,
  Alert:({title,description,action}:any)=><div role="alert">{title}{description}{action}</div>,
  Button:({children,size,...props}:any)=><button {...props}>{children}</button>,Skeleton:()=> <span>正在核对</span>,
}));
afterEach(cleanup);
const target={appCode:'aiavatar',action:'image',endpointId:'endpoint',providerModel:'model',specKey:'1024x1024',unit:'image' as const};
const quote=(freeOnly=false):ModelBillingQuote=>({target,usage:{quantity:2,outputQuantity:0},standardCredits:20,discountCredits:4,payableCredits:16,scopedCredits:10,walletCredits:6,discountName:'八折',priceVersion:'v1',grantAllocations:[],freeOnly,canAfford:!freeOnly,approval:{walletId:'wallet',target,usage:{quantity:2,outputQuantity:0},priceVersion:'v1',freeOnly,maxWalletCredits:freeOnly?0:6}});
test('shows the full split and confirms the exact server approval only once',async()=>{
 const value=quote(),confirm=vi.fn();render(<StudioModelQuoteDialog loadQuote={vi.fn().mockResolvedValue(value)} onConfirm={confirm} onCancel={vi.fn()}/>);
 const button=await screen.findByRole('button',{name:'确认并支付 6 积分'});
 expect(screen.getByText('八折')).toBeTruthy();expect(screen.getByText('−10 积分')).toBeTruthy();
 fireEvent.click(button);fireEvent.click(button);expect(confirm).toHaveBeenCalledTimes(1);expect(confirm).toHaveBeenCalledWith(value.approval);
});
test('free-only change blocks the previous paid quote immediately and discards stale responses',async()=>{
 const replies:Array<{resolve:(q:ModelBillingQuote)=>void;signal:AbortSignal}>=[];
 const load=vi.fn((_free:boolean,signal:AbortSignal)=>new Promise<ModelBillingQuote>(resolve=>replies.push({resolve,signal})));
 const confirm=vi.fn();render(<StudioModelQuoteDialog loadQuote={load} onConfirm={confirm} onCancel={vi.fn()}/>);
 await waitFor(()=>expect(replies.length).toBe(1));
 fireEvent.click(screen.getByRole('checkbox'));
 expect(screen.getByRole('button',{name:'确认并生成'}).hasAttribute('disabled')).toBe(true);
 await waitFor(()=>expect(replies.length).toBe(2));expect(replies[0].signal.aborted).toBe(true);
 replies[0].resolve(quote());replies[1].resolve({...quote(true),unavailableReason:'模型赠款不够'});
 await screen.findByText(/模型赠款不够/);
 expect(screen.getByRole('button',{name:'确认并支付 6 积分'}).hasAttribute('disabled')).toBe(true);expect(confirm).not.toHaveBeenCalled();
});
test('failed quote supports an explicit retry and never allows confirmation',async()=>{
 const load=vi.fn().mockRejectedValueOnce(new Error('网络中断')).mockResolvedValueOnce(quote()),confirm=vi.fn(),cancel=vi.fn();
 render(<StudioModelQuoteDialog loadQuote={load} onConfirm={confirm} onCancel={cancel}/>);
 await screen.findByText(/网络中断/);expect(screen.getByRole('button',{name:'确认并生成'}).hasAttribute('disabled')).toBe(true);
 fireEvent.click(screen.getByRole('button',{name:'重新报价'}));await screen.findByRole('button',{name:'确认并支付 6 积分'});
 fireEvent.click(screen.getByRole('button',{name:'取消生成'}));expect(cancel).toHaveBeenCalledOnce();expect(confirm).not.toHaveBeenCalled();
});
test('zero ordinary payment can confirm only when the server confirms sufficient matching allowance',async()=>{
 const value={...quote(true),scopedCredits:16,walletCredits:0,canAfford:true},confirm=vi.fn();
 render(<StudioModelQuoteDialog initialFreeOnly loadQuote={vi.fn().mockResolvedValue(value)} onConfirm={confirm} onCancel={vi.fn()}/>);
 const button=screen.getByRole('button',{name:'确认并生成'});await waitFor(()=>expect(button.hasAttribute('disabled')).toBe(false));
 fireEvent.click(button);expect(confirm).toHaveBeenCalledWith(value.approval);
});
