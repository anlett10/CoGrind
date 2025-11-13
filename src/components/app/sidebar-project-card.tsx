import { useState, type ReactNode } from "react";
import { Card, CardContent, CardHeader } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Progress } from "~/components/ui/progress";
import {
  MoreHorizontal,
  Github,
  Users,
  Star,
  GitFork,
  Edit,
  Trash2,
  RefreshCw,
  Crown,
  Eye,
  Download,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { useQueryClient } from "@tanstack/react-query";
import { useConvexMutation, useConvexAction } from "@convex-dev/react-query";
import { api } from "convex/_generated/api";
import { Id } from "convex/_generated/dataModel";
import { toast } from "sonner";
import { EditProjectModal } from "./edit-project-modal";
import { ProjectDetailsModal } from "./project-details-modal";

const getProjectStatusLabel = (status: string) => {
  const labels: Record<string, string> = {
    planning: "Planning",
    development: "Development",
    alpha: "Alpha",
    beta: "Beta",
    "official-release": "Official Release",
  };
  return labels[status] || status;
};

const getProjectStatusColor = (status: string) => {
  const colors: Record<string, string> = {
    planning: "bg-slate-100 text-slate-700 dark:bg-slate-700/50 dark:text-slate-300",
    development: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
    alpha: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
    beta: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
    "official-release": "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300",
  };
  return colors[status] || colors.planning;
};

const formatNumber = (num: number) => {
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  return num.toString();
};

type Project = {
  _id?: Id<"projects"> | string;
  id: string;
  name: string;
  description?: string;
  type?: string;
  category?: string;
  status: string;
  githubUrl?: string;
  githubStars?: number;
  githubForks?: number;
  githubRepo?: string;
  npmDownloads?: number;
  websiteUrl?: string;
  downloadCount?: number;
  userCount?: number;
  launchDate?: number | string | Date;
  taskCount?: number;
  completedTaskCount?: number;
  progressPercentage?: number;
  userRole?: string;
};

interface SidebarProjectCardProps {
  project: Project;
  isSelected: boolean;
  onSelect: (projectId: string | null) => void;
  onShowCollaborators: () => void;
}

export function SidebarProjectCard({ project, isSelected, onSelect, onShowCollaborators }: SidebarProjectCardProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const queryClient = useQueryClient();

  const deleteProject = useConvexMutation(api.projects.deleteProject);
  const syncGitHubMetrics = useConvexAction((api.projects as any).syncGitHubMetrics);

  const handleDelete = async () => {
    if (!window.confirm(`Delete "${project.name}"? This cannot be undone.`)) {
      return;
    }

    setIsDeleting(true);
    try {
      const projectId = (project._id || project.id) as Id<"projects">;
      await deleteProject({ projectId });
      queryClient.invalidateQueries({
        predicate: (query) => {
          const key = query.queryKey;
          return Array.isArray(key) && (key[0] === api.projects.listProjects || key[0] === api.projects.getProject);
        },
      });
      toast.success("Project deleted successfully");
    } catch (error) {
      toast.error(`Failed to delete project: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSyncGitHubMetrics = async () => {
    setIsSyncing(true);
    try {
    const repoUrl =
      project.githubUrl ||
      (project.githubRepo ? `https://github.com/${project.githubRepo}` : null) ||
      project.websiteUrl ||
      null;

      if (!repoUrl) {
        toast.error("Add a GitHub URL before syncing metrics.");
        return;
      }

      const projectId = (project._id ?? project.id) as Id<"projects">;
      await syncGitHubMetrics({ projectId });

      queryClient.invalidateQueries({
        predicate: (query) => {
          const key = query.queryKey;
          return Array.isArray(key) && (key[0] === api.projects.listProjects || key[0] === api.projects.getProject);
        },
      });

      toast.success("GitHub metrics synced successfully");
    } catch (error) {
      toast.error(`Failed to sync GitHub metrics: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setIsSyncing(false);
    }
  };

  const getProjectIcon = (type?: string) => {
    const icons: Record<string, string> = {
      saas: "💼",
      mobile: "📱",
      web: "🌐",
      desktop: "💻",
      "open-source": "🔓",
      library: "📚",
      tool: "🔧",
      blog: "✍️",
      course: "🎓",
      other: "📦",
    };
    return icons[type || "other"];
  };

  const getCategoryBadgeClasses = (category?: string) => {
    const colors: Record<string, string> = {
      saas: "border-blue-200 text-blue-700 dark:border-blue-700 dark:text-blue-200",
      mobile: "border-green-200 text-green-700 dark:border-green-700 dark:text-green-200",
      web: "border-purple-200 text-purple-700 dark:border-purple-700 dark:text-purple-200",
      desktop: "border-orange-200 text-orange-700 dark:border-orange-700 dark:text-orange-200",
      "open-source": "border-slate-200 text-slate-700 dark:border-slate-700 dark:text-slate-100",
      library: "border-indigo-200 text-indigo-700 dark:border-indigo-700 dark:text-indigo-200",
      tool: "border-amber-200 text-amber-700 dark:border-amber-700 dark:text-amber-200",
      blog: "border-pink-200 text-pink-700 dark:border-pink-700 dark:text-pink-200",
      course: "border-teal-200 text-teal-700 dark:border-teal-700 dark:text-teal-200",
      other: "border-slate-200 text-slate-700 dark:border-slate-600 dark:text-slate-200",
    };
    return colors[category || "other"];
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case "owner":
        return <Crown className="h-3 w-3 text-amber-500" />;
      case "collaborator":
        return <Users className="h-3 w-3 text-emerald-500" />;
      default:
        return <Users className="h-3 w-3 text-slate-500" />;
    }
  };

  const getRoleDisplayName = (role: string) => {
    switch (role) {
      case "owner":
        return "Owner";
      case "collaborator":
        return "Builder";
      default:
        return "Unknown";
    }
  };
 
  const repoLabel = (() => {
    if (project.githubRepo) return project.githubRepo;
    if (project.githubUrl) {
      try {
        const { pathname } = new URL(project.githubUrl);
        const segments = pathname.replace(/^\/+/, "").split("/");
        if (segments.length >= 2) {
          return `${segments[0]}/${segments[1]}`.replace(/\.git$/, "");
        }
      } catch {
        /* ignore malformed URLs */
      }
    }
    return null;
  })();

  const descriptionText = project.description?.trim() || "No description provided yet.";

  return (
    <div className="mt-6 flex justify-center first:mt-0">
      <Card
        className={`group relative mx-auto w-[90%] flex h-full cursor-pointer flex-col overflow-hidden border border-slate-200/80 bg-gradient-to-br from-white via-slate-50 to-slate-100 backdrop-blur transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-xl dark:border-slate-700 dark:from-slate-800 dark:via-slate-800 dark:to-slate-800 dark:hover:border-slate-600 ${
          isSelected ? "ring-2 ring-black dark:ring-white ring-offset-2 ring-offset-white dark:ring-offset-black" : ""
        }`}
        onClick={() => onSelect(isSelected ? null : project.id)}
      >
        <CardHeader className="flex flex-col gap-3 px-4 sm:px-6 pb-3 pt-6">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-gradient-to-br from-slate-100 via-white to-slate-50 text-lg shadow-sm dark:border-slate-700 dark:from-slate-700 dark:via-slate-800 dark:to-slate-800">
              {getProjectIcon(project.type)}
            </div>
            <div className="min-w-0 flex-1 space-y-1.5">
              <div className="flex items-center gap-2">
                <h3 className="truncate text-base font-semibold text-slate-900 dark:text-slate-100">
                  {project.name || "Unnamed Project"}
                </h3>
                {project.userRole && (
                  <Badge variant="outline" className="flex items-center gap-1 border-slate-300 text-xs dark:border-slate-600">
                    {getRoleIcon(project.userRole)}
                    {getRoleDisplayName(project.userRole)}
                  </Badge>
                )}
              </div>
              <p className="line-clamp-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                {descriptionText}
              </p>
            </div>
          </div>

          {(project.userRole === "owner" || project.userRole === "collaborator") && (
            <div className="absolute right-4 top-4 flex-shrink-0">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8 p-0 flex-shrink-0">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  sideOffset={8}
                  className="z-50 w-48 rounded-xl border border-slate-200/90 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-xl p-1"
                >
                  {project.userRole === "owner" && (
                    <>
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowEditModal(true);
                        }}
                        className="flex items-center gap-2 px-3 py-2 text-sm text-slate-900 dark:text-slate-200 cursor-pointer rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700/50 focus:bg-slate-100 dark:focus:bg-slate-700/50"
                      >
                        <Edit className="h-4 w-4" />
                        Edit Project
                      </DropdownMenuItem>
                      <DropdownMenuSeparator className="my-1 bg-slate-200/80 dark:bg-slate-700" />
                    </>
                  )}
                  <DropdownMenuItem
                    onClick={(event) => {
                      event.stopPropagation();
                      onShowCollaborators();
                    }}
                    className="flex items-center gap-2 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 cursor-pointer rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 focus:bg-slate-100 dark:focus:bg-slate-800"
                  >
                    <Users className="h-4 w-4" />
                    Collaboration
                  </DropdownMenuItem>
                  {project.userRole === "owner" && (
                    <>
                      <DropdownMenuSeparator className="my-1 bg-slate-200/80 dark:bg-slate-700" />
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete();
                        }}
                        disabled={isDeleting}
                        className="flex items-center gap-2 px-3 py-2 text-sm text-red-600 dark:text-red-400 cursor-pointer rounded-lg hover:bg-red-50 dark:hover:bg-red-950/20 focus:bg-red-50 dark:focus:bg-red-950/20 focus:text-red-600 dark:focus:text-red-400 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                      >
                        <Trash2 className="h-4 w-4" />
                        Delete
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}

          <div className="flex flex-wrap gap-2 text-xs">
            <Badge variant="secondary" className={`${getProjectStatusColor(project.status as any)} border-0`}>
              {getProjectStatusLabel(project.status as any)}
            </Badge>
            {project.launchDate && (
              <Badge variant="outline" className="text-xs text-slate-600 dark:text-slate-300">
                Launched {new Date(project.launchDate).toLocaleDateString()}
              </Badge>
            )}
          </div>
        </CardHeader>

        <CardContent className="flex flex-1 flex-col px-0 pb-6 pt-3">
          <div className="flex flex-1 flex-col gap-5 px-6 w-full">
            {repoLabel && (
              <div className="rounded-xl border border-slate-200 bg-slate-100/90 px-4 py-2 text-xs font-medium text-slate-700 shadow-sm dark:border-slate-700 dark:bg-slate-700 dark:text-slate-200">
                <div className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-2 text-slate-800 dark:text-slate-100">
                    <Github className="h-3.5 w-3.5" /> Repository
                  </span>
                  <span className="truncate font-mono text-[11px] text-slate-900 dark:text-slate-100">
                    {repoLabel}
                  </span>
                </div>
              </div>
            )}

            <div className="rounded-2xl border border-slate-200 bg-white/85 px-4 py-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
              <div className="grid grid-cols-3 gap-4">
                <MetricPill label="Stars" value={formatNumber(project.githubStars || 0)} icon={<Star className="h-3.5 w-3.5 text-amber-500" />} />
                <MetricPill label="Forks" value={formatNumber(project.githubForks || 0)} icon={<GitFork className="h-3.5 w-3.5 text-slate-500" />} />
                <MetricPill
                  label="Downloads"
                  value={formatNumber(project.npmDownloads || project.downloadCount || 0)}
                  icon={<Download className="h-3.5 w-3.5 text-emerald-500" />}
                />
              </div>
            </div>

            {(project.taskCount || project.completedTaskCount) && (
              <div className="rounded-xl border border-slate-200 bg-white/80 px-4 py-3 text-xs text-slate-600 shadow-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                <div className="flex items-center justify-between">
                  <span className="font-medium">Tasks</span>
                  <span>
                    {project.completedTaskCount || 0}
                    <span className="text-slate-400"> / {project.taskCount || 0}</span>
                  </span>
                </div>
                <Progress value={project.progressPercentage || 0} className="mt-2 h-1.5" />
              </div>
            )}

            {(project.taskCount && project.taskCount > 0) || project.category === "learning" ? (
              <div className="rounded-xl border border-dashed border-slate-200 bg-white/70 px-4 py-3 dark:border-slate-700 dark:bg-slate-800/60">
                <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                  <span>Task progress</span>
                  <span>
                    {project.completedTaskCount || 0}/{project.taskCount || 0}
                  </span>
                </div>
                <Progress value={project.progressPercentage || 0} className="mt-2 h-1.5" />
              </div>
            ) : null}

            <div className="mt-auto flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="flex-1 border-slate-300 text-sm font-medium text-slate-800 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-700"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowDetailsModal(true);
                }}
              >
                <Eye className="mr-2 h-4 w-4" />
                View details
              </Button>
              {project.userRole === "owner" && (project.githubUrl || project.githubRepo || project.websiteUrl) && (
                <Button
                  variant="outline"
                  size="icon"
                  className="border-slate-300 text-slate-800 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-700"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSyncGitHubMetrics();
                  }}
                  disabled={isSyncing}
                >
                  <RefreshCw className={`h-4 w-4 ${isSyncing ? "animate-spin" : ""}`} />
                </Button>
              )}
              {(project.githubUrl || project.githubRepo || project.websiteUrl) && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="border border-slate-300 bg-white text-slate-800 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                  onClick={(e) => {
                    e.stopPropagation();
                    const repoUrl =
                      project.githubUrl ||
                      (project.githubRepo ? `https://github.com/${project.githubRepo}` : undefined) ||
                      project.websiteUrl;
                    if (repoUrl) {
                      window.open(repoUrl, "_blank");
                    } else {
                      toast.error("Repository URL not available.");
                    }
                  }}
                >
                  <Github className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {project._id && (
        <EditProjectModal
          project={{
            _id: project._id as Id<"projects">,
            id: project.id,
            name: project.name,
            description: project.description || "",
            status: project.status,
            githubUrl: project.githubUrl,
            githubStars: project.githubStars,
            githubForks: project.githubForks,
            npmDownloads: project.npmDownloads,
          }}
          open={showEditModal}
          onOpenChange={setShowEditModal}
        />
      )}

      {project._id && (
        <ProjectDetailsModal projectId={project._id as Id<"projects">} open={showDetailsModal} onOpenChange={setShowDetailsModal} />
      )}
    </div>
  );
}

function MetricPill({ label, value, icon }: { label: string; value: string | number; icon: ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white/80 p-3 text-center shadow-sm transition-transform duration-200 hover:-translate-y-0.5 hover:shadow-lg dark:border-slate-700 dark:bg-slate-800">
      <div className="flex items-center justify-center gap-1 text-xs font-medium text-slate-500 dark:text-slate-400">
        {icon}
        {label}
      </div>
      <p className="mt-1 text-sm font-semibold text-slate-800 dark:text-slate-100">{value}</p>
    </div>
  );
}
