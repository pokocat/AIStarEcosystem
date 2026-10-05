import * as React from "react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { AddCharacterDialog } from "./add-bar";

// 画布上「加一个角色」的弹窗：加的时候就选分级（以前一律存成配角）。断结构和回调参数，不断文案（§8.0.1 ⑩）。

afterEach(() => cleanup());

const pressed = () => document.querySelector<HTMLElement>('[data-field="role"] [aria-pressed="true"]')?.dataset.role;

function submitName(name: string) {
  fireEvent.change(screen.getByLabelText("角色名"), { target: { value: name } });
  fireEvent.submit(screen.getByRole("dialog"));
}

describe("AddCharacterDialog 分级", () => {
  it("打开时停在调用方给的缺省分级；不改就按它交回", () => {
    const onSubmit = vi.fn();
    render(<AddCharacterDialog open existingNames={[]} defaultRole="lead" onClose={() => {}} onSubmit={onSubmit} />);
    expect(pressed()).toBe("lead");
    submitName("林微");
    expect(onSubmit).toHaveBeenCalledWith("林微", "lead");
  });

  it("选了别的分级就交回选的那个；关掉再打开回到缺省", () => {
    const onSubmit = vi.fn();
    const { rerender } = render(<AddCharacterDialog open existingNames={[]} defaultRole="support" onClose={() => {}} onSubmit={onSubmit} />);
    fireEvent.click(document.querySelector('[data-field="role"] [data-role="extra"]')!);
    expect(pressed()).toBe("extra");
    submitName("路人");
    expect(onSubmit).toHaveBeenCalledWith("路人", "extra");
    rerender(<AddCharacterDialog open={false} existingNames={[]} defaultRole="support" onClose={() => {}} onSubmit={onSubmit} />);
    rerender(<AddCharacterDialog open existingNames={[]} defaultRole="support" onClose={() => {}} onSubmit={onSubmit} />);
    expect(pressed()).toBe("support");
  });

  it("接线：画布把 defaultNewRole(角色们) 作为缺省传进来，选的分级一路写进 addCharacter", () => {
    const src = readFileSync(resolve(__dirname, "./board-view.tsx"), "utf8");
    expect(src).toMatch(/defaultRole=\{defaultNewRole\(doc\.characters\)\}/);
    expect(src).toMatch(/addCharacter\(d, name, role\)/);
  });
});
