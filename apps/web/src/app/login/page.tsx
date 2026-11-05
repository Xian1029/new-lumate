"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { BookOpen, BrainCircuit, CirclePause, Eye, EyeOff, Loader2, LockKeyhole, Sparkles, Target, UserRound } from "lucide-react";
import { AccountError, login } from "@/lib/account";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [accountDisabled, setAccountDisabled] = useState(false);
  const usernameInput = useRef<HTMLInputElement>(null);

  const clearFeedback = () => {
    setError("");
    setAccountDisabled(false);
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    clearFeedback();
    setSubmitting(true);
    try {
      const user = await login(username, password);
      if (user.must_change_password) {
        router.replace("/change-password");
        return;
      }
      const settings = await fetch("/api/ai-settings/me", { credentials: "include" })
        .then((response) => response.ok ? response.json() : null)
        .catch(() => null);
      const needsAISetup = user.role === "student" && settings && !settings.effective_key_available;
      router.replace(needsAISetup ? "/settings/ai?welcome=1" : "/");
    } catch (reason) {
      if (reason instanceof AccountError && reason.code === "account_disabled") {
        setAccountDisabled(true);
      } else {
        setError(reason instanceof Error ? reason.message : "登录失败，请稍后重试");
      }
      setSubmitting(false);
    }
  };

  return (
    <main className="relative grid min-h-screen place-items-center overflow-hidden bg-[#f5f3ed] p-3 sm:p-6 lg:p-8">
      <div className="pointer-events-none absolute -left-24 -top-28 h-80 w-80 rounded-full bg-[#b9d8c5]/40 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 -right-24 h-96 w-96 rounded-full bg-[#f2c980]/30 blur-3xl" />

      <section className="relative mx-auto grid w-full max-w-[520px] overflow-hidden rounded-[1.75rem] border border-white/80 bg-white shadow-[0_24px_70px_rgba(43,61,52,0.12)] lg:min-h-[680px] lg:max-w-6xl lg:grid-cols-[1.08fr_0.92fr] lg:rounded-[2rem]">
        <div className="relative hidden overflow-hidden bg-[#233a32] p-12 text-white lg:flex lg:flex-col lg:justify-between">
          <div className="absolute inset-0 opacity-20" style={{ backgroundImage: "radial-gradient(circle at 1px 1px, #ffffff 1px, transparent 0)", backgroundSize: "28px 28px" }} />
          <div className="absolute -right-24 top-28 h-72 w-72 rounded-full border border-white/20" />
          <div className="absolute -right-10 top-44 h-48 w-48 rounded-full border border-white/10" />
          <div className="relative flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-white/12 ring-1 ring-white/20"><Sparkles className="h-5 w-5 text-[#f3cf88]" /></span>
            <div><p className="text-xl font-semibold tracking-wide">Lumate</p><p className="text-xs text-white/55">AI 学习伙伴</p></div>
          </div>
          <div className="relative max-w-lg space-y-7">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm text-white/75 ring-1 ring-white/10">
              <BrainCircuit className="h-4 w-4 text-[#f3cf88]" />让每一次学习都有方向
            </div>
            <div className="space-y-4">
              <h1 className="text-5xl font-semibold leading-[1.18] tracking-tight">把好奇心，<br />变成真正的进步。</h1>
              <p className="max-w-md text-base leading-7 text-white/65">从教材理解、知识梳理到练习复盘，Lumate 陪你找到适合自己的学习节奏。</p>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {[{ icon: BookOpen, label: "理解教材" }, { icon: Target, label: "聚焦目标" }, { icon: BrainCircuit, label: "智能复习" }].map(({ icon: Icon, label }) => (
                <div key={label} className="rounded-2xl bg-white/[0.07] p-4 ring-1 ring-white/10 backdrop-blur-sm">
                  <Icon className="mb-3 h-5 w-5 text-[#f3cf88]" /><p className="text-sm text-white/80">{label}</p>
                </div>
              ))}
            </div>
          </div>
          <p className="relative text-xs text-white/35">专注当下 · 保持好奇 · 稳步成长</p>
        </div>

        <div className="flex items-center justify-center px-6 py-8 sm:px-12 sm:py-10 lg:px-16">
          <div className="w-full max-w-sm">
            <div className="mb-8 flex items-center gap-3 lg:hidden">
              <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#233a32] text-[#f3cf88]"><Sparkles className="h-5 w-5" /></span>
              <div><p className="text-xl font-semibold text-[#233a32]">Lumate</p><p className="text-xs text-muted-foreground">AI 学习伙伴</p></div>
            </div>
            <div className="mb-7 space-y-2">
              <p className="text-sm font-medium text-[#71897d]">欢迎回来</p>
              <h2 className="text-3xl font-bold tracking-tight text-[#202b27]">继续今天的学习</h2>
              <p className="text-sm text-muted-foreground">登录后查看你的学习空间和今日任务。</p>
            </div>
            <form onSubmit={submit} className="space-y-5">
              <label className="block space-y-2">
                <span className="text-sm font-medium text-[#34443d]">用户名</span>
                <div data-focus-shell className="flex h-13 items-center rounded-xl border border-[#deddd7] bg-[#fbfaf7] px-4 transition focus-within:border-[#789081] focus-within:bg-white focus-within:ring-4 focus-within:ring-[#789081]/10">
                  <UserRound className="mr-3 h-4.5 w-4.5 shrink-0 text-[#8d9993]" />
                  <input ref={usernameInput} required autoComplete="username" value={username} onChange={(event) => { setUsername(event.target.value); clearFeedback(); }} placeholder="请输入用户名" style={{ outline: "none" }} className="h-full min-w-0 flex-1 rounded-none border-0 bg-transparent text-sm shadow-none !outline-none focus-visible:!outline-none placeholder:text-[#a8aaa7]" />
                </div>
              </label>
              <label className="block space-y-2">
                <span className="text-sm font-medium text-[#34443d]">密码</span>
                <div data-focus-shell className="flex h-13 items-center rounded-xl border border-[#deddd7] bg-[#fbfaf7] px-4 transition focus-within:border-[#789081] focus-within:bg-white focus-within:ring-4 focus-within:ring-[#789081]/10">
                  <LockKeyhole className="mr-3 h-4.5 w-4.5 shrink-0 text-[#8d9993]" />
                  <input required autoComplete="current-password" type={showPassword ? "text" : "password"} value={password} onChange={(event) => { setPassword(event.target.value); clearFeedback(); }} placeholder="请输入密码" style={{ outline: "none" }} className="h-full min-w-0 flex-1 rounded-none border-0 bg-transparent text-sm shadow-none !outline-none focus-visible:!outline-none placeholder:text-[#a8aaa7]" />
                  <button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "隐藏密码" : "显示密码"} className="rounded-lg p-1.5 text-[#8d9993] transition hover:bg-[#eef1ed] hover:text-[#53695e]">
                    {showPassword ? <EyeOff className="h-4.5 w-4.5" /> : <Eye className="h-4.5 w-4.5" />}
                  </button>
                </div>
              </label>
              {accountDisabled && (
                <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-4 text-amber-950">
                  <div className="flex items-start gap-3">
                    <CirclePause aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
                    <div className="space-y-2">
                      <p className="text-sm font-semibold">账号已暂停使用</p>
                      <p className="text-sm leading-6">你的学习数据仍然保留。请联系管理员，在「成员管理」中恢复账号后重新登录。</p>
                      <button type="button" className="rounded text-sm font-semibold underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4" onClick={() => { setUsername(""); setPassword(""); clearFeedback(); usernameInput.current?.focus(); }}>使用其他账号登录</button>
                    </div>
                  </div>
                </div>
              )}
              {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>}
              <button disabled={submitting} className="flex h-13 w-full items-center justify-center gap-2 rounded-xl bg-[#2c473d] font-semibold text-white shadow-[0_10px_24px_rgba(44,71,61,0.20)] transition hover:-translate-y-0.5 hover:bg-[#36564a] hover:shadow-[0_14px_30px_rgba(44,71,61,0.25)] disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:translate-y-0">
                {submitting ? <><Loader2 className="h-4 w-4 animate-spin" />正在登录...</> : "进入我的学习空间"}
              </button>
            </form>
            <div className="mt-7 flex items-center justify-center gap-2 text-xs text-muted-foreground">
              <LockKeyhole className="h-3.5 w-3.5" /><span>账号由管理员统一创建，学习数据安全隔离</span>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
