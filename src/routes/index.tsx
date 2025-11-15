import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { FolderKanban, Play, MessageSquare } from "lucide-react";
import { WorkflowStepper, type WorkflowStep } from "~/components/app/workflow-stepper";

export const Route = createFileRoute("/")({
  component: HomeComponent,
});

function HomeComponent() {
  const workflowSteps: WorkflowStep[] = [
    {
      id: "project",
      title: "Project",
      description: "Define project and tasks, share with collaborators.",
      status: "completed",
    },
    {
      id: "live-run",
      title: "Live Run",
      description: "Pick and run tasks based on your plan.",
      status: "current",
    },
    {
      id: "review",
      title: "Review",
      description: "Refine internal tasks, and spot new GitHub issues.",
      status: "current",
    },
  ];

  return (
    <div className="mx-auto mt-8 w-full max-w-6xl px-6 pb-16">
      <div className="flex min-h-[calc(100vh-8rem)] flex-col items-center justify-center">
        <div className="mx-auto w-full max-w-6xl space-y-12">
          {/* Header Section */}
          <div className="text-center space-y-4">
            <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl md:text-6xl">
              Welcome to{" "}
              <span className="bg-gradient-to-r from-blue-500 via-purple-500 via-pink-500 to-rose-500 bg-clip-text text-transparent drop-shadow-sm">
                CoGrind
              </span>
          </h1>
            <p className="text-xl sm:text-2xl font-medium text-foreground/80 max-w-3xl mx-auto leading-relaxed">
              Streamline your workflow, collaborate seamlessly, and turn your ideas into reality.
            </p>
          </div>

          {/* Workflow Stepper Section */}
          <div className="mt-8">
            <Card className="border border-slate-200/80 dark:border-slate-800 shadow-lg shadow-slate-200/50 dark:shadow-slate-900/50 bg-gradient-to-br from-white via-slate-50/50 to-white dark:from-slate-900 dark:via-slate-900 dark:to-slate-900">
              <CardHeader className="pb-4">
                <CardTitle className="text-2xl font-bold text-center text-foreground">Workflow</CardTitle>
              </CardHeader>
              <CardContent className="pt-2 pb-8 px-6">
                <WorkflowStepper steps={workflowSteps} orientation="horizontal" />
              </CardContent>
            </Card>
          </div>

          {/* Features Section */}
          <div className="grid gap-6 md:grid-cols-3 mt-8">
            {/* Project Page */}
            <Card className="group border border-slate-200/80 dark:border-slate-800 shadow-md hover:shadow-xl transition-all duration-300 hover:-translate-y-1 bg-white dark:bg-slate-900">
              <CardHeader className="pb-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-blue-100 to-blue-200 dark:from-blue-900/40 dark:to-blue-800/40 shadow-sm group-hover:shadow-md transition-shadow">
                    <FolderKanban className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                  </div>
                  <CardTitle className="text-xl font-semibold">Project page</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 pt-2">
                <CardDescription className="text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                  • Create project and invite collaborators to join your project
                </CardDescription>
                <CardDescription className="text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                  • Create or generate tasks with AI and assign them to your project, then share tasks with collaborators.
                </CardDescription>
              </CardContent>
            </Card>

            {/* Live Run Page */}
            <Card className="group border border-slate-200/80 dark:border-slate-800 shadow-md hover:shadow-xl transition-all duration-300 hover:-translate-y-1 bg-white dark:bg-slate-900">
              <CardHeader className="pb-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-100 to-emerald-200 dark:from-emerald-900/40 dark:to-emerald-800/40 shadow-sm group-hover:shadow-md transition-shadow">
                    <Play className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <CardTitle className="text-xl font-semibold">Live Run page</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 pt-2">
                <CardDescription className="text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                  • Select active tasks from Task List section.
                </CardDescription>
                <CardDescription className="text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                  • Run selected tasks from Live Run section.
                </CardDescription>
              </CardContent>
            </Card>

            {/* Review Page */}
            <Card className="group border border-slate-200/80 dark:border-slate-800 shadow-md hover:shadow-xl transition-all duration-300 hover:-translate-y-1 bg-white dark:bg-slate-900">
              <CardHeader className="pb-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-purple-100 to-purple-200 dark:from-purple-900/40 dark:to-purple-800/40 shadow-sm group-hover:shadow-md transition-shadow">
                    <MessageSquare className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                  </div>
                  <CardTitle className="text-xl font-semibold">Review page</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 pt-2">
                <CardDescription className="text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                  • Review/refine all shared tasks when needed.
                </CardDescription>
                <CardDescription className="text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                  • Review and spot newly created GitHub issues.
                </CardDescription>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
