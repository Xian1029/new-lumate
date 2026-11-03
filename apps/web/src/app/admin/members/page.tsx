"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
type Account = { id: string; username: string; name: string; is_active: boolean };
export default function MembersPage() {
  const router = useRouter();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [username, setUsername] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [resetId, setResetId] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");
  async function refresh() {
    const response = await fetch("/api/auth/admin/users", { credentials: "include" });
    if (!response.ok) { router.replace("/"); return; }
    setAccounts(await response.json());
  }
  useEffect(() => { void refresh(); }, []);
  async function update(path: string, method: string, body?: object, successMessage = "操作已完成") {
    const response = await fetch(path, { method, credentials: "include", headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
    if (!response.ok) { const error = await response.json().catch(() => null); setMessage(error?.detail || "操作失败"); return false; }
    setMessage(successMessage); await refresh(); return true;
  }
  return <main className="mx-auto max-w-2xl space-y-5 p-6">
    <button onClick={() => router.push("/")} className="text-sm text-brand">← 返回首页</button>
    <h1 className="text-2xl font-bold">成员管理</h1>
    <p className="text-sm text-muted-foreground">停用账号可保留学习数据并随时恢复。仅无学习数据的账号可永久删除。</p>
    <section className="space-y-4 rounded-2xl border bg-card p-5"><h2 className="font-semibold">创建普通账号</h2>
      <div className="grid gap-2 sm:grid-cols-3"><input placeholder="用户名" value={username} onChange={e => setUsername(e.target.value)} className="rounded-lg border p-2"/><input placeholder="昵称" value={name} onChange={e => setName(e.target.value)} className="rounded-lg border p-2"/><input type="password" placeholder="初始密码（至少 8 位）" value={password} onChange={e => setPassword(e.target.value)} className="rounded-lg border p-2"/></div>
      <button disabled={username.length < 3 || password.length < 8} onClick={() => void update("/api/auth/admin/users", "POST", { username, name, password }).then(ok => { if (ok) { setUsername(""); setName(""); setPassword(""); } })} className="rounded-lg bg-brand px-4 py-2 text-brand-foreground disabled:opacity-50">创建账号</button>
    </section>
    <section className="divide-y rounded-2xl border bg-card px-5">{accounts.map(account => <div key={account.id} className="py-4 text-sm"><div className="flex flex-wrap items-center gap-3"><span className="min-w-0 flex-1 font-medium">{account.name} <span className="text-muted-foreground">· {account.username}</span> <span className={`ml-1 rounded-full px-2 py-0.5 text-xs ${account.is_active ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>{account.is_active ? "使用中" : "已停用"}</span></span><button className="rounded-lg border px-2.5 py-1.5 text-brand hover:bg-muted" onClick={() => { setResetId(resetId === account.id ? null : account.id); setNewPassword(""); }}>重置密码</button><button className="rounded-lg border px-2.5 py-1.5 text-brand hover:bg-muted" onClick={() => void update(`/api/auth/admin/users/${account.id}`, "PATCH", { is_active: !account.is_active }, account.is_active ? `已停用 ${account.username}，学习数据已保留。管理员可随时恢复。` : `已恢复 ${account.username}，现在可以登录。`)}>{account.is_active ? "停用" : "恢复"}</button><button className="rounded-lg px-2.5 py-1.5 text-destructive hover:bg-destructive/10" onClick={() => { if (window.confirm(`永久删除账号 ${account.username}？此操作不可撤销。`)) void update(`/api/auth/admin/users/${account.id}`, "DELETE", undefined, `已删除 ${account.username}`); }}>永久删除</button></div>{resetId === account.id && <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl bg-muted/60 p-3"><input type="password" autoComplete="new-password" placeholder="输入新密码（至少 8 位）" value={newPassword} onChange={e => setNewPassword(e.target.value)} className="min-w-48 flex-1 rounded-lg border bg-background px-3 py-2 outline-none focus:border-brand"/><button disabled={newPassword.length < 8} className="rounded-lg bg-brand px-3 py-2 text-brand-foreground disabled:opacity-50" onClick={() => void update(`/api/auth/admin/users/${account.id}/reset-password`, "POST", { password: newPassword }, `已为 ${account.username} 重置密码，原登录已失效。`).then(ok => { if (ok) { setResetId(null); setNewPassword(""); } })}>确认重置</button><button onClick={() => { setResetId(null); setNewPassword(""); }} className="rounded-lg px-3 py-2 text-muted-foreground">取消</button><p className="w-full text-xs text-muted-foreground">重置后，该账号需要使用新密码重新登录。</p></div>}</div>)}</section>
    {message && <p role="status" className="rounded-xl border border-brand/20 bg-brand/5 px-4 py-3 text-sm text-brand">{message}</p>}
  </main>;
}
