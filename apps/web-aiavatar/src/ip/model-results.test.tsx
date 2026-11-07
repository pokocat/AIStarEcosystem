// @vitest-environment jsdom
import React from "react";
import {render,screen,fireEvent,waitFor,cleanup} from "@testing-library/react";
import {afterEach,expect,test,vi} from "vitest";
const mock=vi.hoisted(()=>({fetch:vi.fn()}));
vi.mock("../../../../packages/api-client/src/_client",()=>({apiFetch:mock.fetch}));
import {ModelResults} from "../../../../packages/api-client/src/model-results";
afterEach(()=>{cleanup();mock.fetch.mockReset();});
test("the complete long result is displayed as text and can be copied",async()=>{
 const text="<script>window.bad=true</script>\n"+"模型原文。".repeat(12000);
 mock.fetch.mockImplementation((url:string)=>Promise.resolve(url.includes("?page=")?[{id:"r1",model:"测试模型",purpose:"DAP_PERSONA",createdAt:"2026-11-05T13:00:00Z"}]:{id:"r1",content:text,finishReason:"length"}));
 const copy=vi.fn().mockResolvedValue(undefined);Object.defineProperty(navigator,"clipboard",{configurable:true,value:{writeText:copy}});
 render(<ModelResults/>);fireEvent.click(await screen.findByRole("button",{name:/测试模型/}));
 await waitFor(()=>expect(document.querySelector("pre")?.textContent).toBe(text));
 expect(document.querySelector("article script")).toBeNull();
 expect(screen.getByText(/可能不完整/)).toBeTruthy();
 fireEvent.click(screen.getByRole("button",{name:"复制全文"}));
 await waitFor(()=>expect(copy).toHaveBeenCalledWith(text));
});
test("empty history and read failures are explicit",async()=>{
 mock.fetch.mockResolvedValue([]);render(<ModelResults/>);
 expect(await screen.findByText(/暂无记录/)).toBeTruthy();
 expect((screen.getByRole("button",{name:"下一页"}) as HTMLButtonElement).disabled).toBe(true);
});
