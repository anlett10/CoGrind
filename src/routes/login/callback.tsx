import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import authClient from "~/lib/auth-client";

export const Route = createFileRoute("/login/callback")({
  component: RouteComponent,
});

function RouteComponent() {
  const navigate = useNavigate();
  const { data: session, isPending } = authClient.useSession();
  const hasNavigated = useRef(false);

  useEffect(() => {
    const handleRedirect = async () => {
      if (session && !hasNavigated.current) {
        hasNavigated.current = true;
        navigate({ to: "/", replace: true });
      } else if (!isPending && !session) {
        // If no session after loading, redirect back to login
        navigate({ to: "/login", replace: true });
      }
    };
    handleRedirect();
  }, [session, isPending, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto"></div>
        <p className="mt-4">Completing sign in...</p>
      </div>
    </div>
  );
}
