import { useEffect } from "react";
import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { Loader2, CheckCircle, XCircle } from "lucide-react";
import { toast } from "sonner";

import { useConvexMutation } from "@convex-dev/react-query";
import { api } from "convex/_generated/api";

import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";

export const Route = createFileRoute("/email/invitation-response")({
  component: InvitationResponse,
  validateSearch: (search: Record<string, unknown>) => ({
    token: (search.token as string) || "",
    action: (search.action as "accept" | "decline") || "accept",
  }),
});

function InvitationResponse() {
  const navigate = useNavigate();
  const { token, action } = useSearch({ from: "/email/invitation-response" });

  const acceptInvitation = useConvexMutation(api.projects.acceptProjectInvitation);
  const declineInvitation = useConvexMutation(api.projects.declineProjectInvitation);

  const isAccepting = action === "accept";

  useEffect(() => {
    if (!token) {
      toast.error("Invalid or missing invitation token.");
      navigate({ to: "/projects" });
      return;
    }

    const respond = async () => {
      try {
        if (isAccepting) {
          const result = await acceptInvitation({ token });
          toast.success(result.message ?? "Invitation accepted!");
        } else {
          const result = await declineInvitation({ token });
          toast.success(result.message ?? "Invitation declined.");
        }
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to process invitation.";
        toast.error(message);
      } finally {
        setTimeout(() => {
          navigate({ to: "/projects" });
        }, 2000);
      }
    };

    void respond();
  }, [acceptInvitation, declineInvitation, isAccepting, navigate, token]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="flex items-center justify-center gap-2">
            <Loader2 className="h-6 w-6 animate-spin" />
            {isAccepting ? "Accepting invitation..." : "Declining invitation..."}
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            We&apos;re finishing up. You&apos;ll be redirected to your projects shortly.
          </p>
          <Button onClick={() => navigate({ to: "/projects" })} variant="outline" className="w-full">
            Go to Projects
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

export default InvitationResponse;

