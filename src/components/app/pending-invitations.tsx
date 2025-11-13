import { useMemo } from "react";
import { useConvexQuery, useConvexMutation } from "@convex-dev/react-query";
import { api } from "convex/_generated/api";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Card, CardHeader, CardTitle, CardContent } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";

type PendingInvitation = {
  id: string;
  projectId: string;
  projectName: string;
  role: string;
  invitedAt: number;
  inviterName?: string;
  token: string;
  expiresAt: number;
};

interface PendingInvitationsProps {
  className?: string;
}

export function PendingInvitations({ className }: PendingInvitationsProps) {
  const queryClient = useQueryClient();
  const invitations = useConvexQuery(api.projects.getPendingInvitations, {}) as
    | PendingInvitation[]
    | undefined;

  const acceptInvitation = useConvexMutation(api.projects.acceptProjectInvitation);
  const declineInvitation = useConvexMutation(api.projects.declineProjectInvitation);

  const sortedInvitations = useMemo(() => {
    if (!invitations) return [];
    return [...invitations].sort((a, b) => b.invitedAt - a.invitedAt);
  }, [invitations]);

  if (!sortedInvitations.length) {
    return null;
  }

  const refresh = () => {
    queryClient.invalidateQueries({
      predicate: (query) => {
        const key = query.queryKey;
        if (!Array.isArray(key)) return false;
        return (
          key[0] === api.projects.getPendingInvitations ||
          key[0] === api.projects.getProjectCollaborators ||
          key[0] === api.projects.listProjectInvitations ||
          key[0] === api.projects.listProjects
        );
      },
    });
  };

  const handleRespond = async (token: string, action: "accept" | "decline") => {
    try {
      if (action === "accept") {
        await acceptInvitation({ token });
        toast.success("Invitation accepted!");
      } else {
        await declineInvitation({ token });
        toast.success("Invitation declined.");
      }
      refresh();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to respond to invitation.";
      toast.error(message);
    }
  };

  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">Pending Invitations</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {sortedInvitations.map((invitation) => (
          <div
            key={invitation.id}
            className="flex flex-col gap-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <div>
              <div className="flex items-center gap-2 text-sm font-medium text-slate-900 dark:text-slate-100">
                {invitation.projectName}
                <Badge variant="secondary" className="uppercase">
                  {invitation.role}
                </Badge>
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Invited by {invitation.inviterName || "a teammate"} ·{" "}
                {new Date(invitation.invitedAt).toLocaleString()}
              </div>
              <div className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                Expires {new Date(invitation.expiresAt).toLocaleString()}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                className="bg-black text-white hover:bg-gray-800 dark:bg-white dark:text-black dark:hover:bg-gray-200"
                onClick={() => handleRespond(invitation.token, "accept")}
              >
                Accept
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleRespond(invitation.token, "decline")}
              >
                Decline
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

