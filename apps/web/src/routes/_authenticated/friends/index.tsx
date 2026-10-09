import { createFileRoute } from "@tanstack/react-router";
import { Page } from "@/components/page";

export const Route = createFileRoute("/_authenticated/friends/")({
  component: () => <Page title="Friends" />,
});
