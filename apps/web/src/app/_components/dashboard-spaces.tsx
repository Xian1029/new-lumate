"use client";

import { useState } from "react";
import { ArrowRight, BookOpen, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { Course } from "@/lib/api";
import { ModeBadge } from "@/components/course/mode-selector";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DashSection } from "./dash-section";
import {
  CARD_COLORS,
  formatDate,
  getInitials,
  getCourseMode,
  getFriendlySceneLabel,
} from "./dashboard-utils";

export function CourseSpacesSection({
  courses,
  locale,
  onNavigate,
  onDelete,
  showPendingApprovals = true,
  t,
}: {
  courses: Course[];
  locale: string;
  onNavigate: (path: string) => void;
  onDelete: (courseId: string) => Promise<void>;
  showPendingApprovals?: boolean;
  t: (key: string) => string;
}) {
  const [deleteTarget, setDeleteTarget] = useState<Course | null>(null);
  const [deleting, setDeleting] = useState(false);

  const confirmDelete = async () => {
    if (!deleteTarget || deleting) return;
    setDeleting(true);
    try {
      await onDelete(deleteTarget.id);
      setDeleteTarget(null);
      toast.success(t("home.spaceDelete.success"));
    } catch (error) {
      toast.error(t("home.spaceDelete.failed"), {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <DashSection title={t("home.yourSpaces")} icon={BookOpen}>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {courses.map((course, idx) => {
          const color = CARD_COLORS[idx % CARD_COLORS.length];
          const initials = getInitials(course.name);
          const hasPending = showPendingApprovals && (course.pending_approval_count ?? 0) > 0;
          return (
            <div key={course.id} className="relative rounded-2xl card-lift bg-card group">
              <button
                type="button"
                onClick={() => onNavigate(`/course/${course.id}`)}
                aria-label={t("home.spaceOpen").replace("{name}", course.name)}
                className="flex w-full flex-col gap-3 rounded-2xl p-5 text-left"
              >
                <div className="flex items-center gap-3 w-full">
                  <div className={`w-10 h-10 ${color.bg} rounded-xl flex items-center justify-center shrink-0`}>
                    <span className={`font-bold text-xs ${color.text}`}>{initials}</span>
                  </div>
                  <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                  …4088 tokens truncated…span>
        </button>
      </div>
    </div>
  );
}
