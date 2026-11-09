'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Avatar, Button, Checkbox, Collapse, ConfigProvider, Empty, Flex, Form, Image, Input, Modal, QRCode, Radio, Select, Space, Table, Tag, Typography } from 'antd';
import type { TableColumnsType } from 'antd';
import { ArrowLeft, UserRound } from 'lucide-react';
import type { VideoPortraitItem, VideoPortraitOverview, VideoPortraitPerson } from '@ai-star-eco/types/video-portrait-library';
import { formatDateTime } from '@/lib/datetime';
import { normalizeStudioError, reportStudioError } from './studio-errors';
import * as api from './api/video-portrait-library';

export const PORTRAIT_THEME = { token: { colorPrimary: '#192229', borderRadius: 8, fontFamily: 'var(--ip-ui, sans-serif)' }, components: { Table: { headerBg: 'transparent' }, Modal: { titleFontSize: 18 } } };
export const portraitStatus: Record<string, string> = { needs_review: '待确认', uploading: '提交中', processing: '审核中', active: '可使用', failed: '未通过', revoked: '已撤销', verifying: '待核验', verified: '已核验' };
export const PortraitStatus = ({ status }: { status: string }) => <Tag color={status === 'active' ? 'success' : status === 'failed' ? 'error' : undefined}>{portraitStatus[status] || '待确认'}</Tag>;

/** All portrait controls use Ant Design. CSS is limited to product layout and media dimensions. */
export function PortraitMaterialTable({ items, loading, expanded, onExpand, renderEditor, onRefresh }: {
  items: VideoPortraitItem[]; loading?: boolean; expanded?: string; onExpand: (id?: string) => void;
  renderEditor: (item: VideoPortraitItem) => React.ReactNode; onRefresh: (item: VideoPortraitItem) => void;
}) {
  const columns: TableColumnsType<VideoPortraitItem> = [
    { title: '素材', key: 'material', render: (_, item) => <Flex align="center" gap={12}>
      {item.previewUrl ? <Image src={item.previewUrl} alt={item.label} width={48} height={60} style={{ objectFit: 'cover', borderRadius: 6 }} /> : <Avatar shape="square" size={48} icon={<UserRound size={18} />} />}
      <Flex vertical gap={4} style={{ minWidth: 0 }}><Typography.Text strong ellipsis={{ tooltip: item.label }}>{item.label}</Typography.Text>
        <Typography.Text type={item.errorMessage ? 'danger' : 'secondary'} className="portrait-secondary">{item.errorMessage || (item.placement === 'virtual' ? 'AI 虚拟人像' : item.placement === 'person' ? '真人照片' : '人像类型待确认')}</Typography.Text>
      </Flex></Flex> },
    { title: '状态', key: 'status', width: 98, render: (_, item) => <PortraitStatus status={item.status} /> },
    { title: '更新时间', key: 'updated', width: 175, responsive: ['lg'], render: (_, item) => <Typography.Text type="secondary">{formatDateTime(item.updatedAt)}</Typography.Text> },
    { title: '操作', key: 'action', width: 100, align: 'right', render: (_, item) => ['needs_review', 'failed', 'revoked'].includes(item.status)
      ? <Button size="small" onClick={() => onExpand(expanded === item.id ? undefined : item.id)}>确认人像</Button>
      : item.status === 'processing' ? <Button type="link" size="small" onClick={() => onRefresh(item)}>查询结果</Button> : null },
  ];
  return <Table<VideoPortraitItem> rowKey="id" size="middle" columns={columns} dataSource={items} loading={loading} pagination={false}
    locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无人像素材" /> }}
    expandable={{ expandedRowKeys: expanded ? [expanded] : [], showExpandColumn: false, expandedRowRender: renderEditor }} />;
}

type Declaration = { kind: 'person' | 'virtual'; personId?: string; accepted?: boolean };
export function PortraitDeclaration({ item, overview, busy, onSubmit, onPerson }: {
  item: VideoPortraitItem; overview: VideoPortraitOverview; busy: boolean;
  onSubmit: (values: Declaration) => Promise<void>; onPerson: (libraryId: string) => void;
}) {
  const [form] = Form.useForm<Declaration>();
  const kind = Form.useWatch('kind', form) || 'person', personId = Form.useWatch('personId', form), accepted = Form.useWatch('accepted', form);
  const people = overview.persons.filter(p => p.libraryId === item.libraryId && p.status === 'active');
  const ready = accepted && (kind === 'virtual' || !!personId);
  return <Form form={form} layout="vertical" initialValues={{ kind: 'person', accepted: false }} onFinish={onSubmit} className="portrait-declaration">
    <Form.Item name="kind" label="人像类型"><Radio.Group optionType="button" buttonStyle="solid" options={[{ value: 'person', label: '真人照片' }, { value: 'virtual', label: 'AI 虚拟人像' }]} onChange={() => form.setFieldValue('accepted', false)} /></Form.Item>
    {kind === 'person' && <Form.Item label="核验人物" required><Flex gap={8} wrap align="start"><Form.Item name="personId" noStyle>
      <Select aria-label="已核验人物" placeholder="选择已核验人物" options={people.map(p => ({ value: p.id, label: p.name }))} className="portrait-person-select" disabled={busy} />
    </Form.Item><Button onClick={() => onPerson(item.libraryId)} disabled={busy}>新增核验</Button></Flex><Typography.Text type="secondary" className="portrait-secondary">{people.length ? '照片需与核验本人一致。' : '请由照片中的本人完成核验。'}</Typography.Text></Form.Item>}
    <Collapse ghost size="small" items={[{ key: 'agreement', label: kind === 'person' ? '人像授权说明' : '虚拟人像声明', children: <Typography.Paragraph className="portrait-agreement">{kind === 'person' ? overview.agreement.text : overview.agreement.virtualDeclaration}</Typography.Paragraph> }]} />
    <Form.Item name="accepted" valuePropName="checked"><Checkbox>我已阅读并同意上述说明</Checkbox></Form.Item>
    <Flex gap={12} align="center" wrap><Button type="primary" htmlType="submit" loading={busy} disabled={!ready}>提交审核</Button>
      {!ready && <Typography.Text type="secondary" className="portrait-secondary">{kind === 'person' && !personId ? '请选择核验人物并确认授权。' : '请阅读并确认授权说明。'}</Typography.Text>}
    </Flex>
  </Form>;
}

export function PortraitPersonModal({ libraryId, overview, initialPerson, onClose, onChanged }: {
  libraryId?: string; overview?: VideoPortraitOverview; initialPerson?: VideoPortraitPerson; onClose: () => void; onChanged: () => Promise<void>;
}) {
  const [form] = Form.useForm<{ name: string; accepted: boolean }>();
  const [person, setPerson] = useState<VideoPortraitPerson>(), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const requestId = useRef<string | undefined>(undefined);
  const name = Form.useWatch('name', form), consent = Form.useWatch('accepted', form);
  useEffect(() => { if (libraryId) { form.resetFields(); setPerson(initialPerson); setError(''); requestId.current = undefined; } }, [libraryId, initialPerson, form]);
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
    }, 5000);
    return () => { stopped = true; clearTimeout(timer); };
  }, [libraryId, person, onChanged]);
  return <Modal title="本人核验" open={!!libraryId} onCancel={onClose} maskClosable={false} destroyOnHidden footer={person
    ? <Button onClick={onClose}>{person.status === 'active' ? '返回确认人像' : '关闭'}</Button>
    : <Space><Button onClick={onClose}>取消</Button><Button type="primary" loading={busy} disabled={!consent || !name?.trim()} onClick={() => void apply(async () => {
      requestId.current ||= crypto.randomUUID();
      return api.startPortraitPerson({ libraryId: libraryId!, name: name.trim(), clientRequestId: requestId.current, accepted: consent, agreementVersion: overview!.agreement.version });
    })}>开始核验</Button></Space>}>
    <Flex vertical gap={16}>
      {error && <Alert type="error" title={error} showIcon />}
      {!person ? <Form form={form} layout="vertical" initialValues={{ accepted: false }}>
        <Typography.Paragraph type="secondary">请由照片中的本人完成核验。</Typography.Paragraph>
        <Form.Item name="name" label="人物名称" rules={[{ required: true }]}><Input placeholder="例如：林晚" maxLength={64} /></Form.Item>
        <Collapse ghost size="small" items={[{ key: 'agreement', label: '本人核验及人像授权说明', children: <Typography.Paragraph>{overview?.agreement.text}</Typography.Paragraph> }]} />
        <Form.Item name="accepted" valuePropName="checked"><Checkbox>我已阅读并同意上述说明</Checkbox></Form.Item>
        {(!consent || !name?.trim()) && <Typography.Text type="secondary" className="portrait-secondary">请填写人物名称并确认授权。</Typography.Text>}
      </Form> : person.status === 'active' ? <Alert type="success" title="本人核验已通过" description="可继续提交该人物的照片审核。" showIcon />
        : person.verificationUrl ? <Flex vertical gap={16} align="center">
          <Typography.Text>请本人使用手机扫码核验</Typography.Text><QRCode value={person.verificationUrl} size={208} />
          <Typography.Text type="secondary" className="portrait-secondary">有效期至 {formatDateTime(person.expiresAt)}</Typography.Text>
          <Space wrap><Button href={person.verificationUrl} target="_blank" rel="noreferrer">在本机核验</Button><Button loading={busy} onClick={() => void apply(() => api.refreshPortraitPerson(person.id))}>已完成，查询结果</Button></Space>
        </Flex> : <Alert type="warning" title="核验链接已失效" action={<Button onClick={() => { setPerson(undefined); requestId.current = undefined; }}>重新核验</Button>} />}
    </Flex>
  </Modal>;
}

export function usePortraitOverview(enabled = true) {
  const [overview, setOverview] = useState<VideoPortraitOverview>(), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const lock = useRef(false), alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const reload = useCallback(async () => { const value = await api.portraitOverview(); if (alive.current) { setOverview(value); setError(''); } return value; }, []);
  useEffect(() => { if (enabled) void reload().catch(e => { if (alive.current) setError(normalizeStudioError(e).message); }); }, [enabled, reload]);
  const act = useCallback(async (run: () => Promise<unknown>) => {
    if (lock.current) return false; lock.current = true; setBusy(true); setError('');
    try { await run(); await reload(); return true; }
    catch (e) { if (alive.current) setError(normalizeStudioError(e).message); reportStudioError(e); return false; }
    finally { lock.current = false; if (alive.current) setBusy(false); }
  }, [reload]);
  useEffect(() => {
    if (!enabled || !overview?.items.some(i => i.status === 'processing')) return;
    let stopped = false;
    const timer = setTimeout(async () => {
      try { for (const item of overview.items.filter(i => i.status === 'processing')) { if (stopped) return; await api.refreshPortrait(item.id); } if (!stopped) await reload(); }
      catch (e) { if (!stopped) setError(normalizeStudioError(e).message); }
    }, 10000);
    return () => { stopped = true; clearTimeout(timer); };
  }, [enabled, overview, reload]);
  return { overview, error, busy, reload, act };
}
