import { useCallback, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { App, Button, ConfigProvider, Flex, Layout, Menu, Space, Table, Tabs, Typography } from 'antd';
import { PortraitDeclaration, PortraitMaterialTable, PortraitPersonModal, PortraitStatus, PORTRAIT_THEME, usePortraitOverview } from '../../apps/web-aiavatar/src/ip/portrait-review-ui';
import { PortraitReviewHost } from '../../apps/web-aiavatar/src/ip/portrait-review-host';
import { requestPortraitReview } from '../../apps/web-aiavatar/src/ip/portrait-review-events';
import { declarePortrait, refreshPortrait, revokePortraitPerson } from './api';

function Preview() {
  const { overview, busy, reload, act } = usePortraitOverview();
  const [expanded, setExpanded] = useState<string>(), [personLibrary, setPersonLibrary] = useState<string>(), [demo, setDemo] = useState('');
  const changed = useCallback(async () => { await reload(); }, [reload]);
  return <ConfigProvider theme={PORTRAIT_THEME} button={{ autoInsertSpace: false }}><App>
    <Flex align="center" justify="space-between" wrap gap={8} style={{ marginBottom: 12 }}><Typography.Text type="secondary">设计预览 · 示例数据 · 核验操作仅作演示</Typography.Text><Button onClick={async () => { const ready = await requestPortraitReview([], [overview!.items[0]]); await reload(); setDemo(ready ? '人像已就绪，原生成操作可继续。' : '当前内容已保留。'); }}>体验生成前核验</Button></Flex>
    <Layout style={{ background: '#f0efec', borderRadius: 12, overflow: 'hidden' }}>
      <Layout.Header style={{ background: '#fff', padding: '0 24px', height: 64, display: 'flex', alignItems: 'center', gap: 32 }}><Typography.Text strong style={{ whiteSpace: 'nowrap' }}>IP Studio</Typography.Text><Menu mode="horizontal" selectedKeys={['assets']} items={[{ key: 'home', label: '首页' }, { key: 'create', label: '创作' }, { key: 'assets', label: '资产' }, { key: 'projects', label: '项目' }]} style={{ flex: 1, minWidth: 0, border: 0 }} /></Layout.Header>
      <Layout.Content style={{ margin: 16, padding: 28, background: '#fff', borderRadius: 12 }}>
        <Flex vertical gap={24}>
          <Flex vertical gap={4}><Typography.Title level={2} style={{ fontFamily: "'Noto Serif SC','Songti SC',serif", margin: 0 }}>人像核验</Typography.Title><Typography.Text type="secondary">用于 Seedance Fast / Mini 视频创作</Typography.Text></Flex>
          <Tabs defaultActiveKey="materials" items={[{ key: 'materials', label: '人像素材', children: <Flex vertical gap={16}>
            <Flex justify="space-between" align="center" gap={12}><Typography.Text type="secondary">审核通过的人像可直接用于创作。</Typography.Text><Button type="primary" onClick={() => setExpanded('portrait-one')}>添加人像</Button></Flex>
            <PortraitMaterialTable items={overview?.items || []} loading={!overview} expanded={expanded} onExpand={setExpanded} onRefresh={item => void act(() => refreshPortrait(item.id))} renderEditor={item => overview && <PortraitDeclaration item={item} overview={overview} busy={busy} onPerson={setPersonLibrary} onSubmit={async input => { await act(() => declarePortrait(item.id, input)); setExpanded(undefined); }} />} />
          </Flex> }, { key: 'persons', label: '本人核验', children: <Flex vertical gap={16}>
            <Flex justify="space-between" align="center"><Typography.Text type="secondary">由照片中的本人完成核验。</Typography.Text><Button type="primary" onClick={() => setPersonLibrary('ark-demo')}>新增核验</Button></Flex>
            <Table rowKey="id" pagination={false} dataSource={overview?.persons} columns={[{ title: '人物', dataIndex: 'name' }, { title: '状态', render: (_, person) => <PortraitStatus status={person.status === 'active' ? 'verified' : person.status} /> }, { title: '操作', align: 'right', render: (_, person) => <Button type="text" disabled={person.status === 'revoked'} onClick={() => void act(() => revokePortraitPerson(person.id))}>撤销授权</Button> }]} />
          </Flex> }]} />
          {demo && <Typography.Text type="secondary">{demo}</Typography.Text>}
        </Flex>
      </Layout.Content>
    </Layout>
    <PortraitPersonModal libraryId={personLibrary} overview={overview} onClose={() => setPersonLibrary(undefined)} onChanged={changed} /><PortraitReviewHost />
  </App></ConfigProvider>;
}
createRoot(document.getElementById('portrait-framework-root')!).render(<Preview />);
