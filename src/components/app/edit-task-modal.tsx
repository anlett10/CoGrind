import { useState, useEffect } from "react";
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
import { useConvexMutation } from "@convex-dev/react-query";
import { api } from "convex/_generated/api";
import { Id } from "convex/_generated/dataModel";

interface EditTaskModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: {
    _id: string;
    text: string;
    details: string;
    priority?: string;
    status?: string;
    hrs?: number;
    sharedWith?: string;
  } | null;
}

export function EditTaskModal({
  open,
  onOpenChange,
  task,
}: EditTaskModalProps) {
  const [text, setText] = useState("");
  const [details, setDetails] = useState("");
  const [priority, setPriority] = useState("medium");
  const [status, setStatus] = useState("todo");
  const [hrs, setHrs] = useState("1");
  const [sharedEmails, setSharedEmails] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const updateTask = useConvexMutation(api.tasks.updateTask);

  // Initialize form with task data when task changes
  useEffect(() => {
    if (task) {
      setText(task.text || "");
      setDetails(task.details || "");
      setPriority(task.priority || "medium");
      setStatus(task.status || "todo");
      setHrs(task.hrs?.toString() || "1");
      
      // Parse sharedWith JSON string to display emails
      if (task.sharedWith) {
        try {
          const emails = JSON.parse(task.sharedWith);
          setSharedEmails(Array.isArray(emails) ? emails.join(", ") : "");
        } catch {
          setSharedEmails("");
        }
      } else {
        setSharedEmails("");
      }
    }
  }, [task]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!text.trim() || !task) {
      return;
    }

    setIsSubmitting(true);
    try {
      // Parse shared emails (comma-separated) and convert to JSON string
      const emails = sharedEmails
        .split(",")
        .map((email) => email.trim())
        .filter((email) => email.length > 0 && email.includes("@"));
      const sharedWithJson = emails.length > 0 ? JSON.stringify(emails) : undefined;

      await updateTask({
        taskId: task._id as Id<"tasks">,
        text: text.trim(),
        details: details.trim() || "",
        priority,
        status,
        hrs: parseFloat(hrs) || 1,
        sharedWith: sharedWithJson,
      });
      
      // Close modal
      onOpenChange(false);
    } catch (error) {
      console.error("Failed to update task:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      onOpenChange(false);
    }
  };

  if (!task) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span>Edit Task</span>
          </DialogTitle>
          <DialogDescription>
            Update task details
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <label htmlFor="edit-task-text" className="text-sm font-medium">
                Task Name <span className="text-destructive">*</span>
              </label>
              <Input
                id="edit-task-text"
                type="text"
                placeholder="Enter task name..."
                value={text}
                onChange={(e) => setText(e.target.value)}
                required
                disabled={isSubmitting}
              />
            </div>
            
            <div className="grid gap-2">
              <label htmlFor="edit-task-details" className="text-sm font-medium">
                Task Details
              </label>
              <textarea
                id="edit-task-details"
                placeholder="Enter task details (optional)..."
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                disabled={isSubmitting}
                rows={3}
                className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <label htmlFor="edit-task-priority" className="text-sm font-medium">
                  Priority
                </label>
                <select
                  id="edit-task-priority"
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                  disabled={isSubmitting}
                  className="h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>
              
              <div className="grid gap-2">
                <label htmlFor="edit-task-status" className="text-sm font-medium">
                  Status
                </label>
                <select
                  id="edit-task-status"
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  disabled={isSubmitting}
                  className="h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <option value="todo">To Do</option>
                  <option value="in-progress">In Progress</option>
                  <option value="done">Done</option>
                </select>
              </div>
            </div>

            <div className="grid gap-2">
              <label htmlFor="edit-task-hrs" className="text-sm font-medium">
                Estimated Hours
              </label>
              <Input
                id="edit-task-hrs"
                type="number"
                step="0.5"
                min="0.5"
                placeholder="1"
                value={hrs}
                onChange={(e) => setHrs(e.target.value)}
                disabled={isSubmitting}
              />
            </div>

            <div className="grid gap-2">
              <label htmlFor="edit-task-shared" className="text-sm font-medium">
                Share with (emails)
              </label>
              <Input
                id="edit-task-shared"
                type="text"
                placeholder="user1@example.com, user2@example.com"
                value={sharedEmails}
                onChange={(e) => setSharedEmails(e.target.value)}
                disabled={isSubmitting}
              />
              <p className="text-xs text-muted-foreground">
                Enter comma-separated email addresses to share this task
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || !text.trim()}>
              {isSubmitting ? "Updating..." : "Update Task"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

