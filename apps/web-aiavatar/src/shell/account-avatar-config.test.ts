import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import NotionAvatar from "@/vendor/react-notion-avatar";
import { accountAvatarUrl, defaultAccountAvatar } from "./account-avatar-config";

describe("account default avatars", () => {
  it("keeps the same appearance across renders and uses the full UID", () => {
    const first = defaultAccountAvatar("0123456789ab-account-a");
    expect(defaultAccountAvatar("0123456789ab-account-a")).toEqual(first);
    expect(defaultAccountAvatar("0123456789ab-account-b")).not.toEqual(first);
    const render = () => renderToStaticMarkup(createElement(NotionAvatar, first));
    expect(render()).toBe(render());
    expect(render()).toContain('<svg viewBox="0 0 1080 1080"');
    expect(render()).toContain("<path");
  });

  it("assigns varied valid upstream configurations", () => {
    const avatars = Array.from({ length: 100 }, (_, i) => defaultAccountAvatar(`registered-${i}`));
    expect(new Set(avatars.map(avatar => JSON.stringify(avatar))).size).toBe(100);
    expect([...new Set(avatars.map(avatar => avatar.bgColor))]).toEqual(["#f3f4f6"]);
    for (const { config } of avatars) {
      for (const [key, count] of Object.entries({ face: 12, eye: 15, eyebrow: 17, glass: 14, hair: 59, mouth: 21, nose: 15 })) {
        expect(config[key]).toBeGreaterThanOrEqual(0);
        expect(config[key]).toBeLessThan(count);
      }
    }
  });

  it("only uses valid account image URLs", () => {
    expect(accountAvatarUrl("https://id.example/avatars/u/v.jpg")).toBe("https://id.example/avatars/u/v.jpg");
    for (const value of [null, "", "bad url", "javascript:alert(1)", "data:image/svg+xml,hi"]) expect(accountAvatarUrl(value)).toBeNull();
  });
});
