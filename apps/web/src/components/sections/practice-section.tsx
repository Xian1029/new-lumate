"use client";

import { lazy, useCallback, useMemo, useState } from "react";
import { useT } from "@/lib/i18n-context";
import { useWorkspaceStore } from "@/store/workspace";
import { TabbedSection, type TabDef } from "./tabbed-section";

const QuizView = lazy(() =>
  import("./practice/quiz-view").then((m) => ({ default: m.QuizView })),
);
const FlashcardView = lazy(() =>
  import("./practice/flashcard-view").then((m) => ({ default: m.FlashcardView })),
);
const ReviewView = lazy(() =>
  import("./practice/review-view").then((m) => ({ default: m.ReviewView })),
);
const FlashcardReviewView = lazy(() =>
  import("./practice/flashcard-review-view").then((m) => ({ default: m.FlashcardReviewView })),
);
interface PracticeSectionProps {
  courseId: string;
  showReview?: boolean;
  aiActionsEnabled?: boolean;
  defaultTab?: PracticeTab;
  quizDifficultyHint?: "easy" | "medium" | "hard";
  quizModeHint?: "course_following" | "self_paced" | "exam_prep" | "maintenance";
  scope?: "all" | "quiz" | "flashcards";
  quizExitHref?: string;
  flashcardExitHref?: string;
}

type PracticeTab = "quiz" | "flashcards" | "review";
type ReviewSource = "quiz" | "flashcards" | null;

function ReviewSourcePicker({ onChoose }: { onChoose: (source: Exclude<ReviewSource, null>) => void }) {
  const t = useT();
  return (
    <div className="flex flex-1 items-center justify-center p-6 text-center" data-testid="review-source-picker">
      <div className="max-w-sm space-y-3">
        <h3 className="text-sm font-semibold">{t("practice.review.chooseTitle")}</h3>
        <p className="text-xs leading-5 text-muted-foreground">{t("practice.review.chooseHint")}</p>
        <div className="flex flex-wrap justify-center gap-2">
          <button type="button" className="rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium hover:bg-muted" onClick={() => onChoose("quiz")}>
            {t("practice.review.quiz")}
          </button>
          <button type="button" className="rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium hover:bg-muted" onClick={() => onChoose("flashcards")}>
            {t("practice.review.flashcards")}
          </button>
        </div>
      </div>
    </div>
  );
}

export function PracticeSection({
  courseId,
  showReview = true,
  aiActionsEnabled = true,
  defaultTab = "quiz",
  quizDifficultyHint,
  quizModeHint,
  scope = "all",
  quizExitHref,
  flashcardExitHref,
}: PracticeSectionProps) {
  const t = useT();
  // In a combined practice area, “复盘” must retain the tab the learner came
  // from.  Scoped blocks already have an unambiguous source.
  const [reviewSource, setReviewSource] = useState<ReviewSource>(
    scope === "flashcards" ? "flashcards" : scope === "quiz" ? "quiz" : null,
  );
  const allTabs: TabDef<PracticeTab>[] = useMemo(
    () => [
      { id: "quiz", label: t("course.quiz"), testId: "right-tab-quiz" },
      { id: "flashcards", label: t("course.cards"), testId: "right-tab-cards" },
      { id: "review", label: t("course.review"), testId: "right-tab-review" },
    ],
    [t],
  );
  const tabs = useMemo(
    () => allTabs.filter((tab) => {
      if (tab.id === "review") return showReview;
      return scope === "all" || tab.id === scope;
    }),
    [showReview, scope, allTabs],
  );

  const practiceActiveTab = useWorkspaceStore((s) => s.practiceActiveTab) as PracticeTab | null;
  const clearPracticeTab = useCallback(() => {
    useWorkspaceStore.getState().setPracticeTab(null);
  }, []);

  return (
    <div role="region" aria-label={t("ui.practice")} className="h-full min-h-0 overflow-hidden flex flex-col">
    <TabbedSection
      tabs={tabs}
      defaultTab={tabs.some((t) => t.id === defaultTab) ? defaultTab : "quiz"}
      testId="practice-section"
      externalTab={practiceActiveTab}
      onExternalTabConsumed={clearPracticeTab}
      onTabChange={(nextTab, previousTab) => {
        if (nextTab === "review" && (previousTab === "quiz" || previousTab === "flashcards")) {
          setReviewSource(previousTab);
        }
        if (nextTab === "quiz" || nextTab === "flashcards") setReviewSource(nextTab);
      }}
    >
      {(activeTab) => (
        <>
          {activeTab === "quiz" ? (
            <QuizView
              courseId={courseId}
              aiActionsEnabled={aiActionsEnabled}
              modeHint={quizModeHint}
              difficultyHint={quizDifficultyHint}
              exitHref={quizExitHref}
            />
          ) : null}
          {activeTab === "flashcards" ? (
            <FlashcardView courseId={courseId} aiActionsEnabled={aiActionsEnabled} exitHref={flashcardExitHref} />
          ) : null}
          {activeTab === "review" && showReview && reviewSource === "quiz" ? (
            <ReviewView courseId={courseId} aiActionsEnabled={aiActionsEnabled} />
          ) : null}
          {activeTab === "review" && showReview && reviewSource === "flashcards" ? (
            <FlashcardReviewView courseId={courseId} />
          ) : null}
          {activeTab === "review" && showReview && reviewSource === null ? (
            <ReviewSourcePicker onChoose={setReviewSource} />
          ) : null}
        </>
      )}
    </TabbedSection>
    </div>
  );
}
