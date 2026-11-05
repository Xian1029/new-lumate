"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Bot, KeyRound, LogOut, Plus, Shield, UserRound, UsersRound } from "lucide-react";
import { AccountError, getMe, logout, type CurrentUser } from "@/lib/account";
import { deleteCourse, startLearningPlan } from "@/lib/api";
import { useLearningHome } from "./_hooks/use-learning-home";
import { DailyMomentum, DraftPlansSection, FirstSpaceEmptyState, LearningSummary, NextLearningCard, PendingPlansSection, ProcessingSection, RecentLearning, ReviewSection, SpacesSection, TodayTasksSection } from "./_components/learning-home";
import { getCourseCreationPolicy, type CourseCreationPolicy } from "@/lib/course-creation-policy";

export default function LearningHomePage() {
  const router = useRouter();
  const { overview, loading, error, reload } = useLearningHome();
  const [creationPolicy, setCreationPolicy] = useState<CourseCreationPolicy | null>(null);
  const [account, setAccount] = useState<CurrentUser | null>(null);
  const [accessReady, setAccessReady] = useState(false);
  const [accessError, setAccessError] = useState(false);
  const navigate = (href: string) => router.push(href);
  // Await the authoritative task mutation before navigating.  The endpoint is
  // idempotent for IN_PROGRESS, so a retried click never turns into a 409.
  const startTask = async (planId: string) => (await startLearningPlan(planId)).href;
  const deleteSpace = async (courseId: string) => { await deleteCourse(courseId); await reload(); setCreationPolicy(await getCourseCreationPolicy()); };

  useEffect(() => {
    const refreshPolicy = () => { void getCourseCreationPolicy().then(setCreationPolicy).catch(() => undefined); };
    window.addEventListener("focus", refreshPolicy);
    return () => window.removeEventListener("focus", refreshPolicy);
  }, []);

  // The overview already carries the server-resolved task location.  Prefetch
  // it while the learner is reading the card, so the first click only waits
  // for the tiny authoritative start mutation rather than a route compile.
  useEffect(() => {
    const href = overview?.current_learning_action?.href;
    if (href) router.prefetch(href);
  }, [overview?.current_learning_action?.href, router]);

  useEffect(() => {
    void getMe().then(async (user) => {
      setAccount(user);
      if (user.must_change_password) { router.replace("/change-password"); return; }
      if (user.role === "student") {
        const response = await fetch("/api/ai-settings/me", { credentials: "include" }).catch(() => null);
        if (!response?.ok) { router.replace("/login"); return; }
        const ai = await response.json();
        if (!ai.effective_key_available) {
          router.replace("/settings/ai?welcome=1"); return;
        }
      }
      setCreationPolicy(await getCourseCreationPolicy());
      setAccessReady(true);
    }).catch((error: unknown) => {
      if (error instanceof AccountError && (error.status === 401 || error.status === 403)) {
        router.replace("/login");
        return;
      }
      setAccessError(true);
    });
  }, [router]);

  const empty = !loading && overview?.learning_spaces.length === 0;
  if (!accessReady) return <main className="grid min-h-screen place-items-center bg-background text-sm text-muted-foreground">{accessError ? <div className="text-center"><p>暂时无法检查学习账号，请稍后重试。</p><button type="button" onClick={() => window.location.reload()} className="mt-3 rounded-lg bg-brand px-4 py-2 text-brand-foreground">重新检查</button></div> : "正在检查学习账号配置…"}</main>;
  const showNewSpaceButton = creationPolicy?.can_create_now === true;
  return <main className="min-h-screen bg-background"><div className="mx-auto flex max-w-4xl flex-col gap-5 px-4 py-8 sm:px-6 md:py-12"><header className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-sm text-muted-foreground">我的学习首页</p><p className="mt-1 text-lg font-semibold text-foreground">今天，先完成一个小目标。</p></div><div className="flex items-center gap-2 sm:gap-3"><button type="button" onClick={() => navigate("/learning-plans")} className="rounded-full bg-brand-muted px-3 py-2 text-sm font-semibold text-brand">我的学习计划</button>{showNewSpaceButton && <button type="button" onClick={() => navigate("/new")} className="inline-flex h-10 items-center gap-2 rounded-full bg-brand px-4 text-sm font-semibold text-brand-foreground"><Plus className="size-4" />新建学习空间</button>}{account && <details className="relative order-last">
  <summary aria-label="账号菜单" title={account.name} className="grid size-10 cursor-pointer list-none place-items-center rounded-full border border-border bg-card text-muted-foreground shadow-sm transition hover:border-brand/40 hover:bg-brand-muted hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40">
    <UserRound className="size-[18px]" />
  </summary>
  <div className="absolute right-0 z-40 mt-2 w-52 overflow-hidden rounded-2xl border border-border/80 bg-card p-2 shadow-xl shadow-foreground/10">
    <div className="mb-1 flex items-center gap-3 border-b border-border/70 px-2 py-2.5">
      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-brand-muted text-brand"><UserRound className="size-4" /></span>
      <div className="min-w-0"><p className="truncate text-sm font-semibold text-foreground">{account.name}</p><p className="text-xs text-muted-foreground">{account.role === "super_admin" ? "超级管理员" : "学习账号"}</p></div>
    </div>
    <button onClick={() => navigate("/settings/ai")} className="flex w-full items-center gap-2.5 rounded-xl p-2.5 text-left text-sm hover:bg-muted"><Bot className="size-4 text-muted-foreground" />AI 服务设置</button>
    {account.role === "super_admin" && <>
      <button onClick={() => navigate("/admin/ai-settings")} className="flex w-full items-center gap-2.5 rounded-xl p-2.5 text-left text-sm hover:bg-muted"><Shield className="size-4 text-muted-foreground" />平台 AI 设置</button>
      <button onClick={() => navigate("/admin/members")} className="flex w-full items-center gap-2.5 rounded-xl p-2.5 text-left text-sm hover:bg-muted"><UsersRound className="size-4 text-muted-foreground" />成员管理</button>
    </>}
    <button onClick={() => navigate("/change-password")} className="flex w-full items-center gap-2.5 rounded-xl p-2.5 text-left text-sm hover:bg-muted"><KeyRound className="size-4 text-muted-foreground" />修改密码</button>
    <button onClick={() => void logout().finally(() => { localStorage.clear(); sessionStorage.clear(); navigate("/login"); })} className="mt-1 flex w-full items-center gap-2.5 rounded-xl border-t border-border/60 p-2.5 text-left text-sm text-destructive hover:bg-destructive/10"><LogOut className="size-4" />退出登录</button>
  </div>
</details>}</div></header>{error && <div className="rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">加载学习数据失败：{error}<button type="button" onClick={reload} className="ml-3 font-medium underline">重试</button></div>}{empty ? <FirstSpaceEmptyState onNavigate={navigate} allowCreate={showNewSpaceButton} /> : <><NextLearningCard action={overview?.current_learning_action ?? null} actions={overview?.current_learning_actions} actionCount={overview?.current_learning_action_count} loading={loading} onNavigate={navigate} onStartPlan={startTask} onShowAllSpaces={() => document.getElementById("learning-spaces")?.scrollIntoView({ behavior: "smooth", block: "start" })} />{overview && <DailyMomentum overview={overview} />}{overview && <TodayTasksSection overview={overview} onNavigate={navigate} onStartPlan={startTask} />}{overview && !overview.current_learning_action_is_resume_fallback && <RecentLearning recent={overview.recent_learning} onNavigate={navigate} />}{<DraftPlansSection plans={overview?.draft_learning_plans ?? []} onNavigate={navigate} />}<PendingPlansSection plans={overview?.pending_learning_plans ?? []} onNavigate={navigate} />{overview && <ReviewSection reviews={overview.review_queue} onNavigate={navigate} />}{overview && <ProcessingSection uploads={overview.processing_uploads} onNavigate={navigate} />}{overview && <SpacesSection spaces={overview.learning_spaces} onNavigate={navigate} onDelete={deleteSpace} allowCreate={showNewSpaceButton} />}{overview && <LearningSummary overview={overview} />}</>}</div></main>;
}
