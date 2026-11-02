"use client";

interface FillBlankAnswerProps {
  question: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

export function countQuestionBlanks(question: string): number {
  const explicit = question.match(/_{2,}|[（(\[]\s*[）)\]]/g)?.length ?? 0;
  return Math.max(1, Math.min(explicit, 8));
}

function splitAnswer(value: string, count: number): string[] {
  const parts = value.split(/[;；\n]+/);
  return Array.from({ length: count }, (_, index) => parts[index] ?? "");
}

export function FillBlankAnswer({ question, value, onChange, disabled = false }: FillBlankAnswerProps) {
  const count = countQuestionBlanks(question);
  const answers = splitAnswer(value, count);

  const update = (index: number, nextValue: string) => {
    const next = [...answers];
    next[index] = nextValue;
    onChange(next.join("；"));
  };

  return (
    <div className="grid gap-3 sm:grid-cols-2" data-testid="fill-blank-answer">
      {answers.map((answer, index) => (
        <label key={index} className="space-y-1.5">
          <span className="text-xs font-medium text-muted-foreground">
            {count > 1 ? `第 ${index + 1} 空` : "请填写答案"}
          </span>
          <input
            value={answer}
            onChange={(event) => update(index, event.target.value)}
            disabled={disabled}
            className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none transition focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-50"
            placeholder={count > 1 ? `填写第 ${index + 1} 空` : "输入答案"}
            aria-label={count > 1 ? `第 ${index + 1} 空` : "填空题答案"}
          />
        </label>
      ))}
    </div>
  );
}
