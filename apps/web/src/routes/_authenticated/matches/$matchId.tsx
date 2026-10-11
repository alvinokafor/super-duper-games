import type { PublicProfile } from "@bankroll/contracts";
import { BOARD, isBuyable, type LagosCommand, phaseSeconds } from "@bankroll/lagos-rules";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { BackIcon } from "@/components/icons";
import { backButtonClass, ErrorText, errorMessage, Muted } from "@/components/ui";
import { matchMessagesQuery, useMatchCommand, useSendMatchMessage } from "@/features/match/api";
import { Board } from "@/features/match/board/board";
import { spaceDotClass } from "@/features/match/board/board-layout";
import { Die, PlayerStrip, RollPill, TurnTimer } from "@/features/match/parts";
import { BuySheet, ChatSheet, PaydaySheet, ResultsSheet } from "@/features/match/sheets";
import { useGameAnimationStore } from "@/features/match/stores/game-animation.store";
import { useGameSessionStore } from "@/features/match/stores/game-session.store";
import { resetMatchStores } from "@/features/match/stores/reset-match-stores";
import { DICE_MS, planFront, shownPositions, startWalk, type Walk, walkPath } from "@/features/match/token-walk";
import { useMatchSync } from "@/features/match/use-match-sync";
import { formatCount } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/matches/$matchId")({
  component: MatchPage,
});

const TOAST_MS = 4000;

function usePageHidden() {
  const [hidden, setHidden] = useState(() => document.hidden);
  useEffect(() => {
    const update = () => setHidden(document.hidden);
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, []);
  return hidden;
}

function MatchPage() {
  const { matchId } = Route.useParams();
  const { userId } = Route.useRouteContext();
  const router = useRouter();

  const [chatOpen, setChatOpen] = useState(false);
  const [unseen, setUnseen] = useState(0);
  const [toast, setToast] = useState<{ senderId: string; body: string } | null>(null);
  const [payday, setPayday] = useState<{ income: number; amount: number } | null>(null);
  const [resultsOpen, setResultsOpen] = useState(true);

  const view = useMatchSync(matchId, (senderId, body) => {
    if (senderId === userId || chatOpen) return;
    setToast({ senderId, body });
    setUnseen((n) => n + 1);
  });
  const messages = useQuery(matchMessagesQuery(matchId));
  const send = useSendMatchMessage(matchId);
  const command = useMatchCommand(matchId);

  const state = useGameSessionStore((s) => (s.matchId === matchId ? s.gameState : null));
  const deadline = useGameSessionStore((s) => s.turnDeadline);
  const sending = useGameSessionStore((s) => s.pendingCommandIds.length > 0);
  const queue = useGameAnimationStore((s) => s.queue);
  const complete = useGameAnimationStore((s) => s.complete);

  useEffect(() => resetMatchStores, [matchId]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), TOAST_MS);
    return () => clearTimeout(timer);
  }, [toast]);

  const { isError: commandFailed, reset: resetCommand } = command;
  useEffect(() => {
    if (!commandFailed) return;
    const timer = setTimeout(resetCommand, TOAST_MS);
    return () => clearTimeout(timer);
  }, [commandFailed, resetCommand]);

  // Plays server events one at a time. The die waits on screen, then the
  // piece walks tile by tile; my own payday opens a card without holding up
  // later events. Everything else is already reflected in the board.
  const hidden = usePageHidden();
  const front = queue[0];
  const play = planFront(queue, hidden);
  const showDice = play === "dice";
  const [walk, setWalk] = useState<Walk | null>(null);
  useEffect(() => {
    if (!front) return;
    if (front.event.type === "payday" && front.event.playerId === userId) {
      setPayday({ income: front.event.income, amount: front.event.amount });
    }
    if (play === "walk" && front.event.type === "token_moved") {
      const { playerId, from, to } = front.event;
      setWalk({ key: front.key, playerId, at: from });
      return startWalk(
        walkPath(from, to),
        (at) => setWalk({ key: front.key, playerId, at }),
        () => {
          setWalk(null);
          complete(front.key);
        },
      );
    }
    if (play !== "dice") return complete(front.key);
    const timer = setTimeout(() => complete(front.key), DICE_MS);
    return () => clearTimeout(timer);
  }, [front, play, userId, complete]);
  const moving = queue.some((a) => a.event.type === "dice_rolled" || a.event.type === "token_moved");
  const players = state?.players;
  const positions = useMemo(() => shownPositions(players ?? [], queue, walk), [players, queue, walk]);

  const profiles = useMemo(
    () => new Map<string, PublicProfile>((view.data?.players ?? []).map((p) => [p.id, p])),
    [view.data?.players],
  );
  const names = useMemo(() => new Map([...profiles].map(([id, p]) => [id, p.displayName])), [profiles]);

  const header = (
    <div className="flex items-center justify-between px-3 pb-[10px]">
      <div className="flex w-20 shrink-0">
        <button type="button" onClick={() => router.history.back()} className={backButtonClass} aria-label="Back">
          <BackIcon />
        </button>
      </div>
      <div className="flex flex-col items-center gap-px">
        <p className="text-[14px] leading-[18px] font-bold tracking-snug text-ink">
          {state ? `Round ${state.round} of ${state.maxRounds}` : "Lagos Property"}
        </p>
        {state && (
          <p className="text-caption leading-caption font-medium text-ink-soft">
            {state.phase === "finished"
              ? "Match over"
              : state.round === state.maxRounds
                ? "Last round"
                : `${state.maxRounds - state.round} rounds left`}
          </p>
        )}
      </div>
      <div className="flex w-20 shrink-0 justify-end">
        {state && state.phase !== "finished" && <TurnTimer deadline={deadline} totalSeconds={phaseSeconds(state.phase)} />}
      </div>
    </div>
  );

  if (!state) {
    return (
      <main className="flex min-h-full flex-col bg-paper pt-[calc(env(safe-area-inset-top)+12px)]">
        {header}
        <div className="px-4 pt-4">
          {view.isError ? <ErrorText>{errorMessage(view.error)}</ErrorText> : <Muted>Loading match…</Muted>}
        </div>
      </main>
    );
  }

  const me = state.players.find((p) => p.id === userId);
  const playing = me?.status === "playing";
  const myTurn = playing && state.currentPlayerId === userId;
  const currentName = names.get(state.currentPlayerId) ?? "Player";
  const run = (cmd: LagosCommand) => command.mutate({ command: cmd, commandId: crypto.randomUUID() });

  const busy = sending || command.isPending;
  const landed = me ? BOARD[me.position]! : null;
  const buying =
    myTurn && state.phase === "awaiting_purchase" && !moving && !payday && landed && isBuyable(landed) ? landed : null;

  let action: { label: string; onClick?: () => void; tone: "danfo" | "lagoon" | "quiet" };
  if (state.phase === "finished") action = { label: "SEE RESULTS", tone: "lagoon", onClick: () => setResultsOpen(true) };
  else if (busy || moving) action = { label: "MOVING", tone: "quiet" };
  else if (!playing) action = { label: "YOU'RE OUT · WATCHING", tone: "quiet" };
  else if (myTurn && state.phase === "awaiting_roll") action = { label: "ROLL", tone: "danfo", onClick: () => run({ type: "roll_dice" }) };
  else if (myTurn && state.phase === "awaiting_action")
    action = { label: "END TURN", tone: "lagoon", onClick: () => run({ type: "end_turn" }) };
  else if (myTurn) action = { label: "YOUR MOVE", tone: "quiet" };
  else action = { label: `${currentName.toUpperCase()}'S TURN`, tone: "quiet" };

  const actionTone = {
    danfo: "bg-danfo text-ink",
    lagoon: "bg-lagoon text-white",
    quiet: "bg-paper-deep text-[#6E6860]",
  }[action.tone];

  const diceEvent = showDice && front?.event.type === "dice_rolled" ? front.event : null;
  const moveEvent = diceEvent
    ? queue.find((a) => a.event.type === "token_moved" && a.event.playerId === diceEvent.playerId)?.event
    : null;
  const destination = moveEvent?.type === "token_moved" ? BOARD[moveEvent.to]! : null;

  return (
    <main className="mx-auto flex min-h-full w-full max-w-[480px] flex-col bg-paper pt-[calc(env(safe-area-inset-top)+12px)]">
      {header}

      <Board state={state} myId={userId} names={names} positions={positions}>
        {diceEvent && (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-3">
            <Die value={diceEvent.value} />
            {destination && (
              <RollPill
                dotClass={spaceDotClass(destination)}
                text={`${diceEvent.playerId === userId ? "To" : `${names.get(diceEvent.playerId) ?? "Player"} to`} ${destination.name}`}
              />
            )}
          </div>
        )}
      </Board>

      <div className="relative min-h-2 flex-1">
        {toast && (
          <button
            type="button"
            onClick={() => {
              setChatOpen(true);
              setUnseen(0);
              setToast(null);
            }}
            className="absolute inset-x-3 bottom-0 flex items-center gap-2 rounded-[14px] border border-line bg-white px-3 py-2 text-left shadow-[0_4px_10px_#202A2524]"
          >
            <span className="shrink-0 text-caption leading-caption font-black text-ink">{names.get(toast.senderId) ?? "Player"}</span>
            <span className="truncate text-caption leading-caption font-medium text-ink-soft">{toast.body}</span>
          </button>
        )}
      </div>

      <PlayerStrip state={state} myId={userId} profiles={profiles} />

      <div className="flex flex-col gap-[10px] px-3 pt-3 pb-[max(16px,env(safe-area-inset-bottom))]">
        {!buying && <ErrorText>{errorMessage(command.error)}</ErrorText>}
        <button
          type="button"
          onClick={action.onClick}
          disabled={!action.onClick}
          className={`flex h-[52px] shrink-0 items-center justify-center rounded-[12px] text-[18px] leading-body font-black tracking-wide ${actionTone}`}
        >
          {action.label}
        </button>
        <button
          type="button"
          onClick={() => {
            setChatOpen(true);
            setUnseen(0);
          }}
          className="flex h-11 shrink-0 items-center gap-2 rounded-[12px] border border-line bg-white px-[14px]"
        >
          <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
            <path d="M3 4.5h12v8H6.2L3 15.2V4.5z" fill="none" stroke="#5C6B64" strokeWidth="1.5" strokeLinejoin="round" />
          </svg>
          <span className="flex-1 text-left text-[14px] leading-[18px] font-medium text-muted">Say something…</span>
          {unseen > 0 && (
            <span className="flex h-4 min-w-4 items-center justify-center rounded-pill bg-alert px-1 text-[10px] leading-3 font-black text-white">
              {formatCount(unseen)}
            </span>
          )}
        </button>
      </div>

      {buying && (
        <BuySheet
          space={buying}
          state={state}
          myId={userId}
          deadline={deadline}
          busy={busy}
          error={command.error}
          onBuy={() => me && run({ type: "buy_property", space: me.position })}
          onPass={() => run({ type: "pass_property" })}
        />
      )}
      {payday && <PaydaySheet income={payday.income} amount={payday.amount} onClose={() => setPayday(null)} />}
      {state.phase === "finished" && resultsOpen && (
        <ResultsSheet state={state} profiles={profiles} myId={userId} onClose={() => setResultsOpen(false)} />
      )}
      {chatOpen && (
        <ChatSheet
          messages={messages.data?.messages ?? []}
          myId={userId}
          sending={send.isPending}
          error={send.error}
          onSend={(body) => send.mutateAsync(body)}
          onClose={() => setChatOpen(false)}
        />
      )}
    </main>
  );
}
