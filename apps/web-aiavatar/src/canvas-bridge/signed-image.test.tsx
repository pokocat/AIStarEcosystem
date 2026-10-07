// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor, cleanup } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
const refresh = vi.fn();
vi.mock("./image-storage", () => ({ refreshImageUrl: (...args: unknown[]) => refresh(...args) }));
import { SignedImage } from "./signed-image";
afterEach(() => { cleanup(); refresh.mockReset(); });
it("renews a failed signed image once, then renders a retry control instead of looping", async () => {
  refresh.mockResolvedValue("https://cdn/fresh");
  render(<SignedImage src="https://cdn/expired" storageKey="owned/key.jpg" alt="成图" />);
  fireEvent.error(screen.getByAltText("成图"));
  await waitFor(() => expect(screen.getByAltText("成图").getAttribute("src")).toBe("https://cdn/fresh"));
  expect(refresh).toHaveBeenCalledWith("owned/key.jpg");
  fireEvent.error(screen.getByAltText("成图"));
  expect(screen.getByRole("button", { name: "图片加载失败 · 重新加载" })).toBeTruthy();
  expect(refresh).toHaveBeenCalledTimes(1);
});
it("a failed signing request is visible and can be retried", async () => {
  refresh.mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce("https://cdn/fresh");
  render(<SignedImage src="https://cdn/old" storageKey="owned/key.jpg" alt="图" />);
  fireEvent.error(screen.getByAltText("图"));
  fireEvent.click(await screen.findByRole("button"));
  await waitFor(() => expect(screen.getByAltText("图").getAttribute("src")).toBe("https://cdn/fresh"));
});
