'use client';
import type { IpDemoAdmin } from '@ai-star-eco/types';

export function StudioOfficialContentTarget({ items, value, disabled, onChange, onVersion }: {
  items: IpDemoAdmin[]; value: string; disabled: boolean; onChange: (item?: IpDemoAdmin) => void; onVersion: () => void;
}) {
  const mutable = items.filter(item => !item.currentVersionId), versioned = items.filter(item => item.currentVersionId);
  return <div className="studio-official-content-target">
    <label htmlFor="studio-official-content-target">保存位置</label>
    <select id="studio-official-content-target" value={value} disabled={disabled} onChange={event => {
      const item = items.find(item => item.id === event.target.value);
      if (!item?.currentVersionId) onChange(item);
    }}>
      <option value="">新建官方内容</option>
      {mutable.map(item => <option key={item.id} value={item.id}>更新「{item.name}」（{item.kind === 'template' ? '模板' : '示例'}{item.enabled ? '' : ' · 已下线'}）</option>)}
      {!!versioned.length && <optgroup label="已发布配方 · 请新增版本">{versioned.map(item => <option key={item.id} value={item.id} disabled>{item.name} · 版本化模板</option>)}</optgroup>}
    </select>
    {!!versioned.length && <div className="studio-official-version-note"><p>已发布的配方保留原版本。更新模板请配置并发布新版本，已有用户的画布继续使用原版本。</p><button type="button" disabled={disabled} onClick={onVersion}>发布模板新版本</button></div>}
  </div>;
}
