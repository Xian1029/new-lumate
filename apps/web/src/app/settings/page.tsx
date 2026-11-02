"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
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
  const effectiveBlockers = (health?.local_beta_blockers ?? []).filter(
    (item) => item !== "llm_unhealthy" && item !== "llm_not_ready",
  );
  const displayedHealth = health && accountAIReady ? {
    ...health,
    llm_status: "ready" as const,
    llm_available: true,
    llm_primary: "deepseek",
    llm_providers: ["deepseek"],
    llm_provider_health: { deepseek: true },
    local_beta_blockers: effectiveBlockers,
    local_beta_ready: effectiveBlockers.length === 0,
  } : health;
  const multiUserMode = health?.deployment_mode === "multi_user";

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
        <RuntimeAlert health={displayedHealth} />

        <RuntimeStatusSection
          health={displayedHealth}
          healthLoading={healthLoading}
          onRefresh={() => void loadHealth()}
        />

        {multiUserMode ? <section className="space-y-3"><h2 className="font-medium text-foreground">当前账号 AI 服务</h2><div className="rounded-xl border border-border bg-card p-5"><div className="flex flex-wrap items-center justify-between gap-4"><div><p className={`font-semibold ${accountAIReady ? "text-brand" : "text-destructive"}`}>{accountAIReady ? "AI 服务已可用" : "AI 服务尚未配置"}</p><p className="mt-1 text-sm text-muted-foreground">{accountAIReady ? `当前使用${accountAI?.effective_key_source === "platform" ? "平台统一 Key" : "个人 Key"}（${accountAI?.effective_provider || "deepseek"}），学习空间内的 AI 功能可正常调用。` : "请先完成 AI Key 配置，AI 笔记、学习计划和智能辅导才能使用。"}</p></div><button type="button" onClick={() => router.push(account?.role === "super_admin" ? "/admin/ai-settings" : "/settings/ai")} className="rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-brand-foreground">{account?.role === "super_admin" ? "前往平台 AI 设置" : "前往个人 AI 设置"}</button></div></div></section> : <><ProviderConnectionsSection
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
        /></>}

        <AppearanceSection />

        <NotificationsSection />

        <TemplatesSection />
      </div>
    </div>
  );
}
