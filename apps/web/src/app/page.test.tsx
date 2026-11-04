import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { AccountError, getMe } from "@/lib/account";
import LearningHomePage from "./page";

const replace = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace, prefetch: vi.fn(), push: vi.fn() }) }));
vi.mock("@/lib/account", async (original) => ({
  ...await original<typeof import("@/lib/account")>(), getMe: vi.fn(),
}));
vi.mock("./_hooks/use-learning-home", () => ({
  useLearningHome: () => ({ overview: null, loading: true, error: null, reload: vi.fn() }),
}));

afterEach(() => { cleanup(); vi.clearAllMocks(); });

it("sends a visitor without a session to login instead of staying on account checks", async () => {
  vi.mocked(getMe).mockRejectedValue(new AccountError("Not authenticated", 401));
  render(<LearningHomePage />);
  await waitFor(() => expect(replace).toHaveBeenCalledWith("/login"));
});

it("offers a retry when the account service is temporarily unavailable", async () => {
  vi.mocked(getMe).mockRejectedValue(new AccountError("服务暂不可用", 503));
  render(<LearningHomePage />);
  expect(await screen.findByRole("button", { name: "重新检查" })).toBeInTheDocument();
  expect(replace).not.toHaveBeenCalled();
});
