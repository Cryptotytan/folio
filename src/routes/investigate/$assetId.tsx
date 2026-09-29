import { Navigate, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/investigate/$assetId")({
  component: RedirectAsset,
});

function RedirectAsset() {
  const { assetId } = Route.useParams();
  return <Navigate to="/asset/$id" params={{ id: assetId }} search={{ tab: "overview" }} />;
}
