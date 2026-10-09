import { createFileRoute } from "@tanstack/react-router";
import { Page } from "@/components/page";

export const Route = createFileRoute("/_authenticated/groups/")({
  component: () => <Page title="Groups" />,
});
