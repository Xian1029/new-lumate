import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { LearningHomeOverview } from "@/lib/api";
import { HomeCalendar } from "./home-calendar";

function todayKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

describe("HomeCalendar", () => {
  it("shows overdue reminders and an unscheduled started task today", async () => {
    const user = userEvent.setup();
    const overview = {
      calendar_items: [
        { id: "old", plan_id: "p", course_id: "c", course_name: "数学", title: "已延期任务", date: "2026-10-30", item_type: "TASK", status: "READY", estimated_minutes: 10, href: "/old", is_overdue: true, overdue_days: 3 },
        { id: "started", plan_id: "p", course_id: "c", course_name: "数学", title: "已开启的第二个任务", date: todayKey(), item_type: "TASK", status: "IN_PROGRESS", estimated_minutes: 10, href: "/started", is_unscheduled: true },
      ],
      today_tasks: [], upcoming_tasks: [],
    } as unknown as LearningHomeOverview;
    render(<HomeCalendar overview={overview} onNavigate={vi.fn()} />);
    expect(screen.getByText("1 项计划已延期，建议优先处理")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "查看日历" }));
    expect(screen.getByText("延期提醒")).toBeInTheDocument();
    expect(screen.getByText("已开启的第二个任务")).toBeInTheDocument();
    expect(screen.getByText("今日已开启")).toBeInTheDocument();
  });
});
