'use client';

import { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Alert, Button, Checkbox, ConfigProvider, Modal, Skeleton } from 'antd';
import { ApiError } from '@ai-star-eco/api-client';
import type { ModelBillingApproval, ModelBillingQuote } from '@ai-star-eco/types/model-billing';
import type { EnterpriseBillingSelection } from '@ai-star-eco/types/enterprise';
import { normalizeStudioError } from './studio-errors';

type LoadQuote=(freeOnly:boolean,signal:AbortSignal)=>Promise<ModelBillingQuote>;
const n=(value:number)=>value.toLocaleString('zh-CN');
export function StudioModelQuoteDialog({loadQuote,billing,initialFreeOnly=false,onConfirm,onCancel}:{loadQuote:LoadQuote;billing?:EnterpriseBillingSelection|null;initialFreeOnly?:boolean;onConfirm:(approval:ModelBillingApproval)=>void;onCancel:()=>void}) {
  const [freeOnly,setFreeOnly]=useState(initialFreeOnly),[reload,setReload]=useState(0),[loading,setLoading]=useState(true),[error,setError]=useState('');
  const [quote,setQuote]=useState<ModelBillingQuote>();const confirmed=useRef(false);
  useEffect(()=>{
    const abort=new AbortController();setLoading(true);setError('');setQuote(undefined);
    loadQuote(freeOnly,abort.signal).then(value=>{if(!abort.signal.aborted)setQuote(value);})
      .catch(caught=>{if(!abort.signal.aborted)setError(normalizeStudioError(caught).message);})
      .finally(()=>{if(!abort.signal.aborted)setLoading(false);});
    return ()=>abort.abort();
  },[loadQuote,freeOnly,reload]);
  const blocked=loading||!!error||!quote?.canAfford||quote.freeOnly!==freeOnly;
  return <ConfigProvider theme={{token:{colorPrimary:'#192229',fontFamily:'var(--ip-ui, sans-serif)',borderRadius:8}}}><Modal open title={quote?.target.action==='video'?'确认视频费用':quote?'确认图片费用':'确认生成费用'} okText={quote?.walletCredits?`确认并支付 ${n(quote.walletCredits)} 积分`:'确认并生成'} cancelText="取消生成" getContainer={false}
    onCancel={onCancel} okButtonProps={{disabled:blocked}} onOk={()=>{if(!blocked&&quote&&!confirmed.current){confirmed.current=true;onConfirm(quote.approval);}}}>
    <div className="studio-billing-form"><p>{billing?.mode==='enterprise'?'所选企业成员账户':'个人账户'} · 本次{quote?.target.action==='video'?'视频':'图片'}生成</p>
      {loading?<Skeleton active paragraph={{rows:4}}/>:error?<Alert type="error" showIcon title="无法取得报价" description={error} action={<Button size="small" onClick={()=>setReload(value=>value+1)}>重新报价</Button>}/>:quote&&<>
        <p>{quote.target.action==='video'?`视频生成 · 合计 ${n(quote.usage.quantity)} ${quote.target.unit==='second'?'秒':'次'}`:`${n(quote.usage.quantity)} 张 · ${quote.target.specKey.replace('x',' × ')}`}</p>
        <dl className="studio-model-quote-lines">
          <div><dt>标准价格</dt><dd>{n(quote.standardCredits)} 积分</dd></div>
          {quote.discountCredits>0&&<div><dt>{quote.discountName||'客户优惠'}</dt><dd>−{n(quote.discountCredits)} 积分</dd></div>}
          <div><dt>折后费用</dt><dd>{n(quote.payableCredits)} 积分</dd></div>
          <div><dt>模型赠款抵扣</dt><dd>−{n(quote.scopedCredits)} 积分</dd></div>
          <div><dt>需付普通积分</dt><dd><strong>{n(quote.walletCredits)} 积分</strong></dd></div>
        </dl>
        {!quote.canAfford&&<Alert type="warning" showIcon title="当前不能生成" description={quote.unavailableReason||'请检查可用额度后重新报价'} action={<Button size="small" onClick={()=>setReload(value=>value+1)}>重新报价</Button>}/>}
      </>}
      <Checkbox checked={freeOnly} onChange={event=>{setQuote(undefined);setLoading(true);setFreeOnly(event.target.checked);}}>只用模型赠款</Checkbox>
      <p>选中后，额度不足就停止生成，不扣普通积分。提交时会再次核对价格与额度。</p>
    </div>
  </Modal></ConfigProvider>;
}
export function confirmStudioModelQuote(loadQuote:LoadQuote,billing?:EnterpriseBillingSelection|null,initialFreeOnly=false):Promise<ModelBillingApproval> {
  return new Promise((resolve,reject)=>{
    const host=document.createElement('div');host.className='ip-brand-surface studio-billing-host';document.body.appendChild(host);
    const root=createRoot(host),origin=document.activeElement instanceof HTMLElement?document.activeElement:null;
    const finish=(approval?:ModelBillingApproval)=>{root.unmount();host.remove();setTimeout(()=>{if(origin?.isConnected)origin.focus();},0);
      if(approval)resolve(approval);else reject(new ApiError({code:'STUDIO_BILLING_CANCELLED',message:'本次生成已取消，未提交任务。'},400));};
    root.render(<StudioModelQuoteDialog loadQuote={loadQuote} billing={billing} initialFreeOnly={initialFreeOnly} onConfirm={finish} onCancel={()=>finish()}/>);
  });
}
