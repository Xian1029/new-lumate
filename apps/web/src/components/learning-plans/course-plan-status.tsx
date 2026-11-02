"use client";

import Link from "next/link";
import { Check, ChevronDown, ChevronUp, Circle, Clock3, Play } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { getCourseLearningPlanDashboard, getPlanOverdueDays, taskStatusLabel, taskTypeLabel, type LearningPlanSummary, type LearningTask } from "@/lib/api";

interface CoursePlanDashboard {
  draft_plan: LearningPlanSummary | null;
  pending_plan: LearningPlanSummary | null;
  active_plan: LearningPlanSummary | null;
  current_task: LearningTask | null;
  today_tasks: LearningTask[];
  plan_tasks?: LearningTask[];
}

function localDate(value: string | null): string | null { return value ? value.slice(0, 10) : null; }

export function taskOverdueDays(task: LearningTask, now = new Date()): number {
  if (["COMPLETED", "SKIPPED"].includes(task.status)) return 0;
  const raw = localDate(task.postponed_to || task.scheduled_for);
  if (!raw) return 0;
  const [year, month, day] = raw.split("-").map(Number);
  const due = new Date(year, month - 1, day);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.max(0, Math.floor((today.getTime() - due.getTime()) / 86_400_000));
}

function TaskTimelineRow({ task, active }: { task: LearningTask; active: boolean }) {
  const overdueDays = taskOverdueDays(task);
  const completed = task.status === "COMPLETED";
  const date = localDate(task.postponed_to || task.scheduled_for);
  return <li className={`relative flex gap-3 rounded-xl border px-3 py-3 ${active ? "border-brand/30 bg-brand-muted/35" : overdueDays ? "border-destructive/25 bg-destructive/5" : "border-border/60 bg-card/70"}`}>
    <span className={`mt-0.5 grid size-7 shrink-0 place-items-center rounded-full ${completed ? "bg-success/15 text-success" : active ? "bg-brand text-brand-foreground" : "bg-muted text-muted-foreground"}`}>{completed ? <Check className="size-3.5" /> : active ? <Play className="size-3 fill-current" /> : <Circle className="size-3" />}</span>
    <span className="min-w-0 flex-1"><span className="flex flex-wrap items-center gap-1.5 text-[11px]"><span className="font-medium text-brand">{taskTypeLabel[task.task_type]}</span><span className="text-muted-foreground">{taskStatusLabel[task.status]}</span>{active && <span className="rounded-full bg-brand/10 px-1.5 py-0.5 font-semibold text-brand">当前</span>}{overdueDays > 0 && <span className="rounded-full bg-destructive/10 px-1.5 py-0.5 font-semibold text-destructive">延期 {overdueDays} 天</span>}</span><span className="mt-1 block text-sm font-semibold text-foreground">{task.title}</span><span className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">{task.estimated_minutes ? <span>约 {task.estimated_minutes} 分钟</span> : null}{date ? <span>{task.postponed_to ? "已调整至" : "计划日期"} {date}</span> : <span>暂未指定日期</span>}</span></span>
  </li>;
}

export function CoursePlanStatus({ courseId }: { courseId: string }) {
  const [data, setData] = useState<CoursePlanDashboard | null>(null);
  const [showAll, setShowAll] = useState(false);
  useEffect(() => { void getCourseLearningPlanDashboard(courseId).then(setData).catch(() => setData(null)); }, [courseId]);
  const draft = data?.draft_plan; const pending = data?.pending_plan; const active = data?.active_plan;
  const tasks = useMemo(() => data?.plan_tasks?.length ? data.plan_tasks : (data?.today_tasks ?? []), [data]);
  const currentId = data?.current_task?.id;
  const foundCurrentIndex = tasks.findIndex((task) => task.id === currentId);
  const previewStart = Math.max(0, foundCurrentIndex > -1 ? foundCurrentIndex - 1 : 0);
  const previewTasks = tasks.slice(previewStart, previewStart + 4);
  const visibleTasks = showAll ? tasks : previewTasks;

  if (draft) return <section className="rounded-2xl border border-sky-200 bg-sky-50/60 p-4"><p className="font-semibold text-foreground">有一份计划等待继续编辑</p><p className="mt-1 text-sm text-muted-foreground">“{draft.plan.title}”还没有开始执行，补充或调整后再确认即可。</p><Link href={`/learning-plans/${draft.plan.id}/edit`} className="mt-3 inline-flex rounded-lg bg-brand px-3 py-2 text-sm font-semibold text-brand-foreground">继续编辑</Link></section>;
  if (pending) return <section className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4"><p className="font-semibold text-foreground">学习计划等待确认</p><p className="mt-1 text-sm text-muted-foreground">我们已经准备好“{pending.plan.title}”，确认后即可开始。</p><Link href={`/learning-plans/${pending.plan.id}/review`} className="mt-3 inline-flex rounded-lg bg-brand px-3 py-2 text-sm font-semibold text-brand-foreground">查看并确认</Link></section>;
  if (active) {
    const total = active.task_count || tasks.length;
    const overdueDays = getPlanOverdueDays(active.plan);
    return <section className={`rounded-2xl border p-4 ${overdueDays ? "border-destructive/25 bg-destructive/5" : "border-brand/20 bg-brand-muted/25"}`}>
      <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-semibold text-foreground">当前学习计划</p><p className="mt-1 text-sm text-muted-foreground">{active.plan.title} · 已完成 {active.completed_task_count}/{total} 项</p></div><div className="flex flex-wrap gap-2"><span className="rounded-full bg-card px-2.5 py-1 text-xs font-medium text-brand">进行中</span>{overdueDays > 0 && <span className="rounded-full bg-destructive/10 px-2.5 py-1 text-xs font-semibold text-destructive">计划延期 {overdueDays} 天</span>}</div></div>
      {visibleTasks.length ? <><div className="mt-4 flex items-center justify-between gap-2"><p className="text-xs font-semibold text-foreground">任务全貌</p><span className="text-[11px] text-muted-foreground">共 {tasks.length} 项</span></div><ol className={`mt-2 space-y-2 ${showAll && tasks.length > 6 ? "max-h-96 overflow-y-auto pr-1" : ""}`}>{visibleTasks.map((task) => <TaskTimelineRow key={task.id} task={task} active={task.id === currentId} />)}</ol>{tasks.length > previewTasks.length && <button type="button" onClick={() => setShowAll((value) => !value)} className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-brand hover:underline">{showAll ? <><ChevronUp className="size-3.5" />收起任务</> : <><ChevronDown className="size-3.5" />查看全部 {tasks.length} 项任务</>}</button>}</> : <p className="mt-4 rounded-xl bg-card/70 px-3 py-3 text-sm text-muted-foreground">当前没有可执行任务，请在计划中安排下一步。</p>}
      <div className="mt-4 flex flex-wrap items-center gap-3"><Link href={`/learning-plans/${active.plan.id}`} className="inline-flex rounded-lg border border-brand/30 bg-card px-3 py-2 text-sm font-semibold text-brand hover:bg-brand-muted">管理详细计划</Link>{data?.current_task?.estimated_minutes ? <span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><Clock3 className="size-3.5" />当前任务约 {data.current_task.estimated_minutes} 分钟</span> : null}</div>
    </section>;
  }
  return <section className="rounded-2xl border border-dashed border-border p-4"><p className="font-semibold">制定学习计划</p><p className="mt-1 text-sm text-muted-foreground">根据本学习空间的真实章节生成可调整草稿。</p><div className="mt-3 flex gap-4"><Link href={`/learning-plans/ai/new?courseId=${courseId}`} className="text-sm font-semibold text-brand hover:underline">AI 生成学习计划</Link><Link href={`/learning-plans/new?courseId=${courseId}`} className="text-sm font-medium text-muted-foreground hover:text-foreground">手动创建</Link></div></section>;
}
