'use client';
import { useEffect, useRef, useState } from 'react';
import { Button, Input, Modal, Select } from 'antd';
import { SocialAccountApi } from '@ai-star-eco/api-client';
import type { SocialAccount, SocialAccountBindInit, SocialAccountBindPollResult, SocialPlatform } from '@ai-star-eco/types/social-account';
import { StudioErrorNotice, reportStudioError, useStudioErrorState } from './studio-errors';
import { studioOverlayContainer } from './studio-overlay';

export const socialPlatformLabels: Record<SocialPlatform, string> = { douyin:'抖音', kuaishou:'快手', shipinhao:'视频号', xiaohongshu:'小红书', bilibili:'哔哩哔哩', tiktok:'TikTok', youtube:'YouTube', baijiahao:'百家号' };
const supported = ['douyin','kuaishou','shipinhao','xiaohongshu'] as const;

/** Uses the existing bind ticket protocol, including cancellation of late init responses. */
export function StudioSocialBind({ onClose, onBound }: { onClose: () => void; onBound: (account: SocialAccount) => void }) {
  const [platform,setPlatform] = useState<SocialPlatform>('douyin'), [name,setName] = useState('');
  const [init,setInit] = useState<SocialAccountBindInit>();
  const [result,setResult] = useState<SocialAccountBindPollResult>();
  const [error,setError] = useStudioErrorState(), [busy,setBusy] = useState(false), [code,setCode] = useState(''), [retry,setRetry] = useState(0);
  const alive = useRef(true), locked = useRef(false), ticket = useRef<string | undefined>(undefined), completed = useRef(false);
  const callbacks = useRef({onClose,onBound}); callbacks.current = {onClose,onBound};
  const cancel = (value: string) => { void SocialAccountApi.cancelBind(value).catch(reportStudioError); };
  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; if (ticket.current && !completed.current) cancel(ticket.current); };
  }, []);
  useEffect(() => {
    if (!init) return;
    let active = true, timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        if (Date.parse(init.expiresAt) <= Date.now()) { if (active) setResult({status:'expired'}); return; }
        const value = await SocialAccountApi.pollBind(init.sessionTicket);
        if (!active) return;
        setError(''); setResult(value);
        if (value.status === 'success' && value.account) {
          completed.current = true; callbacks.current.onBound(value.account); callbacks.current.onClose(); return;
        }
        if (value.status === 'failed' || value.status === 'expired') return;
        timer = setTimeout(() => void poll(), 2000);
      } catch (e) { if (active) setError(e); }
    };
    void poll();
    return () => { active = false; clearTimeout(timer); };
  }, [init,retry,setError]);
  const start = async () => {
    if (locked.current || init || !name.trim()) return;
    locked.current = true; setBusy(true); setError('');
    try {
      const value = await SocialAccountApi.initBind({platform,accountName:name.trim()});
      if (!alive.current) { cancel(value.sessionTicket); return; }
      ticket.current = value.sessionTicket; setInit(value);
    } catch (e) { if (alive.current) setError(e); }
    finally { locked.current = false; if (alive.current) setBusy(false); }
  };
  const submitCode = async () => {
    if (!init || locked.current || !/^\d{6}$/.test(code)) return;
    locked.current = true; setBusy(true); setError('');
    try { await SocialAccountApi.submitBindInteraction(init.sessionTicket,{code}); if (alive.current) { setCode(''); setRetry(n => n+1); } }
    catch(e) { if (alive.current) setError(e); }
    finally { locked.current = false; if (alive.current) setBusy(false); }
  };
  const terminal = result?.status === 'expired' || result?.status === 'failed';
  const qr = init?.qrImageDataUrl && /^data:image\/(png|jpe?g|webp);base64,/.test(init.qrImageDataUrl) ? init.qrImageDataUrl : undefined;
  const loginUrl = init?.qrUrl && /^https:\/\//i.test(init.qrUrl) ? init.qrUrl : undefined;
  return <Modal open title="绑定发布账号" footer={null} onCancel={onClose} getContainer={studioOverlayContainer} className="studio-bind-modal" destroyOnHidden>
    <div className="studio-bind-form">
      {!init ? <><label>平台<Select aria-label="绑定平台" value={platform} disabled={busy} onChange={setPlatform} options={supported.map(value => ({value,label:socialPlatformLabels[value]}))}/></label><label>账号备注<Input aria-label="账号备注" value={name} disabled={busy} maxLength={64} placeholder="例如：品牌主号" onChange={e => setName(e.target.value)}/></label><Button type="primary" loading={busy} disabled={!name.trim()} onClick={() => void start()}>获取登录二维码</Button></> : terminal ? <div role="status"><h3>{result.status === 'expired' ? '二维码已过期' : '绑定未完成'}</h3><p>{result.message || '请关闭窗口后重新绑定。'}</p></div> : <>
        <p role="status">{result?.status === 'awaiting_user' ? '平台需要进一步验证' : '请使用对应平台的手机应用扫码登录。'}</p>
        {qr ? <img className="studio-bind-qr" src={qr} alt="平台登录二维码"/> : loginUrl ? <a href={loginUrl} target="_blank" rel="noopener noreferrer">打开平台登录页</a> : <p>{init.alreadyLoggedIn ? '正在确认已有登录状态…' : '正在等待平台登录信息，请稍候。'}</p>}
        {result?.status === 'awaiting_user' && <><label>{result.interactionRequired?.prompt || '请输入手机收到的验证码'}<Input aria-label="绑定验证码" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={e => setCode(e.target.value.replace(/\D/g,''))}/></label><Button disabled={!/^\d{6}$/.test(code)} loading={busy} onClick={() => void submitCode()}>提交验证码</Button></>}
      </>}
      {error && <div role="alert"><StudioErrorNotice error={error}/>{init && !terminal && <Button onClick={() => setRetry(n => n+1)}>继续查询本次绑定</Button>}</div>}
      <p className="studio-workspace-hint">绑定结果以平台确认的信息为准。关闭窗口将结束本次扫码。</p>
    </div>
  </Modal>;
}
