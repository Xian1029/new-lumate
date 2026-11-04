export type CourseCreationPolicy = {
  can_create_courses: boolean;
  max_courses: number | null;
  current_courses: number;
  can_create_now: boolean;
};

export async function getCourseCreationPolicy(): Promise<CourseCreationPolicy> {
  const response = await fetch("/api/courses/creation-policy", { credentials: "include", cache: "no-store" });
  if (!response.ok) throw new Error("暂时无法读取学习空间权限");
  return response.json() as Promise<CourseCreationPolicy>;
}
