"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
type Settings = { platform_key_configured: boolean; platform_key_enabled: boolean; allow_personal_keys: boolean; platform_key_masked?: string };
export default function AISettings() {
  const router = useRouter();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [key, setKey] = useState("");
  const [message, setMessage] = useState("");
  async function refresh() {
    const response = await fetch("/api/ai-settings/platform", { credentials: "include" });
    if (!response.ok) { router.replace("/"); return; }
    setSettings(await response.json());
  }
  useEffect(() => { void refresh(); }, []);
  async function update(method: "PUT" | "DELETE") {
    const response = await fetch("/api/ai-settings/platform", {
      method, credentials: "include", headers: { "Content-Type": "application/json" },
      body: method === "PUT" ? JSON.stringify({ api_key: key || undefined, enabled: settings?.platform_key_enabled, allow_personal_keys: settings?.allow_personal_keys }) : undefined,
    });
    if (!response.ok) { setMessage("保存失败，请重试"); return; }
    setKey(""); setMessage("已保存"); await refresh();
  }
  return <main className="mx-auto max-w-xl space-y-5 p-6">
    <button onClick={() => router.push("/")} className="text-sm text-brand">← 返回首页</button>
    <h1 className="text-2xl font-bold">平台 AI 设置</h1>
    <p className="text-sm text-muted-foreground">平台 Key 优先；停用平台 Key 后可允许用户配置个人 Key。完整密钥不会在此显示。</p>
    <div className="space-y-4 rounded-2xl border bg-card p-5">
      <input type="password" autoComplete="off" value={key} onChange={e => setKey(e.target.value)} placeholder={settings?.platform_key_masked || "DeepSeek API Key"} className="w-full rounded-lg border p-3" />
      <label className="flex gap-2"><input type="checkbox" checked={!!settings?.platform_key_enabled} onChange={e => setSettings(s => s && { ...s, platform_key_enabled: e.target.checked })} />启用平台 Key</label>
      <label className="flex gap-2"><input type="checkbox" checked={!!settings?.allow_personal_keys} onChange={e => setSettings(s => s && { ...s, allow_personal_keys: e.target.checked })} />允许个人 Key</label>
      <button onClick={() => void update("PUT")} className="rounded-lg bg-brand px-4 py-2 text-brand-foreground">保存设置</button>
      {settings?.platform_key_configured && <button onClick={() => void update("DELETE")} className="ml-3 text-sm text-destructive">删除平台 Key</button>}
    </div>{message && <p role="status" className="text-sm">{message}</p>}
  </main>;
}
