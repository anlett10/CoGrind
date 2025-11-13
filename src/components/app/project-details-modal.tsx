import { useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Separator } from "~/components/ui/separator";
import { Progress } from "~/components/ui/progress";
import { 
  Plus, 
  Pencil, 
  Trash2, 
  CheckCircle2, 
  XCircle,
  Calendar,
  Users,
  Star,
  GitFork,
  Crown,
  Github,
  ExternalLink,
  Target,
  TrendingUp,
  Globe,
  Smartphone,
  Monitor,
  Database,
  Book,
  Wrench,
  Gamepad2,
  Package
} from "lucide-react";
import { useConvexQuery, useConvexMutation } from "@convex-dev/react-query";
import { api } from "convex/_generated/api";
import { Id } from "convex/_generated/dataModel";
import { useQueryClient } from "@tanstack/react-query";
import { AddTaskModal } from "./add-task-modal";
import { EditTaskModal } from "./edit-task-modal";

interface ProjectDetailsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: Id<"projects">;
}

type Project = {
  _id: Id<"projects">;
  _creationTime: number;
  id: string;
  name: string;
  description: string;
  type?: string;
  category?: string;
  status: string;
  githubUrl?: string;
  websiteUrl?: string;
  githubStars?: number;
  githubForks?: number;
  npmDownloads?: number;
  revenueMonthly?: number;
  revenueTotal?: number;
  downloadCount?: number;
  userCount?: number;
  launchDate?: number;
  userId: string;
  createdAt?: number;
  updatedAt?: number;
};

type Task = {
  _id: string;
  _creationTime: number;
  userId: string;
  text: string;
  details: string;
  priority?: string;
  status?: string;
  hrs?: number;
  startedAt?: number;
  completedAt?: number;
  sharedWith?: string;
  selectedBy?: string;
  refLink?: string;
  projectId?: Id<"projects">;
};

type TaskForEdit = {
  _id: string;
  text: string;
  details: string;
  priority?: string;
  status?: string;
  hrs?: number;
  sharedWith?: string;
  refLink?: string;
  projectId?: Id<"projects">;
};

// Helper functions
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

const formatNumber = (num: number) => {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
};

const getProjectIcon = (type?: string) => {
  const iconMap: Record<string, React.ReactNode> = {
    web: <Globe className="h-6 w-6" />,
    mobile: <Smartphone className="h-6 w-6" />,
    desktop: <Monitor className="h-6 w-6" />,
    saas: <Database className="h-6 w-6" />,
    library: <Book className="h-6 w-6" />,
    tool: <Wrench className="h-6 w-6" />,
    blog: <Package className="h-6 w-6" />,
    course: <Book className="h-6 w-6" />,
    "open-source": <Github className="h-6 w-6" />,
    other: <Package className="h-6 w-6" />,
  };
  if (!type) return <Package className="h-6 w-6" />;
  return iconMap[type] || <Package className="h-6 w-6" />;
};

const getProjectTypeLabel = (type?: string) => {
  const labels: Record<string, string> = {
    saas: "SaaS Application",
    mobile: "Mobile App",
    web: "Web Application",
    desktop: "Desktop App",
    "open-source": "Open Source",
    library: "Library/Framework",
    tool: "Developer Tool",
    blog: "Blog/Website",
    course: "Course/Education",
    other: "Other",
  };
  if (!type) return "Project";
  return labels[type] || type;
};

export function ProjectDetailsModal({
  open,
  onOpenChange,
  projectId,
}: ProjectDetailsModalProps) {
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<TaskForEdit | null>(null);
  const [isEditingName, setIsEditingName] = useState(false);
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const queryClient = useQueryClient();

  // Get project
  const project = useConvexQuery(
    api.projects.getProject,
    open ? { projectId } : "skip"
  ) as Project | undefined;

  // Get tasks for this project
  const allTasks = useConvexQuery(
    api.tasks.listTasks,
    open ? {} : "skip"
  ) as Task[] | undefined;

  const tasks = allTasks?.filter(task => task.projectId === projectId) || [];
  const completedTasks = tasks.filter(task => task.status === 'done');
  const progressPercentage = tasks.length > 0 ? (completedTasks.length / tasks.length) * 100 : 0;

  const recentTasks = useMemo(() => {
    if (!tasks.length) return [];
    return [...tasks]
      .sort((a, b) => b._creationTime - a._creationTime)
      .slice(0, 3);
  }, [tasks]);

  const updateProject = useConvexMutation(api.projects.updateProject);
  const updateTask = useConvexMutation(api.tasks.updateTask);
  const deleteTask = useConvexMutation(api.tasks.deleteTask);

  const handleUpdateProjectName = async () => {
    if (!project || !isEditingName) return;
    const newName = prompt('Edit project name:', project.name);
    if (newName && newName !== project.name && newName.trim()) {
      try {
        await updateProject({
          projectId: project._id,
          name: newName.trim(),
        });
        queryClient.invalidateQueries({ predicate: (query) => {
          const key = query.queryKey;
          return Array.isArray(key) && (key[0] === api.projects.getProject || key[0] === api.projects.listProjects);
        }});
      } catch (error) {
        console.error('Failed to update project name:', error);
        alert('Failed to update project name. Please try again.');
      }
    }
    setIsEditingName(false);
  };

  const handleUpdateProjectDescription = async () => {
    if (!project || !isEditingDescription) return;
    const newDescription = prompt('Edit project description:', project.description || '');
    if (newDescription !== null) {
      try {
        await updateProject({
          projectId: project._id,
          description: newDescription,
        });
        queryClient.invalidateQueries({ predicate: (query) => {
          const key = query.queryKey;
          return Array.isArray(key) && (key[0] === api.projects.getProject || key[0] === api.projects.listProjects);
        }});
      } catch (error) {
        console.error('Failed to update project description:', error);
        alert('Failed to update project description. Please try again.');
      }
    }
    setIsEditingDescription(false);
  };

  const handleToggleTask = async (task: Task) => {
    const currentStatus = task.status || 'todo';
    const newStatus = currentStatus === 'done' ? 'todo' : 'done';
    try {
      await updateTask({
        taskId: task._id as Id<"tasks">,
        status: newStatus,
      });
      queryClient.invalidateQueries({ predicate: (query) => {
        const key = query.queryKey;
        return Array.isArray(key) && key[0] === api.tasks.listTasks;
      }});
    } catch (error) {
      console.error('Failed to toggle task:', error);
      alert('Failed to update task. Please try again.');
    }
  };

  if (!project) {
    return null;
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              {getProjectIcon(project.type)}
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-bold">{project.name || 'Unnamed Project'}</h2>
                  {isEditingName && (
                    <div className="flex gap-2">
                      <Button size="sm" onClick={handleUpdateProjectName}>
                        Save
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setIsEditingName(false)}>
                        Cancel
                      </Button>
                    </div>
                  )}
                  {!isEditingName && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setIsEditingName(true)}
                      className="h-6 w-6 p-0"
                    >
                      <Pencil className="h-3 w-3" />
                    </Button>
                  )}
                </div>
                <p className="text-sm text-gray-600 dark:text-slate-400 font-normal">
                  {getProjectTypeLabel(project.type)}
                </p>
              </div>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            {/* Status and Category */}
            <div className="flex items-center gap-3">
              <Badge 
                variant={project.status === 'beta' ? 'default' : 'secondary'}
                className={project.status === 'beta' ? 'bg-black dark:bg-white text-white dark:text-black border-0' : ''}
              >
                {getProjectStatusLabel(project.status)}
              </Badge>
            </div>

            {/* Description */}
            <div>
              <h3 className="font-semibold mb-2">Description</h3>
              <div
                className="text-gray-600 dark:text-slate-300 cursor-pointer hover:bg-muted/50 dark:hover:bg-slate-700/30 p-2 rounded transition-colors min-h-[1.5rem]"
                onClick={() => setIsEditingDescription(true)}
              >
                {project.description || 'Click to add description...'}
              </div>
              {isEditingDescription && (
                <div className="flex gap-2 mt-2">
                  <Button size="sm" onClick={handleUpdateProjectDescription}>
                    Save
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setIsEditingDescription(false)}>
                    Cancel
                  </Button>
                </div>
              )}
            </div>

            {/* Progress Section */}
            {tasks.length > 0 && (
              <div>
                <h3 className="font-semibold mb-3">Progress</h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600 dark:text-slate-400">Task Completion</span>
                    <span className="text-sm font-medium">
                      {completedTasks.length}/{tasks.length} tasks
                    </span>
                  </div>
                  <Progress value={progressPercentage} className="h-2" />
                  <div className="text-center">
                    <span className="text-2xl font-bold">{Math.round(progressPercentage)}%</span>
                    <span className="text-sm text-gray-500 dark:text-slate-400 ml-1">Complete</span>
                  </div>
                </div>
              </div>
            )}

            <Separator />

            {/* Metrics Grid */}
            <div>
              <h3 className="font-semibold mb-3">Project Metrics</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {/* GitHub Stars */}
                <div className="text-center p-3 bg-gray-50 dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700">
                  <Star className="h-5 w-5 mx-auto mb-2 text-black dark:text-white" />
                  <div className="text-lg font-bold dark:text-slate-100">{formatNumber(project.githubStars || 0)}</div>
                  <div className="text-xs text-gray-500 dark:text-slate-400">GitHub Stars</div>
                </div>

                {/* GitHub Forks */}
                <div className="text-center p-3 bg-gray-50 dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700">
                  <GitFork className="h-5 w-5 mx-auto mb-2 text-black dark:text-white" />
                  <div className="text-lg font-bold">{formatNumber(project.githubForks || 0)}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">Forks</div>
                </div>

                {/* NPM Downloads */}
                <div className="text-center p-3 bg-gray-50 dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700">
                  <Package className="h-5 w-5 mx-auto mb-2 text-black dark:text-white" />
                  <div className="text-lg font-bold">{formatNumber(project.npmDownloads || 0)}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">Downloads (30d)</div>
                </div>

                {/* Tasks */}
                <div className="text-center p-3 bg-gray-50 dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700">
                  <Target className="h-5 w-5 mx-auto mb-2 text-black dark:text-white" />
                  <div className="text-lg font-bold dark:text-slate-100">{tasks.length}</div>
                  <div className="text-xs text-gray-500 dark:text-slate-400">Total Tasks</div>
                </div>
              </div>
            </div>

            <Separator />

            {/* Project Information */}
            <div>
              <h3 className="font-semibold mb-3">Project Information</h3>
              <div className="space-y-3">
                {/* Launch Date */}
                {project.launchDate && (
                  <div className="flex items-center gap-3">
                    <Calendar className="h-4 w-4 text-blue-500" />
                    <span className="text-sm text-gray-600 dark:text-slate-400">Launch Date:</span>
                    <span className="font-medium">{new Date(project.launchDate).toLocaleDateString()}</span>
                  </div>
                )}

                {/* GitHub Repository */}
                {project.githubUrl && (
                  <div className="flex items-center gap-3">
                    <Github className="h-4 w-4 text-gray-700 dark:text-slate-300" />
                    <span className="text-sm text-gray-600 dark:text-slate-400">Repository:</span>
                    <Button
                      variant="link"
                      size="sm"
                      className="p-0 h-auto"
                      onClick={() => window.open(project.githubUrl!, '_blank')}
                    >
                      View on GitHub
                      <ExternalLink className="h-3 w-3 ml-1" />
                    </Button>
                  </div>
                )}

                {/* Project Website removed */}
              </div>
            </div>

            {/* Additional Stats */}
            {(((project.npmDownloads ?? project.downloadCount) ?? null) !== null) || (project.userCount !== undefined && project.userCount !== null) ? (
              <>
                <Separator />
                <div>
                  <h3 className="font-semibold mb-3">Additional Statistics</h3>
                  <div className="grid grid-cols-2 gap-4">
                    {((project.npmDownloads ?? project.downloadCount) ?? null) !== null && (
                      <div className="text-center p-3 bg-gray-50 dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700">
                        <TrendingUp className="h-5 w-5 mx-auto mb-2 text-black dark:text-white" />
                        <div className="text-lg font-bold">
                          {formatNumber((project.npmDownloads ?? project.downloadCount) || 0)}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">Downloads (30d)</div>
                      </div>
                    )}
                    {(project.userCount !== undefined && project.userCount !== null) && (
                      <div className="text-center p-3 bg-gray-50 dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700">
                        <Users className="h-5 w-5 mx-auto mb-2 text-black dark:text-white" />
                        <div className="text-lg font-bold">{formatNumber(project.userCount)}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">Users</div>
                      </div>
                    )}
                  </div>
                </div>
              </>
            ) : null}

            <Separator />

            {/* Tasks Section */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Tasks</h3>
                <Button onClick={() => setIsTaskModalOpen(true)} size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Task
                </Button>
              </div>

              <div className="space-y-3">
                {tasks.length === 0 ? (
                  <Card>
                    <CardContent className="py-8 text-center text-muted-foreground">
                      No tasks yet. Add one above!
                    </CardContent>
                  </Card>
                ) : (
                  <>
                    {tasks.length > 3 && (
                      <p className="text-xs text-muted-foreground">
                        Showing the three most recent tasks
                      </p>
                    )}
                    {recentTasks.map((task) => (
                    <Card key={task._id}>
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                          <button
                            onClick={() => handleToggleTask(task)}
                            className="mt-1"
                            title={task.status === 'done' ? 'Mark as incomplete' : 'Mark as complete'}
                          >
                            {task.status === 'done' ? (
                              <CheckCircle2 className="h-5 w-5 text-green-600" />
                            ) : (
                              <XCircle className="h-5 w-5 text-gray-400" />
                            )}
                          </button>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span
                                className={`flex-1 ${
                                  task.status === 'done'
                                    ? 'line-through text-muted-foreground'
                                    : 'font-medium'
                                }`}
                              >
                                {task.text}
                              </span>
                              {task.priority && (
                                <Badge
                                  variant={
                                    task.priority === 'high'
                                      ? 'destructive'
                                      : task.priority === 'medium'
                                      ? 'default'
                                      : 'secondary'
                                  }
                                  className="text-xs"
                                >
                                  {task.priority}
                                </Badge>
                              )}
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => {
                                  setEditingTask({
                                    _id: task._id,
                                    text: task.text,
                                    details: task.details,
                                    priority: task.priority,
                                    status: task.status,
                                    hrs: task.hrs,
                                    sharedWith: task.sharedWith,
                                    refLink: task.refLink,
                                    projectId: task.projectId,
                                  });
                                  setIsEditModalOpen(true);
                                }}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive"
                                onClick={async () => {
                                  if (window.confirm(`Are you sure you want to delete "${task.text}"?`)) {
                                    try {
                                      await deleteTask({ taskId: task._id as Id<"tasks"> });
                                      queryClient.invalidateQueries({ predicate: (query) => {
                                        const key = query.queryKey;
                                        return Array.isArray(key) && key[0] === api.tasks.listTasks;
                                      }});
                                    } catch (error) {
                                      console.error('Failed to delete task:', error);
                                      alert('Failed to delete task. Please try again.');
                                    }
                                  }
                                }}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                            {task.details && (
                              <p className="text-sm text-muted-foreground mb-2">{task.details}</p>
                            )}
                            {task.refLink && (
                              <a
                                href={task.refLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-sm text-blue-600 hover:underline block mb-2"
                              >
                                🔗 {task.refLink}
                              </a>
                            )}
                            {task.hrs && (
                              <span className="text-xs text-muted-foreground">
                                Estimated: {task.hrs} hrs
                              </span>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                    ))}
                  </>
                )}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AddTaskModal
        open={isTaskModalOpen}
        onOpenChange={setIsTaskModalOpen}
        projectId={projectId}
      />
      {editingTask && (
        <EditTaskModal
          open={isEditModalOpen}
          onOpenChange={setIsEditModalOpen}
          task={editingTask}
        />
      )}
    </>
  );
}
