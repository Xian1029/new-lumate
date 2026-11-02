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
  async function refresh() {
    const response = await fetch("/api/auth/admin/users", { credentials: "include" });
    if (!response.ok) { router.replace("/"); return; }
    setAccounts(await response.json());
  }
  useEffect(() => { void refresh(); }, []);
  async function update(path: string, method: string, body?: object) {
    const response = await fetch(path, { method, credentials: "include", headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
    if (!response.ok) { const error = await response.json().catch(() => null); setMessage(error?.detail || "操作失败"); return false; }
    setMessage("操作成功"); await refresh(); return true;
  }
  return <main className="mx-auto max-w-2xl space-y-5 p-6">
    <button onClick={() => router.push("/")} className="text-sm text-brand">← 返回首页</button>
    <h1 className="text-2xl font-bold">成员管理</h1>
    <p className="text-sm text-muted-foreground">停用账号可保留学习数据并随时恢复。仅无学习数据的账号可永久删除。</p>
    <section className="space-y-4 rounded-2xl border bg-card p-5"><h2 className="font-semibold">创建普通账号</h2>
      <div className="grid gap-2 sm:grid-cols-3"><input placeholder="用户名" value={username} onChange={e => setUsername(e.target.value)} className="rounded-lg border p-2"/><input placeholder="昵称" value={name} onChange={e => setName(e.target.value)} className="rounded-lg border p-2"/><input type="password" placeholder="初始密码（至少 8 位）" value={password} onChange={e => setPassword(e.target.value)} className="rounded-lg border p-2"/></div>
      <button disabled={username.length < 3 || password.length < 8} onClick={() => void update("/api/auth/admin/users", "POST", { username, name, password }).then(ok => { if (ok) { setUsername(""); setName(""); setPassword(""); } })} className="rounded-lg bg-brand px-4 py-2 text-brand-foreground disabled:opacity-50">创建账号</button>
    </section>
    <section className="divide-y rounded-2xl border bg-card px-5">{accounts.map(account => <div key={account.id} className="flex flex-wrap items-center gap-3 py-4 text-sm"><span className="flex-1">{account.name} · {account.username}（{account.is_active ? "正常" : "已停用"}）</span><button className="text-brand" onClick={() => void update(`/api/auth/admin/users/${account.id}`, "PATCH", { is_active: !account.is_active })}>{account.is_active ? "停用" : "恢复"}</button><button className="text-destructive" onClick={() => { if (window.confirm(`永久删除账号 ${account.username}？此操作不可撤销。`)) void update(`/api/auth/admin/users/${account.id}`, "DELETE"); }}>永久删除</button></div>)}</section>
    {message && <p role="status" className="text-sm text-brand">{message}</p>}
  </main>;
}
