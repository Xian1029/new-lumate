"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, ShieldCheck, Sparkles } from "lucide-react";
type Settings = { platform_key_configured: boolean; platform_key_enabled: boolean; allow_personal_keys: boolean; personal_key_configured: boolean; personal_key_masked?: string | null };
export default function PersonalAIPage() {
  const router = useRouter();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [key, setKey] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const ready = !!settings && ((settings.platform_key_configured && settings.platform_key_enabled) || settings.personal_key_configured);
  async function refresh() {
    const response = await fetch("/api/ai-settings/me", { credentials: "include" });
    if (!response.ok) { router.replace("/login"); return; }
    setSettings(await response.json());
  }
  useEffect(() => { void refresh(); }, []);
  async function save() {
    setSaving(true); setMessage("");
    try {
      const response = await fetch("/api/ai-settings/me", { method: "PUT", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ api_key: key.trim() }) });
      if (!response.ok) { const error = await response.json().catch(() => null); setMessage(error?.detail || "保存失败，请重试"); return; }
      setKey(""); await refresh(); router.replace("/");
    } finally { setSaving(false); }
  }
  return <main className="grid min-h-screen place-items-center bg-background px-5 py-10"><section className="w-full max-w-lg overflow-hidden rounded-3xl border border-border bg-card shadow-xl shadow-foreground/5">
    <div className="bg-gradient-to-br from-brand-muted via-background to-amber-50 px-7 py-8"><span className="grid size-12 place-items-center rounded-2xl bg-brand text-brand-foreground"><Sparkles className="size-6" /></span><p className="mt-5 text-xs font-semibold tracking-widest text-brand">LUMATE · AI 服务</p><h1 className="mt-2 text-2xl font-bold text-foreground">{ready ? "AI 服务设置" : "开始学习前，先连接 AI 服务"}</h1><p className="mt-2 text-sm leading-6 text-muted-foreground">{ready ? "AI 服务已准备就绪，可以进入学习首页。" : "当前账号尚未配置可用的 AI Key。完成配置后才能进入首页，AI 笔记、学习计划与智能辅导才能正常使用。"}</p></div>
    <div className="space-y-5 px-7 py-7">{!settings ? <p className="text-sm text-muted-foreground">正在检查配置…</p> : ready ? <div className="flex items-center gap-3 rounded-xl bg-brand-muted p-4 text-sm text-brand"><ShieldCheck className="size-5" />{settings.platform_key_configured && settings.platform_key_enabled ? "正在使用平台 AI 服务" : `个人 Key 已配置 ${settings.personal_key_masked || ""}`}</div> : settings.allow_personal_keys ? <><label className="block text-sm font-semibold">你的 DeepSeek API Key</label><div className="flex items-center gap-3 rounded-xl border border-border px-3 focus-within:ring-2 focus-within:ring-brand/30"><KeyRound className="size-4 text-muted-foreground"/><input type="password" autoComplete="off" value={key} onChange={e => setKey(e.target.value)} placeholder="输入 DeepSeek API Key" className="h-12 min-w-0 flex-1 bg-transparent text-sm outline-none" /></div><p className="text-xs leading-5 text-muted-foreground">Key 仅在服务端加密保存，不会在页面再次显示完整内容。</p><button disabled={saving || key.trim().length < 8} onClick={() => void save()} className="w-full rounded-xl bg-brand py-3 text-sm font-semibold text-brand-foreground disabled:opacity-50">{saving ? "正在保存…" : "保存并进入首页"}</button></> : <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900">管理员尚未启用平台 AI 服务，且未开放个人 Key 配置。请联系管理员完成设置。</p>}
      {ready && <button onClick={() => router.replace("/")} className="w-full rounded-xl bg-brand py-3 text-sm font-semibold text-brand-foreground">进入学习首页</button>}
      {message && <p role="alert" className="text-sm text-destructive">{message}</p>}
    </div></section></main>;
}
