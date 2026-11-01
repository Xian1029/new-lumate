"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createLearningPlan, createLearningTask, getContentTree, listCourseOverview, planAction, type ContentNode, type CourseOverviewCard, type LearningTaskType } from "@/lib/api";
import { toast } from "sonner";

const taskTypes: Array<{ value: LearningTaskType; label: string }> = [
  { value: "LEARN", label: "学习新内容" },
  { value: "PRACTICE", label: "完成练习" },
  { value: "REVIEW", label: "复习巩固" },
  { value: "NOTE", label: "整理笔记" },
];

/** Creates a usable plan: a draft must contain a first task before review. */
export default function NewLearningPlanPage() {
  const router = useRouter();
  const [courses, setCourses] = useState<CourseOverviewCard[]>([]);
  const [courseId, setCourseId] = useState("");
  const [nodes, setNodes] = useState<ContentNode[]>([]);
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { void listCourseOverview().then(setCourses).catch((error) => toast.error((error as Error).message || "课程加载失败")); }, []);
  useEffect(() => { if (!courseId) return; void getContentTree(courseId).then((data) => { setNodes(data); setSelectedNodeIds([]); }).catch(() => { setNodes([]); setSelectedNodeIds([]); toast.error("无法读取课程章节，请稍后重试。"); }); }, [courseId]);
  const chapterOptions = useMemo(() => { const result: Array<{ id: string; label: string }> = []; const visit = (items: ContentNode[], parents: string[]) => items.forEach((node) => { const path = [...parents, node.title]; if (node.children?.length) visit(node.children, path); else if (node.content_category !== "syllabus") result.push({ id: node.id, label: path.join(" / ") }); }); visit(nodes, []); return result; }, [nodes]);
  const toggleNode = (id: string) => setSelectedNodeIds((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const courseId = String(form.get("courseId") || "");
    const title = String(form.get("title") || "").trim();
    const firstTask = String(form.get("firstTask") || "").trim();
    if (!courseId || !title || !firstTask || !selectedNodeIds.length) { toast.error("请选择学习空间和至少一个具体学习章节。"); return; }
    setSubmitting(true);
    try {
      const plan = await createLearningPlan({
        course_id: courseId,
        title,
        description: String(form.get("description") || "").trim() || null,
        target_date: String(form.get("targetDate") || "") || null,
        available_minutes_per_day: Number(form.get("minutes")) || null,
        source: "USER",
        draft_payload: { selected_content_node_ids: selectedNodeIds },
      });
      const selectedOptions = chapterOptions.filter((option) => selectedNodeIds.includes(option.id));
      for (const [index, option] of selectedOptions.entries()) {
        await createLearningTask(plan.id, {
          title: selectedOptions.length === 1 ? firstTask : `${firstTask}：${option.label.split(" / ").at(-1)}`,
          task_type: String(form.get("taskType") || "LEARN") as LearningTaskType,
          sequence: index + 1,
          content_node_id: option.id,
          instruction: String(form.get("instruction") || "").trim() || null,
          estimated_minutes: Number(form.get("taskMinutes")) || null,
          required: true,
        });
      }
      await planAction(plan.id, "submit");
      toast.success("计划已创建，请确认后开始执行。");
      router.push(`/learning-plans/${plan.id}/review`);
    } catch (error) {
      toast.error((error as Error).message || "创建计划失败，请重试");
    } finally {
      setSubmitting(false);
    }
  };

  return <main className="mx-auto min-h-screen max-w-2xl bg-background px-4 py-8 sm:px-6"><button type="button" className="text-sm text-brand hover:underline" onClick={() => router.push("/learning-plans")}>← 学习计划中心</button><header className="mt-4"><h1 className="text-2xl font-bold text-foreground">新建学习计划</h1><p className="mt-2 text-sm text-muted-foreground">选择一个或多个具体学习章节；每个所选章节都会生成一项任务，提交后可在确认页检查和调整。</p></header><form onSubmit={submit} className="mt-6 space-y-5 rounded-2xl border border-border/70 bg-card p-5"><label className="block text-sm font-medium">学习空间<select name="courseId" value={courseId} onChange={(event) => setCourseId(event.target.value)} required className="mt-2 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"><option value="">请选择学习空间</option>{courses.map((course) => <option key={course.id} value={course.id}>{course.name}</option>)}</select></label><label className="block text-sm font-medium">计划名称<Input name="title" required className="mt-2" placeholder="例如：本周完成有理数基础学习" /></label><label className="block text-sm font-medium">目标日期<Input name="targetDate" type="date" className="mt-2" /></label><label className="block text-sm font-medium">每天预计学习时间（分钟）<Input name="minutes" type="number" min="1" className="mt-2" placeholder="例如 30" /></label><label className="block text-sm font-medium">计划说明<textarea name="description" className="mt-2 min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" placeholder="这段时间想达成什么？" /></label><div className="rounded-xl bg-muted/35 p-4"><div className="flex items-center justify-between gap-3"><div><p className="text-sm font-semibold">计划任务</p><p className="mt-1 text-xs text-muted-foreground">每个所选章节都会创建一项独立任务。</p></div>{selectedNodeIds.length > 0 && <span className="shrink-0 rounded-full bg-brand-muted px-2.5 py-1 text-xs font-semibold text-brand">已选 {selectedNodeIds.length} 个</span>}</div><fieldset className="mt-3"><legend className="text-sm font-medium">选择课程章节（可多选）</legend><div className="mt-2 max-h-64 space-y-1 overflow-y-auto rounded-xl border border-input bg-background p-2">{!courseId ? <p className="p-3 text-sm text-muted-foreground">请先选择学习空间</p> : !chapterOptions.length ? <p className="p-3 text-sm text-muted-foreground">暂无可学习章节，请先完成资料解析</p> : chapterOptions.map((node) => <label key={node.id} className="flex cursor-pointer items-start gap-2 rounded-lg px-3 py-2 text-sm hover:bg-muted"><input type="checkbox" checked={selectedNodeIds.includes(node.id)} onChange={() => toggleNode(node.id)} className="mt-0.5" /><span>{node.label}</span></label>)}</div>{chapterOptions.length > 0 && <div className="mt-2 flex gap-3 text-xs"><button type="button" onClick={() => setSelectedNodeIds(chapterOptions.map((node) => node.id))} className="font-medium text-brand hover:underline">全选</button><button type="button" onClick={() => setSelectedNodeIds([])} disabled={!selectedNodeIds.length} className="font-medium text-muted-foreground hover:text-foreground disabled:opacity-40">清空选择</button></div>}</fieldset><label className="mt-3 block text-sm font-medium">任务名称<Input name="firstTask" required className="mt-2" placeholder="例如：完成例题与基础练习" /><span className="mt-1 block text-xs font-normal text-muted-foreground">选择多个章节时，系统会在任务名称后附加对应章节名称。</span></label><div className="mt-3 grid gap-3 sm:grid-cols-2"><label className="text-sm font-medium">任务类型<select name="taskType" className="mt-2 h-10 w-full rounded-md border border-input bg-background px-3 text-sm">{taskTypes.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label><label className="text-sm font-medium">每个章节预计分钟<Input name="taskMinutes" type="number" min="1" className="mt-2" placeholder="例如 25" /></label></div><label className="mt-3 block text-sm font-medium">统一完成提示<textarea name="instruction" className="mt-2 min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" placeholder="写清完成标准，例如：完成 10 道基础题并订正。" /></label></div><div className="flex justify-end gap-3"><Button type="button" variant="outline" disabled={submitting} onClick={() => router.push("/learning-plans")}>取消</Button><Button disabled={submitting || courses.length === 0 || !chapterOptions.length || !selectedNodeIds.length}>{submitting ? "正在创建…" : `创建 ${selectedNodeIds.length || ""} 项任务并确认`}</Button></div></form></main>;
}
