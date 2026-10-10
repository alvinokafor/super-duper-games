import { GAME_ID, MAX_PLAYERS, MIN_PLAYERS, MISSED_TURNS_BEFORE_REMOVAL } from "@bankroll/lagos-rules";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { BackIcon } from "@/components/icons";
import { BottomBar, backButtonClass, buttonClass, Chip, Screen } from "@/components/ui";
import { LagosHeroStrip } from "@/features/games/art";

export const Route = createFileRoute("/_authenticated/games/how-to-play")({
  component: HowToPlayPage,
});

// Plain-language summary of docs/lagos-property-rules.md. Leave out amounts
// the rules still mark as provisional.
const sections = [
  {
    title: "Win by being the richest",
    body: "The game ends when only one player can still pay their way, or when the last round finishes. Then the player worth the most wins. Your worth counts cash, land, buildings and money people owe you.",
  },
  {
    title: "Your turn",
    body: "Roll the die and move clockwise. Where you land decides what happens: buy the property, pay rent or tax, or draw a card. Then build or make deals before you end your turn.",
  },
  {
    title: "GO is payday",
    body: "There's no fixed salary. Each time you pass or land on GO, your shops, offices and hotels pay you, minus their upkeep. Build early so payday is worth something. GO never takes money from you.",
  },
  {
    title: "Corridors and buildings",
    body: "The 18 properties come in six colour corridors of three. The more of a corridor you own, the bigger the buildings you can put up. Each property has room for a business, a home and a hotel at the same time. Build evenly across a corridor.",
  },
  {
    title: "Rent",
    body: "When someone lands on your homes or hotel, they pay you straight away. The Airport, Refinery and Railway charge a fee too, and it grows with how many of them you own.",
  },
  {
    title: "Deals with friends",
    body: "Trade land for cash or swap properties. Buy a property with a partner and split it 25/75, 50/50 or 75/25. Lend money with a property as security, or for a share of its income until you're paid back.",
  },
  {
    title: "Watch out for the EFCC",
    body: "Later in the game, EFCC raids begin. You get one round's warning and can secretly pay for protection. The raid always happens. If it picks one of your unprotected properties, you pay to settle or it's sealed for three rounds.",
  },
  {
    title: "Special spaces",
    body: "EFCC Holding: pay ₦5,000 or miss your next turn. Park: a safe stop. Income Tax takes 5% of your cash. Property Tax takes 3% of what your properties are worth. Chance and Community Chest cards can help or hurt.",
  },
  {
    title: "Running short",
    body: `If you owe more than you have, you get 60 seconds to sell buildings, sell land to the bank or borrow from a friend. If you still can't pay, you're out. Miss ${MISSED_TURNS_BEFORE_REMOVAL} turns in a row and you're out too.`,
  },
];

function HowToPlayPage() {
  const router = useRouter();

  return (
    <Screen>
      <div className="flex items-center gap-3 px-4 pb-3">
        <button type="button" onClick={() => router.history.back()} className={backButtonClass} aria-label="Back">
          <BackIcon />
        </button>
        <h1 className="text-section leading-title font-black tracking-[-0.02em] text-ink">How to play</h1>
      </div>

      <section className="mx-4 flex shrink-0 flex-col overflow-hidden rounded-[20px] border border-edge bg-white">
        <LagosHeroStrip badge="LAGOS PROPERTY" />
        <div className="flex flex-col gap-[6px] px-4 pt-[14px] pb-4">
          <p className="text-[14px] leading-[19px] text-ink-soft">
            Buy land, build shops and homes, lend to friends and dodge the EFCC. Richest player wins.
          </p>
          <div className="mt-1 flex flex-wrap gap-[6px]">
            <Chip>
              {MIN_PLAYERS}–{MAX_PLAYERS} players
            </Chip>
            <Chip>45–60 min</Chip>
            <Chip>One die</Chip>
            <Chip>₦75,000 to start</Chip>
          </div>
        </div>
      </section>

      <ol className="flex flex-col gap-2 px-4 pt-4">
        {sections.map((section, i) => (
          <li key={section.title} className="flex gap-3 rounded-[18px] bg-white p-[14px]">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-pill bg-lagoon-soft text-label leading-caption font-black text-lagoon">
              {i + 1}
            </span>
            <div className="flex min-w-0 flex-col gap-1">
              <h2 className="text-body leading-5 font-black text-ink">{section.title}</h2>
              <p className="text-[14px] leading-[19px] text-ink-soft">{section.body}</p>
            </div>
          </li>
        ))}
      </ol>

      <BottomBar>
        <Link to="/games/$gameId" params={{ gameId: GAME_ID }} className={buttonClass("danfo", "lg")}>
          Play Lagos Property
        </Link>
      </BottomBar>
    </Screen>
  );
}
