"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowRight, CheckCircle2, KeyRound, Sparkles } from "lucide-react";
import { useT } from "@/lib/i18n-context";
import {
  getHealthStatus,
  getLlmRuntimeConfig,
  type HealthStatus,
  type LlmRuntimeConfig,
} from "@/lib/api";
import type { ProviderName } from "./sections/types";
import {
  RuntimeStatusSection,
  ProviderConnectionsSection,
  AppearanceSection,
  NotificationsSection,
  TemplatesSection,
} from "./sections";
import { RuntimeAlert } from "@/components/shared/runtime-alert";
import { getMe, type CurrentUser } from "@/lib/account";

type AccountAISettings = {
  effective_key_available: boolean;
  effective_key_source: "platform" | "personal" | null;
  effective_provider?: string | null;
};

export default function SettingsPage() {
  const router = useRouter();
  const t = useT();

  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [healthLoading, setHealthLoading] = useState(false);
  const [runtimeConfig, setRuntimeConfig] = useState<LlmRuntimeConfig | null>(null);
  const [runtimeLoading, setRuntimeLoading] = useState(false);
  const [savingRuntime, setSavingRuntime] = useState(false);
  const [provider, setProvider] = useState<ProviderName>("ollama");
  const [model, setModel] = useState("llama3.2:3b");
  const [llmRequired, setLlmRequired] = useState(false);
  const [account, setAccount] = useState<CurrentUser | null>(null);
  const [accountAI, setAccountAI] = useState<AccountAISettings | null>(null);
  const healthErrorShown = useRef(false);
  const runtimeErrorShown = useRef(false);

  const loadHealth = useCallback(async () => {
    setHealthLoading(true);
    try {
      setHealth(await getHealthStatus());
      healthErrorShown.current = false;
    } catch (error) {
      setHealth(null);
      if (!healthErrorShown.current) {
        toast.error(error instanceof Error ? error.message : t("settings.runtimeUnavailable"));
        healthErrorShown.current = true;
      }
    } finally {
      setHealthLoading(false);
    }
  }, [t]);

  const loadRuntimeConfig = useCallback(async () => {
    setRuntimeLoading(true);
    try {
      const config = await getLlmRuntimeConfig();
      setRuntimeConfig(config);
      setProvider((config.provider as ProviderName) || "ollama");
      setModel(config.model || "llama3.2:3b");
      setLlmRequired(config.llm_required);
      runtimeErrorShown.current = false;
    } catch (error) {
      setRuntimeConfig(null);
      if (!runtimeErrorShown.current) {
        toast.error(error instanceof Error ? error.message : t("settings.runtimeUnavailable"));
        runtimeErrorShown.current = true;
      }
    } finally {
      setRuntimeLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void loadHealth();
    void getMe().then(setAccount).catch(() => null);
    void fetch("/api/ai-settings/me", { credentials: "include" })
      .then((response) => response.ok ? response.json() : null)
      .then(setAccountAI)
      .catch(() => null);
    const id = setInterval(() => void loadHealth(), 30_000);
    return () => clearInterval(id);
  }, [loadHealth, loadRuntimeConfig]);

  useEffect(() => {
    if (health?.deployment_mode === "single_user") void loadRuntimeConfig();
  }, [health?.deployment_mode, loadRuntimeConfig]);

  function handleRuntimeSaved(config: LlmRuntimeConfig): void {
    setRuntimeConfig(config);
  }

  const accountAIReady = Boolean(accountAI?.effective_key_available);
  const singleUserMode = health?.deployment_mode === "single_user";

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/60 px-6 py-4 flex items-center gap-3 glass sticky top-0 z-10">
        <button
          type="button"
          onClick={() => router.push("/")}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          aria-label={t("settings.back")}
        >
          &larr; {t("settings.back")}
        </button>
        <h1 className="text-lg font-bold text-foreground">
          {t("nav.settings")}
        </h1>
      </header>

      <div className="max-w-4xl mx-auto p-6 md:p-10 space-y-8">
        {singleUserMode ? <><RuntimeAlert health={health} /><RuntimeStatusSection
          health={health}
          healthLoading={healthLoading}
          onRefresh={() => void loadHealth()}
        /><ProviderConnectionsSection
          runtimeConfig={runtimeConfig}
          runtimeLoading={runtimeLoading}
          provider={provider}
          model={model}
          llmRequired={llmRequired}
          savingRuntime={savingRuntime}
          onProviderChange={setProvider}
          onModelChange={setModel}
          onLlmRequiredToggle={() => setLlmRequired((value) => !value)}
          onRuntimeSaved={handleRuntimeSaved}
          onRefreshConfig={() => void loadRuntimeConfig()}
          onRefreshHealth={() => void loadHealth()}
          setSavingRuntime={setSavingRuntime}
        /></> : <section className="overflow-hidden rounded-3xl border border-border/70 bg-card shadow-sm">
          <div className="bg-gradient-to-br from-brand-muted/80 via-card to-amber-50/70 px-6 py-6 sm:px-7">
            <div className="flex items-start gap-4">
              <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-brand text-brand-foreground shadow-sm"><Sparkles className="size-5" /></span>
              <div><p className="text-xs font-semibold tracking-[0.18em] text-brand">AI 服务</p><h2 className="mt-1 text-xl font-bold text-foreground">当前账号配置</h2><p className="mt-1 text-sm text-muted-foreground">用于 AI 笔记、学习计划、智能判题与学习助手。</p></div>
            </div>
          </div>
          <div className="flex flex-col gap-5 px-6 py-6 sm:flex-row sm:items-center sm:justify-between sm:px-7">
            {!accountAI ? <div className="space-y-2"><div className="h-5 w-32 animate-pulse rounded bg-muted" /><div className="h-4 w-52 animate-pulse rounded bg-muted" /></div> : <div className="flex items-start gap-3">
              <span className={`mt-0.5 grid size-8 shrink-0 place-items-center rounded-full ${accountAIReady ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>{accountAIReady ? <CheckCircle2 className="size-4" /> : <KeyRound className="size-4" />}</span>
              <div><p className="font-semibold text-foreground">{accountAIReady ? "AI 服务已连接" : "尚未配置可用的 AI Key"}</p><p className="mt-1 text-sm leading-6 text-muted-foreground">{accountAIReady ? `当前使用${accountAI.effective_key_source === "platform" ? "平台统一配置" : "个人配置"} · ${accountAI.effective_provider || "DeepSeek"}` : "完成配置后即可使用学习空间内的 AI 功能。"}</p></div>
            </div>}
            <button type="button" onClick={() => router.push(account?.role === "super_admin" ? "/admin/ai-settings" : "/settings/ai")} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-brand-foreground shadow-sm transition hover:opacity-90">{accountAIReady ? "管理 AI 配置" : "立即配置"}<ArrowRight className="size-4" /></button>
          </div>
        </section>}

        <AppearanceSection />

        <NotificationsSection />

        <TemplatesSection />
      </div>
    </div>
  );
}
