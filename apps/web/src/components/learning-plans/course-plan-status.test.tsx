import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CoursePlanStatus, taskOverdueDays } from "./course-plan-status";

const { tasks } = vi.hoisted(() => ({
  tasks: Array.from({ length: 7 }, (_, index) => ({
    id: `task-${index + 1}`, plan_id: "plan-1", course_id: "course-1", content_node_id: null,
    knowledge_point_id: null, task_type: "LEARN", title: `计划任务 ${index + 1}`, instruction: null,
    action_href: null, scheduled_for: index === 0 ? "2026-10-30T00:00:00Z" : null,
    estimated_minutes: 10, sequence: index + 1, required: true,
    status: index === 0 ? "COMPLETED" : index === 3 ? "IN_PROGRESS" : "READY",
    completed_at: index === 0 ? "2026-10-30T00:00:00Z" : null, postponed_to: null,
    planning_reason: null, metadata_json: null,
  })),
}));

vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
  return {
    ...actual,
    getCourseLearningPlanDashboard: vi.fn().mockResolvedValue({
      draft_plan: null, pending_plan: null,
      active_plan: { plan: { id: "plan-1", title: "七年级数学计划", status: "ACTIVE", target_date: "2026-11-10" }, task_count: 7, completed_task_count: 1, remaining_minutes: 60 },
      current_task: tasks[3], today_tasks: tasks.slice(1), plan_tasks: tasks,
    }),
  };
});

describe("CoursePlanStatus", () => {
  beforeEach(() => vi.clearAllMocks());

  it("shows a current-task window and expands to the full plan", async () => {
    const user = userEvent.setup();
    render(<CoursePlanStatus courseId="course-1" />);
    expect(await screen.findByText("任务全貌")).toBeInTheDocument();
    expect(screen.getByText("计划任务 4")).toBeInTheDocument();
    expect(screen.queryByText("计划任务 7")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "查看全部 7 项任务" }));
    expect(screen.getByText("计划任务 1")).toBeInTheDocument();
    expect(screen.getByText("计划任务 7")).toBeInTheDocument();
  });

  it("does not mark completed work overdue", () => {
    expect(taskOverdueDays(tasks[0] as never, new Date(2026, 10, 2))).toBe(0);
  });
});
