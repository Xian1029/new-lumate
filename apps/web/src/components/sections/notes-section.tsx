"use client";

import { t } from "@/lib/i18n";
import { useState, useCallback, useEffect, useMemo, useRef, type PointerEvent as ReactPointerEvent } from "react";
import { createPortal } from "react-dom";
import { ArrowRight, BookOpen, Sparkles, X } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PdfAnswer } from "@/components/ai-pdf-reader/pdf-answer";
import { useCourseStore } from "@/store/course";
import { useWorkspaceStore } from "@/store/workspace";
import { useT } from "@/lib/i18n-context";
import {
  listGeneratedNoteBatches,
  restructureNotes,
  saveGeneratedNotes,
  getAiNoteForNode,
  listCourseFiles,
  type AiNoteForNode,
  type UploadedCourseFile,
} from "@/lib/api";
import { API_BASE, buildSecureRequestInit } from "@/lib/api/client";
import { stabilizeMarkdownMermaidBlocks } from "@/lib/markdown/mermaid";
import { takePdfStreamEvents } from "@/lib/pdf-reader/sse";
import { useBatchManager } from "@/hooks/use-batch-manager";
import { AiFeatureBlocked } from "@/components/shared/ai-feature-blocked";
import { collectContentNodes, findFirstContentNode, findNodeById, isLearnableContentNode } from "@/lib/content-tree";
import { ContentNodeItem } from "./notes/content-node-item";
import { CornellNoteView } from "./notes/cornell-note-view";
import { toast } from "sonner";

/** Application-owned viewer: unlike the browser PDF plugin, its text layer is selectable. */
function cleanPdfSelection(value: string) {
  return value
    // PDF text streams commonly include control glyphs around illustrations.
    .replace(/[\u0000-\u0009\u000b-\u001f\u007f-\u009f]/g, " ")
    .replace(/\uE011/g, "-")
    .split(/\n+/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .map((line) => line.replace(/(?<=[\p{Script=Han}０-９（）．，。、])\s+(?=[\p{Script=Han}０-９（）．，。、])/gu, ""))
    .filter(Boolean)
    .join("\n")
    .replace(/(?<=[\p{Script=Han}０-９）．，。、])\n(?=[\p{Script=Han}０-９（])/gu, "")
    .replace(/\n/g, " ")
    .trim()
    .slice(0, 2400);
}

function PdfStudyReader({ url, courseId, jobId, initialPage = 1 }: { url: string; courseId: string; jobId: string; initialPage?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const cachedAnswersRef = useRef(new Map<string, string>());
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);
  const [selected, setSelected] = useState("");
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [sourceLabel, setSourceLabel] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [status, setStatus] = useState("正在加载课本…");
  const [pageNumber, setPageNumber] = useState(initialPage);
  const [pageCount, setPageCount] = useState(0);

  useEffect(() => {
    let disposed = false;
    void (async () => {
      try {
        const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
        pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/legacy/build/pdf.worker.min.mjs", import.meta.url).toString();
        const response = await fetch(url, buildSecureRequestInit());
        if (!response.ok) throw new Error("file");
        const pdfDocument = await pdfjs.getDocument({ data: await response.arrayBuffer() }).promise;
        setPageCount(pdfDocument.numPages);
        const safePage = Math.min(Math.max(1, pageNumber), pdfDocument.numPages);
        const page = await pdfDocument.getPage(safePage);
        const viewport = page.getViewport({ scale: 1.3 });
        const canvas = canvasRef.current;
        const layer = textRef.current;
        if (!canvas || !layer || disposed) return;
        setSelected("");
        canvas.width = viewport.width; canvas.height = viewport.height;
        await page.render({ canvasContext: canvas.getContext("2d")!, viewport }).promise;
        layer.replaceChildren();
        layer.style.width = `${viewport.width}px`; layer.style.height = `${viewport.height}px`;
        setStatus(`第 ${safePage} / ${pdfDocument.numPages} 页。正在准备可选文字…`);
        try {
          const text = await page.getTextContent();
          for (const item of text.items) {
            if (!("str" in item) || !item.str || !("transform" in item)) continue;
            const span = window.document.createElement("span");
            // `item.transform` is expressed in PDF coordinates.  The canvas is
            // painted with `viewport.transform` (including its flipped Y axis),
            // so converting through the same matrix keeps the selectable layer
            // directly on top of the printed glyphs at every zoom level.
            const transformed = pdfjs.Util.transform(viewport.transform, item.transform as number[]);
            const fontSize = Math.max(8, Math.hypot(transformed[2], transformed[3]));
            const angle = Math.atan2(transformed[1], transformed[0]) * (180 / Math.PI);
            span.textContent = item.str;
            span.dataset.pdfBaseline = String(transformed[5]);
            span.style.cssText = `position:absolute;left:${transformed[4]}px;top:${transformed[5] - fontSize}px;font-size:${fontSize}px;font-family:sans-serif;line-height:1;white-space:pre;color:transparent;cursor:text;transform-origin:0 0;`;
            layer.appendChild(span);
            // PDF glyph widths rarely match the browser fallback font. Scale the
            // selectable span to PDF's measured width so native selection looks
            // like a compact WPS-style highlight rather than long rectangles.
            const pdfWidth = Math.abs((item.width ?? 0) * viewport.scale);
            const browserWidth = span.getBoundingClientRect().width;
            const scaleX = pdfWidth > 0 && browserWidth > 0 ? pdfWidth / browserWidth : 1;
            span.style.transform = `rotate(${angle}deg) scaleX(${scaleX})`;
          }
          setStatus(`第 ${safePage} / ${pdfDocument.numPages} 页。拖选文字即可精读。`);
        } catch { setStatus(`第 ${safePage} / ${pdfDocument.numPages} 页已显示，但文字层暂不可用。`); }
      } catch { setStatus("课本加载失败，请关闭后重试。"); }
    })();
    return () => { disposed = true; abortRef.current?.abort(); };
  }, [url, pageNumber]);

  const explain = async () => {
    const text = selected.trim();
    if (!text || abortRef.current) return;
    const learnerQuestion = question.trim() || "请详细解释这段课本内容。";
    const cacheKey = JSON.stringify([jobId, pageNumber, text, learnerQuestion]);
    const cached = cachedAnswersRef.current.get(cacheKey);
    if (cached) {
      setAnswer(cached);
      toast.info("这段文字已解释，已显示上次结果。");
      return;
    }
    const controller = new AbortController();
    abortRef.current = controller;
    setIsGenerating(true);
    setAnswer("正在生成解释，请稍候…");
    const timeout = window.setTimeout(() => controller.abort("timeout"), 55_000);
    try {
      const response = await fetch(`${API_BASE}/pdf-reader/explanations/stream`, buildSecureRequestInit({ method: "POST", body: JSON.stringify({ course_id: courseId, job_id: jobId, anchor: { page: pageNumber, text }, question: learnerQuestion }), signal: controller.signal }));
      if (!response.ok || !response.body) {
        if (response.status === 401 || response.status === 403 || response.status === 404) {
          setAnswer("暂时无法访问这本课本，请返回学习空间后重试。");
        } else if (response.status === 429) {
          setAnswer("提问太频繁了，请稍等片刻再试。");
        } else {
          setAnswer("解释暂时无法生成，请稍后重试。");
        }
        return;
      }
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let receivedContent = false;
      let receivedError = false;
      let fullAnswer = "";
      while (true) {
        const { done, value } = await reader.read(); if (done) break;
        if (controller.signal.aborted) return;
        const parsed = takePdfStreamEvents(buffer + decoder.decode(value, { stream: true }));
        buffer = parsed.remainder;
        for (const event of parsed.events) {
          if (controller.signal.aborted) return;
          if (event.event === "content") {
            const chunk = JSON.parse(event.data) as { content?: string };
            if (chunk.content) {
              fullAnswer += chunk.content;
              setAnswer(fullAnswer);
              receivedContent = true;
            }
          } else if (event.event === "sources") {
            const sources = JSON.parse(event.data) as Array<{ label?: string }>;
            setSourceLabel(sources[0]?.label ?? `课本第 ${pageNumber} 页`);
          } else if (event.event === "no_evidence") {
            const payload = JSON.parse(event.data) as { message?: string };
            receivedError = true;
            setAnswer(payload.message ?? "这一页暂时无法提取课本正文，请换一页重试。");
          } else if (event.event === "error") {
            receivedError = true;
            setAnswer("解释暂时中断了，请点击“重试解释”再试一次。");
          }
        }
      }
      if (controller.signal.aborted) return;
      if (!receivedContent && !receivedError) setAnswer("暂时没有生成解释，请重新选择文段后再试。");
      if (receivedContent && !receivedError) cachedAnswersRef.current.set(cacheKey, fullAnswer);
    } catch {
      if (controller.signal.aborted && controller.signal.reason === "user") {
        setAnswer((old) => old === "正在生成解释，请稍候…" ? "已停止生成。" : old);
      } else if (controller.signal.aborted && controller.signal.reason === "timeout") {
        setAnswer("解释等待时间较长，请点击“重试解释”再试一次。");
      } else if (!controller.signal.aborted) {
        setAnswer("网络似乎不稳定，请稍后重试。");
      }
    } finally {
      window.clearTimeout(timeout);
      if (abortRef.current === controller) {
        abortRef.current = null;
        setIsGenerating(false);
      }
    }
  };

  const clearReading = () => {
    abortRef.current?.abort("clear");
    abortRef.current = null;
    dragStartRef.current = null;
    window.getSelection()?.removeAllRanges();
    textRef.current?.querySelector(".pdf-selection-overlay")?.remove();
    setSelected("");
    setQuestion("");
    setAnswer("");
    setSourceLabel("");
    setIsGenerating(false);
  };

  const startSelection = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    window.getSelection()?.removeAllRanges();
    const layerBounds = textRef.current?.getBoundingClientRect();
    if (!layerBounds) return;
    dragStartRef.current = { x: event.clientX - layerBounds.left, y: event.clientY - layerBounds.top };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const finishSelection = (event: ReactPointerEvent<HTMLDivElement>) => {
    const layer = textRef.current;
    const start = dragStartRef.current;
    if (!layer || !start) return;
    dragStartRef.current = null;
    const bounds = layer.getBoundingClientRect();
    const end = { x: event.clientX - bounds.left, y: event.clientY - bounds.top };
    const top = Math.min(start.y, end.y);
    const bottom = Math.max(start.y, end.y);
    const spans = Array.from(layer.querySelectorAll<HTMLSpanElement>("span"));
    const selectedSpans = spans.map((span) => ({ span, rect: span.getBoundingClientRect() }))
      .filter(({ rect }) => rect.bottom - bounds.top >= top && rect.top - bounds.top <= bottom);
    if (!selectedSpans.length) return;

    // Select complete visual lines. It makes dragging across a paragraph stable
    // even when one PDF line is split into many glyph runs, and never selects
    // the raster image below because it has no text-layer spans.
    type SelectionItem = { span: HTMLSpanElement; rect: DOMRect; baseline: number };
    const orderedLines: Array<{ baseline: number; items: SelectionItem[] }> = [];
    for (const { span, rect, baseline } of selectedSpans.map((item) => ({
      ...item,
      baseline: Number(item.span.dataset.pdfBaseline) || item.rect.bottom - bounds.top,
    })).sort((a, b) => a.baseline - b.baseline)) {
      // Superscripts, numerals and punctuation often sit 1-3 px away from the
      // sentence baseline. Cluster by distance, never by rounded grid cells.
      const line = orderedLines.find((candidate) => Math.abs(candidate.baseline - baseline) <= 6);
      if (line) line.items.push({ span, rect, baseline });
      else orderedLines.push({ baseline, items: [{ span, rect, baseline }] });
    }
    const text = cleanPdfSelection(orderedLines.map(({ items }) => items
      .sort((a, b) => a.rect.left - b.rect.left)
      .map(({ span }) => span.textContent ?? "").join("").trim()).join("\n"));
    if (!text) return;
    setSelected(text);
    setAnswer("");
    setQuestion("");
    setSourceLabel("");
    layer.querySelector(".pdf-selection-overlay")?.remove();
    const overlay = window.document.createElement("div");
    overlay.className = "pdf-selection-overlay";
    overlay.style.cssText = "pointer-events:none;position:absolute;inset:0;";
    for (const { baseline, items: line } of orderedLines) {
      const left = Math.min(...line.map(({ rect }) => rect.left - bounds.left));
      const right = Math.max(...line.map(({ rect }) => rect.right - bounds.left));
      const lineHeight = Math.max(14, Math.min(24, Math.max(...line.map(({ rect }) => rect.height)) * 0.62));
      const lineTop = baseline - lineHeight + 2;
      const highlight = window.document.createElement("div");
      highlight.style.cssText = `position:absolute;left:${left}px;top:${lineTop}px;width:${right - left}px;height:${lineHeight}px;border-radius:2px;background:rgb(91 156 255 / 0.28);`;
      overlay.appendChild(highlight);
    }
    layer.appendChild(overlay);
    window.getSelection()?.removeAllRanges();
  };

  return <div className="grid min-h-0 flex-1 grid-cols-1 grid-rows-2 gap-3 p-3 md:grid-cols-[minmax(0,1fr)_24rem] md:grid-rows-1">
    <div className="relative overflow-auto rounded-xl bg-muted/30 p-3">
      <div className="sticky top-0 z-10 mb-2 flex items-center justify-center gap-3"><Button size="sm" variant="outline" disabled={pageNumber <= 1} onClick={() => setPageNumber((p) => p - 1)}>上一页</Button><span className="rounded bg-background px-2 py-1 text-xs">第 {pageNumber} / {pageCount || "…"} 页</span><Button size="sm" variant="outline" disabled={!pageCount || pageNumber >= pageCount} onClick={() => setPageNumber((p) => p + 1)}>下一页</Button></div>
      <div className="relative mx-auto w-fit"><canvas ref={canvasRef} className="block bg-white shadow" /><div ref={textRef} className="absolute left-0 top-0 cursor-text select-none" style={{ touchAction: "none" }} onPointerDown={startSelection} onPointerUp={finishSelection} /></div>
    </div>
    <aside className="overflow-auto rounded-2xl border bg-card p-4 shadow-sm">
      <div className="flex items-center gap-3"><span className="flex size-10 items-center justify-center rounded-xl bg-brand-muted text-brand"><Sparkles className="size-5" /></span><div><h2 className="text-lg font-bold">AI 精读</h2><p className="text-xs text-muted-foreground">回答仅依据当前课本页</p></div></div>
      <p className="mt-3 rounded-lg bg-muted/60 px-3 py-2 text-xs text-muted-foreground">{status}</p>
      <label htmlFor="pdf-selected-text" className="mt-4 block text-xs font-semibold">精选知识（可编辑）</label>
      <textarea id="pdf-selected-text" aria-label="选中文段，可编辑" value={selected} maxLength={2400} disabled={isGenerating} onChange={(event) => { setSelected(event.target.value); setAnswer(""); setSourceLabel(""); }} placeholder="拖选课本正文后，可在这里修改文字" className="mt-2 min-h-28 w-full resize-y rounded-xl border border-border bg-muted/40 p-3 text-[15px] leading-7 outline-none transition focus:border-brand/50 focus-visible:ring-2 focus-visible:ring-brand/20 disabled:opacity-70" />
      <p className="mt-1 text-right text-xs text-muted-foreground">{selected.length} / 2400 字</p>
      <label htmlFor="pdf-reader-question" className="mt-3 block text-xs font-semibold">想重点了解什么（选填）</label>
      <textarea id="pdf-reader-question" aria-label="精读追问" value={question} maxLength={800} disabled={isGenerating} onChange={(event) => setQuestion(event.target.value)} placeholder="例如：为什么需要引入负数？" className="mt-2 min-h-20 w-full resize-y rounded-xl border border-border bg-background p-3 text-[15px] leading-7 outline-none focus:border-brand/50 focus-visible:ring-2 focus-visible:ring-brand/20 disabled:opacity-70" />
      <div className="mt-3 flex items-center gap-2"><Button size="sm" disabled={!selected.trim() || isGenerating} onClick={() => void explain()}>{isGenerating ? "正在精读…" : answer ? "继续追问" : "详细解读"}</Button><Button size="sm" variant="ghost" disabled={!selected && !answer && !question && !isGenerating} onClick={clearReading}>清除</Button></div>
      <div className="mt-4 min-w-0" aria-live="polite">{answer && <PdfAnswer answer={answer} sourceLabel={sourceLabel} />}</div>
    </aside>
  </div>;
}

interface NotesSectionProps {
  courseId: string;
  blockId?: string;
  aiActionsEnabled?: boolean;
  immersive?: boolean;
  /** Opens one course file in the application-owned PDF reader. */
  initialFileJobId?: string | null;
  initialPage?: number | null;
  onCloseReader?: () => void;
}

interface GeneratedNoteDraft {
  title: string;
  markdown: string;
  format: string;
  sourceNodeId: string;
}

function cleanNoteText(value: unknown): string {
  if (typeof value !== "string") return "";

  // Some providers or copied source material arrive as UTF-8 bytes decoded as
  // Latin-1 (for example "ä¸­æ–‡"). Repair only that recognizable pattern so
  // ordinary non-English study content is never rewritten blindly.
  const withoutControls = value
    .replaceAll("\u0000", "")
    .replace(/[\u0001-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replaceAll("\uFFFD", "");
  const looksMojibaked = /(?:Ã.|Â.|â..|[\u00C2-\u00F4][\u0080-\u00BF])/.test(withoutControls);
  if (!looksMojibaked) return withoutControls.normalize("NFC").trim();

  try {
    // macOS/Windows text copied through a legacy path can turn bytes 80-9F
    // into their Windows-1252 punctuation equivalents.
    const cp1252Bytes: Record<number, number> = {
      0x2013: 0x96,
      0x2014: 0x97,
      0x2018: 0x91,
      0x2019: 0x92,
      0x201A: 0x82,
      0x201C: 0x93,
      0x201D: 0x94,
      0x2020: 0x86,
      0x2021: 0x87,
      0x2026: 0x85,
    };
    const rawBytes = Array.from(withoutControls, (char) => {
      const codePoint = char.codePointAt(0) ?? 0;
      return codePoint <= 0xff ? codePoint : cp1252Bytes[codePoint];
    });
    if (rawBytes.some((byte) => byte === undefined)) {
      return withoutControls.normalize("NFC").trim();
    }
    const bytes = Uint8Array.from(rawBytes as number[]);
    const repaired = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    return repaired.normalize("NFC").trim();
  } catch {
    return withoutControls.normalize("NFC").trim();
  }
}

export const cleanNoteTextForTest = cleanNoteText;

function cleanNoteMarkdown(value: unknown): string {
  const markdown = cleanNoteText(value);
  return markdown ? stabilizeMarkdownMermaidBlocks(markdown) : "";
}

function normalizeGeneratedNoteDraft(
  payload: unknown,
  sourceNodeId: string,
  fallbackTitle: string,
): GeneratedNoteDraft | null {
  if (!payload || typeof payload !== "object") return null;

  const record = payload as Record<string, unknown>;
  const markdown = cleanNoteMarkdown(record.ai_content);
  if (!markdown) return null;

  return {
    title: cleanNoteText(record.original_title) || fallbackTitle,
    markdown,
    format: cleanNoteText(record.format_used) || "markdown",
    sourceNodeId,
  };
}

function normalizeAiNote(note: AiNoteForNode | null): AiNoteForNode | null {
  if (!note || typeof note !== "object") return null;

  const markdown = cleanNoteMarkdown(note.markdown);
  if (!markdown) return null;

  return {
    id: typeof note.id === "string" ? note.id : "",
    title: cleanNoteText(note.title) || t("ui.ai_notes"),
    markdown,
    format: cleanNoteText(note.format) || "markdown",
    auto_generated: !!note.auto_generated,
    version: typeof note.version === "number" ? note.version : 1,
  };
}

function NotesLoadingState({ label }: { label: string }) {
  return (
    <div className="mx-auto w-full max-w-3xl animate-pulse space-y-4 py-6" role="status" aria-live="polite">
      <div className="flex items-center gap-3">
        <span className="size-10 rounded-2xl bg-muted/70" />
        <div className="flex-1 space-y-2">
          <div className="h-3 w-36 rounded-full bg-muted/80" />
          <div className="h-2.5 w-56 max-w-[70%] rounded-full bg-muted/55" />
        </div>
      </div>
      <div className="space-y-3 rounded-2xl border border-border/50 bg-card/70 p-5">
        <div className="h-3 w-2/5 rounded-full bg-muted/75" />
        <div className="h-2.5 w-full rounded-full bg-muted/50" />
        <div className="h-2.5 w-11/12 rounded-full bg-muted/50" />
        <div className="h-20 rounded-xl bg-muted/35" />
      </div>
      <p className="text-center text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

export function NotesSection({
  courseId,
  blockId,
  aiActionsEnabled = true,
  immersive = false,
  initialFileJobId = null,
  initialPage = null,
  onCloseReader,
}: NotesSectionProps) {
  const t = useT();
  const contentTree = useCourseStore((s) => s.contentTree);
  const contentTreeCourseId = useCourseStore((s) => s.contentTreeCourseId);
  const fetchContentTree = useCourseStore((s) => s.fetchContentTree);
  const { saving, latestBatch, wrapSave } = useBatchManager({
    courseId,
    refreshSection: "notes",
    listFn: listGeneratedNoteBatches,
  });
  const selectedNodeId = useWorkspaceStore((s) => s.selectedNodeId);
  const focusedBlockId = useWorkspaceStore((s) => s.spaceLayout.focusedBlockId);
  const setSelectedNodeId = useWorkspaceStore((s) => s.setSelectedNodeId);
  const noteDraft = useWorkspaceStore((s) => s.noteDraft);
  const setNoteDraft = useWorkspaceStore((s) => s.setNoteDraft);
  const draft = noteDraft?.courseId === courseId ? noteDraft : null;
  const setDraft = useCallback((next: GeneratedNoteDraft | null) => {
    setNoteDraft(next ? { ...next, courseId } : null);
  }, [courseId, setNoteDraft]);
  const [generating, setGenerating] = useState(false);
  const [viewMode, setViewMode] = useState<"ai" | "source">("ai");
  const [aiNote, setAiNote] = useState<AiNoteForNode | null>(null);
  const [aiNoteLoading, setAiNoteLoading] = useState(false);
  const [aiNoteResolvedNodeId, setAiNoteResolvedNodeId] = useState<string | null>(null);
  const [sourceFiles, setSourceFiles] = useState<UploadedCourseFile[]>([]);
  const [sourceFilesLoading, setSourceFilesLoading] = useState(true);
  const [sourcePreview, setSourcePreview] = useState<{ url: string; name: string; page?: number } | null>(null);
  const closeReader = useCallback(() => {
    setSourcePreview(null);
    onCloseReader?.();
  }, [onCloseReader]);
  const aiFetchRequestRef = useRef(0);
  const generateRequestRef = useRef(0);

  const contentNodes = useMemo(() => collectContentNodes(contentTree), [contentTree]);

  const selectedNode = useMemo(
    () => findNodeById(contentTree, selectedNodeId),
    [selectedNodeId, contentTree],
  );
  const selectedLearnableNode = selectedNode && isLearnableContentNode(selectedNode)
    ? selectedNode
    : null;
  const canUseAiNotes = !!selectedLearnableNode;
  const selectedNodeForFetch = selectedLearnableNode?.id;

  const currentIndex = useMemo(
    () => contentNodes.findIndex((n) => n.id === selectedLearnableNode?.id),
    [contentNodes, selectedLearnableNode?.id],
  );
  const canPrev = currentIndex > 0;
  const canNext = currentIndex >= 0 && currentIndex < contentNodes.length - 1;

  useEffect(() => {
    if (contentTreeCourseId !== courseId) {
      void fetchContentTree(courseId);
    }
  }, [courseId, contentTreeCourseId, fetchContentTree]);

  // An absent selection or a non-learning node (preface/catalogue) is source
  // material only. Never silently substitute the first chapter, because that
  // makes the AI Notes tab appear to belong to the preface.
  useEffect(() => {
    // A route-level deep link is written before the async course tree arrives.
    // Do not clear it while loading, and never validate it against another
    // course's tree left in the shared store.
    if (contentTreeCourseId !== courseId) return;
    if (!findFirstContentNode(contentTree)) {
      if (selectedNodeId) setSelectedNodeId(null);
      if (draft) setDraft(null);
      return;
    }

    const requested = findNodeById(contentTree, selectedNodeId);
    if (selectedNodeId && !requested) {
      setSelectedNodeId(null);
    }
    if (draft && draft.sourceNodeId !== (selectedLearnableNode?.id ?? "")) {
      setDraft(null);
    }
  }, [courseId, contentTreeCourseId, contentTree, selectedNodeId, setSelectedNodeId, draft, selectedLearnableNode?.id]);

  useEffect(() => {
    setViewMode(canUseAiNotes ? "ai" : "source");
  }, [canUseAiNotes, selectedNodeId]);

  // Fetch AI note for selected node
  useEffect(() => {
    if (!selectedNodeForFetch) {
      aiFetchRequestRef.current += 1;
      setAiNote(null);
      setAiNoteResolvedNodeId(null);
      setAiNoteLoading(false);
      return;
    }

    const requestId = ++aiFetchRequestRef.current;
    let cancelled = false;
    setAiNoteLoading(true);
    setAiNoteResolvedNodeId(null);
    getAiNoteForNode(courseId, selectedNodeForFetch)
      .then((note) => {
        if (!cancelled && requestId === aiFetchRequestRef.current) {
          setAiNote(normalizeAiNote(note));
          setAiNoteResolvedNodeId(selectedNodeForFetch);
          setAiNoteLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled && requestId === aiFetchRequestRef.current) {
          setAiNote(null);
          setAiNoteResolvedNodeId(selectedNodeForFetch);
          setAiNoteLoading(false);
        }
      });
    return () => { cancelled = true; };
  }, [courseId, selectedNodeForFetch]);

  useEffect(() => {
    let cancelled = false;
    setSourceFiles([]);
    setSourceFilesLoading(true);
    listCourseFiles(courseId)
      .then((files) => {
        if (!cancelled) {
          setSourceFiles(files);
          const initialFile = initialFileJobId ? files.find((file) => file.job_id === initialFileJobId) : null;
          if (initialFile) {
            setSourcePreview({
              url: `${API_BASE}/content/files/${initialFile.job_id}`,
              name: initialFile.filename || initialFile.file_name || t("notes.originalPdf"),
              page: initialPage ?? 1,
            });
          }
          setSourceFilesLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSourceFiles([]);
          setSourceFilesLoading(false);
        }
      });
    return () => { cancelled = true; };
  }, [courseId, initialFileJobId, initialPage, t]);

  useEffect(() => {
    if (!sourcePreview) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeReader();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [sourcePreview, closeReader]);

  const handleGenerate = useCallback(async () => {
    if (!selectedLearnableNode) {
      toast.error(t("ui.select_section_first"));
      return;
    }

    const requestId = ++generateRequestRef.current;
    setGenerating(true);
    try {
      const result = await restructureNotes(selectedLearnableNode.id);
      if (requestId !== generateRequestRef.current) return;

      const nextDraft = normalizeGeneratedNoteDraft(
        result,
        selectedLearnableNode.id,
        selectedLearnableNode.title || t("ui.untitled_section"),
      );

      if (!nextDraft) {
        throw new Error(t("ui.ai_notes_empty"));
      }

      setDraft(nextDraft);
      setViewMode("ai");
      toast.success(t("ui.generated_ai_notes"));
    } catch (error) {
      if (requestId === generateRequestRef.current) {
        toast.error((error as Error).message || t("ui.failed_gen_notes"));
      }
    } finally {
      if (requestId === generateRequestRef.current) {
        setGenerating(false);
      }
    }
  }, [selectedLearnableNode, t]);

  const handleSave = useCallback(
    async (replaceBatchId?: string) => {
      if (!draft) return;
      await wrapSave(() =>
        saveGeneratedNotes(courseId, draft.markdown, draft.title, draft.sourceNodeId, replaceBatchId),
      );
    },
    [courseId, draft, wrapSave],
  );

  // Determine what AI content to show
  const aiContent = draft?.markdown ?? aiNote?.markdown;
  const aiTitle = draft?.title ?? aiNote?.title;
  const hasAiNotes = !!(aiContent && aiContent.length > 0);
  const NotesViewport = immersive ? "div" : ScrollArea;

  if (contentTreeCourseId !== courseId) {
    return <NotesLoadingState label={t("ui.loading")} />;
  }

  if (contentTree.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-4 text-center">
        <div>
          <p className="text-muted-foreground text-sm">{t("notes.empty")}</p>
        </div>
      </div>
    );
  }

  return (
    <>
    <div role="region" aria-label={t("ui.course_notes")} className={`flex w-full flex-1 ${immersive ? "self-start overflow-visible" : "min-h-0 overflow-hidden"}`} data-testid="notes-panel">
      <div className={`flex w-full flex-1 flex-col ${immersive ? "overflow-visible" : "min-h-0"}`}>
        <div
          role="toolbar"
          aria-label={t("ui.notes_toolbar")}
          className="sticky top-0 z-30 flex min-h-11 shrink-0 items-center gap-2 border-b border-border/60 bg-card px-3 py-2 shadow-[0_8px_18px_-16px_rgba(30,45,38,0.7)]"
        >
          {/* AI / Source toggle */}
          <div role="group" aria-label={t("ui.view_mode")} className="flex items-center gap-0.5 rounded-xl bg-muted/30 p-0.5">
            <button
              type="button"
              disabled={!canUseAiNotes}
              aria-pressed={viewMode === "ai" ? "true" : "false"}
              className={`px-2 py-0.5 text-xs rounded ${
                viewMode === "ai"
                  ? "bg-primary text-primary-foreground"
                  : canUseAiNotes
                    ? "text-muted-foreground hover:text-foreground"
                    : "cursor-not-allowed text-muted-foreground/40"
              }`}
              onClick={() => setViewMode("ai")}
            >
              {t("notes.aiView")}
            </button>
            <button
              type="button"
              aria-pressed={viewMode === "source" ? "true" : "false"}
              className={`px-2 py-0.5 text-xs rounded ${
                viewMode === "source"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              onClick={() => setViewMode("source")}
            >
              {t("notes.sourceView")}
            </button>
          </div>

          <div className="ml-auto flex items-center gap-2">
            {/* Node selector: prev / dropdown / next */}
            {contentNodes.length > 1 && (
              <>
                <button
                  type="button"
                  className="px-1 py-0.5 text-xs text-muted-foreground hover:text-foreground disabled:opacity-30"
                  disabled={!canPrev}
                  onClick={() => canPrev && setSelectedNodeId(contentNodes[currentIndex - 1].id)}
                  aria-label={t("ui.previous_section")}
                >
                  &lsaquo;
                </button>
                <select
                  value={selectedLearnableNode?.id ?? ""}
                  onChange={(e) => setSelectedNodeId(e.target.value)}
                  className="h-6 text-xs rounded border border-border bg-background px-1 max-w-[160px] truncate"
                  aria-label={t("ui.select_section")}
                >
                  <option value="" disabled>
                    {t("ui.select_section")}
                  </option>
                  {contentNodes.map((n, i) => (
                    <option key={n.id} value={n.id}>
                      {n.title || `${t("ui.untitled_section")} ${i + 1}`}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="px-1 py-0.5 text-xs text-muted-foreground hover:text-foreground disabled:opacity-30"
                  disabled={!canNext}
                  onClick={() => canNext && setSelectedNodeId(contentNodes[currentIndex + 1].id)}
                  aria-label={t("ui.next_section")}
                >
                  &rsaquo;
                </button>
              </>
            )}
            {contentNodes.length <= 1 && selectedLearnableNode ? (
              <Badge variant="outline" className="max-w-56 truncate">
                {selectedLearnableNode.title}
              </Badge>
            ) : null}
            {draft && latestBatch?.is_active ? (
              <Button
                size="sm"
                variant="outline"
                className="h-6 px-2 text-xs"
                onClick={() => void handleSave(latestBatch.batch_id)}
                disabled={saving || generating}
              >
                替换最新版本
              </Button>
            ) : null}
            {draft ? (
              <Button
                size="sm"
                variant="outline"
                className="h-6 px-2 text-xs"
                onClick={() => void handleSave()}
                disabled={saving || generating}
              >
                另存为新版本
              </Button>
            ) : null}            <Button
              data-testid="notes-generate"
              size="sm"
              className="h-6 px-2 text-xs"
              onClick={() => void handleGenerate()}
              disabled={!aiActionsEnabled || generating || saving || !canUseAiNotes}
            >
              {generating ? <span className="animate-pulse mr-1">...</span> : null}
              {t("notes.regenerate")}
            </Button>
          </div>
        </div>

        {!aiActionsEnabled ? <AiFeatureBlocked compact className="mx-4 mt-4" /> : null}

        <NotesViewport className={`${immersive ? "p-4" : "min-h-0 flex-1 p-4 scrollbar-thin"} ${
          !immersive && viewMode === "ai" && hasAiNotes
            ? "xl:[&_[data-slot=scroll-area-scrollbar]]:hidden xl:[&_[data-slot=scroll-area-viewport]]:!overflow-hidden"
            : ""
        }`}>
          {!selectedLearnableNode ? (
            <div className="mx-auto flex max-w-md flex-col items-center justify-center rounded-2xl border border-dashed border-brand/30 bg-brand-muted/20 px-6 py-12 text-center">
              <BookOpen className="mb-3 size-8 text-brand" aria-hidden="true" />
              <p className="text-base font-semibold text-foreground">先选择一个学习内容</p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">选择一个知识点后，就可以在这里记录你的学习笔记。</p>
            </div>
          ) : viewMode === "ai" ? (
            <>
              {aiNoteLoading || aiNoteResolvedNodeId !== selectedNodeForFetch ? (
                <NotesLoadingState label={t("ui.loading_ai_notes")} />
              ) : hasAiNotes ? (
                <div data-testid="notes-preview">
                  <CornellNoteView
                    courseId={courseId}
                    nodeId={selectedLearnableNode!.id}
                    title={aiTitle}
                    markdown={aiContent!}
                    focused={!!blockId && focusedBlockId === blockId}
                    immersive={immersive}
                  />
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 gap-3">
                  <p className="text-sm text-muted-foreground">
                    {t("notes.noAiNotesForSection")}
                  </p>
                  <Button
                    size="sm"
                    onClick={() => void handleGenerate()}
                    disabled={!aiActionsEnabled || generating || !canUseAiNotes}
                  >
                    {generating ? t("ui.generating") : t("ui.generate_ai_notes")}
                  </Button>
                </div>
              )}
            </>
          ) : sourceFilesLoading ? (
            <NotesLoadingState label={t("notes.preparingSource")} />
          ) : sourceFiles.length > 0 && (!selectedNode || selectedNode.source_type === "file") ? (
            <div className="mx-auto max-w-3xl overflow-hidden rounded-3xl border border-amber-200/80 bg-gradient-to-br from-amber-50 via-orange-50/70 to-emerald-50/70 shadow-[0_18px_50px_-35px_rgba(120,80,20,0.55)] dark:border-amber-900 dark:from-amber-950/30 dark:via-background dark:to-emerald-950/20">
              <div className="relative border-b border-amber-200/60 px-6 py-5 dark:border-amber-900/70">
                <div className="pointer-events-none absolute -right-8 -top-12 size-32 rounded-full bg-amber-200/35 blur-2xl" />
                <div className="relative flex items-center gap-4">
                  <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-white text-amber-700 shadow-sm ring-1 ring-amber-200 dark:bg-background dark:text-amber-300 dark:ring-amber-900">
                    <BookOpen className="size-6" />
                  </div>
                  <div>
                    <p className="flex items-center gap-2 font-bold text-amber-950 dark:text-amber-100">
                      {t("notes.sourceCardTitle")}
                      <Sparkles className="size-4 text-amber-500" />
                    </p>
                    <p className="mt-1 text-sm leading-6 text-amber-950/65 dark:text-amber-100/65">
                      {t("notes.sourceCardDescription")}
                    </p>
                  </div>
                </div>
              </div>
              <div className="space-y-3 p-4 sm:p-5">
                {sourceFiles.length ? sourceFiles.map((file) => (
                  <button
                    type="button"
                    key={file.id}
                    onClick={() => {
                      const isSelectedPdf = selectedLearnableNode?.source_file?.toLowerCase().endsWith(".pdf")
                        && selectedLearnableNode.source_file === (file.filename || file.file_name);
                      const page = isSelectedPdf ? selectedLearnableNode.metadata?.source_pages?.[0] : undefined;
                      setSourcePreview({
                      url: `${API_BASE}/content/files/${file.job_id}${page ? `#page=${page}` : ""}`,
                      name: file.filename || file.file_name || t("notes.originalPdf"),
                      page: page ?? 1,
                      });
                    }}
                    className="group flex w-full items-center gap-4 rounded-2xl border border-white/90 bg-white/85 px-4 py-4 text-left shadow-sm ring-1 ring-amber-100 transition duration-200 hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 dark:border-border dark:bg-card/90 dark:ring-amber-900"
                  >
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-900">
                      <BookOpen className="size-5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-foreground">{file.filename || file.file_name || t("notes.originalPdf")}</span>
                      <span className="mt-1 block text-xs text-muted-foreground">{t("notes.sourceFileHint")}</span>
                    </span>
                    <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-emerald-600 px-3 py-2 text-xs font-semibold text-white shadow-sm transition group-hover:bg-emerald-700">
                      {t("notes.openOriginal")}
                      <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
                    </span>
                  </button>
                )) : (
                  <p className="text-sm text-muted-foreground">{t("notes.originalUnavailable")}</p>
                )}
              </div>
            </div>
          ) : (
            // Plain-text and web sources remain readable as extracted text.
            selectedNode ? (
              <ContentNodeItem node={selectedNode} />
            ) : (
              contentTree.map((node) => (
                <ContentNodeItem key={node.id} node={node} />
              ))
            )
          )}
        </NotesViewport>
      </div>
    </div>
    {sourcePreview && typeof document !== "undefined" ? createPortal(
      <div className="fixed inset-0 z-[100] flex flex-col bg-background" role="dialog" aria-modal="true" aria-label={sourcePreview.name}>
        <div className="flex h-14 shrink-0 items-center gap-3 border-b border-border px-4">
          <p className="min-w-0 flex-1 truncate text-sm font-semibold">{sourcePreview.name}</p>
          <button
            type="button"
            onClick={closeReader}
            className="inline-flex size-9 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label={t("ui.close")}
          >
            <X className="size-5" />
          </button>
        </div>
        <PdfStudyReader
          url={sourcePreview.url}
          courseId={courseId}
          jobId={sourcePreview.url.split("/").pop()?.split("#")[0] ?? ""}
          initialPage={sourcePreview.page ?? 1}
        />
      </div>,
      document.body,
    ) : null}
    </>
  );
}
