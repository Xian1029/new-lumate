"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, ShieldCheck, Sparkles } from "lucide-react";

type Provider = { id: string; label: string; default_model: string };
type Settings = { platform_key_configured: boolean; platform_key_enabled: boolean; allow_personal_keys: boolean; ai_key_mode: "auto" | "platform" | "personal"; personal_key_configured: boolean; personal_key_masked?: string | null; personal_provider?: string; personal_model?: string | null; effective_provider?: string; effective_key_available: boolean; effective_key_source?: string | null; supported_providers: Provider[] };

export default function PersonalAIPage() {
  const router = useRouter();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [key, setKey] = useState("");
  const [provider, setProvider] = useState("deepseek");
  const [model, setModel] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [editing, setEditing] = useState(false);
  const ready = !!settings?.effective_key_available;

  async function refresh() {
    const response = await fetch("/api/ai-settings/me", { credentials: "include" });
    if (!response.ok) { router.replace("/login"); return; }
    const next = await response.json();
    setSettings(next); setProvider(next.personal_provider || "deepseek"); setModel(next.personal_model || "");
  }
  useEffect(() => { void refresh(); }, []);

  async function save() {
    setSaving(true); setMessage("");
    try {
      const payload = { api_key: key.trim(), provider, model: model.trim() || undefined };
      const testResponse = await fetch("/api/ai-settings/me/test", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const testResult = await testResponse.json().catch(() => null);
      if (!testResponse.ok || !testResult?.ok) { setMessage(testResult?.message || testResult?.detail || "Key 验证失败，请检查后重试"); return; }
      const response = await fetch("/api/ai-settings/me", { method: "PUT", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (!response.ok) { const error = await response.json().catch(() => null); setMessage(error?.detail || "保存失败，请重试"); return; }
      setKey(""); await refresh(); setEditing(false);
    } finally { setSaving(false); }
  }

  async function testSaved() {
    setTesting(true); setMessage("");
    try {
      const response = await fetch("/api/ai-settings/me/test-saved", { method: "POST", credentials: "include" });
      const result = await response.json().catch(() => null);
      setMessage(response.ok && result?.ok ? "AI 服务连接成功，可以正常使用。" : result?.message || result?.detail || "AI 服务连接失败，请更新 Key 后重试");
    } finally { setTesting(false); }
  }

  const selected = settings?.supported_providers.find((item) => item.id === provider);
  return <main className="grid min-h-screen place-items-center bg-background px-5 py-10"><section className="w-full max-w-lg overflow-hidden rounded-3xl border border-border bg-card shadow-xl shadow-foreground/5">
    <div className="bg-gradient-to-br from-brand-muted via-background to-amber-50 px-7 py-8"><span className="grid size-12 place-items-center rounded-2xl bg-brand text-brand-foreground"><Sparkles className="size-6" /></span><p className="mt-5 text-xs font-semibold tracking-widest text-brand">LUMATE · AI 服务</p><h1 className="mt-2 text-2xl font-bold text-foreground">{ready ? "AI 服务设置" : "开始学习前，先连接 AI 服务"}</h1><p className="mt-2 text-sm leading-6 text-muted-foreground">{ready ? "AI 服务已准备就绪，可以进入学习首页。" : "完成配置后，AI 笔记、学习计划与智能辅导才能正常使用。"}</p></div>
    <div className="space-y-5 px-7 py-7">{!settings ? <p className="text-sm text-muted-foreground">正在检查配置…</p> : ready && !editing ? <><div className="flex items-center gap-3 rounded-xl bg-brand-muted p-4 text-sm text-brand"><ShieldCheck className="size-5" />{settings.effective_key_source === "platform" ? `正在使用平台 AI 服务（${settings.effective_provider || "deepseek"}）` : `个人 ${settings.personal_provider || "deepseek"} Key 已配置 ${settings.personal_key_masked || ""}`}</div>{settings.allow_personal_keys && settings.effective_key_source !== "platform" && <button type="button" onClick={() => { setEditing(true); setMessage(""); }} className="text-sm font-semibold text-brand hover:underline">更换模型或 API Key</button>}</> : settings.allow_personal_keys ? <><label className="block text-sm font-semibold">AI 服务商</label><select value={provider} onChange={(event) => { const value = event.target.value; setProvider(settings.supported_providers.find((item) => item.id === value)?.id || "deepseek"); setModel(settings.supported_providers.find((item) => item.id === value)?.default_model || ""); }} className="h-12 w-full rounded-xl border border-border bg-background px-3 text-sm">{settings.supported_providers.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select><label className="block text-sm font-semibold">模型（可更换）</label><input value={model} onChange={(event) => setModel(event.target.value)} placeholder={selected?.default_model || "输入模型名称"} className="h-12 w-full rounded-xl border border-border bg-background px-3 text-sm" /><label className="block text-sm font-semibold">你的 API Key</label><div data-focus-shell className="flex items-center gap-3 rounded-xl border border-border px-3 transition focus-within:border-brand focus-within:ring-4 focus-within:ring-brand/10"><KeyRound className="size-4 shrink-0 text-muted-foreground" /><input type="password" autoComplete="off" value={key} onChange={(event) => setKey(event.target.value)} placeholder="输入所选服务商的 API Key" className="h-12 min-w-0 flex-1 rounded-none border-0 bg-transparent text-sm shadow-none outline-none" /></div><p className="text-xs leading-5 text-muted-foreground">保存前会由服务端验证 Key；完整内容不会返回页面或写入浏览器存储。</p><button disabled={saving || key.trim().length < 8} onClick={() => void save()} className="w-full rounded-xl bg-brand py-3 text-sm font-semibold text-brand-foreground disabled:opacity-50">{saving ? "正在验证并保存…" : "验证并保存"}</button></> : <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900">{settings.ai_key_mode === "platform" ? "当前账号被指定使用平台 AI 服务，但平台 Key 尚未启用。请联系管理员完成设置。" : "当前账号没有可用的 AI 服务。请联系管理员为此账号选择平台服务或开放个人 Key。"}</p>}
      {ready && !editing && <div className="grid gap-3 sm:grid-cols-2"><button disabled={testing} onClick={() => void testSaved()} className="rounded-xl border border-brand/30 py-3 text-sm font-semibold text-brand disabled:opacity-60">{testing ? "正在测试…" : "测试当前配置"}</button><button onClick={() => router.replace("/")} className="rounded-xl bg-brand py-3 text-sm font-semibold text-brand-foreground">进入学习首页</button></div>}
      {message && <p role="alert" className="text-sm text-destructive">{message}</p>}
    </div>
  </section></main>;
}
