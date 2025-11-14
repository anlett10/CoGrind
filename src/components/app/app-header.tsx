import { useState, useMemo } from "react";
import {
  ClientOnly,
  Link,
  useRouterState,
} from "@tanstack/react-router";
import { Menu } from "lucide-react";
import { cn } from "~/lib/utils";
import authClient from "~/lib/auth-client";
import AppUserMenu from "~/components/app/app-user-menu";
import { DarkModeToggle } from "~/components/app/mode-toggle";
import { Button } from "~/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from "~/components/ui/sheet";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";

function AppLogo() {
  return (
    <div className="flex items-center gap-3">
      <div className="relative flex-shrink-0">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl overflow-hidden shadow-lg">
          <img
            src="/CG.png"
            alt="CoGrind Logo"
            className="h-full w-full object-contain"
          />
        </div>
      </div>

      <div className="hidden sm:block flex-shrink-0">
        <div className="flex flex-col">
          <span className="text-xl font-bold tracking-tight text-transparent bg-gradient-to-r from-blue-500 via-purple-500 via-pink-500 to-rose-500 bg-clip-text drop-shadow-sm">
            CoGrind
          </span>
          <span className="text-[10px] font-medium tracking-wider text-muted-foreground/70 uppercase">
            Collaborate. Execute. Deliver.
          </span>
        </div>
      </div>
    </div>
  );
}

const NAV_LINKS = [
  { to: "/", label: "Home" },
  { to: "/project", label: "Project" },
  { to: "/live", label: "Live Run" },
  { to: "/refine", label: "Review" },
];

function NavigationLinks({
  className = "",
  onLinkClick,
  showRing = true,
}: {
  className?: string;
  onLinkClick?: () => void;
  showRing?: boolean;
}) {
  const router = useRouterState();
  const currentPath = router.location.pathname;
  const { data: session } = authClient.useSession();

  const links = useMemo(() => {
    return NAV_LINKS;
  }, []);

  return (
    <div className="flex w-full justify-center">
      <nav
        className={cn(
          "relative flex w-full max-w-md items-center justify-center gap-1 rounded-full",
          "px-1 py-1",
          showRing &&
            "bg-muted/70 ring-1 ring-border/60 shadow-[0_10px_30px_-20px_rgba(15,23,42,0.45)] backdrop-blur-md",
          className
        )}
      >
        {links.map(({ to, label }) => {
          const isActive =
            currentPath === to || (to !== "/" && currentPath.startsWith(to));
          return (
            <Link
              key={to}
              to={to}
              onClick={onLinkClick}
              className={cn(
                "relative z-10 rounded-full px-3 py-2 text-sm font-semibold tracking-wide transition-all",
                "hover:bg-foreground/10 hover:text-foreground",
                isActive
                  ? "bg-background text-foreground shadow-sm ring-1 ring-border"
                  : "text-muted-foreground"
              )}
            >
              {label}
              {isActive && (
                <span className="absolute -bottom-1 left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-primary" />
              )}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

function MobileNav() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild className="md:hidden">
        <Button
          variant="ghost"
          size="icon"
          className="rounded-full border border-border/60 bg-background/60 shadow-sm backdrop-blur hover:bg-background/90"
        >
          <Menu className="h-5 w-5" />
          <span className="sr-only">Toggle menu</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-72">
        <VisuallyHidden asChild>
          <SheetTitle>Navigation</SheetTitle>
        </VisuallyHidden>
        <VisuallyHidden asChild>
          <SheetDescription>Application primary navigation</SheetDescription>
        </VisuallyHidden>
        <div className="mt-8 flex flex-col gap-6">
          <Link
            to="/"
            onClick={() => setIsOpen(false)}
            className="flex items-center gap-3"
          >
            <AppLogo />
          </Link>
          <NavigationLinks
            className="flex-col gap-2 rounded-2xl bg-muted/60 px-3 py-3 shadow-inner"
            onLinkClick={() => setIsOpen(false)}
            showRing={false}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}

export function AppHeader() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/60 bg-gradient-to-r from-background via-background/95 to-background/90 shadow-lg shadow-black/5 backdrop-blur-xl supports-[backdrop-filter]:bg-background/70">
      <div className="w-full px-4 sm:px-6 lg:px-10">
        <div className="flex h-20 items-center justify-between">
          <div className="flex items-center gap-4 pl-2 sm:pl-4 lg:pl-6">
            <MobileNav />
            <Link
              to="/"
              className="flex-shrink-0 rounded-full bg-background/60 p-1 transition-opacity duration-200 hover:opacity-90"
            >
              <AppLogo />
            </Link>
          </div>

          <div className="hidden flex-1 justify-center md:flex">
            <NavigationLinks />
          </div>

          <div className="flex items-center justify-end gap-3 pr-2 sm:pr-4 lg:pr-6 md:gap-4">
            <ClientOnly fallback={<div className="h-10 w-10" />}>
              <DarkModeToggle />
            </ClientOnly>
            <ClientOnly fallback={<div className="h-10 w-10" />}>
              <AppUserMenu />
            </ClientOnly>
          </div>
        </div>
      </div>
    </header>
  );
}
