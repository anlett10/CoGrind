import { useEffect } from "react";
import { useForm } from "@tanstack/react-form";
import { useQueryClient } from "@tanstack/react-query";
import { useConvexMutation } from "@convex-dev/react-query";
import { api } from "convex/_generated/api";
import { toast } from "sonner";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { Label } from "~/components/ui/label";
import { Sparkles } from "lucide-react";

const statusOptions = [
  "planning",
  "development",
  "alpha",
  "beta",
  "official-release",
] as const;

type StatusOption = typeof statusOptions[number];

type CreateProjectForm = {
  name: string;
  description: string;
  status: StatusOption;
  githubUrl: string;
};

interface AddProjectModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

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

export function AddProjectModal({ open, onOpenChange }: AddProjectModalProps) {
  const queryClient = useQueryClient();

  const createProject = useConvexMutation(api.projects.createProject);

  const form = useForm({
    defaultValues: {
      name: "",
      description: "",
      status: "planning" as StatusOption,
      githubUrl: "",
    } satisfies CreateProjectForm,
    onSubmit: async ({ value, formApi }) => {
      try {
        const trimmedGithubUrl = value.githubUrl.trim();
        const submitData = {
          id: generateProjectId(value.name),
          name: value.name.trim(),
          description: value.description.trim(),
          status: value.status,
          githubUrl: trimmedGithubUrl ? trimmedGithubUrl : undefined,
        };

        await createProject(submitData);

        queryClient.invalidateQueries({
          predicate: (query) => {
            const key = query.queryKey;
            return Array.isArray(key) && (key[0] === api.projects.listProjects || key[0] === api.projects.getProject);
          },
        });

        toast.success("Project created successfully!");
        formApi.reset();
        onOpenChange(false);
      } catch (error) {
        toast.error("Failed to create project");
        console.error("Create project error:", error);
      }
    },
  });

  const generateProjectId = (name: string) => {
    const base = name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    const fallback = "project";
    const slug = base.length > 0 ? base : fallback;
    const randomSuffix = Math.random().toString(36).slice(2, 8);
    return `${slug}-${randomSuffix}`;
  };

  const handleClose = () => {
    form.reset();
    onOpenChange(false);
  };

  useEffect(() => {
    if (open) {
      form.reset();
        }
  }, [open, form]);

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          handleClose();
        } else {
          form.reset();
          onOpenChange(true);
        }
      }}
    >
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 backdrop-blur-xl supports-[backdrop-filter]:bg-white/90">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-gray-600 dark:text-gray-400" />
            Create New Project
          </DialogTitle>
          <DialogDescription>
            Create a new project to organize your tasks
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            form.handleSubmit();
          }}
          className="space-y-6"
        >
          {/* Basic Information */}
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
              <Label htmlFor="name">Project Name *</Label>
              <Input
                id="name"
                      value={field.state.value}
                placeholder="e.g., My Awesome Project"
                      onBlur={field.handleBlur}
                      onChange={(event) => field.handleChange(event.target.value)}
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
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                    value={field.state.value}
                placeholder="Enter project description (optional)..."
                rows={3}
                    onBlur={field.handleBlur}
                    onChange={(event) => field.handleChange(event.target.value)}
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
                <Label htmlFor="status">Status</Label>
                      <Select value={field.state.value} onValueChange={(value) => field.handleChange(value as StatusOption)}>
                  <SelectTrigger className="flex h-11 items-center justify-between rounded-lg border border-slate-200/80 bg-white/90 px-3 text-sm font-medium shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-ring dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent className="z-50 rounded-xl border border-slate-200/80 bg-white/95 shadow-xl dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100">
                          {statusOptions.map((status) => {
                            const displayLabel = status === "official-release" 
                              ? "Official Release" 
                              : status.charAt(0).toUpperCase() + status.slice(1);
                            return (
                            <SelectItem key={status} value={status}>
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
                <Label htmlFor="githubUrl">GitHub URL</Label>
                <Input
                  id="githubUrl"
                        value={field.state.value}
                  placeholder="https://github.com/username/repository"
                        onBlur={field.handleBlur}
                        onChange={(event) => field.handleChange(event.target.value)}
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
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={form.state.isSubmitting}
              className="bg-black dark:bg-white text-white dark:text-black hover:bg-gray-800 dark:hover:bg-gray-200"
            >
              {form.state.isSubmitting ? "Creating..." : "Create Project"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}