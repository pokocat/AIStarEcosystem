'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Button, ConfigProvider, Flex, Modal, Select, Space, Table, Tabs, Typography } from 'antd';
import type { TableColumnsType } from 'antd';
import { Plus } from 'lucide-react';
import type { VideoPortraitPerson } from '@ai-star-eco/types/video-portrait-library';
import { StudioPage } from './studio-page';
import { useRequireAuth, PlatformGateScreen } from '@/components/hub/auth';
import { formatDateTime } from '@/lib/datetime';
import { uploadLibraryMedia } from '@/canvas-bridge/asset-library';
import { uploadAssetBatch } from './asset-upload-batch';
import { PortraitFooterBar, PortraitGuide, PortraitMaterialTable, PortraitPersonModal, PortraitStatus, portraitNeedsAction, PORTRAIT_THEME, usePortraitFooter, usePortraitOverview } from './portrait-review-ui';
import * as api from './api/video-portrait-library';
import './video-portrait-library.css';

export function VideoPortraitLibrary() {
  const auth = useRequireAuth();
  const { overview, error, busy, reload, act } = usePortraitOverview(auth === 'ok');
  const [library, setLibrary] = useState<string>(), [confirming, setConfirming] = useState<string>(), [personLibrary, setPersonLibrary] = useState<string>(), [tab, setTab] = useState('materials');
  const [verification, setVerification] = useState<VideoPortraitPerson>();
  const [modal, modalHolder] = Modal.useModal();
  const footer = usePortraitFooter();
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => { if (overview) setLibrary(current => current || overview.libraries[0]?.id); }, [overview]);
  const changed = useCallback(async () => { await reload(); }, [reload]);
  const uploadPortraits = (files: File[], libraryId: string) => void act(async () => {
    const { uploaded, error } = await uploadAssetBatch(files, async file => {
      const result = await uploadLibraryMedia(file, 'image');
      return api.registerPortrait({ libraryId, key: result.key, mediaType: 'image', label: file.name });
    });
    if (uploaded.length) setConfirming(uploaded[0].id);
    if (error) throw error;
  });
  if (auth === 'no-platform') return <PlatformGateScreen />;
  const peopleColumns: TableColumnsType<VideoPortraitPerson> = [
    { title: '人物', key: 'name', render: (_, person) => <Flex vertical gap={4}>
      <Typography.Text strong>{person.name}</Typography.Text>
      {person.arkError && <Typography.Text type="danger" className="portrait-secondary">{person.arkError}</Typography.Text>}
    </Flex> },
    { title: '状态', key: 'status', width: 100, render: (_, person) => <PortraitStatus status={person.status === 'active' ? 'verified' : person.status} /> },
    { title: '核验时间', key: 'created', width: 175, responsive: ['lg'], render: (_, person) => <Typography.Text type="secondary">{formatDateTime(person.createdAt)}</Typography.Text> },
    { title: '操作', key: 'actions', align: 'right', width: 160, render: (_, person) => <Space wrap size={4}>
      {person.status === 'verifying' && <Button type="link" size="small" disabled={busy} onClick={() => { setVerification(person); setPersonLibrary(person.libraryId); }}>继续核验</Button>}
      <Button type="text" size="small" disabled={busy} onClick={() => modal.confirm({ title: `撤销${person.name}的人像授权？`, content: '该人物的人像将停止用于新视频，并从官方素材库删除。', okText: '撤销授权', cancelText: '取消', okButtonProps: { danger: true }, onOk: () => act(() => api.revokePortraitPerson(person.id)) })}>{person.status === 'revoked' ? '重试清理' : '撤销授权'}</Button>
    </Space> },
  ];
  const confirmItem = overview?.items.find(item => item.id === confirming);
  const ordered = [...(overview?.items || [])].sort((a, b) => Number(portraitNeedsAction(b)) - Number(portraitNeedsAction(a)));
  return <ConfigProvider theme={PORTRAIT_THEME} button={{ autoInsertSpace: false }}><StudioPage title="人像核验" description="用于 Seedance Fast / Mini 视频创作" className="portrait-library-page" actions={<Button type="text" href="/assets">返回资产</Button>}>
    {error && <Alert type="error" title={error} showIcon action={<Button size="small" onClick={() => void act(changed)}>重试</Button>} />}
    {overview?.libraries.length === 0 && <Alert type="info" title="人像核验暂未开放" />}
    <Tabs activeKey={tab} onChange={setTab} items={[{ key: 'materials', label: '人像素材', children: <Flex vertical gap={16}>
      <Flex justify="space-between" gap={12} wrap align="center"><Typography.Text type="secondary">审核通过的人像可直接用于创作。</Typography.Text><Space wrap>
        {(overview?.libraries.length || 0) > 1 && <Select aria-label="人像素材库" value={library} onChange={setLibrary} options={overview?.libraries.map(l => ({ value: l.id, label: l.name }))} />}
        <input ref={input} type="file" hidden multiple disabled={!library || busy} accept="image/jpeg,image/png,image/webp" aria-label="选择人像照片"
          onChange={e => { const files = Array.from(e.target.files ?? []); e.target.value = ''; if (files.length && library) uploadPortraits(files, library); }}/>
        <Button type="primary" icon={<Plus size={15} />} disabled={!library || busy} onClick={() => input.current?.click()}>添加人像</Button>
      </Space></Flex>
      <PortraitMaterialTable items={ordered} loading={!overview} onConfirm={item => setConfirming(item.id)} onRefresh={item => void act(() => api.refreshPortrait(item.id))} />
    </Flex> }, { key: 'people', label: '本人核验', children: <Flex vertical gap={16}>
      <Flex justify="space-between" align="center" gap={12}><Typography.Text type="secondary">由照片中的本人完成核验。</Typography.Text><Button type="primary" disabled={!library || busy} onClick={() => { setVerification(undefined); setPersonLibrary(library); }}>新增核验</Button></Flex>
      <Table<VideoPortraitPerson> rowKey="id" columns={peopleColumns} dataSource={overview?.persons} loading={!overview} pagination={false} locale={{ emptyText: '暂无本人核验记录' }} />
    </Flex> }]} />
    <Modal title="确认参考人像" open={!!confirmItem} width={720} mask={{ closable: false }} destroyOnHidden onCancel={() => setConfirming(undefined)}
      footer={<PortraitFooterBar footer={footer} after={confirmItem?.status === 'active' && <Button type="primary" onClick={() => setConfirming(undefined)}>完成</Button>}>
        {confirmItem?.status !== 'active' && <Button onClick={() => setConfirming(undefined)}>关闭</Button>}
      </PortraitFooterBar>}>
      {confirmItem && overview && <PortraitGuide key={confirmItem.id} item={confirmItem} overview={overview} busy={busy} act={act} batchItems={overview.items} footer={footer.slots} />}
    </Modal>
    <PortraitPersonModal libraryId={personLibrary} overview={overview} initialPerson={verification} onClose={() => { setPersonLibrary(undefined); setVerification(undefined); }} onChanged={changed} />{modalHolder}
  </StudioPage></ConfigProvider>;
}
