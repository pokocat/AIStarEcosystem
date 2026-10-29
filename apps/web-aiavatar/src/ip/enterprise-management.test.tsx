// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { webcrypto } from "node:crypto";
import { EnterpriseManagement } from "./enterprise-management";
import type { EnterpriseContext } from "@ai-star-eco/types/enterprise";
const clipboard = vi.hoisted(() => ({ command: vi.fn(), clearData: vi.fn(), setData: vi.fn() }));
const api = vi.hoisted(() => ({ addMembers: vi.fn(), addMember: vi.fn(), members: vi.fn(), invitations: vi.fn(), ownershipTransfers: vi.fn(), invite: vi.fn(), revoke: vi.fn(), updateMember: vi.fn(), requestOwnership: vi.fn(), acceptOwnership: vi.fn(), policy: vi.fn(), updatePolicy: vi.fn(), previewLifecycle: vi.fn(), lifecycle: vi.fn() }));
vi.mock("@/canvas-bridge/enterprise-api", () => ({ EnterpriseApi: api }));
vi.mock("@/canvas-bridge/api", () => ({ fetchModels: vi.fn().mockResolvedValue({ image: [{ endpointId: "image-id", name: "人像图片" }], video: [] }) }));
vi.mock("@/canvas-bridge/studio-api", () => ({ studioCapabilities: vi.fn().mockResolvedValue({ textModels: [{ endpointId: "text-id", name: "创作文本" }] }), studioSpeechCatalog: vi.fn().mockResolvedValue({ models: [] }), studioLipSyncCatalog: vi.fn().mockResolvedValue({ models: [] }) }));
vi.mock("./studio-errors", () => ({ normalizeStudioError: (error: any) => ({ message: error.message || String(error) }) }));
vi.mock("antd", () => ({
  Alert: ({ title, description, action }: any) => <div role="alert">{title}{description}{action}</div>,
  Button: ({ children, loading, type, danger, htmlType, ...props }: any) => <button {...props} type={htmlType || "button"} disabled={loading || props.disabled}>{children}</button>,
  Checkbox: ({ children, ...props }: any) => <label><input {...props} type="checkbox"/>{children}</label>,
  Empty: ({ description }: any) => <p>{description}</p>,
  Input: Object.assign((props: any) => <input {...props}/>, { TextArea: ({ autoSize, ...props }: any) => <textarea {...props}/> }),
  InputNumber: ({ onChange, precision, ...props }: any) => <input {...props} type="number" value={props.value ?? ""} onChange={event => onChange(Number(event.target.value))}/>,
  Select: ({ options, onChange, value, mode, optionFilterProp, ...props }: any) => <select {...props} value={value} multiple={mode === "multiple"} onChange={event => onChange(mode === "multiple" ? [...event.target.selectedOptions].map(option => option.value) : event.target.value)}>{options.map((option: any) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>,
  Modal: ({ open, title, children, footer, onOk, onCancel, okText, okButtonProps, confirmLoading }: any) => open ? <section role="dialog" aria-label={title}><h2>{title}</h2>{children}{footer || <><button onClick={onCancel}>取消</button><button disabled={confirmLoading || okButtonProps?.disabled} onClick={onOk}>{okText}</button></>}</section> : null,
  Pagination: () => null, Skeleton: () => <p>读取中</p>, Tag: ({ children }: any) => <span>{children}</span>,
  Table: ({ dataSource, columns }: any) => <table><tbody>{dataSource.map((row: any) => <tr key={row.id}>{columns.map((column: any, index: number) => <td key={index}>{column.render ? column.render(row[column.dataIndex], row) : row[column.dataIndex]}</td>)}</tr>)}</tbody></table>,
}));
const owner = { enterprise: { id: "team", name: "创作公司", status: "active" }, member: { id: "self", userId: "owner", role: "owner", status: "active" }, permissions: ["enterprise.read", "member.invite", "member.manage", "policy.manage"] } as EnterpriseContext;
const member = { id: "member", userId: "user", displayName: "张三", role: "member", status: "active", capabilities: { pointsManage: false, billingRead: false, rechargeRequest: false }, version: 3 };
const page = (data: unknown[]) => ({ data, pagination: { total: data.length } });
beforeEach(() => { vi.clearAllMocks(); clipboard.command.mockReset(); clipboard.command.mockImplementation(() => {
  const event=new Event("copy",{bubbles:true,cancelable:true});
  Object.defineProperty(event,"clipboardData",{value:{clearData:clipboard.clearData,setData:clipboard.setData}});
  document.activeElement?.dispatchEvent(event);return true;
});Object.defineProperty(document,"execCommand",{configurable:true,value:clipboard.command}); vi.stubGlobal("crypto", webcrypto); api.members.mockResolvedValue(page([member])); api.invitations.mockResolvedValue(page([])); api.ownershipTransfers.mockResolvedValue(page([])); api.previewLifecycle.mockResolvedValue({ availableCredits: 50, pendingCredits: 20, activeJobs: 2, cancellableJobs: 1, acceptedJobs: 1, canProceed: true, blockers: [], confirmationFingerprint: "preview" }); api.lifecycle.mockResolvedValue({ reclaimedCredits: 50 }); api.policy.mockResolvedValue({ allowedEndpointIds: ["image-id"], maxActiveJobs: 3, version: 2 }); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); Reflect.deleteProperty(document,"execCommand"); });

test("suspend previews exact available and pending consequences before explicit confirmation", async () => {
  render(<EnterpriseManagement context={owner} section="team" onChanged={vi.fn().mockResolvedValue(undefined)}/>);
  fireEvent.click(await screen.findByRole("button", { name: "停用" }));
  const dialog = await screen.findByRole("dialog", { name: "停用成员" });
  expect(api.previewLifecycle).toHaveBeenCalledWith("team", { action: "suspend", memberId: "member" }); expect(api.lifecycle).not.toHaveBeenCalled();
  expect(within(dialog).getByText("50")).toBeDefined(); expect(within(dialog).getByText("20")).toBeDefined();
  fireEvent.click(within(dialog).getByRole("button", { name: "确认停用成员" }));
  await waitFor(() => expect(api.lifecycle).toHaveBeenCalledWith("team", expect.objectContaining({ action: "suspend", memberId: "member", confirmationFingerprint: "preview" })));
});

test("lifecycle failure retains preview and original idempotency key for retry", async () => {
  api.lifecycle.mockRejectedValueOnce(new Error("网络中断")).mockResolvedValueOnce({});
  render(<EnterpriseManagement context={owner} section="team" onChanged={vi.fn().mockResolvedValue(undefined)}/>);
  fireEvent.click(await screen.findByRole("button", { name: "移除" })); const dialog = await screen.findByRole("dialog", { name: "移除成员" });
  fireEvent.click(within(dialog).getByRole("button", { name: "确认移除成员" }));
  await waitFor(() => expect(api.lifecycle).toHaveBeenCalledTimes(1)); await screen.findAllByText(/网络中断/);
  fireEvent.click(within(dialog).getByRole("button", { name: "确认移除成员" }));
  await waitFor(() => expect(api.lifecycle).toHaveBeenCalledTimes(2)); expect(api.lifecycle.mock.calls[0][1].clientRequestId).toBe(api.lifecycle.mock.calls[1][1].clientRequestId);
});

test("ordinary member cannot invoke administrator controls and can accept incoming owner transfer", async () => {
  api.ownershipTransfers.mockResolvedValue(page([{ id: "transfer", status: "pending", toUserId: "user", expiresAt: "2099-01-01T00:00:00Z" }]));
  const context = { ...owner, member: { ...owner.member, id: "member", userId: "user", role: "member" }, permissions: ["enterprise.read"] } as EnterpriseContext;
  render(<EnterpriseManagement context={context} section="lifecycle" onChanged={vi.fn().mockResolvedValue(undefined)}/>);
  fireEvent.click(await screen.findByRole("button", { name: "接受主账号移交" }));
  await waitFor(() => expect(api.acceptOwnership).toHaveBeenCalledWith("team", "transfer"));
  expect(screen.queryByRole("button", { name: "创建邀请" })).toBeNull(); expect(api.members).not.toHaveBeenCalled();
});

test("model policy selects human model names and sends endpoint ids with version", async () => {
  render(<EnterpriseManagement context={owner} section="policy" onChanged={vi.fn().mockResolvedValue(undefined)}/>);
  expect(await screen.findByRole("option", { name: "图片 · 人像图片" })).toBeDefined(); expect(screen.getByRole("option", { name: "文本 · 创作文本" })).toBeDefined();
  fireEvent.change(screen.getByLabelText("每位成员最多在途任务数"), { target: { value: "5" } }); fireEvent.click(screen.getByRole("button", { name: "保存生成设置" }));
  await waitFor(() => expect(api.updatePolicy).toHaveBeenCalledWith("team", { allowedEndpointIds: ["image-id"], maxActiveJobs: 5, version: 2 }));
});

test("close with unresolved funds shows blockers and cannot submit", async () => {
  api.previewLifecycle.mockResolvedValue({ availableCredits: 100, pendingCredits: 20, activeJobs: 1, cancellableJobs: 0, acceptedJobs: 1, canProceed: false, blockers: ["请先处理剩余企业积分"], confirmationFingerprint: "blocked" });
  render(<EnterpriseManagement context={owner} section="lifecycle" onChanged={vi.fn().mockResolvedValue(undefined)}/>);
  fireEvent.click(await screen.findByRole("button", { name: "核对关闭企业条件" })); const dialog = await screen.findByRole("dialog", { name: "关闭企业" });
  expect(within(dialog).getByText(/请先处理剩余企业积分/)).toBeDefined(); expect(within(dialog).getByRole("button", { name: "确认关闭企业" }).hasAttribute("disabled")).toBe(true); expect(api.lifecycle).not.toHaveBeenCalled();
});

test("group invitation creates a shareable 90-day link and stays visible until explicitly closed", async () => {
  const token = "a".repeat(43);
  api.invite.mockResolvedValue({ invitation: { id: "invite", expiresAt: "2027-01-15T08:00:00Z" }, token }); const changed = vi.fn().mockResolvedValue(undefined);
  render(<EnterpriseManagement context={owner} section="team" onChanged={changed}/>);
  fireEvent.click(await screen.findByRole("button", { name: "创建分享链接" }));
  const dialog = await screen.findByRole("dialog", { name: "分享企业邀请" });
  expect(api.invite).toHaveBeenCalledWith("team", { clientRequestId: expect.any(String), validDays: 90 });
  expect((within(dialog).getByLabelText("企业邀请链接") as HTMLTextAreaElement).value).toContain(`/enterprise/invite#token=${token}`); expect(changed).not.toHaveBeenCalled();
  fireEvent.click(within(dialog).getByRole("button", { name: "完成" })); expect(screen.queryByRole("dialog", { name: "分享企业邀请" })).toBeNull();
});


async function invitationDialog() {
  api.invite.mockResolvedValue({invitation:{id:"invite",expiresAt:"2027-01-15T08:00:00Z"},token:"c".repeat(43)});
  render(<EnterpriseManagement context={owner} section="team" onChanged={vi.fn().mockResolvedValue(undefined)}/>);
  fireEvent.click(await screen.findByRole("button",{name:"创建分享链接"}));
  return screen.findByRole("dialog",{name:"分享企业邀请"});
}

test("native copying confirms inside its dialog only after success", async () => {
  const dialog=await invitationDialog();let resolve!:()=>void;
  const writeText=vi.fn().mockReturnValueOnce(new Promise<void>(done=>{resolve=done;}));vi.stubGlobal("navigator",{clipboard:{writeText}});
  fireEvent.click(within(dialog).getByRole("button",{name:"复制邀请链接"}));
  expect(writeText).toHaveBeenCalledWith((within(dialog).getByLabelText("企业邀请链接") as HTMLTextAreaElement).value);
  expect(within(dialog).queryByRole("status")).toBeNull();
  expect(within(dialog).getByRole("button",{name:"复制邀请链接"}).hasAttribute("disabled")).toBe(true);
  resolve();await within(dialog).findByRole("status");expect(api.invite).toHaveBeenCalledTimes(1);
});

test("the compatible modal copy replaces image or rich clipboard content with only the complete plain text",async()=>{
  const dialog=await invitationDialog();fireEvent.click(within(dialog).getByRole("button",{name:"复制邀请链接"}));
  await within(dialog).findByRole("status");
  expect(clipboard.command).toHaveBeenCalledWith("copy");expect(clipboard.clearData).toHaveBeenCalledTimes(1);
  expect(clipboard.setData).toHaveBeenCalledWith("text/plain",(within(dialog).getByLabelText("企业邀请链接") as HTMLTextAreaElement).value);
});

test.each([false, "throws"])("copy failure %s visibly selects the complete link without pretending the previous clipboard was replaced",async failure=>{
  const dialog=await invitationDialog();
  if(failure===false)clipboard.command.mockReturnValueOnce(false);else clipboard.command.mockImplementationOnce(()=>{throw new Error("not allowed");});
  fireEvent.click(within(dialog).getByRole("button",{name:"复制邀请链接"}));
  await within(dialog).findByRole("alert");
  const field=within(dialog).getByLabelText("企业邀请链接") as HTMLTextAreaElement;
  expect(document.activeElement).toBe(field);expect(field.selectionStart).toBe(0);expect(field.selectionEnd).toBe(field.value.length);
  expect(within(dialog).queryByRole("status")).toBeNull();
  fireEvent.click(within(dialog).getByRole("button",{name:"复制邀请链接"}));
  await within(dialog).findByRole("status");expect(api.invite).toHaveBeenCalledTimes(1);
});


test("the native clipboard writes only the complete invitation string, with compatibility fallback on denial",async()=>{
  const writeText=vi.fn().mockResolvedValue(undefined);vi.stubGlobal("navigator",{clipboard:{writeText}});
  const dialog=await invitationDialog();const link=(within(dialog).getByLabelText("企业邀请链接") as HTMLTextAreaElement).value;
  fireEvent.click(within(dialog).getByRole("button",{name:"复制邀请链接"}));await within(dialog).findByRole("status");
  expect(writeText).toHaveBeenCalledWith(link);expect(clipboard.command).not.toHaveBeenCalled();
  writeText.mockRejectedValueOnce(new Error("permission denied"));
  fireEvent.click(within(dialog).getByRole("button",{name:"复制邀请链接"}));
  await waitFor(()=>expect(clipboard.setData).toHaveBeenCalledWith("text/plain",link));
});

test("a copy command that reports success without writing a copy event is never presented as copied",async()=>{
  const dialog=await invitationDialog();clipboard.command.mockReturnValueOnce(true);
  fireEvent.click(within(dialog).getByRole("button",{name:"复制邀请链接"}));await within(dialog).findByRole("alert");
  expect(within(dialog).queryByRole("status")).toBeNull();
});


test("phone addition validates input, preserves errors and refreshes real members after success", async () => {
  const changed = vi.fn().mockResolvedValue(undefined);
  api.addMember.mockRejectedValueOnce(new Error("该账号已加入其他企业")).mockResolvedValueOnce(member);
  render(<EnterpriseManagement context={owner} section="team" onChanged={changed}/>);
  fireEvent.click(await screen.findByRole("button", { name: "添加成员" }));
  const input = screen.getByLabelText("手机号");
  const submit = screen.getByRole("button", { name: "确认添加" });
  fireEvent.change(input, { target: { value: "123" } });
  expect(submit.hasAttribute("disabled")).toBe(true);
  fireEvent.change(input, { target: { value: "+86 138 0013 8000" } });
  fireEvent.click(submit);
  await screen.findByText("该账号已加入其他企业");
  expect((input as HTMLInputElement).value).toBe("+86 138 0013 8000");
  fireEvent.click(submit);
  await screen.findByText("「张三」已在企业成员中，可为其分配企业积分。");
  expect(api.addMember).toHaveBeenLastCalledWith("team", { phone: "13800138000" });
  expect(changed).toHaveBeenCalledOnce();
  expect(screen.queryByLabelText("手机号")).toBeNull();
});

test("ordinary members have no phone addition entry", async () => {
  render(<EnterpriseManagement context={{ ...owner, member: { ...owner.member, role: "member" }, permissions: ["enterprise.read"] }} section="team" onChanged={async () => {}}/>);
  await screen.findByText("成员只能查看本人企业积分");
  expect(screen.queryByRole("button", { name: "添加成员" })).toBeNull();
});


test("batch mode deduplicates pasted phones and keeps only failed entries for retry", async () => {
  api.addMembers.mockResolvedValueOnce({ successCount: 1, failureCount: 1, results: [
    { phone: "13800138000", status: "success", member },
    { phone: "13900139000", status: "failed", errorCode: "ENTERPRISE_ALREADY_JOINED", message: "该账号已加入其他企业" },
  ] }).mockResolvedValueOnce({ successCount: 1, failureCount: 0, results: [{ phone: "13900139000", status: "success", member }] });
  const changed = vi.fn().mockResolvedValue(undefined);
  render(<EnterpriseManagement context={owner} section="team" onChanged={changed}/>);
  fireEvent.click(await screen.findByRole("button", { name: "添加成员" }));
  fireEvent.click(screen.getByRole("button", { name: "批量添加" }));
  fireEvent.change(screen.getByLabelText("手机号列表"), { target: { value: "13800138000，13900139000\n+86 13800138000" } });
  fireEvent.click(screen.getByRole("button", { name: "确认添加 2 人" }));
  await screen.findByText("处理结果：成功 1 人，失败 1 人");
  expect(api.addMembers).toHaveBeenCalledWith("team", { phones: ["13800138000", "13900139000"] });
  expect((screen.getByLabelText("手机号列表") as HTMLTextAreaElement).value).toBe("13900139000");
  expect(screen.getByText("该账号已加入其他企业")).toBeDefined();
  fireEvent.click(screen.getByRole("button", { name: "确认添加 1 人" }));
  await screen.findByText("处理结果：成功 1 人，失败 0 人");
  expect(api.addMembers).toHaveBeenLastCalledWith("team", { phones: ["13900139000"] });
  expect(changed).toHaveBeenCalledTimes(2);
});

test("batch mode caps each request at 100 phones and preserves drafts across mode switches", async () => {
  render(<EnterpriseManagement context={owner} section="team" onChanged={async () => {}}/>);
  fireEvent.click(await screen.findByRole("button", { name: "添加成员" }));
  fireEvent.change(screen.getByLabelText("手机号"), { target: { value: "13800138000" } });
  fireEvent.click(screen.getByRole("button", { name: "批量添加" }));
  fireEvent.change(screen.getByLabelText("手机号列表"), { target: { value: Array.from({ length: 101 }, (_, i) => String(13900000000 + i)).join("\n") } });
  expect(screen.getByRole("button", { name: "确认添加 101 人" }).hasAttribute("disabled")).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "单个添加" }));
  expect((screen.getByLabelText("手机号") as HTMLInputElement).value).toBe("13800138000");
  expect(api.addMembers).not.toHaveBeenCalled();
});
