// @vitest-environment jsdom
// 「Studio 技能」 page against the in-memory contract mock: publish a new version, surface the last-active
// refusal, roll back, review a distilled draft, dry-run and create from a pasted file.
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { FeedbackProviders } from '@/components/feedback';

vi.mock('@/api', async () => {
  const client = await vi.importActual<typeof import('@/api/_client')>('@/api/_client');
  const m = await vi.importActual<typeof import('@/mocks/studio-skills')>('@/mocks/studio-skills');
  const later = <T,>(fn: () => T) => new Promise<T>((resolve, reject) => setTimeout(() => { try { resolve(fn()); } catch (e) { reject(e); } }, 0));
  return {
    ApiError: client.ApiError,
    StudioSkillsApi: {
      listStudioSkills: () => later(m.mockListStudioSkills),
      getStudioSkill: (k: string) => later(() => m.mockGetStudioSkill(k)),
      listStudioSkillVersions: (k: string) => later(() => m.mockListStudioSkillVersions(k)),
      createStudioSkill: (b: never) => later(() => m.mockCreateStudioSkill(b)),
      publishStudioSkillVersion: (k: string, b: never) => later(() => m.mockPublishStudioSkillVersion(k, b)),
      setStudioSkillStatus: (k: string, b: never) => later(() => m.mockSetStudioSkillStatus(k, b)),
      rollbackStudioSkill: (k: string, v: number, b: never) => later(() => m.mockRollbackStudioSkill(k, v, b)),
      publishStudioSkillDraft: (k: string, v: number, b: never) => later(() => m.mockPublishStudioSkillDraft(k, v, b)),
      dryRunStudioSkill: (k: string, b: never) => later(() => m.mockDryRunStudioSkill(k, b)),
    },
  };
});
import StudioSkillsPage from './page';
import { resetMockStudioSkills } from '@/mocks/studio-skills';

beforeEach(() => { resetMockStudioSkills(); Element.prototype.scrollIntoView ||= () => {}; });
afterEach(cleanup);

async function open() {
  render(<FeedbackProviders><StudioSkillsPage /></FeedbackProviders>);
  await screen.findByRole('option', { name: /参考视频复刻/ });
  await screen.findByRole('textbox', { name: '技能正文' });
}
const versionRow = (v: number) => within(screen.getByRole('list', { name: '版本列表' })).getByRole('listitem', { name: `v${v}` });
const dialog = () => screen.getByRole('dialog');

test('the list shows status, version, pending drafts and routing hints; publishing asks for a note and appends a version', async () => {
  await open();
  const item = screen.getByRole('option', { name: /参考视频复刻/ });
  expect(within(item).getByText('启用')).toBeDefined();
  expect(within(item).getByText('1 份待审阅')).toBeDefined();
  expect(within(item).getByText('带视频 · 说到「复刻」「照着做」「同款」 · 默认')).toBeDefined();
  expect(within(screen.getByRole('option', { name: /口播种草/ })).getByText('草稿')).toBeDefined();

  const publish = screen.getByRole('button', { name: /发布新版本/ }) as HTMLButtonElement;
  expect(publish.disabled).toBe(true);
  fireEvent.change(screen.getByRole('textbox', { name: '技能正文' }), { target: { value: '# 参考视频复刻\n新的写法。' } });
  fireEvent.click(publish);
  fireEvent.change(within(dialog()).getByRole('textbox'), { target: { value: '改写分段规则' } });
  fireEvent.click(within(dialog()).getByRole('button', { name: '发布' }));
  await waitFor(() => expect(within(versionRow(4)).getByText('当前')).toBeDefined());
  expect(within(versionRow(4)).getByText('改写分段规则')).toBeDefined();
  expect(within(versionRow(4)).getByText('后台发布')).toBeDefined();
});

test('auto-fix checks can only come from the checks; removing a check drops it; new ids are normalized', async () => {
  await open();
  const autoFix = screen.getByRole('group', { name: '允许自动修正的检查项' });
  fireEvent.click(within(autoFix).getByRole('button', { name: 'product-facts' }));
  expect(within(autoFix).getByRole('button', { name: 'product-facts' }).getAttribute('aria-pressed')).toBe('true');
  fireEvent.click(screen.getByRole('button', { name: '移除 product-facts' }));
  expect(within(screen.getByRole('group', { name: '允许自动修正的检查项' })).queryByRole('button', { name: 'product-facts' })).toBeNull();
  const add = screen.getByRole('textbox', { name: '添加检查项' });
  fireEvent.change(add, { target: { value: 'New Check' } });
  fireEvent.click(within(add.parentElement!).getByRole('button', { name: '添加' }));
  expect(screen.getByRole('button', { name: '移除 new-check' })).toBeDefined();
});

test('withdrawing the last active skill shows why it was refused', async () => {
  await open();
  fireEvent.click(within(screen.getByRole('group', { name: '技能状态' })).getByRole('button', { name: '已停用' }));
  fireEvent.click(within(dialog()).getByRole('button', { name: '停用' }));
  await screen.findByText('最后一个启用的技能不能停用。对话至少要有一个可用的技能，先启用另一个，再停用它。');
  expect(within(screen.getByRole('group', { name: '技能状态' })).getByRole('button', { name: '启用' }).getAttribute('aria-pressed')).toBe('true');
});

test('rolling back confirms first and creates a new version; a distilled draft is reviewed, then published', async () => {
  await open();
  fireEvent.click(within(versionRow(1)).getByRole('button', { name: '回滚到此版本' }));
  expect(within(dialog()).getByText(/会用 v1 的内容生成一个新版本并立即生效/)).toBeDefined();
  fireEvent.click(within(dialog()).getByRole('button', { name: '回滚' }));
  await waitFor(() => expect(within(versionRow(4)).getByText('回滚')).toBeDefined());
  expect(within(versionRow(4)).getByText('当前')).toBeDefined();
  // v3 was distilled on top of v2; v4 is current now, so it cannot be published as is.
  fireEvent.click(within(versionRow(3)).getByRole('button', { name: '审阅后发布' }));
  expect(within(dialog()).getByText(/这份草稿是在 v2 上整理的，之后已经换成了 v4，不能直接发布/)).toBeDefined();
  expect((within(dialog()).getByRole('button', { name: '发布这一版' }) as HTMLButtonElement).disabled).toBe(true);
});

test('a fresh draft shows what it changes and publishes after review', async () => {
  await open();
  fireEvent.click(within(versionRow(3)).getByRole('button', { name: '审阅后发布' }));
  expect(within(dialog()).getByText(/正文（新增 3 行，删掉 0 行）/)).toBeDefined();
  fireEvent.click(within(dialog()).getByRole('button', { name: '发布这一版' }));
  await waitFor(() => expect(within(versionRow(3)).getByText('当前')).toBeDefined());
  expect(within(versionRow(3)).queryByText('待审阅')).toBeNull();
});

test('dry run shows the returned plan and the editor contents are validated first', async () => {
  await open();
  const brief = screen.getByPlaceholderText('换成我的洗衣液，保留最后的反转');
  fireEvent.change(brief, { target: { value: '换成我的洗衣液' } });
  fireEvent.click(screen.getByRole('button', { name: '试跑' }));
  await screen.findByText('计划通过校验');
  expect(screen.getByText('拉片：按叙事切段')).toBeDefined();
  // A broken edit in the editor is not sent.
  fireEvent.change(screen.getByRole('textbox', { name: '技能正文' }), { target: { value: '' } });
  fireEvent.click(screen.getByRole('button', { name: '试跑' }));
  expect(await screen.findByText('编辑器里的内容还有问题，先改好再试跑：')).toBeDefined();
});

test('a skill is created from a pasted file and selected', async () => {
  await open();
  fireEvent.click(screen.getByRole('button', { name: /新建技能/ }));
  fireEvent.click(within(dialog()).getByRole('button', { name: '填入模板' }));
  fireEvent.click(within(dialog()).getByRole('button', { name: '创建' }));
  await waitFor(() => expect(screen.getByRole('option', { name: /新技能/, selected: true })).toBeDefined());
  expect(within(screen.getByRole('option', { name: /新技能/ })).getByText('草稿')).toBeDefined();
});
