'use client';

import { useCallback, useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Alert, Avatar, Button, Checkbox, Empty, Flex, Form, Image, Input, Modal, QRCode, Radio, Spin, Steps, Table, Tag, Typography } from 'antd';
import type { TableColumnsType } from 'antd';
import { CircleCheck, UserRound } from 'lucide-react';
import type { VideoPortraitItem, VideoPortraitOverview, VideoPortraitPerson } from '@ai-star-eco/types/video-portrait-library';
import { formatDateTime } from '@/lib/datetime';
import { useLayoutMode } from '@/shell/layout-mode';
import { ImageLightbox } from './image-lightbox';
import { normalizeStudioError, reportStudioError } from './studio-errors';
import * as api from './api/video-portrait-library';

export const PORTRAIT_THEME = { token: { colorPrimary: '#192229', borderRadius: 8, fontFamily: 'var(--ip-ui, sans-serif)' }, components: { Table: { headerBg: 'transparent' }, Modal: { titleFontSize: 18 } } };
export const portraitStatus: Record<string, string> = { needs_review: '待确认', queued: '排队中', uploading: '提交中', processing: '审核中', active: '可使用', failed: '处理失败', revoked: '已撤销', verifying: '待核验', verified: '已核验' };
export const portraitItemStatus = (item: VideoPortraitItem) => item.submissionUnknown ? '提交待确认' : portraitStatus[item.status] || '待确认';
export const PortraitStatus = ({ status }: { status: string }) => <Tag color={status === 'active' ? 'success' : status === 'failed' ? 'error' : undefined}>{portraitStatus[status] || '待确认'}</Tag>;
/** A portrait the user still has to declare; everything else is waiting on, or already passed, the official review. */
export const portraitNeedsAction = (item: VideoPortraitItem) =>
  !item.submissionUnknown && ['needs_review', 'failed', 'revoked'].includes(item.status);
const portraitPending = (item: VideoPortraitItem) => ['queued', 'uploading', 'processing'].includes(item.status);

type Act = (run: () => Promise<unknown>) => Promise<boolean>;

export function PortraitMaterialTable({ items, loading, onConfirm, onRefresh }: {
  items: VideoPortraitItem[]; loading?: boolean; onConfirm: (item: VideoPortraitItem) => void; onRefresh: (item: VideoPortraitItem) => void;
}) {
  const [preview, setPreview] = useState<{ src: string; alt: string }>();
  const columns: TableColumnsType<VideoPortraitItem> = [
    { title: '素材', key: 'material', render: (_, item) => {
      const { previewUrl, label } = item;
      return <Flex align="center" gap={12}>
        {previewUrl ? <button type="button" className="portrait-table-thumb" aria-label={`放大查看${label}`} title="点击放大"
          onClick={() => setPreview({ src: previewUrl, alt: label })}>
          <img src={previewUrl} alt={label} />
        </button> : <Avatar shape="square" size={48} icon={<UserRound size={18} />} />}
        <Flex vertical gap={4} style={{ minWidth: 0 }}><Typography.Text strong ellipsis={{ tooltip: label }}>{label}</Typography.Text>
        <Typography.Text type={item.arkError || item.errorMessage ? 'danger' : 'secondary'} className="portrait-secondary">{item.arkError || item.errorMessage || (item.placement === 'virtual' ? 'AI 虚拟人像' : item.placement === 'person' ? '真人照片' : '人像类型待确认')}</Typography.Text>
        </Flex>
      </Flex>;
    } },
    { title: '状态', key: 'status', width: 98, render: (_, item) => item.submissionUnknown
      ? <Tag color="warning">{portraitItemStatus(item)}</Tag> : <PortraitStatus status={item.status} /> },
    { title: '更新时间', key: 'updated', width: 175, responsive: ['lg'], render: (_, item) => <Typography.Text type="secondary">{formatDateTime(item.updatedAt)}</Typography.Text> },
    { title: '操作', key: 'action', width: 100, align: 'right', render: (_, item) => portraitNeedsAction(item)
      ? <Button size="small" onClick={() => onConfirm(item)}>确认人像</Button>
      : item.status === 'processing' ? <Button type="link" size="small" onClick={() => onRefresh(item)}>查询结果</Button> : null },
  ];
  return <>
    <Table<VideoPortraitItem> rowKey="id" size="middle" columns={columns} dataSource={items} loading={loading} pagination={false}
      locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无人像素材" /> }} />
    {preview && <ImageLightbox src={preview.src} alt={preview.alt} open onClose={() => setPreview(undefined)} />}
  </>;
}

/** Where a dialog lets the current step put its controls: the left end (hint or 上一步) and the main button. */
export type PortraitFooterSlots = { start: HTMLElement | null; action: HTMLElement | null };
export const PORTRAIT_NO_FOOTER: PortraitFooterSlots = { start: null, action: null };
export function usePortraitFooter() {
  const [start, startRef] = useState<HTMLElement | null>(null), [action, actionRef] = useState<HTMLElement | null>(null);
  return { slots: useMemo(() => ({ start, action }), [start, action]), startRef, actionRef };
}
/** One button row per dialog: the step's hint on the left, dialog buttons then the step's main button on the right. */
export function PortraitFooterBar({ footer, note, children, after }: { footer: ReturnType<typeof usePortraitFooter>; note?: ReactNode; children?: ReactNode; after?: ReactNode }) {
  return <Flex align="center" justify="space-between" gap={12} wrap className="portrait-footer">
    <Flex align="center" gap={8} className="portrait-footer-start"><span ref={footer.startRef} className="portrait-slot" />{note}</Flex>
    <Flex align="center" justify="flex-end" gap={8} wrap className="portrait-footer-end">{children}<span ref={footer.actionRef} className="portrait-slot" />{after}</Flex>
  </Flex>;
}
const hintText = (text: string) => <Typography.Text type="secondary" className="portrait-secondary">{text}</Typography.Text>;

export const portraitVerificationLive = (person: VideoPortraitPerson) => person.status === 'verifying' && !!person.verificationUrl;

/** QR step shared by the guided declaration and the standalone verification. Its buttons live in the dialog footer. */
export function PortraitVerifyPanel({ person, note }: { person: VideoPortraitPerson; note: string }) {
  // On a phone the person is often holding this very device and cannot scan its own screen: open the link first, QR second.
  const phone = useLayoutMode() === 'mobile';
  if (!portraitVerificationLive(person)) return <Flex vertical align="center" gap={8} className="portrait-state">
    {person.arkError ? <Alert type="error" showIcon title={person.arkError} className="portrait-provider-error" />
      : <Typography.Text strong>核验未完成，链接已失效</Typography.Text>}
    <Typography.Text type="secondary">请{person.name}本人重新核验。</Typography.Text>
  </Flex>;
  return <Flex vertical align="center" gap={12} className="portrait-verify">
    {person.arkError && <Alert type="error" showIcon title={person.arkError} className="portrait-provider-error" />}
    <Typography.Text strong>{phone ? `请${person.name}本人完成核验` : `请${person.name}本人用手机扫码核验`}</Typography.Text>
    {phone && <Button type="primary" block href={person.verificationUrl} target="_blank" rel="noreferrer">在本机核验</Button>}
    <QRCode type="svg" value={person.verificationUrl!} size={phone ? 128 : 168} bordered={false} className="portrait-qr" />
    {phone && hintText('本人不在身边时，请其用手机扫码。')}
    <Flex align="center" gap={8}><Spin size="small" /><Typography.Text type="secondary">{note}</Typography.Text></Flex>
    <Flex align="center" gap={4} wrap justify="center">{hintText(`链接有效至 ${formatDateTime(person.expiresAt)}`)}
      {!phone && <Button type="link" size="small" href={person.verificationUrl} target="_blank" rel="noreferrer">在本机核验</Button>}</Flex>
  </Flex>;
}

const NEW = 'new';
const NO_BATCH_ITEMS: VideoPortraitItem[] = [];
type Kind = 'person' | 'virtual';
const PORTRAIT_KINDS = [
  { value: 'person', title: '真人照片', example: '本人、朋友或演员的照片，含美颜、修图或保留真人长相的 AI 改图。', next: '首次使用该人物需本人核验。每张照片单独审核。' },
  { value: 'virtual', title: 'AI 虚拟人像', example: '由 AI 生成的虚构人物，例如虚拟主播或角色图。形象不能与真实人物雷同。', next: '无需本人核验，提交后由火山方舟审核。' },
] as const;

/** People this photo can be declared as: verified ones, plus a verification still waiting for its scan. One entry per name. */
function portraitPeople(overview: VideoPortraitOverview, item: VideoPortraitItem) {
  const rank = (p: VideoPortraitPerson) => (p.id === item.personId ? 4 : 0) + (p.status === 'active' ? 2 : 0);
  const usable = overview.persons.filter(p => p.libraryId === item.libraryId && (p.status === 'active' || portraitVerificationLive(p)));
  const byName = new Map<string, VideoPortraitPerson>();
  for (const p of usable) { const kept = byName.get(p.name); if (!kept || rank(p) > rank(kept)) byName.set(p.name, p); } // Newest first already.
  return [...byName.values()];
}

/**
 * One portrait, one guided path: choose the type → (new person) scan to verify → official review.
 * Consent is given once; it covers the person verification and the photo declaration (same agreement version).
 * A person verified here is the one in the photo, so the photo is submitted as soon as verification passes.
 * With `footer`, the step's hint and main button go to the dialog's button row; without it they sit under the content.
 */
export function PortraitGuide({ item, overview, busy, act, footer, batchItems = NO_BATCH_ITEMS }: {
  item: VideoPortraitItem; overview: VideoPortraitOverview; busy: boolean; act: Act;
  footer?: PortraitFooterSlots; batchItems?: VideoPortraitItem[];
}) {
  const people = portraitPeople(overview, item);
  const typeId = useId();
  const [kind, setKind] = useState<Kind | undefined>(item.placement === 'person' || item.placement === 'virtual' ? item.placement : undefined);
  // The person on file for this photo, or the only verified one, so a repeat photo is one tick and one click.
  const [choice, setChoice] = useState<string | undefined>(() => people.find(p => p.id === item.personId)?.id
    ?? (people.filter(p => p.status === 'active').length === 1 ? people.find(p => p.status === 'active')!.id : undefined));
  const [name, setName] = useState(''), [accepted, setAccepted] = useState(false);
  const [additionalIds, setAdditionalIds] = useState<string[]>([]);
  const [verification, setVerification] = useState<VideoPortraitPerson>(), [verified, setVerified] = useState<VideoPortraitPerson>();
  const [preview, setPreview] = useState<{ src: string; alt: string }>();
  const closePreview = useCallback(() => setPreview(undefined), []);
  const requestId = useRef<string | undefined>(undefined);
  // The person just verified may reach this list one reload after the photo is submitted.
  const options = verified && !people.some(p => p.id === verified.id) ? [...people, verified] : people;
  const chosen = options.length ? choice : NEW;
  const pick = options.find(p => p.id === chosen);
  const phase = item.status === 'active' ? 'done' : item.submissionUnknown ? 'unknown'
    : portraitPending(item) ? 'review' : verification ? 'verify' : 'choose';
  const shownKind = phase === 'review' || phase === 'done' ? item.placement || kind : kind;
  const batchOptions = useMemo(() => batchItems.filter(other => other.id !== item.id && other.libraryId === item.libraryId
    && other.mediaType === 'image' && portraitNeedsAction(other)), [batchItems, item.id, item.libraryId]);
  const selectedIds = useMemo(() => [item.id, ...additionalIds.filter(id => batchOptions.some(other => other.id === id))],
    [item.id, additionalIds, batchOptions]);

  const declare = useCallback((personId?: string) => {
    const declaration = { kind: personId ? 'person' as const : 'virtual' as const, personId, accepted: true, agreementVersion: overview.agreement.version };
    return selectedIds.length > 1 ? api.declarePortraits(selectedIds, declaration) : api.declarePortrait(item.id, declaration);
  }, [item.id, overview.agreement.version, selectedIds]);
  const afterVerification = useCallback(async (person: VideoPortraitPerson) => {
    if (person.status !== 'active') { setVerification(person); return; }
    setVerification(undefined); setVerified(person); setChoice(person.id); setKind('person');
    await declare(person.id);
  }, [declare]);
  const start = (personName: string) => act(async () => {
    requestId.current ||= crypto.randomUUID();
    await afterVerification(await api.startPortraitPerson({ libraryId: item.libraryId, name: personName, clientRequestId: requestId.current, accepted: true, agreementVersion: overview.agreement.version }));
  });
  const check = (id: string) => act(async () => afterVerification(await api.refreshPortraitPerson(id)));

  // The provider callback updates the server; this only reads it back while the QR code is on screen.
  useEffect(() => {
    if (verification?.status !== 'verifying') return;
    let stopped = false;
    const timer = setTimeout(async () => {
      try {
        const latest = (await api.portraitOverview()).persons.find(p => p.id === verification.id);
        if (stopped || !latest) return;
        if (latest.status === 'verifying') { setVerification({ ...latest }); return; }
        let ran = false;
        await act(async () => { ran = true; await afterVerification(latest); });
        if (!ran && !stopped) setVerification(current => current && { ...current }); // Another action held the lock; look again.
      } catch { if (!stopped) setVerification(current => current && { ...current }); }
    }, 4000);
    return () => { stopped = true; clearTimeout(timer); };
  }, [verification, act, afterVerification]);

  const blocker = !kind ? '请选择照片类型。' : kind === 'person' && !chosen ? '请选择照片中的人物。'
    : kind === 'person' && chosen === NEW && !name.trim() ? '请填写人物名称。' : !accepted ? '请阅读并同意授权说明。' : '';
  const submit = () => {
    if (blocker || busy) return;
    if (kind === 'virtual') void act(() => declare());
    else if (chosen === NEW) void start(name.trim());
    else if (pick?.status === 'active') void act(() => declare(pick.id));
    else if (pick) void check(pick.id); // Verification already started: pick it up instead of starting over.
  };
  const submitLabel = selectedIds.length > 1 ? `提交审核（${selectedIds.length} 张）` : '提交审核';
  const label = kind === 'virtual' ? submitLabel : chosen === NEW ? '开始本人核验' : pick && pick.status !== 'active' ? '继续核验' : submitLabel;
  const steps = shownKind === 'virtual' ? ['选择类型', '照片审核'] : ['选择类型', '本人核验', '照片审核'];
  const current = phase === 'choose' ? 0 : phase === 'verify' ? 1 : steps.length - 1;
  const personName = overview.persons.find(p => p.id === item.personId)?.name;
  const back = <Button disabled={busy} onClick={() => { setVerification(undefined); requestId.current = undefined; }}>上一步</Button>;
  const [lead, action] = phase === 'choose' ? [blocker && hintText(blocker), <Button key="go" type="primary" loading={busy} disabled={!!blocker} onClick={submit}>{label}</Button>]
    : phase === 'verify' && verification ? [back, portraitVerificationLive(verification)
      ? <Button key="check" loading={busy} onClick={() => void check(verification.id)}>查询核验结果</Button>
      : <Button key="again" type="primary" loading={busy} onClick={() => { requestId.current = undefined; void start(verification.name); }}>重新核验</Button>]
    : phase === 'review' && item.status === 'processing' ? [undefined, <Button key="query" disabled={busy} onClick={() => void act(() => api.refreshPortrait(item.id))}>查询结果</Button>]
    : [undefined, undefined];
  const controls = footer
    ? <>{lead && footer.start && createPortal(lead, footer.start)}{action && footer.action && createPortal(action, footer.action)}</>
    : (lead || action) && <Flex align="center" justify="space-between" gap={12} wrap className="portrait-actions">{lead || <span />}{action}</Flex>;
  const { previewUrl } = item;

  return <div className="portrait-guide">
    <figure className="portrait-guide-photo">
      {previewUrl ? <button type="button" className="portrait-guide-image" aria-label={`放大查看${item.label}`} title="点击放大"
        onClick={() => setPreview({ src: previewUrl, alt: item.label })}>
        <img src={previewUrl} alt={item.label} />
      </button> : <div className="portrait-guide-placeholder"><UserRound size={28} /></div>}
      <figcaption><Typography.Text type="secondary" ellipsis={{ tooltip: item.label }}>{item.label}</Typography.Text></figcaption>
    </figure>
    {preview && <ImageLightbox src={preview.src} alt={preview.alt} open onClose={closePreview} />}
    <Flex vertical gap={24} className="portrait-guide-body">
      <Steps size="small" responsive={false} current={current} status={phase === 'done' ? 'finish' : phase === 'verify' && verification && !portraitVerificationLive(verification) ? 'error' : 'process'} items={steps.map(title => ({ title }))} />
      {phase === 'choose' && <Form layout="vertical" requiredMark={false} onFinish={submit} className="portrait-guide-form">
        {(item.arkError || item.status === 'failed') && <Alert type={item.status === 'failed' ? 'error' : 'warning'} showIcon title={item.arkError || item.errorMessage || '素材入库失败。'} className="portrait-provider-error" />}
        {item.status === 'revoked' && <Alert type="warning" showIcon title="这张照片的人物授权已撤销，请重新确认。" />}
        <Form.Item label={<span id={`${typeId}-label`}>照片类型</span>} extra={<span id={`${typeId}-hint`}>不确定照片来源？请向素材提供者确认，或更换来源明确的图片。</span>}>
          <Radio.Group name={typeId} aria-labelledby={`${typeId}-label`} aria-describedby={`${typeId}-hint`}
            className="portrait-type-options" value={kind} disabled={busy}
            onChange={e => { setKind(e.target.value); setAccepted(false); setAdditionalIds([]); }}>
            {PORTRAIT_KINDS.map(({ value, title, example, next }) => <Radio key={value} value={value}
              className="portrait-type-option" aria-labelledby={`${typeId}-${value}-title`} aria-describedby={`${typeId}-${value}-description`}>
              <span id={`${typeId}-${value}-title`} className="portrait-type-title">{title}</span>
              <span id={`${typeId}-${value}-description`} className="portrait-type-description">
                <span>{example}</span>
                <span>{next}</span>
              </span>
            </Radio>)}
          </Radio.Group>
        </Form.Item>
        {kind === 'person' && options.length > 0 && <Form.Item label="照片中的人物">
          <Radio.Group vertical value={chosen} disabled={busy} onChange={e => { setChoice(e.target.value); setAccepted(false); setAdditionalIds([]); }}
            options={[...options.map(p => ({ value: p.id, label: p.status === 'active' ? p.name : `${p.name}（核验中）` })), { value: NEW, label: '其他人物' }]} />
        </Form.Item>}
        {kind === 'person' && chosen === NEW && <Form.Item label="人物名称" extra="请将核验二维码或链接交给照片中的本人。">
          <Input value={name} onChange={e => setName(e.target.value)} placeholder="例如：林晚" maxLength={64} disabled={busy} autoFocus={!options.length} />
        </Form.Item>}
        {kind && item.mediaType === 'image' && batchOptions.length > 0 && <Form.Item
          label={kind === 'virtual' ? '同时提交其他虚拟人像' : '同时提交同一人的其他照片'}>
          <Checkbox.Group<string> value={additionalIds} disabled={busy} onChange={ids => { setAdditionalIds(ids); setAccepted(false); }}>
            <Flex wrap gap={12}>
              {batchOptions.map(other => <Checkbox key={other.id} value={other.id} disabled={additionalIds.length >= 11 && !additionalIds.includes(other.id)}>
                <Flex vertical gap={4}>
                  {other.previewUrl && <Image preview={false} src={other.previewUrl} alt="" width={40} height={44} style={{ objectFit: 'cover', borderRadius: 4 }} />}
                  <Typography.Text ellipsis={{ tooltip: other.label }} className="portrait-batch-label">{other.label}</Typography.Text>
                </Flex>
              </Checkbox>)}
            </Flex>
          </Checkbox.Group>
        </Form.Item>}
        {kind && <PortraitConsent key={kind} checked={accepted} disabled={busy} onChange={setAccepted}
          title={kind === 'person' ? '人像授权说明' : '虚拟人像声明'} text={kind === 'person' ? overview.agreement.text : overview.agreement.virtualDeclaration} />}
      </Form>}
      {phase === 'verify' && verification && <PortraitVerifyPanel person={verification} note="核验通过后将自动提交照片审核" />}
      {phase === 'review' && <Flex vertical align="center" gap={10} className="portrait-state">
        <Spin />
        <Typography.Text strong>{item.status === 'queued' ? '照片排队中' : item.status === 'uploading' ? '照片提交中' : '照片审核中'}</Typography.Text>
        <Typography.Text type="secondary">{item.status === 'queued' ? '排到后将自动送审。' : '结果会自动更新。'}</Typography.Text>
        {item.arkError && <Alert type="warning" showIcon title={item.arkError} className="portrait-provider-error" />}
      </Flex>}
      {phase === 'unknown' && <Alert type="warning" showIcon title={item.arkError || item.errorMessage || '素材提交结果待确认，请联系技术支持。'} className="portrait-provider-error" />}
      {phase === 'done' && <Flex vertical align="center" gap={8} className="portrait-state">
        <CircleCheck size={36} className="portrait-done-icon" aria-hidden />
        <Typography.Text strong>审核已通过</Typography.Text>
        <Typography.Text type="secondary">{item.placement === 'virtual' ? 'AI 虚拟人像' : personName ? `真人照片 · ${personName}` : '真人照片'}</Typography.Text>
      </Flex>}
      {controls}
    </Flex>
  </div>;
}

/** 「我已阅读并同意《…》」: the title opens the text in place; clicking it never ticks the box. */
function PortraitConsent({ checked, disabled, onChange, title, text }: { checked: boolean; disabled?: boolean; onChange: (checked: boolean) => void; title: string; text?: string }) {
  const [open, setOpen] = useState(false);
  return <Form.Item className="portrait-consent">
    <Checkbox checked={checked} disabled={disabled} onChange={e => onChange(e.target.checked)}>我已阅读并同意<Button type="link" className="portrait-terms-link" aria-expanded={open}
      onClick={e => { e.preventDefault(); setOpen(value => !value); }}>《{title}》</Button></Checkbox>
    {open && <Typography.Paragraph className="portrait-terms">{text}</Typography.Paragraph>}
  </Form.Item>;
}

/** Standalone verification from the portrait page's「本人核验」tab. */
export function PortraitPersonModal({ libraryId, overview, initialPerson, onClose, onChanged }: {
  libraryId?: string; overview?: VideoPortraitOverview; initialPerson?: VideoPortraitPerson; onClose: () => void; onChanged: () => Promise<void>;
}) {
  const [person, setPerson] = useState<VideoPortraitPerson>(), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [name, setName] = useState(''), [accepted, setAccepted] = useState(false);
  const requestId = useRef<string | undefined>(undefined);
  useEffect(() => { if (libraryId) { setName(''); setAccepted(false); setPerson(initialPerson); setError(''); requestId.current = undefined; } }, [libraryId, initialPerson]);
  const apply = async (run: () => Promise<VideoPortraitPerson>) => {
    if (busy) return; setBusy(true); setError('');
    try { setPerson(await run()); await onChanged(); } catch (e) { const failure = normalizeStudioError(e); setError(failure.message); reportStudioError(e); } finally { setBusy(false); }
  };
  // The callback verifies with Ark on the server; reading this list never treats a URL parameter as proof.
  useEffect(() => {
    if (!libraryId || person?.status !== 'verifying') return;
    let stopped = false;
    const timer = setTimeout(async () => {
      try { const latest = await api.portraitOverview(); const updated = latest.persons.find(p => p.id === person.id); if (!stopped && updated) { setPerson(updated); if (updated.status !== 'verifying') await onChanged(); } }
      catch { /* Keep the current session; explicit query remains available. */ }
    }, 4000);
    return () => { stopped = true; clearTimeout(timer); };
  }, [libraryId, person, onChanged]);
  const blocker = !name.trim() ? '请填写人物名称。' : !accepted ? '请阅读并同意授权说明。' : '';
  const begin = () => {
    if (blocker) return;
    void apply(async () => {
      requestId.current ||= crypto.randomUUID();
      return api.startPortraitPerson({ libraryId: libraryId!, name: name.trim(), clientRequestId: requestId.current, accepted, agreementVersion: overview!.agreement.version });
    });
  };
  const footer = !person ? <Flex align="center" justify="space-between" gap={12} wrap className="portrait-footer">
      <span>{blocker && hintText(blocker)}</span>
      <Flex gap={8}><Button onClick={onClose}>取消</Button><Button type="primary" loading={busy} disabled={!!blocker} onClick={begin}>开始核验</Button></Flex>
    </Flex>
    : person.status === 'active' ? <Button type="primary" onClick={onClose}>完成</Button>
    : <Flex gap={8} justify="flex-end"><Button onClick={onClose}>关闭</Button>{portraitVerificationLive(person)
      ? <Button loading={busy} onClick={() => void apply(() => api.refreshPortraitPerson(person.id))}>查询核验结果</Button>
      : <Button type="primary" onClick={() => { setName(person.name); setPerson(undefined); requestId.current = undefined; }}>重新核验</Button>}</Flex>;
  return <Modal title="本人核验" open={!!libraryId} onCancel={onClose} mask={{ closable: false }} destroyOnHidden footer={footer}>
    <Flex vertical gap={16}>
      {error && <Alert type="error" title={error} showIcon />}
      {!person ? <Form layout="vertical" requiredMark={false} onFinish={begin} className="portrait-guide-form">
        <Form.Item label="人物名称" extra="需要照片中的本人用手机扫码核验。"><Input value={name} onChange={e => setName(e.target.value)} placeholder="例如：林晚" maxLength={64} autoFocus /></Form.Item>
        <PortraitConsent checked={accepted} onChange={setAccepted} title="人像授权说明" text={overview?.agreement.text} />
      </Form> : person.status === 'active' ? <Flex vertical align="center" gap={8} className="portrait-state">
        <CircleCheck size={36} className="portrait-done-icon" aria-hidden />
        <Typography.Text strong>本人核验已通过</Typography.Text>
        <Typography.Text type="secondary">确认{person.name}的照片时可直接选择。</Typography.Text>
      </Flex> : <PortraitVerifyPanel person={person} note="核验完成后自动更新" />}
    </Flex>
  </Modal>;
}

export function usePortraitOverview(enabled = true, pollItems = true) {
  const [overview, setOverview] = useState<VideoPortraitOverview>(), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const lock = useRef(false), alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const reload = useCallback(async () => { const value = await api.portraitOverview(); if (alive.current) { setOverview(value); setError(''); } return value; }, []);
  useEffect(() => { if (enabled) void reload().catch(e => { if (alive.current) setError(normalizeStudioError(e).message); }); }, [enabled, reload]);
  const act = useCallback(async (run: () => Promise<unknown>) => {
    if (lock.current) return false; lock.current = true; setBusy(true); setError('');
    try { await run(); await reload(); return true; }
    catch (e) {
      if (alive.current) setError(normalizeStudioError(e).message); reportStudioError(e);
      // A failed submission can still change the record (e.g. to failed); show it without clearing the error.
      void api.portraitOverview().then(value => { if (alive.current) setOverview(value); }).catch(() => undefined);
      return false;
    }
    finally { lock.current = false; if (alive.current) setBusy(false); }
  }, [reload]);
  const pending = overview?.items.some(portraitPending);
  useEffect(() => {
    if (!enabled || !pollItems || !pending) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try { await reload(); }
      catch (e) { if (!stopped) setError(normalizeStudioError(e).message); }
      finally { if (!stopped) timer = setTimeout(poll, 5000); }
    };
    timer = setTimeout(poll, 5000);
    return () => { stopped = true; clearTimeout(timer); };
  }, [enabled, pollItems, pending, reload]);
  return { overview, error, busy, reload, act };
}
