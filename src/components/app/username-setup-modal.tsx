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

interface UsernameSetupModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentUsername?: string;
  userId?: string;
}

export function UsernameSetupModal({
  open,
  onOpenChange,
  currentUsername,
  userId,
}: UsernameSetupModalProps) {
  const [username, setUsername] = useState(currentUsername || "");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const updateUsername = useConvexMutation(api.user.updateUsername as any);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!username.trim()) {
      setError("Username is required");
      return;
    }

    if (!userId) {
      setError("User ID is required");
      return;
    }

    // Validate username format
    if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
      setError("Username must be 3-20 characters, alphanumeric and underscores only");
      return;
    }

    setIsSubmitting(true);
    try {
      await updateUsername({
        userId,
        username: username.trim(),
      });

      // Convex queries will auto-refresh due to reactivity

      onOpenChange(false);
      setError(null);
    } catch (err: any) {
      setError(err.message || "Failed to update username. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>
            {currentUsername ? "Update Username" : "Set Username"}
          </DialogTitle>
          <DialogDescription>
            {currentUsername
              ? "Choose a new username for your public profile."
              : "Choose a username for your public profile. This can be changed later."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <label htmlFor="username" className="text-sm font-medium">
                Username
              </label>
              <Input
                id="username"
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value);
                  setError(null);
                }}
                placeholder="johndoe"
                className={error ? "border-destructive" : ""}
                disabled={isSubmitting}
              />
              {error && (
                <p className="text-sm text-destructive">{error}</p>
              )}
              <p className="text-xs text-muted-foreground">
                3-20 characters, alphanumeric and underscores only
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : currentUsername ? "Update" : "Set Username"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

