import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { AccountError, login } from "@/lib/account";
import LoginPage from "./page";

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn() }) }));
vi.mock("@/lib/account", async (original) => ({
  ...await original<typeof import("@/lib/account")>(), login: vi.fn(),
}));
afterEach(() => { cleanup(); vi.clearAllMocks(); });

it("explains disabled accounts and lets the learner switch accounts", async () => {
  vi.mocked(login).mockRejectedValue(new AccountError("账号已停用", 403, "account_disabled"));
  const user = userEvent.setup();
  render(<LoginPage />);
  await user.type(screen.getByPlaceholderText("请输入用户名"), "test1");
  await user.type(screen.getByPlaceholderText("请输入密码"), "password1");
  await user.click(screen.getByRole("button", { name: "进入我的学习空间" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("账号已暂停使用");
  expect(screen.getByRole("alert")).toHaveTextContent("学习数据仍然保留");
  expect(screen.getByRole("alert")).toHaveTextContent("联系管理员");
  expect(screen.getByRole("alert")).not.toHaveTextContent("403");
  await user.click(screen.getByRole("button", { name: "使用其他账号登录" }));
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  expect(screen.getByPlaceholderText("请输入用户名")).toHaveValue("");
  expect(screen.getByPlaceholderText("请输入密码")).toHaveValue("");
  expect(screen.getByPlaceholderText("请输入用户名")).toHaveFocus();
});

it("keeps invalid passwords distinct from disabled accounts", async () => {
  vi.mocked(login).mockRejectedValue(new AccountError("用户名或密码错误", 401));
  const user = userEvent.setup();
  render(<LoginPage />);
  await user.type(screen.getByPlaceholderText("请输入用户名"), "test1");
  await user.type(screen.getByPlaceholderText("请输入密码"), "wrong");
  await user.click(screen.getByRole("button", { name: "进入我的学习空间" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("用户名或密码错误");
  expect(screen.queryByText("账号已暂停使用")).not.toBeInTheDocument();
});
