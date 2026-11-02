"use client";

import { ArrowRight, BookOpen, CalendarCheck2, Clock3, FileClock, Flame, Play, Plus, RotateCcw, Settings2, Sparkles, Target, Trash2, Trophy, TrendingUp } from "lucide-react";
import { HomeCalendar } from "./home-calendar";
import { useState } from "react";
import type { HomeLearningAction, HomeLearningSpace, HomeProcessingUpload, HomeReviewItem, LearningHomeOverview, LearningPlanSummary } from "@/lib/api";

function HomeSection({ title, icon: Icon, children, action }: { title: string; icon: typeof BookOpen; children: React.ReactNode; action?: React.ReactNode }) {
  return <section className="rounded-2xl border border-border/70 bg-card p-5 shadow-sm"><div className="mb-4 flex items-center justify-between gap-3"><div className="flex items-center gap-2 text-sm font-semibold text-foreground"><span className="grid size-7 place-items-center rounded-lg bg-brand-muted text-brand"><Icon className="size-4" /></span>{title}</div>{action}</div>{children}</section>;
}

export function FirstSpaceEmptyState({ onNavigate }: { onNavigate: (href: string) => void }) {
  return <section className="rounded-3xl border border-dashed border-brand/35 bg-brand-muted/20 px-6 py-12 text-center"><span className="mx-auto grid size-14 place-items-center rounded-2xl bg-card text-brand shadow-sm"><BookOpen className="size-7" /></span><h1 className="mt-5 text-2xl font-bold text-foreground">创建你的第一个学习空间</h1><p className="mx-auto mt-3 max-w-md text-sm leading-6 text-muted-foreground">上传教材、讲义或笔记后，我们会帮你整理课程并给出下一步学习建议。</p><div className="mt-7 flex flex-wrap justify-center gap-3"><button type="button" onClick={() => onNavigate("/new")} className="inline-flex h-11 items-center gap-2 rounded-full bg-brand px-5 text-sm font-semibold text-brand-foreground"><Plus className="size-4" />上传学习资料</button><button type="button" onClick={() => onNavigate("/setup?step=content")} className="inline-flex h-11 items-center rounded-full border border-border bg-card px-5 text-sm font-semibold text-foreground hover:bg-muted">手动创建学习空间</button></div></section>;
}

export function NextLearningCard({ action, actions = [], actionCount, loading, onNavigate, onStartPlan, onShowAllSpaces }: { action: HomeLearningAction | null; actions?: HomeLearningAction[]; actionCount?: number; loading: boolean; onNavigate: (href: string) => void; onStartPlan?: (planId: string) => Promise<string>; onShowAllSpaces?: () => void }) {
  const [starting, setStarting] = useState(false);
  const visibleActions = actions.length ? actions : (action ? [action] : []);
  const primaryAction = visibleActions[0] ?? action;
  const launch = async (target: HomeLearningAction) => { if (starting) return; setStarting(true); try { const href = target.learning_task_id && target.plan_id ? await onStartPlan?.(target.plan_id) : target.href; onNavigate(href || target.href); } finally { setStarting(false); } };
  return <section className="overflow-hidden rounded-3xl border border-brand/20 bg-gradient-to-br from-brand-muted via-card to-card p-6 shadow-sm sm:p-7"><p className="text-sm font-semibold text-brand">今日继续学习</p>{loading ? <div className="mt-4 space-y-3 animate-pulse"><div className="h-7 w-2/3 rounded bg-muted" /><div className="h-4 w-full rounded bg-muted" /><div className="h-11 w-32 rounded-full bg-muted" /></div> : !primaryAction ? <div className="mt-4"><h1 className="text-xl font-bold text-foreground">先创建一个学习空间</h1><p className="mt-2 text-sm text-muted-foreground">添加资料后，我们会为你准备第一步。</p></div> : <><p className="mt-3 text-xs font-medium text-muted-foreground">{primaryAction.course_name || "学习空间"}</p><h1 className="mt-1 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">{primaryAction.title}</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">{primaryAction.reason}</p><button type="button" disabled={starting} onClick={() => void launch(primaryAction)} className="mt-6 inline-flex h-11 items-center gap-2 rounded-full bg-brand px-6 text-sm font-semibold text-brand-foreground transition-opacity hover:opacity-90 disabled:opacity-60"><Play className="size-4 fill-current" />{starting ? "正在进入…" : primaryAction.action_text}</button>{visibleActions.length > 1 && <div className="mt-5 border-t border-brand/15 pt-4"><p className="mb-2 text-xs font-medium text-muted-foreground">其他学习空间的今日提醒</p><div className="space-y-2">{visibleActions.slice(1).map((item) => <button key={item.learning_task_id || item.recommendation_id || item.href} type="button" disabled={starting} onClick={() => void launch(item)} className="flex w-full items-center gap-3 rounded-xl bg-card/75 px-3 py-2.5 text-left hover:bg-card disabled:opacity-60"><Target className="size-4 shrink-0 text-brand" /><span className="min-w-0 flex-1"><span className="block truncate text-xs text-muted-foreground">{item.course_name || "学习空间"}</span><span className="block truncate text-sm font-medium text-foreground">{item.title}</span></span><span className="shrink-0 text-xs font-medium text-brand">{item.action_text}</span><ArrowRight className="size-4 shrink-0 text-muted-foreground" /></button>)}</div></div>}{(actionCount ?? visibleActions.length) > visibleActions.length && <button type="button" onClick={onShowAllSpaces} className="mt-4 text-sm font-semibold text-brand hover:underline">还有 {(actionCount ?? visibleActions.length) - visibleActions.length} 个学习空间，查看全部</button>}</>}</section>;
}

export function DailyMomentum({ overview }: { overview: LearningHomeOverview }) {
  const { today_summary: today, learning_summary: summary } = overview;
  const hasTodayTasks = today.total_count > 0;
  // The server owns the workspace completion contract. When today has no
  // scheduled tasks, fall back to that same contract instead of showing a
  // disconnected “free exploration” state on the home page.
  const progressSource = hasTodayTasks
    ? { completed: today.completed_count, total: today.total_count, percent: Math.round((today.completed_count / today.total_count) * 100), label: "今日任务完成度" }
    : { completed: summary.completed_learning_items, total: summary.total_learning_items, percent: summary.progress_percent ?? 0, label: "课程完成度" };
  const hasProgressSource = progressSource.total > 0;
  const progress = progressSource.percent;
  const remaining = Math.max(today.total_count - today.completed_count, 0);
  const message = !hasTodayTasks
    ? hasProgressSource
      ? `今天暂无计划任务；课程已完成 ${progressSource.completed}/${progressSource.total} 个学习内容。`
      : "今天暂无计划任务，可以选择感兴趣的内容开始学习。"
    : remaining === 0
      ? `今天安排的 ${today.total_count} 项任务已全部完成，记得适当休息。`
      : today.completed_count === 0
        ? `今天有 ${today.total_count} 项学习任务，从第一项开始吧。`
        : `今天已完成 ${today.completed_count}/${today.total_count} 项，还剩 ${remaining} 项。`;
  const statusLabel = !hasTodayTasks ? (hasProgressSource ? "课程总进度" : "今日暂无任务") : remaining === 0 ? "今日目标已完成" : today.completed_count > 0 ? "进行中" : "待开始";
  const checkpoints = [0, 50, 100];
  return <section className="relative overflow-hidden rounded-3xl border border-brand/20 bg-gradient-to-br from-brand-muted/85 via-card to-amber-50/55 p-5 shadow-sm dark:to-amber-950/15 sm:p-6"><div className="pointer-events-none absolute -right-9 -top-12 size-36 rounded-full bg-amber-300/20 blur-3xl dark:bg-amber-400/10" /><div className="relative flex items-start justify-between gap-4"><div className="flex items-center gap-2"><span className="grid size-9 place-items-center rounded-xl bg-brand text-brand-foreground shadow-sm"><Flame className="size-4.5" /></span><div><div className="flex flex-wrap items-center gap-2"><p className="text-sm font-semibold text-foreground">今日学习进度</p><span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${remaining === 0 && hasTodayTasks ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300" : "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300"}`}>{statusLabel}</span></div><p className="mt-0.5 text-xs text-muted-foreground">{message}</p></div></div>{hasProgressSource && <div className="shrink-0 text-right"><p className="text-2xl font-bold tracking-tight text-foreground">{progress}<span className="text-sm text-muted-foreground">%</span></p><p className="text-[10px] font-medium text-muted-foreground">{progressSource.label}</p></div>}</div><div className="relative mt-6"><div className="h-2 rounded-full bg-brand/10"><div className="h-full rounded-full bg-gradient-to-r from-brand to-emerald-400 transition-[width] duration-500" style={{ width: `${progress}%` }} /></div><div className="absolute inset-x-0 -top-1.5 flex justify-between">{checkpoints.map((checkpoint) => <span key={checkpoint} className={`size-5 rounded-full border-[3px] border-card shadow-sm ${progress >= checkpoint && hasProgressSource ? "bg-brand" : "bg-muted"}`} />)}</div></div><div className="mt-3 flex items-center justify-between text-[11px] font-medium text-muted-foreground"><span>{hasTodayTasks ? `今日已完成 ${today.completed_count} 项` : hasProgressSource ? `已完成 ${progressSource.completed} 个学习内容` : "今日暂无安排"}</span><span>{hasTodayTasks ? `今日共计 ${today.total_count} 项` : hasProgressSource ? `共 ${progressSource.total} 个学习内容` : "开始学习后将自动更新"}</span></div><div className="mt-5 flex flex-wrap gap-2"><span className="inline-flex items-center gap-1.5 rounded-full border border-border/80 bg-card/80 px-3 py-1.5 text-xs text-muted-foreground"><Sparkles className="size-3.5 text-sky-500" />{summary.active_workspace_count} 个学习空间</span><span className="inline-flex items-center gap-1.5 rounded-full border border-border/80 bg-card/80 px-3 py-1.5 text-xs text-muted-foreground"><Trophy className="size-3.5 text-amber-500" />{summary.review_due_count ? `${summary.review_due_count} 项待复习` : "暂无待复习内容"}</span></div></section>;
}

export function PendingPlansSection({ plans, onNavigate }: { plans: LearningPlanSummary[]; onNavigate: (href: string) => void }) {
  const plan = plans[0];
  if (!plan) return null;
  return <HomeSection title="待确认计划" icon={Target}><button type="button" onClick={() => onNavigate(`/learning-plans/${plan.plan.id}/review`)} className="w-full rounded-xl bg-brand-muted/35 p-4 text-left hover:bg-brand-muted/55"><p className="font-semibold text-foreground">你有一个学习计划等待确认</p><p className="mt-1 text-sm text-muted-foreground">{plan.plan.title} · 目标日期：{plan.plan.target_date || "暂未设定"} · 每天约 {plan.plan.available_minutes_per_day || "—"} 分钟</p><span className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-brand">查看并确认 <ArrowRight className="size-4" /></span></button></HomeSection>;
}

export function DraftPlansSection({ plans, onNavigate }: { plans: LearningPlanSummary[]; onNavigate: (href: string) => void }) {
  const plan = plans[0]; if (!plan) return null;
  return <HomeSection title="待继续编辑的计划" icon={Target}><button type="button" onClick={() => onNavigate(`/learning-plans/${plan.plan.id}/edit`)} className="w-full rounded-xl bg-sky-50/70 p-4 text-left hover:bg-sky-100/70"><p className="font-semibold text-foreground">继续完善“{plan.plan.title}”</p><p className="mt-1 text-sm text-muted-foreground">计划尚未开始，不会出现在今日任务中。</p><span className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-brand">继续编辑 <ArrowRight className="size-4" /></span></button></HomeSection>;
}

export function TodayTasksSection({ overview, onNavigate, onStartPlan }: { overview: LearningHomeOverview; onNavigate: (href: string) => void; onStartPlan?: (planId: string) => Promise<string> }) {
  const { today_tasks: tasks, today_summary: summary, upcoming_tasks: upcoming } = overview;
  if (!tasks.length && !upcoming.length) return null;
  const launch = async (planId: string, fallback: string) => onNavigate(await onStartPlan?.(planId) || fallback);
  const rows = tasks.length ? tasks : upcoming;
  const title = tasks.length ? `今天要完成 · 预计 ${summary.estimated_minutes} 分钟` : "近期学习安排";
  return <HomeSection title={title} icon={CalendarCheck2}>{tasks.length > 0 && <p className="mb-3 text-xs text-muted-foreground">完成一项，就离目标更近一步。已完成 {summary.completed_count}/{summary.total_count} 项</p>}{!tasks.length && <p className="mb-3 text-xs text-muted-foreground">提前看一看接下来的安排，学习更从容。</p>}<div className="space-y-2">{rows.map((task) => <button key={task.id} type="button" onClick={() => void launch(task.plan_id, task.href)} className="flex w-full items-center gap-3 rounded-xl bg-muted/30 p-3 text-left hover:bg-muted/60"><Target className="size-4 shrink-0 text-brand" /><span className="flex-1 truncate text-sm text-foreground">{task.title}</span><span className="text-xs text-muted-foreground">{tasks.length ? (task.status === "IN_PROGRESS" ? "继续" : "开始") : "查看安排"}</span><ArrowRight className="size-4 text-muted-foreground" /></button>)}</div></HomeSection>;
}

export function ProcessingSection({ uploads, onNavigate }: { uploads: HomeProcessingUpload[]; onNavigate: (href: string) => void }) {
  if (!uploads.length) return null;
  const failed = uploads.filter((upload) => upload.status === "failed");
  return <HomeSection title={failed.length ? `有 ${failed.length} 份资料需要重新处理` : "资料处理中"} icon={FileClock}><div className="space-y-2">{uploads.slice(0, 3).map((upload) => <button key={upload.id} type="button" onClick={() => onNavigate(upload.href)} className="flex w-full items-center gap-3 rounded-xl bg-muted/30 p-3 text-left hover:bg-muted/60"><FileClock className="size-4 shrink-0 text-brand" /><span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium text-foreground">{upload.name}</span><span className="block truncate text-xs text-muted-foreground">{upload.status === "failed" ? "处理没有完成，点击重新查看" : `${upload.phase_label} · 已完成 ${upload.progress_percent}%`}</span></span><ArrowRight className="size-4 text-muted-foreground" /></button>)}</div></HomeSection>;
}

export function ReviewSection({ reviews, onNavigate }: { reviews: HomeReviewItem[]; onNavigate: (href: string) => void }) {
  if (!reviews.length) return null;
  const top = reviews[0];
  const isFlashcardReview = top.review_kind === "flashcards";
  // A flashcard total must only include entries that open flashcard review;
  // mixing it with concept-review counts made “15 张” navigate to a queue
  // containing fewer than 15 cards.
  const matchingReviews = reviews.filter((review) => review.review_kind === top.review_kind);
  const total = matchingReviews.reduce((sum, review) => sum + review.count, 0);
  return <HomeSection title={isFlashcardReview ? `今日待复习 · ${total} 张` : `待复习 · ${total}`} icon={RotateCcw}><div className="space-y-2">{matchingReviews.slice(0, 3).map((review) => <button key={`${review.course_id}:${review.review_kind}`} type="button" onClick={() => onNavigate(review.href)} className="flex w-full items-center gap-3 rounded-xl bg-muted/40 p-3 text-left transition-colors hover:bg-muted/70"><span className="flex-1"><span className="block text-sm font-medium text-foreground">{review.course_name}</span><span className="mt-1 block text-xs text-muted-foreground">{isFlashcardReview ? `待复盘 ${review.count} 张卡片 · 约 ${review.estimated_minutes} 分钟` : `优先复习：${review.highest_priority_knowledge} · 约 ${review.estimated_minutes} 分钟`}</span></span><span className="text-xs text-warning">开始复习</span><ArrowRight className="size-4 text-muted-foreground" /></button>)}</div></HomeSection>;
}

function spaceLocationLabel(space: HomeLearningSpace): string {
  if (space.current_node_title) return `${space.status_label}：${space.current_node_title}`;
  if (space.status === "COMPLETED") return "当前学习内容已完成，可以复习巩固。";
  if (space.status === "NOT_STARTED") return "从第一个学习内容开始学习";
  return "已准备好下一步学习内容";
}

export function SpacesSection({ spaces, onNavigate, onDelete, allowCreate = true }: { spaces: HomeLearningSpace[]; onNavigate: (href: string) => void; onDelete?: (id: string) => Promise<void>; allowCreate?: boolean }) {
  const [showAll, setShowAll] = useState(false);
  const [managing, setManaging] = useState(false);
  const remove = async (id: string, name: string) => {
    if (!window.confirm(`将学习空间“${name}”移入回收站？之后仍可恢复。`)) return;
    await onDelete?.(id);
  };
  const action = <div className="flex flex-wrap items-center justify-end gap-3"><button type="button" onClick={() => setManaging((value) => !value)} className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"><Settings2 className="size-3.5" />{managing ? "完成管理" : "管理空间"}</button><button type="button" onClick={() => onNavigate("/trash")} className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"><Trash2 className="size-3.5" />回收站</button>{allowCreate && <button type="button" onClick={() => onNavigate("/new")} className="inline-flex items-center gap-1 text-xs font-semibold text-brand"><Plus className="size-3.5" />新建学习空间</button>}</div>;
  const visibleSpaces = showAll ? spaces : spaces.slice(0, 4);
  return <div id="learning-spaces"><HomeSection title="我的学习空间" icon={BookOpen} action={action}>{managing && <p className="mb-3 rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground">管理模式：可将不再使用的学习空间移入回收站，学习数据不会立即永久删除。</p>}<div className="grid gap-4 sm:grid-cols-2">{visibleSpaces.map((space) => <article key={space.id} className="relative min-h-[236px] overflow-hidden rounded-2xl border border-border/75 bg-card shadow-sm transition-all hover:-translate-y-0.5 hover:border-brand/40 hover:shadow-md"><button type="button" onClick={() => onNavigate(space.target_route)} className={`flex h-full w-full flex-col p-5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-inset ${managing ? "pr-12" : ""}`}><div className="flex items-start gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-muted text-brand"><BookOpen className="size-[18px]" /></span><div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-2"><p className="truncate text-[15px] font-semibold text-foreground">{space.name}</p><span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">{space.status_label}</span></div><p className="mt-1.5 truncate text-xs text-muted-foreground">{spaceLocationLabel(space)}</p></div></div>{space.total_learning_items > 0 ? <div className="mt-5 rounded-xl bg-muted/45 px-3 py-2.5"><div className="flex items-center justify-between gap-2 text-xs"><span className="text-muted-foreground">已完成 {space.completed_learning_items} / {space.total_learning_items} 个学习内容</span><span className="shrink-0 font-semibold text-foreground">{space.progress_percent ?? 0}%</span></div><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-card"><div className="h-full rounded-full bg-brand transition-[width]" style={{ width: `${space.progress_percent ?? 0}%` }} /></div></div> : <p className="mt-5 rounded-xl bg-muted/45 px-3 py-3 text-xs text-muted-foreground">资料正在整理，完成后就可以开始学习。</p>}{space.review_count > 0 ? <p className="mt-3 inline-flex w-fit items-center rounded-full bg-warning/10 px-2.5 py-1 text-xs font-medium text-warning">待复习 {space.review_count} 个知识点</p> : <span className="mt-3 h-7" />}<span className="mt-auto inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-xl bg-brand px-4 text-sm font-semibold text-brand-foreground transition-colors hover:brightness-95">{space.action_label} <ArrowRight className="size-4" /></span></button>{managing && onDelete && <button type="button" aria-label={`删除学习空间“${space.name}”`} title="移入回收站" onClick={() => void remove(space.id, space.name)} className="absolute right-3 top-3 rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"><Trash2 className="size-4" /></button>}</article>)}</div>{spaces.length > 4 ? <button type="button" onClick={() => setShowAll((value) => !value)} className="mt-3 text-sm font-semibold text-brand hover:underline">{showAll ? "收起学习空间" : `查看全部学习空间（${spaces.length}）`}</button> : null}{allowCreate && <button type="button" onClick={() => onNavigate("/new")} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-brand/35 px-4 py-3 text-sm font-semibold text-brand hover:bg-brand-muted/20"><Plus className="size-4" />新建学习空间</button>}</HomeSection></div>;
}

export function RecentLearning({ recent, onNavigate }: { recent: LearningHomeOverview["recent_learning"]; onNavigate: (href: string) => void }) {
  if (!recent) return null;
  return <HomeSection title="继续上次学习" icon={Clock3}><button type="button" onClick={() => onNavigate(recent.href)} className="flex w-full items-center gap-3 rounded-xl bg-muted/30 p-3 text-left hover:bg-muted/60"><div className="flex-1"><p className="text-sm font-medium text-foreground">{recent.course_name}</p><p className="mt-1 text-xs text-muted-foreground">{recent.content_title ? `上次学到：${recent.content_title}` : "回到上次的学习位置"}</p></div><span className="text-xs font-medium text-brand">继续学习</span><ArrowRight className="size-4 text-muted-foreground" /></button></HomeSection>;
}

export function LearningSummary({ overview, onNavigate = (href) => window.location.assign(href) }: { overview: LearningHomeOverview; onNavigate?: (href: string) => void }) {
  const summary = overview.learning_summary;
  const [showAll, setShowAll] = useState(false);
  const spaces = showAll ? overview.learning_spaces : overview.learning_spaces.slice(0, 4);
  return <><HomeCalendar overview={overview} onNavigate={onNavigate} /><HomeSection title="学习概况" icon={TrendingUp}>
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {[[summary.active_workspace_count, "正在学习的空间"], [summary.today_task_count, "今日待完成"], [summary.completed_task_count_this_week, "本周已完成"], [summary.review_due_count, "待复习知识点"]].map(([value, label]) => <div key={label} className="rounded-xl bg-muted/35 px-3 py-3 text-center"><p className="text-xl font-bold text-foreground">{value}</p><p className="mt-1 text-xs text-muted-foreground">{label}</p></div>)}
    </div>
    {summary.total_learning_items > 0 && <div className="mt-4 rounded-xl border border-border/70 p-4"><div className="flex items-center justify-between gap-3"><div><p className="text-sm font-semibold text-foreground">全部学习空间</p><p className="mt-1 text-xs text-muted-foreground">已完成 {summary.completed_learning_items} / {summary.total_learning_items} 个学习内容，按内容数量加权计算。</p></div><span className="text-lg font-bold text-brand">{summary.progress_percent}%</span></div><div className="mt-3 h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-brand" style={{ width: `${summary.progress_percent}%` }} /></div></div>}
    <div className="mt-4 space-y-2">
      {spaces.map((space) => <button key={space.id} type="button" onClick={() => onNavigate(space.target_route)} className="flex w-full items-center gap-3 rounded-xl border border-border/70 px-4 py-3 text-left hover:border-brand/35 hover:bg-brand-muted/15"><span className="grid size-9 shrink-0 place-items-center rounded-xl bg-brand-muted text-brand"><BookOpen className="size-4" /></span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-foreground">{space.name}</span><span className="mt-0.5 block truncate text-xs text-muted-foreground">{space.current_node_title ? `正在学习：${space.current_node_title}` : space.status_label}</span><span className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground"><span>完成 {space.completed_learning_items}/{space.total_learning_items}</span>{space.today_task_count > 0 && <span>今日 {space.today_task_count} 项</span>}{space.review_count > 0 && <span>待复习 {space.review_count} 个</span>}</span></span><span className="shrink-0 text-sm font-bold text-foreground">{space.progress_percent ?? 0}%</span><ArrowRight className="size-4 shrink-0 text-muted-foreground" /></button>)}
    </div>
    {overview.learning_spaces.length > 4 && <button type="button" onClick={() => setShowAll((value) => !value)} className="mt-3 text-sm font-semibold text-brand hover:underline">{showAll ? "收起" : `查看全部学习空间（${overview.learning_spaces.length}）`}</button>}
  </HomeSection></>;
}
