"use client";

import { BookOpen, Lightbulb, Target } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { MarkdownRenderer } from "@/components/shared/markdown-renderer";

const SECTION_META = {
  课本原意: {
    step: "01",
    icon: BookOpen,
    caption: "先读懂课本在说什么",
    tone: "border-sky-200/70 bg-gradient-to-br from-sky-50/90 to-card dark:border-sky-900/70 dark:from-sky-950/25 dark:to-card",
    iconTone: "bg-sky-600 text-white shadow-sm dark:bg-sky-700",
  },
  补充知识: {
    step: "02",
    icon: Lightbulb,
    caption: "把精选内容讲得更明白",
    tone: "border-amber-200/70 bg-gradient-to-br from-amber-50/90 to-card dark:border-amber-900/70 dark:from-amber-950/25 dark:to-card",
    iconTone: "bg-amber-500 text-white shadow-sm dark:bg-amber-700",
  },
  学习提示: {
    step: "03",
    icon: Target,
    caption: "记住本段最重要的内容",
    tone: "border-emerald-200/70 bg-gradient-to-br from-emerald-50/90 to-card dark:border-emerald-900/70 dark:from-emerald-950/25 dark:to-card",
    iconTone: "bg-emerald-600 text-white shadow-sm dark:bg-emerald-700",
  },
} as const;

type PdfSectionTitle = keyof typeof SECTION_META;

export interface PdfAnswerSection {
  title: PdfSectionTitle;
  content: string;
}

export function splitPdfAnswer(value: string): PdfAnswerSection[] {
  const normalized = value.replace(
    /^\*\*(课本原意|补充知识|学习提示)\*\*[ \t]*$/gm,
    "### $1",
  );
  const heading = /^###\s*(课本原意|补充知识|学习提示)\s*$/gm;
  const matches = Array.from(normalized.matchAll(heading));
  return matches.map((match, index) => ({
    title: match[1] as PdfSectionTitle,
    content: normalized.slice(
      (match.index ?? 0) + match[0].length,
      matches[index + 1]?.index ?? normalized.length,
    ).trim(),
  })).filter((section) => section.content);
}

export function PdfAnswer({ answer, sourceLabel }: { answer: string; sourceLabel: string }) {
  const sections = splitPdfAnswer(answer);
  const readableCharacters = answer.replace(/[#>*_`\s\[\]（）()]/g, "").length;
  const readingMinutes = Math.max(1, Math.min(3, Math.ceil(readableCharacters / 300)));

  return (
    <div className="overflow-hidden rounded-3xl border border-brand/15 bg-card shadow-[0_14px_35px_-28px_rgba(24,53,45,0.55)]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 bg-gradient-to-r from-brand-muted/45 via-card to-card px-4 py-3.5">
        <div>
          <div className="flex items-center gap-2"><p className="text-sm font-bold text-foreground">精读阅读卡</p><span className="rounded-full bg-card px-2 py-0.5 text-[11px] font-medium text-muted-foreground shadow-sm">约 {readingMinutes} 分钟</span></div>
          <p className="mt-1 text-xs text-muted-foreground">先看结论，再理解要点</p>
        </div>
        {sourceLabel && <Badge variant="secondary" className="h-7 rounded-full border border-brand/10 bg-card px-2.5 font-normal text-brand shadow-sm"><BookOpen className="mr-1 size-3" />依据：{sourceLabel}</Badge>}
      </div>
      {sections.length ? (
        <div className="space-y-3 p-3 sm:p-4">
          {sections.map((section) => {
            const meta = SECTION_META[section.title];
            const Icon = meta.icon;
            return (
              <section key={section.title} className={`relative overflow-hidden rounded-2xl border p-3.5 ${meta.tone}`}>
                <span className="absolute right-3 top-1 text-3xl font-black tracking-tighter text-foreground/[0.035]" aria-hidden="true">{meta.step}</span>
                <div className="mb-2.5 flex items-center gap-3">
                  <span className={`grid size-9 shrink-0 place-items-center rounded-xl ${meta.iconTone}`}><Icon className="size-4" /></span>
                  <div><h3 className="text-[15px] font-bold text-foreground">{section.title}</h3><p className="text-[11px] text-muted-foreground">{meta.caption}</p></div>
                </div>
                <MarkdownRenderer content={section.content} className="min-w-0 break-words text-[14px] [&_blockquote]:my-2 [&_blockquote]:rounded-xl [&_blockquote]:border-l-[3px] [&_blockquote]:bg-white/70 [&_blockquote]:px-3 [&_blockquote]:py-2 dark:[&_blockquote]:bg-black/10 [&_li]:leading-6 [&_ol]:my-2 [&_ol]:space-y-1.5 [&_ol]:bg-white/55 [&_ol]:px-7 [&_ol]:py-2.5 dark:[&_ol]:bg-black/10 [&_p]:my-1.5 [&_p]:leading-6 [&_strong]:text-brand [&_ul]:my-2 [&_ul]:space-y-1.5 [&_ul]:bg-white/55 [&_ul]:px-5 [&_ul]:py-2.5 dark:[&_ul]:bg-black/10" />
              </section>
            );
          })}
        </div>
      ) : (
        <MarkdownRenderer content={answer} className="min-w-0 break-words px-4 py-4 text-[14px] [&_p]:leading-6" />
      )}
    </div>
  );
}
