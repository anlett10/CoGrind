import { createFileRoute, Outlet } from "@tanstack/react-router";
import { useEffect } from "react";
import authClient from "~/lib/auth-client";

export const Route = createFileRoute("/(authenticated)")({
  component: RouteComponent,
});

export function useRequireAuth() {
  const navigate = Route.useNavigate();
  const { data: session, isPending } = authClient.useSession();

  useEffect(() => {
    if (!session && !isPending) {
      const timer = setTimeout(() => {
        // Pass the current page URL as a search parameter to login
        const currentPath = window.location.pathname + window.location.search;
        navigate({
          to: "/login",
          search: { redirect: currentPath },
          replace: true,
        });
      }, 300); // Delay for 300ms to show message

      return () => clearTimeout(timer);
    }
  }, [session, isPending, navigate]);

  return { session, isPending };
}

// Export a hook to get session data (assumes auth is already handled by parent)
export function useSession() {
  const { data: session } = authClient.useSession();
  return session;
}

function RouteComponent() {
  const { session, isPending: isSessionPending } = useRequireAuth();

  if (isSessionPending) {
    return <div aria-live="polite">Checking session...</div>;
  }

  if (!session) {
    return <div aria-live="polite">Redirecting to login...</div>;
  }

  return (
    <main className="flex-1 flex flex-col min-h-screen" role="main">
      <Outlet />
    </main>
  );
}