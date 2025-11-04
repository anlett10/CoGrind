import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import authClient from "~/lib/auth-client";
import { useNavigate } from "@tanstack/react-router";
import { Button } from "~/components/ui/button";
import { Skeleton } from "~/components/ui/skeleton";
import { Link } from "@tanstack/react-router";
import { User, LogOut, Mail, ChevronDown, Settings } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { UsernameSetupModal } from "./username-setup-modal";
import { useState } from "react";
import { useConvexQuery } from "@convex-dev/react-query";
import { api } from "convex/_generated/api";

export default function UserMenu() {
  const navigate = useNavigate();
  const { data: session, isPending } = authClient.useSession();
  const [showUsernameModal, setShowUsernameModal] = useState(false);

  // Check if user has username - handle SSR case where hook might return undefined
  const queryResult = useConvexQuery(
    api.user.getUserProfile as any,
    session?.user?.id ? { userId: session.user.id } : { userId: "" }
  ) || {};
  
  const userData = queryResult.data;

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  if (isPending) {
    return (
      <div className="flex items-center gap-2">
        <Skeleton className="h-8 w-8 rounded-full bg-muted animate-pulse" />
        <div className="hidden sm:flex flex-col gap-1">
          <Skeleton className="h-3 w-16 bg-muted animate-pulse" />
          <Skeleton className="h-2 w-12 bg-muted animate-pulse" />
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <Button
        variant="outline"
        asChild
        className="font-medium border-border bg-background text-foreground hover:bg-accent hover:text-accent-foreground transition-colors shadow-sm"
      >
        <Link
          to="/login"
          className="flex items-center gap-2"
        >
          <User className="h-4 w-4" />
          Sign In
        </Link>
      </Button>
    );
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            className="flex items-center gap-3 px-3 py-2 h-auto hover:bg-accent/50 transition-colors"
          >
            <Avatar className="h-8 w-8">
              <AvatarImage
                src={session.user.image || undefined}
                alt={session.user.name || "User avatar"}
                onError={(e) => {
                  // Hide the image on error to show fallback
                  e.currentTarget.style.display = "none";
                }}
              />
              <AvatarFallback className="bg-black dark:bg-white text-white dark:text-black text-sm font-medium">
                {getInitials(session.user.name || "U")}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col items-start">
              <span className="text-sm font-medium leading-none">
                {session.user.name}
              </span>
              <span className="text-xs text-muted-foreground leading-none mt-1">
                Account
              </span>
            </div>
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent
          className="w-64 bg-card border shadow-lg"
          align="end"
          sideOffset={5}
        >
          <DropdownMenuLabel className="font-medium text-sm px-3 py-2">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4" />
              My Account
            </div>
          </DropdownMenuLabel>

          <DropdownMenuSeparator />

          <div className="px-3 py-2">
            <div className="flex items-center gap-3">
              <Avatar className="h-10 w-10">
                <AvatarImage
                  src={session.user.image || undefined}
                  alt={session.user.name || "User avatar"}
                  onError={(e) => {
                    // Hide the image on error to show fallback
                    e.currentTarget.style.display = "none";
                  }}
                />
                <AvatarFallback className="bg-black dark:bg-white text-white dark:text-black">
                  {getInitials(session.user.name || "U")}
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-col">
                <span className="text-sm font-medium">{session.user.name}</span>
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Mail className="h-3 w-3" />
                  {session.user.email}
                </span>
                {userData && !userData.username && (
                  <span className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1 mt-1">
                    <Settings className="h-3 w-3" />
                    Set username for public profile
                  </span>
                )}
              </div>
            </div>
          </div>

          <DropdownMenuSeparator />

          <DropdownMenuItem asChild className="p-0">
            <Button
              variant={userData && !userData.username ? "default" : "ghost"}
              className={`w-full justify-start gap-2 px-3 py-2 h-auto font-normal ${
                userData && !userData.username 
                  ? "bg-amber-100 dark:bg-amber-900/20 text-amber-800 dark:text-amber-200 hover:bg-amber-200 dark:hover:bg-amber-900/30" 
                  : userData && userData.username
                    ? "text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300 hover:bg-green-50 dark:hover:bg-green-900/20"
                    : "text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800"
              }`}
              onClick={() => setShowUsernameModal(true)}
            >
              <Settings className="h-4 w-4" />
              {userData && !userData.username 
                ? "Set Username (Required)" 
                : userData && userData.username 
                  ? `@${userData.username}` 
                  : "Set Username"
              }
            </Button>
          </DropdownMenuItem>

          <DropdownMenuItem asChild className="p-0">
            <Button
              variant="ghost"
              className="w-full justify-start gap-2 px-3 py-2 h-auto text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 font-normal"
              onClick={async () => {
                try {
                  await authClient.signOut();
                  navigate({
                    to: "/",
                  });
                } catch (error) {
                  console.error("Signout failed:", error);
                }
              }}
            >
              <LogOut className="h-4 w-4" />
              Sign Out
            </Button>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Username Setup Modal */}
      <UsernameSetupModal 
        open={showUsernameModal}
        onOpenChange={setShowUsernameModal}
        currentUsername={userData?.username || undefined}
        userId={session?.user?.id}
      />
    </>
  );
}

