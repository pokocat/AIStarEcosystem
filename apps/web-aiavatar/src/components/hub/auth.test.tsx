// @vitest-environment jsdom
import { cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { useRequireAuth } from "./auth";

const session = vi.hoisted(() => ({
  startIdLogin: vi.fn(),
  isAuthed: vi.fn(() => false),
  me: vi.fn(),
  router: { replace: vi.fn() },
}));
vi.mock("next/navigation", () => ({
  useRouter: () => session.router,
  usePathname: () => "/ips",
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/proto/api", () => ({
  USE_MOCK: false, ID_MODE: true,
  auth: { isAuthed: session.isAuthed, startIdLogin: session.startIdLogin },
  AuthApi: { me: session.me },
  onAuthExpired: () => () => {},
}));
vi.mock("@ai-star-eco/landing/EnrollmentGate", () => ({ EnrollmentGate: () => null }));

beforeEach(() => {
  vi.clearAllMocks();
  session.isAuthed.mockReturnValue(false);
  window.history.replaceState(null, "", "/ips?focus=search#details");
});
afterEach(cleanup);

test.each(["rejected", "unavailable"])("%s login navigation goes to a retryable login page with the full return path", async mode => {
  if (mode === "rejected") session.startIdLogin.mockRejectedValue(new Error("CRYPTO_UNAVAILABLE"));
  else session.startIdLogin.mockResolvedValue(false);
  renderHook(() => useRequireAuth());
  await waitFor(() => expect(session.router.replace).toHaveBeenCalledWith("/login?next=%2Fips%3Ffocus%3Dsearch%23details"));
  expect(session.me).not.toHaveBeenCalled();
});

test("successful identity navigation does not start a second login navigation", async () => {
  session.startIdLogin.mockResolvedValue(true);
  renderHook(() => useRequireAuth());
  await waitFor(() => expect(session.startIdLogin).toHaveBeenCalledOnce());
  expect(session.router.replace).not.toHaveBeenCalled();
});

test("late login rejection does not navigate after the protected page unmounts", async () => {
  let reject!: (error: Error) => void;
  session.startIdLogin.mockImplementation(() => new Promise<boolean>((_, fail) => { reject = fail; }));
  const { unmount } = renderHook(() => useRequireAuth());
  unmount();
  reject(new Error("navigation failed"));
  await new Promise(resolve => setTimeout(resolve, 0));
  expect(session.router.replace).not.toHaveBeenCalled();
});
