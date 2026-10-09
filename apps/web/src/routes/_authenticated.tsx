import { createFileRoute, Link, Outlet, redirect, useMatchRoute } from "@tanstack/react-router";
import { getSession } from "@/features/auth/session";

// Makes the app easier to use. It is not security: the API checks every request.
export const Route = createFileRoute("/_authenticated")({
  beforeLoad: async ({ location }) => {
    const session = await getSession();
    if (!session) throw redirect({ to: "/login", search: { redirect: location.href } });
    return { userId: session.user.id };
  },
  component: AuthenticatedLayout,
});

const tabs = [
  { to: "/", label: "Home" },
  { to: "/games", label: "Games" },
  { to: "/friends", label: "Friends" },
  { to: "/groups", label: "Groups" },
  { to: "/profile", label: "Profile" },
] as const;

function AuthenticatedLayout() {
  const matchRoute = useMatchRoute();
  const inMatch = Boolean(matchRoute({ to: "/matches/$matchId", fuzzy: true }));

  return (
    <>
      <div className="flex-1 overflow-y-auto">
        <Outlet />
      </div>
      {!inMatch && (
        <nav className="flex border-t border-line bg-white pb-[env(safe-area-inset-bottom)]">
          {tabs.map((tab) => (
            <Link
              key={tab.to}
              to={tab.to}
              activeOptions={{ exact: tab.to === "/" }}
              className="flex-1 py-3 text-center text-xs font-semibold text-ink-soft"
              activeProps={{ className: "text-lagoon" }}
            >
              {tab.label}
            </Link>
          ))}
        </nav>
      )}
    </>
  );
}
