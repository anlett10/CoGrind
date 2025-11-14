import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import authClient from "~/lib/auth-client";

export const Route = createFileRoute("/login/callback")({
  component: RouteComponent,
  validateSearch: (search: Record<string, unknown>) => {
    return {
      redirect: (search.redirect as string) || undefined,
    };
  },
});

function RouteComponent() {
  const navigate = useNavigate();
  const { redirect } = useSearch({ from: "/login/callback" });
  const { data: session, isPending } = authClient.useSession();
  const hasNavigated = useRef(false);

  useEffect(() => {
    const handleRedirect = async () => {
      if (session && !hasNavigated.current) {
        hasNavigated.current = true;
        // Use redirect parameter if present, otherwise default to /project
        const targetPath = redirect || "/project";
        navigate({ to: targetPath as any, replace: true });
      } else if (!isPending && !session) {
        // If no session after loading, redirect back to login
        navigate({ to: "/login", replace: true });
      }
    };
    handleRedirect();
  }, [session, isPending, navigate, redirect]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto"></div>
        <p className="mt-4">Completing sign in...</p>
      </div>
    </div>
  );
}
