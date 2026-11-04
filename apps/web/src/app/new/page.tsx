"use client";

import { useEffect, useState } from "react";
import { getCourseCreationPolicy } from "@/lib/course-creation-policy";

import { useNewProject } from "./use-new-project";
import { ContentUploadStep } from "./content-upload-step";
import { ParsingProgressStep } from "./parsing-progress-step";

/**
 * Simplified "add another course" page for returning users.
 * Skips mode selection and feature config — goes straight to upload → parse → workspace.
 */
export default function NewProjectPage() {
  const p = useNewProject();
  const [creationAccess, setCreationAccess] = useState<"checking" | "allowed" | "denied">("checking");
  useEffect(() => {
    let active = true;
    void getCourseCreationPolicy().then((policy) => {
      if (active) setCreationAccess(policy.can_create_now ? "allowed" : "denied");
    }).catch(() => { if (active) setCreationAccess("denied"); });
    return () => { active = false; };
  }, []);

  if (creationAccess !== "allowed") return <main className="grid min-h-screen place-items-center bg-background p-6 text-center text-sm text-muted-foreground"><div><p>{creationAccess === "checking" ? "正在检查学习空间权限…" : "当前账号无法新建学习空间，或已达到管理员设置的上限。"}</p><button type="button" onClick={() => p.router.push("/")} className="mt-4 rounded-lg bg-brand px-4 py-2 text-brand-foreground">返回首页</button></div></main>;

  return (
    <div className="min-h-screen bg-background">
      {(p.step === "mode" || p.step === "upload") && (
        <ContentUploadStep
          mode="upload"
          projectName={p.projectName}
          onProjectNameChange={p.setProjectName}
          nameError={p.nameError}
          onValidateName={p.validateName}
          files={p.files}
          onFilesChange={p.setFiles}
          onBack={() => p.router.push("/")}
          onStartParsing={p.startParsing}
          uploadPlan={p.uploadPlan}
          fileAssignments={p.fileAssignments}
          onFileAssignmentChange={(filename, target) => p.setFileAssignments((current) => ({ ...current, [filename]: target }))}
          onCombineAll={() => p.setFileAssignments(Object.fromEntries(p.files.map((file) => [file.name, "__all__"]))) }
          onResetGrouping={() => p.setFileAssignments({})}
          t={p.t}
        />
      )}

      {(p.step === "parsing" || p.step === "features") && (
        <ParsingProgressStep
          projectName={p.projectName}
          url={p.url}
          files={p.files}
          parseSteps={p.parseSteps}
          parseProgress={p.parseProgress}
          parseLogs={p.parseLogs}
          ingestionJobs={p.ingestionJobs}
          canContinueToFeatures={p.canContinueToFeatures}
          allJobsFailed={p.allJobsFailed}
          hasFailedJobs={p.hasFailedJob}
          processingState={p.processingState}
          readyCourseIds={p.readyCourseIds}
          createdCourseId={p.createdCourseId}
          createdCourseIds={p.createdCourseIds}
          uploadPlan={p.uploadPlan}
          onConfirmParsedSpaces={p.confirmParsedSpaces}
          onEnterWorkspace={p.enterWorkspace}
          onReturnToUpload={p.returnToUpload}
          t={p.t}
        />
      )}

    </div>
  );
}
