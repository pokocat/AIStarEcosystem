import type {ModelBillingAmounts,ModelBillingBreakdown} from '@ai-star-eco/types/model-billing';
const total=(value:ModelBillingAmounts)=>value.scopedCredits+value.walletCredits;
const describe=(value:ModelBillingAmounts)=>[
  value.scopedCredits?`模型赠款 ${value.scopedCredits.toLocaleString('zh-CN')} 积分`:'',
  value.walletCredits?`普通积分 ${value.walletCredits.toLocaleString('zh-CN')} 积分`:'',
].filter(Boolean).join(' + ');
export function StudioBillingBreakdown({value}:{value:ModelBillingBreakdown}) {
  return <div className="studio-task-note" aria-label="费用明细">
    {total(value.spent)>0&&<p>已消耗：{describe(value.spent)}</p>}
    {total(value.pending)>0&&<p>冻结中：{describe(value.pending)}</p>}
    {total(value.released)>0&&<p>已解除冻结：{describe(value.released)}</p>}
    {value.released.scopedCredits>0&&<p>解除冻结的赠款按原有效期处理，到期部分作废。</p>}
  </div>;
}
