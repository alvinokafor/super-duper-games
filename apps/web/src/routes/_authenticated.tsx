import { USER_EVENT, userChannelName, userEventSchema } from "@bankroll/contracts";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, Outlet, redirect, useMatches } from "@tanstack/react-router";
import { TabIcon } from "@/components/icons";
import { getSession } from "@/features/auth/session";
import { friendsQuery } from "@/features/friends/api";
import { groupsQuery } from "@/features/groups/api";
import { formatCount } from "@/lib/format";
import { queryKeys } from "@/lib/query-keys";
import { useChannel } from "@/lib/realtime";

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
  { to: "/", label: "Home", icon: "home" },
  { to: "/games", label: "Games", icon: "games" },
  { to: "/friends", label: "Friends", icon: "friends" },
  { to: "/groups", label: "Groups", icon: "groups" },
  { to: "/profile", label: "Profile", icon: "profile" },
] as const;

// Only the five main screens show the tab bar; everything else has its own back button.
const tabRoutes = new Set<string>([
  "/_authenticated/",
  "/_authenticated/games/",
  "/_authenticated/friends/",
  "/_authenticated/groups/",
  "/_authenticated/profile/",
]);

function AuthenticatedLayout() {
  const { userId } = Route.useRouteContext();
  const queryClient = useQueryClient();
  const showTabs = useMatches({ select: (matches) => tabRoutes.has(matches.at(-1)?.routeId ?? "") });

  const refreshLists = () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.friends });
    void queryClient.invalidateQueries({ queryKey: queryKeys.groups, exact: true });
  };

  useChannel(
    userChannelName(userId),
    {
      [USER_EVENT]: (payload) => {
        const event = userEventSchema.safeParse(payload);
        if (!event.success) return;
        if (event.data.type === "friends_changed") void queryClient.invalidateQueries({ queryKey: queryKeys.friends });
        if (event.data.type === "groups_changed") void queryClient.invalidateQueries({ queryKey: queryKeys.groups });
        if (event.data.type === "group_activity") {
          void queryClient.invalidateQueries({ queryKey: queryKeys.groups, exact: true });
        }
      },
    },
    refreshLists,
  );

  return (
    <>
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        <Outlet />
      </div>
      {showTabs && <TabBar />}
    </>
  );
}

function TabBar() {
  const friends = useQuery(friendsQuery);
  const groups = useQuery(groupsQuery);
  const badges: Partial<Record<(typeof tabs)[number]["icon"], number>> = {
    friends: friends.data?.incoming.length ?? 0,
    groups: groups.data?.groups.reduce((sum, g) => sum + g.unreadCount, 0) ?? 0,
  };

  return (
    <nav className="flex justify-around border-t border-edge bg-white px-2 pt-[10px] pb-[max(28px,env(safe-area-inset-bottom))]">
      {tabs.map((tab) => (
        <Link
          key={tab.to}
          to={tab.to}
          activeOptions={{ exact: tab.to === "/" }}
          className="relative flex w-16 shrink-0 flex-col items-center gap-[3px]"
        >
          {({ isActive }) => (
            <>
              <TabIcon name={tab.icon} active={isActive} />
              <span
                className={`text-[11px] leading-[14px] ${isActive ? "font-black text-lagoon" : "font-bold text-muted"}`}
              >
                {tab.label}
              </span>
              {(badges[tab.icon] ?? 0) > 0 && (
                <span className="absolute top-[-3px] left-[38px] flex h-4 min-w-4 items-center justify-center rounded-pill bg-alert px-1 text-[10px] leading-3 font-black text-white">
                  {formatCount(badges[tab.icon] ?? 0)}
                </span>
              )}
            </>
          )}
        </Link>
      ))}
    </nav>
  );
}
