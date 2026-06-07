"use client";
import React from "react";
import { Icons } from "./icons";
import * as UI from "./ui";
import { AuthApi, auth } from "./api";
import { toast } from "./toast";

// ============================================================
// 移动端 · 登录 / 注册（live 模式必经；mock 模式不渲染）
//   手机验证码登录（生产）+ 注册（验证码 + 激活码双因素）+ 体验账号（dev）
// ============================================================
const hLG : any = React.createElement;
const { useState: useStateLG, useEffect: useEffectLG, useRef: useRefLG } = React;

function Tab({ on, onClick, children }) {
  return hLG('button', { onClick, style: {
    flex: 1, height: 40, border: 'none', borderRadius: 'var(--r-pill)', cursor: 'pointer',
    background: on ? 'var(--surface)' : 'transparent', color: on ? 'var(--ink)' : 'var(--ink-3)',
    fontSize: 14, fontWeight: on ? 700 : 600, boxShadow: on ? 'var(--sh-1)' : 'none', transition: 'all .15s' } }, children);
}

function Field({ label, children }) {
  return hLG('div', { style: { marginBottom: 14 } },
    hLG('div', { style: { fontSize: 12.5, fontWeight: 600, color: 'var(--ink-2)', marginBottom: 7 } }, label),
    children);
}

function CodeRow({ phone, value, onChange, purpose }) {
  const [left, setLeft] = useStateLG(0);
  const [sending, setSending] = useStateLG(false);
  const timer = useRefLG(null as any);
  useEffectLG(() => () => timer.current && clearInterval(timer.current), []);
  const send = async () => {
    if (!/^1\d{10}$/.test(phone)) { toast('请输入 11 位手机号', { tone: 'warn' }); return; }
    setSending(true);
    try {
      await AuthApi.smsRequestCode(phone, purpose);
      toast('验证码已发送', { tone: 'ok' });
      setLeft(60);
      timer.current = setInterval(() => setLeft((s) => { if (s <= 1) { clearInterval(timer.current); return 0; } return s - 1; }), 1000);
    } catch (e: any) {
      toast(e?.message || '发送失败，请稍后重试', { tone: 'err' });
    } finally { setSending(false); }
  };
  return hLG('div', { style: { display: 'flex', gap: 9 } },
    hLG(UI.Input, { value, onChange, placeholder: '6 位验证码', inputMode: 'numeric', style: { flex: 1 } }),
    hLG('button', { onClick: send, disabled: left > 0 || sending, style: {
      flex: '0 0 auto', height: 46, padding: '0 16px', borderRadius: 'var(--r-md)', cursor: left > 0 ? 'default' : 'pointer',
      border: '1px solid var(--line-2)', background: left > 0 ? 'var(--surface-3)' : 'var(--surface)',
      color: left > 0 ? 'var(--ink-4)' : 'var(--primary)', fontSize: 13, fontWeight: 700 } },
      sending ? '发送中…' : left > 0 ? left + 's' : '获取验证码'));
}

export function MLogin({ onLoggedIn }) {
  const [tab, setTab] = useStateLG('login'); // login | register | dev
  const [phone, setPhone] = useStateLG('');
  const [code, setCode] = useStateLG('');
  const [licenseKey, setLicenseKey] = useStateLG('');
  const [studioName, setStudioName] = useStateLG('');
  const [busy, setBusy] = useStateLG(false);
  const [devAccounts, setDevAccounts] = useStateLG([] as any[]);

  useEffectLG(() => { AuthApi.devAccounts().then(setDevAccounts).catch(() => {}); }, []);

  const finish = (data: { token: string; user: any }) => {
    auth.setSession(data.token, data.user);
    toast('欢迎回来' + (data.user?.displayName ? ' · ' + data.user.displayName : ''), { tone: 'ok' });
    onLoggedIn();
  };

  const doLogin = async () => {
    if (!/^1\d{10}$/.test(phone)) { toast('请输入 11 位手机号', { tone: 'warn' }); return; }
    if (!code.trim()) { toast('请输入验证码', { tone: 'warn' }); return; }
    setBusy(true);
    try {
      finish(await AuthApi.smsLogin(phone, code.trim()));
    } catch (e: any) {
      if (e?.code === 'USER_NOT_FOUND' || e?.status === 404) {
        toast('该手机号尚未注册，请切换到注册', { tone: 'warn' });
        setTab('register');
      } else {
        toast(e?.message || '登录失败', { tone: 'err' });
      }
    } finally { setBusy(false); }
  };

  const doRegister = async () => {
    if (!/^1\d{10}$/.test(phone)) { toast('请输入 11 位手机号', { tone: 'warn' }); return; }
    if (!code.trim()) { toast('请输入验证码', { tone: 'warn' }); return; }
    if (!licenseKey.trim()) { toast('请输入激活码', { tone: 'warn' }); return; }
    if (!studioName.trim()) { toast('请输入工作室名称', { tone: 'warn' }); return; }
    setBusy(true);
    try {
      finish(await AuthApi.smsRegister({ phone, code: code.trim(), licenseKey: licenseKey.trim(), studioName: studioName.trim() }));
    } catch (e: any) {
      toast(e?.message || '注册失败', { tone: 'err' });
    } finally { setBusy(false); }
  };

  const doDevLogin = async (username: string) => {
    setBusy(true);
    try {
      finish(await AuthApi.devLogin(username));
    } catch (e: any) {
      toast(e?.message || '登录失败', { tone: 'err' });
    } finally { setBusy(false); }
  };

  return hLG('div', { style: { position: 'absolute', inset: 0, zIndex: 200, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--canvas)' }, 'data-screen-label': '登录' },
    // 顶部品牌区（柔光背景）
    hLG('div', { style: { position: 'relative', flex: '0 0 auto', padding: '28px 26px 26px', overflow: 'hidden',
      background: 'linear-gradient(150deg,#EAF0FF,#F1E8FB 46%,#FCE6F1)' } },
      hLG('div', { style: { position: 'absolute', top: -70, right: -60, width: 220, height: 220, borderRadius: '50%', background: 'radial-gradient(closest-side, rgba(18,179,222,.30), transparent 70%)', filter: 'blur(10px)' } }),
      hLG('div', { style: { position: 'absolute', bottom: -80, left: -50, width: 230, height: 230, borderRadius: '50%', background: 'radial-gradient(closest-side, rgba(155,107,255,.24), transparent 70%)', filter: 'blur(12px)' } }),
      hLG('div', { style: { position: 'relative' } },
        hLG('div', { style: { display: 'inline-flex', alignItems: 'center', gap: 7, padding: '6px 13px', background: 'rgba(255,255,255,.7)', backdropFilter: 'blur(8px)', borderRadius: 'var(--r-pill)', fontSize: 12, fontWeight: 700, color: 'var(--ink-2)', marginBottom: 16 } },
          hLG(Icons.sparkle, { size: 13, stroke: 2, style: { color: 'var(--primary)' } }), '数字人资产平台'),
        hLG('h1', { style: { fontSize: 26, fontWeight: 800, letterSpacing: '-.02em', lineHeight: 1.2, margin: 0, color: 'var(--ink)' } }, '登录后，开始创建', hLG('br', null), '你的数字分身'),
        hLG('p', { style: { fontSize: 13, color: 'var(--ink-2)', margin: '10px 0 0', lineHeight: 1.5 } }, '形象、声音与衍生资产都会安全沉淀在你的账户里。'))),

    // 表单区
    hLG('div', { style: { flex: 1, minHeight: 0, overflowY: 'auto', padding: '20px 22px calc(24px + var(--home-ind))' } },
      hLG('div', { style: { display: 'flex', background: 'var(--surface-3)', padding: 3, borderRadius: 'var(--r-pill)', marginBottom: 20 } },
        hLG(Tab, { on: tab === 'login', onClick: () => setTab('login') }, '手机号登录'),
        hLG(Tab, { on: tab === 'register', onClick: () => setTab('register') }, '注册'),
        devAccounts.length > 0 && hLG(Tab, { on: tab === 'dev', onClick: () => setTab('dev') }, '体验账号')),

      tab !== 'dev' && hLG('div', null,
        hLG(Field, { label: '手机号' }, hLG(UI.Input, { value: phone, onChange: setPhone, placeholder: '11 位手机号', inputMode: 'tel' })),
        hLG(Field, { label: '验证码' }, hLG(CodeRow, { phone, value: code, onChange: setCode, purpose: tab === 'register' ? 'register' : 'login' })),
        tab === 'register' && hLG(React.Fragment, null,
          hLG(Field, { label: '激活码' }, hLG(UI.Input, { value: licenseKey, onChange: setLicenseKey, placeholder: '购买套餐后获得的激活码' })),
          hLG(Field, { label: '工作室名称' }, hLG(UI.Input, { value: studioName, onChange: setStudioName, placeholder: '如：柯岚工作室' })),
          hLG('div', { style: { display: 'flex', alignItems: 'flex-start', gap: 8, margin: '4px 0 14px', padding: '10px 12px', background: 'var(--surface-2)', border: '1px solid var(--line)', borderRadius: 'var(--r-md)' } },
            hLG(Icons.info, { size: 14, style: { color: 'var(--ink-3)', flex: '0 0 auto', marginTop: 1 } }),
            hLG('span', { style: { fontSize: 11.5, color: 'var(--ink-3)', lineHeight: 1.5 } }, '注册需要激活码（双因素开通）。还没有激活码？联系平台获取，或在 dev 环境使用体验账号。'))),
        hLG(UI.Button, { variant: 'dark', full: true, size: 'lg', disabled: busy, onClick: tab === 'register' ? doRegister : doLogin, style: { marginTop: 6 } },
          busy ? '请稍候…' : tab === 'register' ? '注册并登录' : '登录')),

      tab === 'dev' && hLG('div', null,
        hLG('p', { style: { fontSize: 12.5, color: 'var(--ink-3)', lineHeight: 1.5, margin: '0 0 14px' } }, 'dev 环境体验账号，一键免密登录。'),
        devAccounts.map((a: any) => hLG('button', { key: a.username, disabled: busy, onClick: () => doDevLogin(a.username), className: 'm-tap', style: {
          display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '13px 15px', marginBottom: 10, textAlign: 'left', cursor: 'pointer',
          background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 'var(--r-lg)', boxShadow: 'var(--sh-1)' } },
          hLG('span', { style: { width: 38, height: 38, flex: '0 0 38px', borderRadius: 12, background: 'var(--grad)', color: '#fff', display: 'grid', placeItems: 'center', fontWeight: 800, fontSize: 16 } }, (a.displayName || a.username || '?').slice(0, 1)),
          hLG('div', { style: { flex: 1, minWidth: 0 } },
            hLG('div', { style: { fontSize: 14.5, fontWeight: 700 } }, a.displayName || a.username),
            hLG('div', { className: 'mono', style: { fontSize: 11, color: 'var(--ink-3)', marginTop: 1 } }, a.username + (a.studioName ? ' · ' + a.studioName : ''))),
          hLG(Icons.chevR, { size: 17, stroke: 2, style: { color: 'var(--ink-4)' } })))),

      hLG('div', { style: { textAlign: 'center', marginTop: 22 } },
        hLG('span', { style: { fontSize: 11, color: 'var(--ink-4)', lineHeight: 1.6 } }, '登录即代表同意《用户协议》与《数字人肖像合规规范》'))));
}
