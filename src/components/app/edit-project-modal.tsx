import { useEffect } from "react";
import { Sparkles } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "~/components/ui/select";
import { Label } from "~/components/ui/label";
import { useConvexMutation } from "@convex-dev/react-query";
import { api } from "convex/_generated/api";
import { Id } from "convex/_generated/dataModel";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useForm } from "@tanstack/react-form";

const statusOptions = [
  "planning",
  "development",
  "alpha",
  "beta",
  "official-release",
] as const;

type StatusOption = typeof statusOptions[number];

type EditProjectForm = {
  name: string;
  description: string;
  status: StatusOption;
  githubUrl: string;
};

const validateProjectName = (value: string) => {
  if (!value.trim()) {
    return "Project name is required";
  }
  return undefined;
};

const validateGithubUrl = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return "Enter a valid URL";
    }
    return undefined;
  } catch {
    return "Enter a valid URL";
  }
};

interface EditProjectModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project: {
    _id: Id<"projects">;
    id: string;
    name: string;
    description: string;
    status: string;
    githubUrl?: string;
    githubStars?: number;
    githubForks?: number;
    npmDownloads?: number;
    websiteUrl?: string;
  } | null;
}

export function EditProjectModal({
  open,
  onOpenChange,
  project,
}: EditProjectModalProps) {
  const queryClient = useQueryClient();

  const updateProject = useConvexMutation(api.projects.updateProject);

  const form = useForm({
    defaultValues: {
      name: "",
      description: "",
      status: "planning" as StatusOption,
      githubUrl: "",
    } satisfies EditProjectForm,
    onSubmit: async ({ value, formApi }) => {
      if (!project) {
        toast.error("Project is missing. Please reopen the modal.");
      return;
    }

    try {
      await updateProject({
        projectId: project._id as Id<"projects">,
          name: value.name.trim(),
          description: value.description.trim(),
          status: value.status,
          githubUrl: value.githubUrl.trim() ? value.githubUrl.trim() : undefined,
      });
      
        queryClient.invalidateQueries({
          predicate: (query) => {
        const key = query.queryKey;
        return Array.isArray(key) && (key[0] === api.projects.listProjects || key[0] === api.projects.getProject);
          },
        });
      
      toast.success("Project updated successfully!");
        formApi.reset();
      onOpenChange(false);
    } catch (error) {
      console.error("Failed to update project:", error);
      toast.error(error instanceof Error ? error.message : "Failed to update project. Please try again.");
      }
    },
  });

  useEffect(() => {
    if (open && project) {
      // Ensure status is a valid option, default to "planning" if not
      const validStatus = statusOptions.includes(project.status as StatusOption) 
        ? (project.status as StatusOption)
        : "planning";
      
      form.reset({
        name: project.name ?? "",
        description: project.description ?? "",
        status: validStatus,
        githubUrl: project.githubUrl || project.websiteUrl || "",
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, project?._id]);

  const handleClose = () => {
    if (!form.state.isSubmitting) {
      form.reset();
      onOpenChange(false);
    }
  };

  if (!project) {
    return null;
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          handleClose();
        } else {
          onOpenChange(true);
        }
      }}
    >
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-gray-600 dark:text-gray-400" />
            Edit Project
          </DialogTitle>
          <DialogDescription>Update project details</DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            form.handleSubmit();
          }}
          className="space-y-6"
        >
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Basic Information</h3>

            <form.Field
              name="name"
              validators={{
                onChange: ({ value }) => validateProjectName(value),
                onBlur: ({ value }) => validateProjectName(value),
                onSubmit: ({ value }) => validateProjectName(value),
              }}
            >
              {(field) => {
                const errorMessage = field.state.meta.errors?.[0];
                return (
            <div className="space-y-2">
              <Label htmlFor="edit-project-name">Project Name *</Label>
              <Input
                id="edit-project-name"
                placeholder="e.g., My Awesome Project"
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(event) => field.handleChange(event.target.value)}
                      disabled={form.state.isSubmitting}
                required
              />
                    {errorMessage ? (
                      <p className="text-sm text-red-600 dark:text-red-400">{errorMessage}</p>
                    ) : null}
            </div>
                );
              }}
            </form.Field>

            <form.Field name="description">
              {(field) => (
            <div className="space-y-2">
              <Label htmlFor="edit-project-description">Description</Label>
              <Textarea
                id="edit-project-description"
                placeholder="Enter project description (optional)..."
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(event) => field.handleChange(event.target.value)}
                    disabled={form.state.isSubmitting}
                rows={3}
              />
            </div>
              )}
            </form.Field>

            {/* Project type and category removed per request */}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <form.Field
                name="status"
                validators={{
                  onChange: ({ value }) => (statusOptions.includes(value) ? undefined : "Select a valid status"),
                  onSubmit: ({ value }) => (statusOptions.includes(value) ? undefined : "Select a valid status"),
                }}
              >
                {(field) => {
                  const errorMessage = field.state.meta.errors?.[0];
                  return (
              <div className="space-y-2">
                <Label htmlFor="edit-project-status">Status</Label>
                <Select
                        value={field.state.value}
                        onValueChange={(value) => {
                          field.handleChange(value as StatusOption);
                        }}
                        disabled={form.state.isSubmitting}
                >
                  <SelectTrigger className="flex h-11 items-center justify-between rounded-lg border border-slate-200/80 bg-white/90 px-3 text-sm font-medium shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-ring dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent className="z-50 rounded-xl border border-slate-200/80 bg-white/95 shadow-xl dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100">
                          {statusOptions.map((option) => {
                            const displayLabel = option === "official-release" 
                              ? "Official Release" 
                              : option.charAt(0).toUpperCase() + option.slice(1);
                            return (
                            <SelectItem key={option} value={option}>
                                {displayLabel}
                            </SelectItem>
                            );
                          })}
                  </SelectContent>
                </Select>
                      {errorMessage ? (
                        <p className="text-sm text-red-600 dark:text-red-400">{errorMessage}</p>
                      ) : null}
              </div>
                  );
                }}
              </form.Field>

              <form.Field
                name="githubUrl"
                validators={{
                  onBlur: ({ value }) => validateGithubUrl(value),
                  onSubmit: ({ value }) => validateGithubUrl(value),
                }}
              >
                {(field) => {
                  const errorMessage = field.state.meta.errors?.[0];
                  return (
              <div className="space-y-2">
                <Label htmlFor="edit-project-github">GitHub URL</Label>
                <Input
                  id="edit-project-github"
                  placeholder="https://github.com/username/repository"
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(event) => field.handleChange(event.target.value)}
                        disabled={form.state.isSubmitting}
                />
                      {errorMessage ? (
                        <p className="text-sm text-red-600 dark:text-red-400">{errorMessage}</p>
                      ) : null}
              </div>
                  );
                }}
              </form.Field>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={form.state.isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={form.state.isSubmitting || !form.state.values.name.trim()}
              className="bg-black dark:bg-white text-white dark:text-black hover:bg-gray-800 dark:hover:bg-gray-200"
            >
              {form.state.isSubmitting ? "Updating..." : "Update Project"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

