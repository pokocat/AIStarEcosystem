// mocks/_handlers/dap-avatars.ts — AiAvatar 数字人引用层 mock handlers（v0.60 收敛）。

import { mockDelay, registerMocks } from "@ai-star-eco/api-client";
import { MOCK_DAP_AVATARS, MOCK_DAP_LOOKS, MOCK_DAP_DERIVS } from "@/mocks/dap-avatars";

registerMocks([
  {
    method: "GET",
    pattern: "/v1/avatars",
    handler: () => mockDelay(MOCK_DAP_AVATARS.map((a) => ({ ...a }))),
  },
  {
    method: "GET",
    pattern: "/v1/avatars/:id/looks",
    handler: () => mockDelay(MOCK_DAP_LOOKS.map((l) => ({ ...l }))),
  },
  {
    method: "GET",
    pattern: "/v1/avatars/:id/derivatives",
    handler: () => mockDelay(MOCK_DAP_DERIVS.map((d) => ({ ...d }))),
  },
]);
