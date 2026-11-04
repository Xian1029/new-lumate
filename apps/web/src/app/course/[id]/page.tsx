"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { useWorkspaceStore } from "@/store/workspace";
import { WorkspaceHeader } from "@/components/shell/workspace-header";
import { RuntimeAlert } from "@/components/shared/runtime-alert";
import { IngestionProgress } from "@/components/shared/ingestion-progress";
import { ContinueLearningCta } from "@/components/course/continue-learning-cta";
import { BlockGrid } from "@/components/blocks/block-grid";
import { ChatFab } from "@/components/chat/chat-fab";
import { ChatDrawer } from "@/components/chat/chat-drawer";
import { SearchDialog } from "@/components/shared/search-dialog";
import { NotesDrawer } from "@/components/blocks/notes-drawer";
import { PlanDrawer } from "@/components/blocks/plan-drawer";
import { CalendarDays } from "lucide-react";
import { ErrorBoundary } from "@/components/shared/error-boundary";
import { useT } from "@/lib/i18n-context";
import { useCourseData } from "./_components/use-course-data";
import { useBlockPersistence } from "./_components/use-block-persistence";
import { useQueueModeSuggestion } from "./_components/use-chat-actions";
import { useUnlockSuggestions, useReviewCheck } from "./_components/use-agent-autonomy";
import { useModeEvaluator, useInitPrompt } from "./_components/use-agent-lifecycle";
import { TemplatePicker } from "./_components/template-picker";
import { SyncSettingsPanel } from "@/components/course/sync-settings-panel";
import { EmptyMaterialsPrompt } from "@/components/course/empty-materials-prompt";
import { findNodeById, isAssessmentOnlyCourse, isLearnableContentNode, isPracticeEligibleContentNode } from "@/lib/content-tree";
import { CoursePlanStatus } from "@/components/learning-plans/course-plan-status";
import { buildLayoutFromMode } from "@/lib/block-system/templates";

type ResumeContext = {
  contentNodeId: string | null;
  knowledgePointId: string | null;
  targetModule: string;
};

export default function CoursePage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const t = useT();
  const courseId = params.id as string;
  const [chatOpen, setChatOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [planDrawerOpen, setPlanDrawerOpen] = useState(false);
  const [resumeContext, setResumeContext] = useState<ResumeContext | null>(null);
  const notesDrawerOpen = useWorkspaceStore((s) => s.notesDrawerOpen);
  const setNotesDrawerOpen = useWorkspaceStore((s) => s.setNotesDrawerOpen);
  const setSelectedNodeId = useWorkspaceStore((s) => s.setSelectedNodeId);
  const selectedNodeId = useWorkspaceStore((s) => s.selectedNodeId);

  const { health, course, courses, contentTree, aiActionsEnabled } = useCourseData(courseId);
  const { blocks, blocksInitialized } = useBlockPersistence(courseId, course);
  const applyBlockTemplate = useWorkspaceStore((s) => s.applyBlockTemplate);
  const resetLayout = useWorkspaceStore((s) => s.resetLayout);
  const guidedRecoveryRef = useRef<string | null>(null);
  const requestedNodeId = searchParams.get("node");
  const requestedModule = searchParams.get("module");
  const isGuidedPlanSession = searchParams.get("guided") === "1";

  useEffect(() => {
    const key = `lumate:last-learning:${courseId}`;
    const raw = window.sessionStorage.getItem(key);
    if (!raw) return;
    window.sessionStorage.removeItem(key);
    try {
      const parsed = JSON.parse(raw) as ResumeContext;
      setResumeContext(parsed);
    } catch {
      setResumeContext(null);
    }
  }, [courseId]);

  useEffect(() => {
    const resumeNodeId = requestedNodeId || resumeContext?.contentNodeId;
    if (!resumeNodeId || contentTree.length === 0 || !blocksInitialized) return;
    const requestedNode = findNodeById(contentTree, resumeNodeId);
    if (!requestedNode || !isLearnableContentNode(requestedNode)) return;

    setSelectedNodeId(requestedNode.id);
    const targetModule = (requestedModule ?? resumeContext?.targetModule ?? "CONTENT").toUpperCase();
    const targetBlockType = targetModule === "NOTE" ? "notes" : targetModule === "PRACTICE" ? "quiz" : targetModule === "REVIEW" ? "review" : null;
    const hasTargetBlock = targetBlockType
      ? blocks.some((block) => block.type === targetBlockType && (block.isVisible ?? block.visible ?? true))
      : false;
    if (targetModule === "NOTE" && !hasTargetBlock) setNotesDrawerOpen(true);

    const frame = window.requestAnimationFrame(() => {
      const selector = targetBlockType ? `[data-block-type="${targetBlockType}"]` : null;
      (selector ? document.querySelector<HTMLElement>(selector) : null)?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [blocks, blocksInitialized, contentTree, requestedModule, requestedNodeId, resumeContext, setNotesDrawerOpen, setSelectedNodeId]);

  useEffect(() => {
    if (!isAssessmentOnlyCourse(contentTree) || requestedNodeId || resumeContext?.contentNodeId) return;
    if (findNodeById(contentTree, selectedNodeId)) return;
    const first = (items: typeof contentTree): string | null => {
      for (const node of items) {
        if (isPracticeEligibleContentNode(node)) return node.id;
        const child = first(node.children ?? []);
        if (child) return child;
      }
      return null;
    };
    setSelectedNodeId(first(contentTree));
  }, [contentTree, requestedNodeId, resumeContext?.contentNodeId, selectedNodeId, setSelectedNodeId]);

  useEffect(() => {
    if (!isGuidedPlanSession || !blocksInitialized || guidedRecoveryRef.current === courseId) return;
    const visibleTypes = new Set(
      blocks
        .filter((block) => block.isVisible ?? block.visible ?? true)
        .map((block) => block.type),
    );
    const hasLearningFlow = (["chapter_list", "progress", "quiz", "flashcards", "knowledge_graph"] as const)
      .some((type) => visibleTypes.has(type));
    if (hasLearningFlow) return;

    // A legacy notes-only layout cannot execute a content task.  Recover the
    // standard course-following workspace only for an explicit plan session;
    // this applies to every task module. A NOTE/PRACTICE plan task used to
    // bypass the recovery and open an old notes-only layout.
    // Regular visits and valid custom layouts remain untouched.
    guidedRecoveryRef.current = courseId;
    resetLayout(buildLayoutFromMode("course_following"));
  }, [blocks, blocksInitialized, courseId, isGuidedPlanSession, resetLayout]);

  const handleIngestionComplete = useCallback(() => {
    const store = useWorkspaceStore.getState();
    if (store.spaceLayout.blocks.length === 0) {
      store.applyBlockTemplate("stem_student");
    }
  }, []);
  const queueModeSuggestion = useQueueModeSuggestion(courseId);

  useUnlockSuggestions(courseId, courses, contentTree, health, blocksInitialized);
  useReviewCheck(courseId, course, aiActionsEnabled);
  useModeEvaluator(courseId, course, aiActionsEnabled, queueModeSuggestion);
  useInitPrompt(courseId, setChatOpen);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const hasBlocks = blocks.length > 0;
  const hasPlanBlock = blocks.some((block) => block.type === "plan" && (block.isVisible ?? block.visible ?? true));

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <WorkspaceHeader courseName={course?.name || t("course.defaultTitle")} courseId={courseId} />

      <div className="px-5 pt-4 max-w-5xl mx-auto w-full space-y-3">
        <RuntimeAlert health={health} />
        <SyncSettingsPanel courseId={courseId} />
        <IngestionProgress
          courseId={courseId}
          onIngestionComplete={handleIngestionComplete}
        />
      </div>

      <main className="flex-1 max-w-5xl mx-auto w-full px-5 py-8 space-y-6">
        {course && (course.file_count ?? 0) === 0 && contentTree.length === 0 ? (
          <EmptyMaterialsPrompt courseId={courseId} />
        ) : null}
        <ErrorBoundary section="workspace">
          <CoursePlanStatus courseId={courseId} />
          {!blocksInitialized ? (
            <div
              role="status"
              aria-live="polite"
              className="flex min-h-48 items-center justify-center text-sm text-muted-foreground"
            >
              {t("ui.loading")}
            </div>
          ) : hasBlocks ? (
            <BlockGrid courseId={courseId} aiActionsEnabled={aiActionsEnabled} />
          ) : (
            <>
              <ContinueLearningCta courseId={courseId} />
              <TemplatePicker onApplyTemplate={applyBlockTemplate} />
            </>
          )}
        </ErrorBoundary>
      </main>

      {hasPlanBlock ? (
        <button
          type="button"
          onClick={() => setPlanDrawerOpen(true)}
          className="fixed left-0 top-1/2 z-40 flex -translate-y-1/2 items-center gap-2 rounded-r-2xl border border-l-0 border-violet-200 bg-background px-2.5 py-3 text-violet-700 shadow-lg transition-all hover:bg-violet-50 hover:pr-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
          aria-label="打开学习计划"
          title="打开学习计划"
        >
          <CalendarDays className="size-5" />
          <span className="hidden text-xs font-semibold sm:inline">计划</span>
        </button>
      ) : null}

      <ChatFab open={chatOpen} onToggle={() => setChatOpen((v) => !v)} />
      <ErrorBoundary section="chat">
        <ChatDrawer
          courseId={courseId}
          courseName={course?.name}
          open={chatOpen}
          onOpenChange={setChatOpen}
          aiActionsEnabled={aiActionsEnabled}
        />
      </ErrorBoundary>
      <ErrorBoundary section="notes-drawer">
        <NotesDrawer
          courseId={courseId}
          open={notesDrawerOpen}
          onOpenChange={setNotesDrawerOpen}
          aiActionsEnabled={aiActionsEnabled}
        />
      </ErrorBoundary>
      <ErrorBoundary section="plan-drawer">
        <PlanDrawer
          courseId={courseId}
          open={planDrawerOpen}
          onOpenChange={setPlanDrawerOpen}
          aiActionsEnabled={aiActionsEnabled}
        />
      </ErrorBoundary>
      <SearchDialog open={searchOpen} onClose={() => setSearchOpen(false)} courseId={courseId} />
    </div>
  );
}
