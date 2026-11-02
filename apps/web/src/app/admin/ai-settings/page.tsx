"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
type Provider = { id: string; label: string; default_model: string };
type Settings = { platform_key_configured: boolean; platform_key_enabled: boolean; allow_personal_keys: boolean; platform_key_masked?: string; platform_provider?: string; platform_model?: string | null; supported_providers: Provider[] };
export default function AISettings() {
  const router = useRouter();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [key, setKey] = useState("");
  const [message, setMessage] = useState("");
  const [testing, setTesting] = useState(false);
  const [provider, setProvider] = useState("deepseek");
  const [model, setModel] = useState("");
  async function refresh() {
    const response = await fetch("/api/ai-settings/platform", { credentials: "include" });
    if (!response.ok) { router.replace("/"); return; }
    const next = await response.json(); setSettings(next); setProvider(next.platform_provider || "deepseek"); setModel(next.platform_model || "");
  }
  useEffect(() => { void refresh(); }, []);
  async function update(method: "PUT" | "DELETE") {
    const response = await fetch("/api/ai-settings/platform", {
      method, credentials: "include", headers: { "Content-Type": "application/json" },
      body: method === "PUT" ? JSON.stringify({ api_key: key || undefined, provider, model: model.trim(), enabled: settings?.platform_key_enabled, allow_personal_keys: settings?.allow_personal_keys }) : undefined,
    });
    if (!response.ok) { setMessage("保存失败，请重试"); return; }
    setKey(""); setMessage("已保存"); await refresh();
  }
  async function testKey() {
    setTesting(true); setMessage("");
    try {
      const path = key.trim() ? "/api/ai-settings/platform/test" : "/api/ai-settings/platform/test-saved";
      const response = await fetch(path, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: key.trim() ? JSON.stringify({ api_key: key.trim(), provider, model: model.trim() || undefined }) : undefined });
      const result = await response.json().catch(() => null);
      setMessage(response.ok && result?.ok ? "AI 服务连接成功，可以正常使用。" : result?.message || result?.detail || "连接失败，请检查 Key 后重试");
    } finally { setTesting(false); }
  }
  return <main className="mx-auto max-w-xl space-y-5 p-6">
    <button onClick={() => router.push("/")} className="text-sm text-brand">← 返回首页</button>
    <h1 className="text-2xl font-bold">平台 AI 设置</h1>
    <p className="text-sm text-muted-foreground">平台 Key 优先；停用平台 Key 后可允许用户配置个人 Key。完整密钥不会在此显示。</p>
    <div className="space-y-4 rounded-2xl border bg-card p-5">
      <select value={provider} onChange={e => { setProvider(e.target.value); setModel(settings?.supported_providers.find(item => item.id === e.target.value)?.default_model || ""); }} className="w-full rounded-lg border bg-background p-3">{settings?.supported_providers?.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select>
      <input value={model} onChange={e => setModel(e.target.value)} placeholder={settings?.supported_providers?.find(item => item.id === provider)?.default_model || "模型名称"} className="w-full rounded-lg border p-3" />
      <input type="password" autoComplete="off" value={key} onChange={e => setKey(e.target.value)} placeholder={settings?.platform_key_masked || "所选服务商 API Key"} className="w-full rounded-lg border p-3" />
      <label className="flex gap-2"><input type="checkbox" checked={!!settings?.platform_key_enabled} onChange={e => setSettings(s => s && { ...s, platform_key_enabled: e.target.checked })} />启用平台 Key</label>
      <label className="flex gap-2"><input type="checkbox" checked={!!settings?.allow_personal_keys} onChange={e => setSettings(s => s && { ...s, allow_personal_keys: e.target.checked })} />允许个人 Key</label>
      <div className="flex flex-wrap gap-2"><button disabled={testing || (!key.trim() && !settings?.platform_key_configured)} onClick={() => void testKey()} className="rounded-lg border border-brand/30 px-4 py-2 text-sm font-semibold text-brand disabled:opacity-50">{testing ? "正在测试…" : "测试当前模型"}</button><button onClick={() => void update("PUT")} className="rounded-lg bg-brand px-4 py-2 text-brand-foreground">保存设置</button></div>
      {settings?.platform_key_configured && <button onClick={() => void update("DELETE")} className="ml-3 text-sm text-destructive">删除平台 Key</button>}
    </div>{message && <p role="status" className="text-sm">{message}</p>}
  </main>;
}
