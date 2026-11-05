"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { changePassword, getMe } from "@/lib/account";

export default function ChangePasswordPage() {
  const router = useRouter();
  const [firstChange, setFirstChange] = useState<boolean | null>(null);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void getMe().then((user) => setFirstChange(user.must_change_password)).catch(() => router.replace("/login"));
  }, [router]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    if (next !== confirm) { setError("两次输入的新密码不一致"); return; }
    setSaving(true);
    try {
      await changePassword(firstChange ? "" : current, next);
      router.replace("/");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "修改失败，请稍后重试");
      setSaving(false);
    }
  };

  return <main className="grid min-h-screen place-items-center bg-background p-5">
    <form onSubmit={submit} className="w-full max-w-sm space-y-4 rounded-2xl border bg-card p-7 shadow-sm">
      <h1 className="text-2xl font-bold">{firstChange ? "设置新密码" : "修改密码"}</h1>
      <p className="text-sm text-muted-foreground">{firstChange === null ? "正在检查账号状态…" : firstChange ? "首次登录或密码重置后，请设置自己的新密码。" : "为保护账号安全，请先填写当前密码。"}</p>
      {firstChange === false && <input required type="password" autoComplete="current-password" placeholder="当前密码" value={current} onChange={(event) => setCurrent(event.target.value)} className="w-full rounded-lg border bg-background p-3" />}
      <input required minLength={8} maxLength={128} type="password" autoComplete="new-password" placeholder="新密码（至少 8 位）" value={next} onChange={(event) => setNext(event.target.value)} className="w-full rounded-lg border bg-background p-3" />
      <input required minLength={8} maxLength={128} type="password" autoComplete="new-password" placeholder="再次输入新密码" value={confirm} onChange={(event) => setConfirm(event.target.value)} className="w-full rounded-lg border bg-background p-3" />
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <button disabled={firstChange === null || saving} className="w-full rounded-lg bg-brand p-3 font-semibold text-brand-foreground disabled:opacity-50">{saving ? "正在保存…" : "保存新密码"}</button>
    </form>
  </main>;
}
