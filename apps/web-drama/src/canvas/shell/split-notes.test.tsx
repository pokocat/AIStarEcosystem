import * as React from "react";
import { beforeEach, describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { rememberSplitNotes, SplitNotesBanner } from "./split-notes";

// 切集说明只显示一次：读到就显示、读完即删、可关闭。notes 是服务端给的原话，这里断它被原样显示出来。
describe("SplitNotesBanner", () => {
  beforeEach(() => window.sessionStorage.clear());

  it("读到就显示（第一条当标题，其余列出来），读完即删；关掉就没了", () => {
    rememberSplitNotes("dcv_1", ["总述", "第二条", "第三条"]);
    render(<SplitNotesBanner canvasId="dcv_1" episodeCount={2} />);
    expect(screen.getByText("总述")).toBeTruthy();
    expect(screen.getAllByRole("listitem").map((li) => li.textContent)).toEqual(["第二条", "第三条"]);
    expect(window.sessionStorage.getItem("drama-canvas-split-notes:dcv_1")).toBeNull();
    fireEvent.click(screen.getByRole("button"));
    expect(screen.queryByText("总述")).toBeNull();
  });

  it("没有记下的说明：什么都不画；别的画布的说明不串", () => {
    rememberSplitNotes("dcv_2", ["别的画布"]);
    const { container } = render(<SplitNotesBanner canvasId="dcv_1" episodeCount={1} />);
    expect(container.firstChild).toBeNull();
    expect(window.sessionStorage.getItem("drama-canvas-split-notes:dcv_2")).not.toBeNull();
  });
});
