"use client";

import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, TriangleAlert } from "lucide-react";
import { useMemo, useState } from "react";
import type { HomeCalendarItem, LearningHomeOverview } from "@/lib/api";

type CalendarTask = LearningHomeOverview["today_tasks"][number];

const WEEKDAYS = ["一", "二", "三", "四", "五", "六", "日"];

function dateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function monthCells(month: Date): Array<Date | null> {
  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const leading = (new Date(year, monthIndex, 1).getDay() + 6) % 7;
  const days = new Date(year, monthIndex + 1, 0).getDate();
  return [...Array.from({ length: leading }, () => null), ...Array.from({ length: days }, (_, index) => new Date(year, monthIndex, index + 1))];
}

function CalendarItemCard({ item, onNavigate }: { item: HomeCalendarItem; onNavigate: (href: string) => void }) {
  const status = item.item_type === "PLAN_TARGET"
    ? (item.status === "PAUSED" ? "已暂停" : "进行中")
    : item.status === "COMPLETED" ? "已完成" : item.status === "IN_PROGRESS" ? "进行中" : "待完成";
  return <button type="button" onClick={() => onNavigate(item.href)} className={`w-full rounded-lg border p-3 text-left shadow-sm transition-colors hover:bg-brand-muted/40 ${item.is_overdue ? "border-destructive/25 bg-destructive/5" : "border-transparent bg-card"}`}>
    <span className={`mb-1 inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${item.is_overdue ? "bg-destructive/10 text-destructive" : item.item_type === "PLAN_TARGET" ? "bg-amber-100 text-amber-800" : "bg-brand-muted text-brand"}`}>
      {item.is_overdue ? `已延期 ${item.overdue_days || 1} 天` : item.item_type === "PLAN_TARGET" ? "计划目标" : item.is_unscheduled ? "今日已开启" : "学习任务"}
    </span>
    <p className="line-clamp-2 text-sm font-medium text-foreground">{item.title}</p>
    <p className="mt-1 text-xs text-muted-foreground">{item.course_name} · {item.item_type === "PLAN_TARGET" ? status : `预计 ${item.estimated_minutes || "—"} 分钟 · ${status}`}</p>
  </button>;
}

export function HomeCalendar({ overview, onNavigate }: { overview: LearningHomeOverview | null; onNavigate: (href: string) => void }) {
  const today = useMemo(() => new Date(), []);
  const [expanded, setExpanded] = useState(false);
  const [visibleMonth, setVisibleMonth] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [selectedDate, setSelectedDate] = useState(() => dateKey(today));
  const items = useMemo<HomeCalendarItem[]>(() => {
    if (!overview) return [];
    if (overview.calendar_items) return overview.calendar_items;
    // Compatibility with an older API during a rolling deployment.
    const byId = new Map<string, CalendarTask>();
    [...overview.today_tasks, ...overview.upcoming_tasks].forEach((task) => byId.set(task.id, task));
    return [...byId.values()].flatMap((task) => {
      const date = (task.postponed_to || task.scheduled_for)?.slice(0, 10);
      return date ? [{ id: `task:${task.id}`, plan_id: task.plan_id, course_id: task.course_id, course_name: task.course_name || "学习空间", plan_title: task.plan_title, title: task.title, date, item_type: "TASK" as const, status: task.status, estimated_minutes: task.estimated_minutes, href: task.href }] : [];
    });
  }, [overview]);
  const itemsByDate = useMemo(() => {
    const grouped = new Map<string, HomeCalendarItem[]>();
    items.forEach((item) => {
      grouped.set(item.date, [...(grouped.get(item.date) ?? []), item]);
    });
    return grouped;
  }, [items]);
  const cells = monthCells(visibleMonth);
  const selectedItems = itemsByDate.get(selectedDate) ?? [];
  const overdueItems = items.filter((item) => item.is_overdue);
  const nextItem = items.find((item) => !item.is_overdue && item.date >= dateKey(today));
  const selectedLabel = selectedDate === dateKey(today) ? "今天" : `${Number(selectedDate.slice(5, 7))} 月 ${Number(selectedDate.slice(8, 10))} 日`;
  const changeMonth = (offset: number) => setVisibleMonth((current) => new Date(current.getFullYear(), current.getMonth() + offset, 1));
  const returnToday = () => {
    setVisibleMonth(new Date(today.getFullYear(), today.getMonth(), 1));
    setSelectedDate(dateKey(today));
  };

  return <section aria-label="学习日历" className="overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm">
    <header className={`flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 ${expanded ? "border-b border-border/60" : ""}`}>
      <div className="flex items-center gap-2"><span className="grid size-8 place-items-center rounded-lg bg-brand-muted/70 text-brand"><CalendarDays className="size-4" /></span><div><h2 className="text-sm font-semibold text-foreground">学习日历</h2><p className={`text-xs ${overdueItems.length ? "font-medium text-destructive" : "text-muted-foreground"}`}>{overdueItems.length ? `${overdueItems.length} 项计划已延期，建议优先处理` : expanded ? "按日期查看学习任务与安排" : (nextItem ? `下一项：${Number(nextItem.date.slice(5, 7))} 月 ${Number(nextItem.date.slice(8, 10))} 日` : "暂无待安排的学习任务")}</p></div></div>
      {expanded ? <div className="flex items-center gap-1"><button type="button" onClick={returnToday} className="mr-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-brand hover:bg-brand-muted" aria-label="返回今天">今天</button><button type="button" onClick={() => changeMonth(-1)} className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="上个月"><ChevronLeft className="size-4" /></button><p className="min-w-24 text-center text-sm font-semibold tabular-nums">{visibleMonth.getFullYear()} 年 {visibleMonth.getMonth() + 1} 月</p><button type="button" onClick={() => changeMonth(1)} className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="下个月"><ChevronRight className="size-4" /></button><button type="button" onClick={() => setExpanded(false)} className="ml-1 inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="收起日历">收起<ChevronUp className="size-3.5" /></button></div> : <button type="button" onClick={() => setExpanded(true)} className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground" aria-expanded="false"><span>查看日历</span><ChevronDown className="size-3.5" /></button>}
    </header>
    {expanded && <div className="grid gap-5 p-4 sm:grid-cols-[minmax(0,1fr)_17rem] sm:p-5">
      <div><div className="grid grid-cols-7 text-center text-[11px] font-medium text-muted-foreground">{WEEKDAYS.map((day) => <span key={day} className="py-1">{day}</span>)}</div><div className="mt-1 grid grid-cols-7 gap-1">{cells.map((date, index) => {
        if (!date) return <span key={`empty-${index}`} aria-hidden="true" />;
        const key = dateKey(date);
        const count = itemsByDate.get(key)?.length ?? 0;
        const hasOverdue = itemsByDate.get(key)?.some((item) => item.is_overdue) ?? false;
        const selected = key === selectedDate;
        const isToday = key === dateKey(today);
        return <button key={key} type="button" onClick={() => setSelectedDate(key)} aria-label={`${date.getMonth() + 1}月${date.getDate()}日${count ? `，${count}项学习安排` : ""}${hasOverdue ? "，包含延期任务" : ""}`} aria-pressed={selected} className={`relative flex aspect-square min-h-9 flex-col items-center justify-center rounded-xl text-sm transition-colors ${selected ? "bg-brand text-brand-foreground shadow-sm" : isToday ? "bg-brand-muted font-semibold text-brand" : hasOverdue ? "bg-destructive/5 text-destructive hover:bg-destructive/10" : "text-foreground hover:bg-muted"}`}><span>{date.getDate()}</span>{count > 0 && <span className={`absolute bottom-1.5 size-1.5 rounded-full ${selected ? "bg-brand-foreground" : hasOverdue ? "bg-destructive" : "bg-amber-500"}`} />}</button>;
      })}</div></div>
      <aside className="max-h-[28rem] overflow-y-auto rounded-xl bg-muted/35 p-4">
        {overdueItems.length > 0 && <div className="mb-4 rounded-xl border border-destructive/20 bg-destructive/5 p-3"><div className="flex items-center gap-2 text-destructive"><TriangleAlert className="size-4" /><h3 className="text-sm font-semibold">延期提醒</h3><span className="ml-auto text-[11px]">{overdueItems.length} 项</span></div><div className="mt-2 space-y-2">{overdueItems.slice(0, 4).map((item) => <CalendarItemCard key={`overdue:${item.id}`} item={item} onNavigate={onNavigate} />)}</div>{overdueItems.length > 4 && <button type="button" onClick={() => onNavigate("/learning-plans")} className="mt-2 text-xs font-semibold text-destructive hover:underline">查看全部延期任务</button>}</div>}
        <div className="flex items-center justify-between gap-2"><h3 className="text-sm font-semibold text-foreground">{selectedLabel}的安排</h3>{selectedItems.length > 0 && <span className="rounded-full bg-card px-2 py-0.5 text-[11px] text-muted-foreground">{selectedItems.length} 项</span>}</div>
        {selectedItems.length ? <div className="mt-3 space-y-2">{selectedItems.map((item) => <CalendarItemCard key={item.id} item={item} onNavigate={onNavigate} />)}</div> : <div className="mt-4 rounded-lg border border-dashed border-border px-3 py-5 text-center"><p className="text-sm text-muted-foreground">这一天还没有学习安排</p>{nextItem ? <button type="button" onClick={() => { const [year, month] = nextItem.date.split("-").map(Number); setVisibleMonth(new Date(year, month - 1, 1)); setSelectedDate(nextItem.date); }} className="mt-2 text-xs font-medium text-brand hover:underline">下一项：{Number(nextItem.date.slice(5, 7))} 月 {Number(nextItem.date.slice(8, 10))} 日 · {nextItem.title}</button> : <p className="mt-1 text-xs text-muted-foreground">可以安心复习，或从感兴趣的内容开始。</p>}</div>}
      </aside>
    </div>}
  </section>;
}
