import { useState } from "react";
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

interface AddTaskModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddTaskModal({
  open,
  onOpenChange,
}: AddTaskModalProps) {
  const [text, setText] = useState("");
  const [details, setDetails] = useState("");
  const [priority, setPriority] = useState("medium");
  const [status, setStatus] = useState("todo");
  const [hrs, setHrs] = useState("1");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const createTask = useConvexMutation(api.tasks.createTask);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!text.trim()) {
      return;
    }

    setIsSubmitting(true);
    try {
      await createTask({
        text: text.trim(),
        details: details.trim() || "",
        priority,
        status,
        hrs: parseFloat(hrs) || 1,
      });
      
      // Reset form
      setText("");
      setDetails("");
      setPriority("medium");
      setStatus("todo");
      setHrs("1");
      
      // Close modal
      onOpenChange(false);
    } catch (error) {
      console.error("Failed to create task:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      setText("");
      setDetails("");
      setPriority("medium");
      setStatus("todo");
      setHrs("1");
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span>Add New Task</span>
          </DialogTitle>
          <DialogDescription>
            Create a new task to track your progress
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <label htmlFor="task-text" className="text-sm font-medium">
                Task Name <span className="text-destructive">*</span>
              </label>
              <Input
                id="task-text"
                type="text"
                placeholder="Enter task name..."
                value={text}
                onChange={(e) => setText(e.target.value)}
                required
                disabled={isSubmitting}
              />
            </div>
            
            <div className="grid gap-2">
              <label htmlFor="task-details" className="text-sm font-medium">
                Task Details
              </label>
              <textarea
                id="task-details"
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
                <label htmlFor="task-priority" className="text-sm font-medium">
                  Priority
                </label>
                <select
                  id="task-priority"
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
                <label htmlFor="task-status" className="text-sm font-medium">
                  Status
                </label>
                <select
                  id="task-status"
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
              <label htmlFor="task-hrs" className="text-sm font-medium">
                Estimated Hours
              </label>
              <Input
                id="task-hrs"
                type="number"
                step="0.5"
                min="0.5"
                placeholder="1"
                value={hrs}
                onChange={(e) => setHrs(e.target.value)}
                disabled={isSubmitting}
              />
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
              {isSubmitting ? "Adding..." : "Add Task"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

