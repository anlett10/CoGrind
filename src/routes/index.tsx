import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "~/components/ui/button";

export const Route = createFileRoute("/")({
  component: HomeComponent,
});

function HomeComponent() {
  return (
    <div className="mx-auto mt-8 w-full max-w-6xl px-4 pb-12">
      <div className="flex min-h-[calc(100vh-8rem)] flex-col items-center justify-center">
        <div className="mx-auto max-w-2xl text-center space-y-6">
          <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
            Welcome to WBA
          </h1>
          <p className="text-lg text-muted-foreground">
            Manage your projects and tasks efficiently
          </p>
          <div className="flex items-center justify-center gap-4 pt-4">
            <Link to="/login">
              <Button size="lg">Get Started</Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
