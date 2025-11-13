import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect, useRef } from "react";
import authClient from "~/lib/auth-client";

export const Route = createFileRoute("/login/")({
  component: RouteComponent,
});

function RouteComponent() {
  const navigate = useNavigate();
  const { data: session, isPending } = authClient.useSession();
  const [oauthLoading, setOAuthLoading] = useState<"google" | "github" | null>(null);
  const hasNavigated = useRef(false);

  // Handle session check at the parent level
  useEffect(() => {
    const handleRedirect = async () => {
      if (session && !hasNavigated.current) {
        hasNavigated.current = true;
        navigate({ to: "/", replace: true });
      }
    };
    handleRedirect();
  }, [session, navigate]);

  const handleOAuthSignIn = async (provider: "google" | "github") => {
    setOAuthLoading(provider);
    try {
      await authClient.signIn.social({
        provider,
        callbackURL: "/login/callback",
      });
    } catch (error) {
      console.error("OAuth sign-in error:", error);
      alert(`Failed to sign in with ${provider}`);
    } finally {
      setOAuthLoading(null);
    }
  };

  // Show loading while checking session
  if (isPending || session) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto"></div>
          <p className="mt-4">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 sm:p-6 lg:p-8">
      <div className="w-full max-w-md">
        {/* Main Card */}
        <div className="relative overflow-hidden rounded-2xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl shadow-2xl border border-white/20 dark:border-slate-700/50">
          <div className="relative p-6 sm:p-8 lg:p-10">
            {/* Header */}
            <div className="text-center mb-6">
              <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 dark:from-white dark:to-slate-200 bg-clip-text text-transparent mb-2">
                Welcome
              </h1>
              <p className="text-gray-600 dark:text-slate-400 text-sm">
                Sign in to continue
              </p>
            </div>

            {/* OAuth Buttons */}
            <div className="space-y-3">
              <button
                onClick={() => handleOAuthSignIn("google")}
                disabled={oauthLoading !== null}
                className="flex w-full items-center justify-center gap-3 px-4 py-3 border-2 border-gray-200 dark:border-slate-700 text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800 hover:border-gray-300 dark:hover:border-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 focus:ring-offset-2 transition-all duration-200 rounded-xl font-medium shadow-lg hover:shadow-xl"
              >
                {oauthLoading === "google" ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-gray-700 dark:border-gray-300"></div>
                    <span>Connecting...</span>
                  </>
                ) : (
                  <>
                    <svg className="h-5 w-5" viewBox="0 0 24 24">
                      <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                      <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                      <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                      <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                    </svg>
                    Google
                  </>
                )}
              </button>

              <button
                onClick={() => handleOAuthSignIn("github")}
                disabled={oauthLoading !== null}
                className="flex w-full items-center justify-center gap-3 px-4 py-3 border-2 border-gray-200 dark:border-slate-700 text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800 hover:border-gray-300 dark:hover:border-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 focus:ring-offset-2 transition-all duration-200 rounded-xl font-medium shadow-lg hover:shadow-xl"
              >
                {oauthLoading === "github" ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-gray-700 dark:border-gray-300"></div>
                    <span>Connecting...</span>
                  </>
                ) : (
                  <>
                    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                      <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.17 6.839 9.49.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.603-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.463-1.11-1.463-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.831.092-.646.35-1.086.636-1.336-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0112 6.836c.85.004 1.705.114 2.504.336 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.167 22 16.418 22 12c0-5.523-4.477-10-10-10z" />
                    </svg>
                    GitHub
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
