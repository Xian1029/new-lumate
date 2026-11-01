"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Plus, Settings2 } from "lucide-react";
import { getMe, logout, type CurrentUser } from "@/lib/account";
import { deleteCourse, startLearningPlan } from "@/lib/api";
import { useLearningHome } from "./_hooks/use-learning-home";
import { DailyMomentum, DraftPlansSection, FirstSpaceEmptyState, LearningSummary, NextLearningCard, PendingPlansSection, ProcessingSection, RecentLearning, ReviewSection, SpacesSection, TodayTasksSection } from "./_components/learning-home";
import { HOME_PREFERENCES_CHANGED_EVENT, isHomeNewSpaceButtonVisible, setHomeNewSpaceButtonVisible } from "@/lib/home-preferences";

function HomeDisplaySettings({ visible, onToggle }: { visible: boolean; onToggle: () => void }) {
  const [open, setOpen] = useState(false);
  const toggleAndClose = () => {
    onToggle();
    setOpen(false);
  };
  return <div className="fixed z-30" style={{ bottom: "max(1.25rem, env(safe-area-inset-bottom))", right: "max(1.25rem, env(safe-area-inset-right))" }}>
    {open && <div className="absolute bottom-16 right-0 max-w-[calc(100vw-2.5rem)] rounded-2xl border border-border/80 bg-card p-4 shadow-xl shadow-foreground/15 animate-fade-in" style={{ width: "18rem" }}>
      <div className="flex items-start gap-3"><span className="grid size-9 shrink-0 place-items-center rounded-xl bg-brand-muted text-brand"><Settings2 className="size-4" /></span><div><p className="text-sm font-semibold text-foreground">首页显示设置</p><p className="mt-0.5 text-xs leading-5 text-muted-foreground">仅调整首页入口，不影响学习内容。</p></div></div>
      <div className="mt-4 rounded-xl border border-border/70 bg-muted/25 p-3"><div className="flex items-center justify-between gap-3"><div className="min-w-0"><p className="text-sm font-medium text-foreground">新建学习空间</p><p className="mt-0.5 text-xs text-muted-foreground">显示首页的新建入口</p></div><button type="button" role="switch" aria-checked={visible} onClick={toggleAndClose} className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${visible ? "bg-brand" : "bg-muted-foreground/35"}`}><span className={`absolute top-1 size-5 rounded-full bg-white shadow-sm transition-transform ${visible ? "translate-x-6" : "translate-x-1"}`} /></button></div></div>
    </div>}
    <button type="button" onClick={() => setOpen((value) => !value)} className={`grid size-12 place-items-center rounded-full border shadow-lg transition-colors hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 ${open ? "border-brand/35 bg-brand text-brand-foreground" : "border-border bg-card text-muted-foreground hover:border-brand/30 hover:text-brand"}`} aria-expanded={open} aria-label="首页显示设置" title="首页显示设置"><Settings2 className="size-5" /></button>
  </div>;
}

export default function LearningHomePage() {
  const router = useRouter();
  const { overview, loading, error, reload } = useLearningHome();
  const [showNewSpaceButton, setShowNewSpaceButton] = useState(true);
  const [account, setAccount] = useState<CurrentUser | null>(null);
  const navigate = (href: string) => router.push(href);
  // Await the authoritative task mutation before navigating.  The endpoint is
  // idempotent for IN_PROGRESS, so a retried click never turns into a 409.
  const startTask = async (planId: string) => (await startLearningPlan(planId)).href;
  const deleteSpace = async (courseId: string) => { await deleteCourse(courseId); await reload(); };

  // The overview already carries the server-resolved task location.  Prefetch
  // it while the learner is reading the card, so the first click only waits
  // for the tiny authoritative start mutation rather than a route compile.
  useEffect(() => {
    const href = overview?.current_learning_action?.href;
    if (href) router.prefetch(href);
  }, [overview?.current_learning_action?.href, router]);

  useEffect(() => {
    const refresh = () => setShowNewSpaceButton(isHomeNewSpaceButtonVisible());
    refresh();
    window.addEventListener(HOME_PREFERENCES_CHANGED_EVENT, refresh);
    return () => window.removeEventListener(HOME_PREFERENCES_CHANGED_EVENT, refresh);
  }, []);

  useEffect(() => {
    void getMe().then((user) => {
      setAccount(user);
      if (user.must_change_password) router.replace("/change-password");
    }).catch((error: Error) => {
      // /auth is intentionally absent in legacy single-user deployments.
      if (error.message.startsWith("401:")) router.replace("/login");
    });
  }, [router]);

  const empty = !loading && overview?.learning_spaces.length === 0;
  const toggleNewSpaceButton = () => {
    const next = !showNewSpaceButton;
    setShowNewSpaceButton(next);
    setHomeNewSpaceButtonVisible(next);
  };
  return <main className="min-h-screen bg-background"><div className="mx-auto flex max-w-4xl flex-col gap-5 px-4 py-8 sm:px-6 md:py-12"><header className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-sm text-muted-foreground">我的学习首页</p><p className="mt-1 text-lg font-semibold text-foreground">今天，先完成一个小目标。</p></div><div className="flex items-center gap-2 sm:gap-3">{account && <details className="relative"><summary className="cursor-pointer list-none rounded-full border px-3 py-2 text-sm">{account.name}</summary><div className="absolute right-0 z-40 mt-2 w-40 rounded-xl border bg-card p-2 shadow-lg"><button onClick={()=>navigate('/settings/ai')} className="w-full rounded p-2 text-left text-sm hover:bg-muted">AI 服务设置</button>{account.role==='super_admin'&&<button onClick={()=>navigate('/admin/ai-settings')} className="w-full rounded p-2 text-left text-sm hover:bg-muted">平台 AI 设置</button>}<button onClick={()=>navigate('/change-password')} className="w-full rounded p-2 text-left text-sm hover:bg-muted">修改密码</button><button onClick={()=>void logout().finally(()=>{localStorage.clear();sessionStorage.clear();navigate('/login')})} className="w-full rounded p-2 text-left text-sm text-destructive hover:bg-muted">退出登录</button></div></details>}<button type="button" onClick={() => navigate("/learning-plans")} className="rounded-full bg-brand-muted px-3 py-2 text-sm font-semibold text-brand">我的学习计划</button>{showNewSpaceButton && <button type="button" onClick={() => navigate("/new")} className="inline-flex h-10 items-center gap-2 rounded-full bg-brand px-4 text-sm font-semibold text-brand-foreground"><Plus className="size-4" />新建学习空间</button>}</div></header>{error && <div className="rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">加载学习数据失败：{error}<button type="button" onClick={reload} className="ml-3 font-medium underline">重试</button></div>}{empty ? <FirstSpaceEmptyState onNavigate={navigate} /> : <><NextLearningCard action={overview?.current_learning_action ?? null} actions={overview?.current_learning_actions} actionCount={overview?.current_learning_action_count} loading={loading} onNavigate={navigate} onStartPlan={startTask} onShowAllSpaces={() => document.getElementById("learning-spaces")?.scrollIntoView({ behavior: "smooth", block: "start" })} />{overview && <DailyMomentum overview={overview} />}{overview && <TodayTasksSection overview={overview} onNavigate={navigate} onStartPlan={startTask} />}{overview && !overview.current_learning_action_is_resume_fallback && <RecentLearning recent={overview.recent_learning} onNavigate={navigate} />}{<DraftPlansSection plans={overview?.draft_learning_plans ?? []} onNavigate={navigate} />}<PendingPlansSection plans={overview?.pending_learning_plans ?? []} onNavigate={navigate} />{overview && <ReviewSection reviews={overview.review_queue} onNavigate={navigate} />}{overview && <ProcessingSection uploads={overview.processing_uploads} onNavigate={navigate} />}{overview && <SpacesSection spaces={overview.learning_spaces} onNavigate={navigate} onDelete={deleteSpace} allowCreate={showNewSpaceButton} />}{overview && <LearningSummary overview={overview} />}</>}<HomeDisplaySettings visible={showNewSpaceButton} onToggle={toggleNewSpaceButton} /></div></main>;
}
