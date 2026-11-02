"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";

interface NumberLineAnswerProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

const MARKER_PREFIX = "数轴标记：";
const AXIS_DESCRIPTION = "原点、正方向、单位长度";

export function isNumberLineDrawingQuestion(question: string): boolean {
  return /(?:画出|作出|作图).{0,16}数轴|数轴上.{0,12}(?:表示|标出|标记)/.test(question);
}

export function parseNumberLineAnswer(value: string): string[] {
  const marker = value.match(/数轴标记\s*[:：]\s*([^\n]+)/);
  if (!marker) return [];
  return marker[1].split(/[、,，;；\s]+/).map((item) => item.trim()).filter(Boolean);
}

function numericValue(raw: string): number | null {
  const text = raw.trim().replace("−", "-");
  const fraction = text.match(/^([+-]?\d+)\s*\/\s*(\d+)$/);
  if (fraction) {
    const denominator = Number(fraction[2]);
    if (!denominator) return null;
    return Number(fraction[1]) / denominator;
  }
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(text)) return null;
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : null;
}

function serialize(points: string[]): string {
  return points.length ? `${MARKER_PREFIX}${points.join("、")}\n${AXIS_DESCRIPTION}` : "";
}

export function NumberLineAnswer({ value, onChange, disabled = false }: NumberLineAnswerProps) {
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const points = useMemo(() => parseNumberLineAnswer(value), [value]);
  const plotted = useMemo(
    () => points.map((label) => ({ label, value: numericValue(label) })).filter(
      (item): item is { label: string; value: number } => item.value !== null,
    ),
    [points],
  );
  const numericPoints = plotted.map((point) => point.value);
  const lower = Math.min(-5, Math.floor(Math.min(...numericPoints, 0)) - 1);
  const upper = Math.max(5, Math.ceil(Math.max(...numericPoints, 0)) + 1);
  const span = Math.max(1, upper - lower);
  const tickStep = Math.max(1, Math.ceil(span / 10));
  const ticks: number[] = [];
  for (let tick = Math.ceil(lower / tickStep) * tickStep; tick <= upper; tick += tickStep) ticks.push(tick);

  const updatePoints = (next: string[]) => {
    const sorted = [...next].sort((left, right) => (numericValue(left) ?? 0) - (numericValue(right) ?? 0));
    onChange(serialize(sorted));
  };

  const addPoint = (raw: string) => {
    const normalized = raw.trim().replace("−", "-");
    const parsed = numericValue(normalized);
    if (parsed === null) {
      setError("请输入整数、小数或分数，例如 -2、0.5、3/4。");
      return;
    }
    if (points.some((point) => numericValue(point) === parsed)) {
      setError("这个位置已经标记。");
      return;
    }
    updatePoints([...points, normalized]);
    setDraft("");
    setError(null);
  };

  const toggleInteger = (tick: number) => {
    const existing = points.find((point) => numericValue(point) === tick);
    if (existing) updatePoints(points.filter((point) => point !== existing));
    else addPoint(String(tick));
  };

  return (
    <div className="space-y-4 rounded-2xl border border-border bg-muted/15 p-4" data-testid="number-line-answer">
      <div>
        <p className="text-sm font-semibold">在数轴上标记位置</p>
        <p className="mt-1 text-xs text-muted-foreground">点击整数刻度，或输入小数、分数后添加。再次点击可取消。</p>
      </div>

      <div className="overflow-x-auto px-3 pb-2 pt-8">
        <div className="relative h-20 min-w-[520px]" aria-label="可交互数轴">
          <div className="absolute left-0 right-1 top-7 h-0.5 bg-foreground/70" />
          <div className="absolute right-0 top-[23px] h-0 w-0 border-y-[5px] border-l-[9px] border-y-transparent border-l-foreground/70" />
          {ticks.map((tick) => {
            const left = ((tick - lower) / span) * 100;
            const selected = points.some((point) => numericValue(point) === tick);
            return (
              <button
                key={tick}
                type="button"
                className="group absolute top-3 -translate-x-1/2 disabled:cursor-not-allowed"
                style={{ left: `${left}%` }}
                onClick={() => toggleInteger(tick)}
                disabled={disabled}
                aria-label={`${selected ? "取消" : "标记"}${tick}`}
              >
                <span className={`mx-auto block h-7 w-0.5 ${tick === 0 ? "bg-foreground" : "bg-foreground/55"}`} />
                <span className={`mt-1 block min-w-7 rounded px-1 text-center text-xs ${selected ? "bg-brand text-white" : "text-muted-foreground group-hover:bg-muted"}`}>
                  {tick}
                </span>
              </button>
            );
          })}
          {plotted.filter((point) => !Number.isInteger(point.value) || !ticks.includes(point.value)).map((point) => (
            <button
              key={point.label}
              type="button"
              className="absolute top-0 -translate-x-1/2 disabled:cursor-not-allowed"
              style={{ left: `${((point.value - lower) / span) * 100}%` }}
              onClick={() => updatePoints(points.filter((item) => item !== point.label))}
              disabled={disabled}
              aria-label={`取消标记${point.label}`}
            >
              <span className="block rounded-full bg-brand px-2 py-0.5 text-[11px] font-semibold text-white shadow-sm">{point.label}</span>
              <span className="mx-auto block h-5 w-0.5 bg-brand" />
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          value={draft}
          onChange={(event) => { setDraft(event.target.value); setError(null); }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              if (draft.trim()) addPoint(draft);
            }
          }}
          disabled={disabled}
          className="h-10 flex-1 rounded-xl border border-border bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 disabled:opacity-50"
          placeholder="输入数值，例如 -2 或 3/4"
          aria-label="要标记的数值"
        />
        <Button type="button" variant="outline" onClick={() => addPoint(draft)} disabled={disabled || !draft.trim()}>
          添加到数轴
        </Button>
      </div>
      {error ? <p className="text-xs text-destructive" role="alert">{error}</p> : null}
      {points.length ? (
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-muted-foreground">已标记：</span>
          {points.map((point) => (
            <button
              key={point}
              type="button"
              onClick={() => updatePoints(points.filter((item) => item !== point))}
              disabled={disabled}
              className="rounded-full border border-brand/25 bg-brand/10 px-2.5 py-1 font-medium text-brand hover:bg-brand/15 disabled:opacity-50"
            >
              {point} <span aria-hidden="true">×</span>
            </button>
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">还没有标记任何位置。</p>
      )}
    </div>
  );
}
