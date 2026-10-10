import { GAME_ID } from "@bankroll/lagos-rules";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { AyoIcon, WhotIcon } from "@/components/icons";
import { Chip, ErrorText, errorMessage, Screen, ScreenTitle, SectionTitle } from "@/components/ui";
import { ArtTile, lagosArt } from "@/features/games/art";
import { gamesQuery } from "@/features/rooms/api";

export const Route = createFileRoute("/_authenticated/games/")({
  component: GamesPage,
});

function GamesPage() {
  const games = useQuery(gamesQuery);
  const lagos = games.data?.games.find((g) => g.id === GAME_ID);

  return (
    <Screen>
      <ScreenTitle title="Games" />
      <ErrorText className="px-4 pb-2">{errorMessage(games.error)}</ErrorText>

      <section className="mx-4 flex flex-col overflow-hidden rounded-[20px] border border-edge bg-white">
        <div className="relative h-[168px] shrink-0 overflow-hidden bg-lagoon">
          <svg viewBox="0 0 358 168" preserveAspectRatio="none" className="absolute inset-0 size-full" aria-hidden>
            <path d="M0 136 Q90 122 180 136 T358 130 V168 H0z" fill="#1A5A44" />
          </svg>
          <ArtTile src={lagosArt.villa} className="absolute top-[10px] left-[50px] h-[140px] w-[150px] rounded-card" />
          <ArtTile
            src={lagosArt.featured}
            className="absolute top-10 left-[186px] h-[112px] w-[122px] rounded-card border-[3px] border-lagoon bg-origin-border"
          />
          <span className="absolute top-3 left-3 flex items-center gap-[5px] rounded-pill bg-lagoon-soft px-2 py-1">
            <span className="size-[7px] shrink-0 rounded-pill bg-online" />
            <span className="text-[11px] leading-[14px] font-black text-lagoon">Available now</span>
          </span>
        </div>
        <div className="flex flex-col gap-[6px] px-4 pt-[14px] pb-4">
          <h2 className="text-[22px] leading-[26px] font-black tracking-tight text-ink">{lagos?.name ?? "Lagos Property"}</h2>
          <p className="text-[14px] leading-[19px] text-ink-soft">
            Buy land, build shops and homes, lend to friends and dodge the EFCC. Richest player wins.
          </p>
          <div className="mt-1 flex gap-[6px]">
            <Chip>{lagos ? `${lagos.minPlayers}–${lagos.maxPlayers} players` : "3–6 players"}</Chip>
            <Chip>45–60 min</Chip>
            <Chip>Board game</Chip>
          </div>
          <div className="mt-[10px] flex gap-[10px]">
            <Link
              to="/games/$gameId"
              params={{ gameId: GAME_ID }}
              className="flex h-[52px] flex-1 items-center justify-center rounded-[14px] bg-danfo text-[16px] leading-5 font-black text-ink"
            >
              Play
            </Link>
            <Link
              to="/games/how-to-play"
              className="flex h-[52px] shrink-0 items-center justify-center rounded-[14px] border-[1.5px] border-edge bg-white px-4 text-body leading-[18px] font-black text-ink"
            >
              How to play
            </Link>
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-2 px-4 pt-4 pb-4">
        <SectionTitle>Coming soon</SectionTitle>
        <div className="flex gap-[10px]">
          <ComingSoon name="Whot" note="Card game · 2–6" tint="bg-[#E7E1F1]" icon={<WhotIcon />} />
          <ComingSoon name="Ayo" note="Strategy · 2 players" tint="bg-danfo-soft" icon={<AyoIcon />} />
        </div>
      </section>
    </Screen>
  );
}

function ComingSoon({ name, note, tint, icon }: { name: string; note: string; tint: string; icon: ReactNode }) {
  return (
    <div className="flex flex-1 flex-col gap-2 rounded-card border border-edge bg-white p-3">
      <div className={`flex h-16 shrink-0 items-center justify-center rounded-[12px] ${tint}`}>{icon}</div>
      <p className="text-[14px] leading-[18px] font-black text-ink">{name}</p>
      <p className="text-caption leading-caption text-ink-soft">{note}</p>
    </div>
  );
}
