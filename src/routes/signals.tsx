import { Navigate, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/signals")({
  component: () => <Navigate to="/app" />,
});
