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
import { User, LogOut, Mail, ChevronDown } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";

export function AppUserMenu() {
  const navigate = useNavigate();
  const { data: session, isPending } = authClient.useSession();

  const getInitials = (name: string) =>
    name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);

  if (isPending) {
    return (
      <div className="flex items-center gap-2">
        <Skeleton className="h-8 w-8 animate-pulse rounded-full bg-muted" />
        <div className="hidden sm:flex flex-col gap-1">
          <Skeleton className="h-3 w-16 animate-pulse bg-muted" />
          <Skeleton className="h-2 w-12 animate-pulse bg-muted" />
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <Button
        variant="outline"
        asChild
        className="border-border bg-background text-foreground shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground"
      >
        <Link to="/login" className="flex items-center gap-2">
          <User className="h-4 w-4" />
          Sign In
        </Link>
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="flex items-center gap-3 rounded-full border border-border/60 bg-white/80 px-3 py-2 text-sm font-medium shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md hover:bg-white/95 dark:border-slate-700/50 dark:bg-slate-800/90 dark:hover:bg-slate-800"
        >
          <Avatar className="h-8 w-8">
            <AvatarImage
              src={session.user.image || undefined}
              alt={session.user.name || "User avatar"}
              onError={(event) => {
                event.currentTarget.style.display = "none";
              }}
            />
            <AvatarFallback className="bg-sky-600 text-xs font-medium text-white">
              {getInitials(session.user.name || "U")}
            </AvatarFallback>
          </Avatar>
          <div className="hidden text-left sm:flex sm:flex-col">
            <span className="text-sm font-medium leading-tight">{session.user.name}</span>
            <span className="mt-0.5 text-xs text-muted-foreground leading-tight">Account</span>
          </div>
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        className="w-64 rounded-xl border border-slate-200/80 bg-white/95 p-1 shadow-2xl ring-1 ring-black/5 dark:border-slate-700/50 dark:bg-slate-800 dark:ring-slate-700/20"
        align="end"
        sideOffset={8}
      >
        <DropdownMenuLabel className="px-3 py-2 text-sm font-medium">
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
                onError={(event) => {
                  event.currentTarget.style.display = "none";
                }}
              />
              <AvatarFallback className="bg-sky-600 text-white">
                {getInitials(session.user.name || "U")}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col">
              <span className="text-sm font-medium">{session.user.name}</span>
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Mail className="h-3 w-3" />
                {session.user.email}
              </span>
            </div>
          </div>
        </div>

        <DropdownMenuSeparator />

        <DropdownMenuItem asChild className="p-0">
          <Button
            variant="ghost"
            className="h-auto w-full justify-start gap-2 px-3 py-2 text-destructive transition-colors hover:bg-destructive/10 hover:text-destructive"
            onClick={async () => {
              try {
                await authClient.signOut();
                navigate({ to: "/" });
              } catch (error) {
                console.error("Sign out failed:", error);
              }
            }}
          >
            <LogOut className="h-4 w-4" />
            Sign Out
          </Button>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default AppUserMenu;
