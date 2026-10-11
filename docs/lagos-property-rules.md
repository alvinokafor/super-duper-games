# LAGOS PROPERTY — GAMEPLAY MECHANICS, RULES & INTERACTIONS

**Version:** 1.0 — implementation handoff draft  
**Status:** Approved baseline with explicitly flagged open decisions  
**Audience:** Cursor/Codex engineering agent, gameplay engineer, UI engineer, QA  
**Scope:** Lagos Property only (the first game in the wider social gaming platform)  
**Last reviewed:** October 2026

> **Agent directive:** Implement the rules marked **LOCKED**. Treat **PROVISIONAL** amounts as configuration values, never embed them in UI assets or hardcode them across engine modules. Treat **OPEN — DECISION REQUIRED** rules as blockers to that specific feature: create a tracked decision, provide a recommendation, and request approval rather than silently inventing outcomes. The server is authoritative for all financial, random, timing, and victory outcomes.

## 1. Game identity and design principles

Lagos Property is a turn-based, competitive, Nigerian-themed multiplayer property-investment board game for **3–6 players**. It is designed to live inside a multi-game social application with accounts, friends, groups, group chats and game rooms. These surrounding features are platform responsibilities; the rules in this document govern Lagos Property.

The game combines dice movement, acquiring properties and utilities, completing three-property color corridors, building up to three different income-generating developments on a land parcel, collecting rent manually, receiving GO income, player-to-player trading, joint ownership, lending and collateral, Chance/Community Chest events, EFCC risk and ultimately bankruptcy or end-of-match net-worth victory.

Design principles: **simple controls, difficult decisions; money must have opportunity cost; deals should be comprehensible within seconds; no rule should require players to maintain their own ledger; outcome determinism; short enough to play multiple matches.**

## 2. Rule status and configuration summary

| Rule | Value | Status |
|---|---|---|
| Players | 3–6 | LOCKED |
| Spaces | 28 unique spaces | LOCKED |
| Die | One fair six-sided die | LOCKED |
| Movement | Clockwise in canonical order | LOCKED |
| Starting cash | ₦75,000 each | LOCKED |
| Cash balance ceiling | ₦1,000,000 | LOCKED; excess handling OPEN |
| Match duration | Engineered for ~45–60 min, no hard one-hour cutoff | LOCKED target |
| Round cap | 48 full-table rounds | PROVISIONAL; must measure 3–6-player pacing |
| GO | Exactly one; investment payday when passed/landed | LOCKED |
| Properties | 18, split into six three-property corridors | LOCKED |
| Utilities | Airport, Refinery, Railway | LOCKED |
| Chance / Community Chest | One board tile each, 16-card deck each | LOCKED |
| Property developments | Commercial, Residential and Hotel slots simultaneously | LOCKED |
| Rent collection | Manual 12-second owner claim | LOCKED |
| Game ending | Last solvent player OR end-round highest net worth | LOCKED |
| Round definition | Each currently active player has one turn | LOCKED |
| Loan types | Fixed-deadline collateral loan and income-sharing loan | LOCKED |
| EFCC | Pre-warning, secret protection, weighted target, settlement or 3-round seizure | LOCKED |

**Money:** Use integer naira. A fee of 3% should be computed using integer arithmetic with an agreed rounding rule. All figures below are *in-game numbers*, not real-world land prices.

## 3. Canonical board and direction

**This exact sequence supersedes every earlier draft.** The board must match the final accepted Paper design. Fixed corners: **GO bottom-left (#1); Free Parking/Park top-left (#8); EFCC top-right (#15); 3% Property Tax bottom-right (#22)**. Move clockwise: left edge bottom-to-top, top edge left-to-right, right edge top-to-bottom, bottom edge right-to-left. Players start on the cheapest land and reach the Island last. Corner positions must not be duplicated.

| # | Space | Type / group | Purchase price |
|---:|---|---|---:|
| 1 | GO | Payday | — |
| 2 | Makoko | Mainland Low-Cost / brown | ₦6,000 |
| 3 | Ajegunle | Mainland Low-Cost / brown | ₦8,000 |
| 4 | Mushin | Mainland Low-Cost / brown | ₦10,000 |
| 5 | 5% Income Tax | Tax | — |
| 6 | Community Chest | Draw Community Chest | — |
| 7 | Ketu | Mainland Residential / orange | ₦12,000 |
| 8 | Free Parking / Park | Special / corner | — |
| 9 | Festac Town | Mainland Residential / orange | ₦17,000 |
| 10 | Gbagada | Mainland Residential / orange | ₦20,000 |
| 11 | Railway | Utility | ₦14,000 |
| 12 | Ajao Estate | Mainland Central / coral | ₦14,000 |
| 13 | Anthony | Mainland Central / coral | ₦17,000 |
| 14 | Yaba | Mainland Central / coral | ₦20,000 |
| 15 | EFCC Holding | Special / corner | — |
| 16 | Ikeja GRA | Mainland Premium / purple | ₦35,000 |
| 17 | Magodo | Mainland Premium / purple | ₦28,000 |
| 18 | Maryland | Mainland Premium / purple | ₦23,000 |
| 19 | Refinery | Utility | ₦18,000 |
| 20 | Osapa London | Lekki / teal | ₦22,000 |
| 21 | Chevron Drive | Lekki / teal | ₦26,000 |
| 22 | 3% Property Tax | Tax / corner | — |
| 23 | Lekki Phase 1 | Lekki / teal | ₦30,000 |
| 24 | Airport | Utility | ₦16,000 |
| 25 | Chance | Draw Chance | — |
| 26 | Victoria Island | Island Elite / gold | ₦36,000 |
| 27 | Eko Atlantic City | Island Elite / gold | ₦44,000 |
| 28 | Banana Island | Island Elite / gold | ₦42,000 |

**Corridors (always three):** Island Elite = Banana Island, Eko Atlantic City, Victoria Island. Lekki = Lekki Phase 1, Chevron Drive, Osapa London. Mainland Premium = Maryland, Magodo, Ikeja GRA. Mainland Central = Yaba, Anthony, Ajao Estate. Mainland Residential = Gbagada, Festac Town, Ketu. Mainland Low-Cost = Mushin, Ajegunle, Makoko.

Land may be acquired in *any order*. Corridor requirements concern control/ownership, not order of acquisition or physical adjacency. The Lekki corridor straddles the bottom-right corner; Mainland Residential straddles Park. Preserve grouping color even across a corner.

## 4. Player setup and lobby

**LOCKED:** Minimum three and maximum six players. Each player chooses a unique token/avatar association and starts with ₦75,000 in cash; unowned properties and utilities start without owners or buildings. A room host starts the match after eligibility/ready checks.

**PROVISIONAL:** First player/turn order selected by a server-controlled shuffle. No rerolls, doubles or extra turn rules because only one die exists. A game only starts after three participants have joined and the agreed ready condition is fulfilled. Set `maxRounds` via a server-configured match setting (default 48 for early testing).

**Interactions:** Create/join room → invite friends → select token → ready → start countdown → match initialized → first player begins. Reject duplicate seats, duplicate token selection if uniqueness is enforced, late join of an in-progress match unless spectator mode is explicitly supported.

**OPEN — DECISION REQUIRED:** Whether the host can choose starting cash or round limit; spectator eligibility; behavior if a participant leaves before start; whether tokens must be unique; host migration. Do not let clients override starting money.

## 5. Turns, phases and timing

All phase progression and deadlines are server-controlled. Time shown in the UI is calculated from server deadlines. An animation is never itself permission for a game-state change.

| Phase | Duration | Client interaction | Typical timeout result |
|---|---:|---|---|
| Roll & move | ~3 seconds animation | Active player initiates roll; die/token animate from server result | Server progresses from already resolved roll |
| Resolve landing | Up to 30 seconds | Buy, partner, pass; draw/acknowledge card; pay mandatory charges | For optional purchases, pass; for mandatory costs, enforce debt resolution |
| Rent collection | Up to 12 seconds; conditional | Eligible residential/hotel owner taps Collect | Rent/fee is waived if not claimed |
| Optional actions | Up to 30 seconds | Build, upgrade, sell, initiate trade/loan, review portfolio | End turn |

**75 seconds is an additive maximum only when all four phases occur**; usual turns should be much shorter. Passive observation and inspecting assets can happen while waiting. Transactions involving other players can require simultaneous approvals and separate deadlines; such operations must not create indefinite pauses.

**A full table round** completes when every still-active (not bankrupt) player has had one scheduled turn. A player missing movement because of EFCC Holding still consumes their scheduled turn for round accounting. Changes in active roster during a round must be defined so rounds do not skip or double-count players.

**Safe out-of-turn interactions:** Loan repayments may occur at any time, not only on one's turn. Trade offers can be drafted out of turn. Applying trades, cash transfers and other actions must occur in a serialized authoritative order. If a new command conflicts with a required landing/rent/auction resolution, defer or reject with a clear reason.

**OPEN — DECISION REQUIRED:** Whether the 30-second landing phase is shared with the 12-second rent window or whether rent begins afterwards; what happens when a multi-party approval spans a turn boundary; rolling timeout when player never taps Roll; exact turn order for effects from cards; whether a skipped turn bypasses optional actions too. The UI concept currently depicts rent and optional actions as distinct phases.

## 6. Movement and GO

Roll a uniform integer 1–6 on the server. For ordinary movement from `p` by `d`: `next = ((p - 1 + d) % 28) + 1`. Walking wraps from tile 28 to tile 1; each forward physical crossing/landing on GO produces **one GO payout**. No fixed traditional Monopoly salary: the payout is based on the player's investments, less relevant deductions.

**GO payout components:** Gross commercial income + gross hotel income + applicable bonuses − commercial/hotel maintenance − residential maintenance − eligible income-sharing loan repayments ± temporary effects. Assets under EFCC seizure produce no income. Joint developments distribute income/expenses by ownership percentages. Show an itemized Payday summary and its net impact on cash.

**Transport movement rules (LOCKED concept):** Ordinary forward movement crossing GO pays. Explicit `Advance to GO` pays. Backward movement never pays GO. Direct moves to a named location only pay GO when card expressly grants it; these are teleports, not assumed traversals. Prevent recursive extra card draws and accidental double payouts from a single movement action. Landing at the destination resolves its normal effect unless a card specifically waives it.

**OPEN — DECISION REQUIRED:** Whether GO can result in a net negative balance (maintenance exceeds revenue), order of maintenance/loan deductions if cash insufficient, partial/integer rounding on split payouts, cap handling at ₦1,000,000, and movement effect processing if a card passes GO then directs to a tile.

## 7. Property purchase and auctions

**Unowned property landing:** The active player sees property name, corridor, list price, current funds, buy-alone action, buy-together action, pass action, and remaining 30-second timer. Buy-alone transfers price from player to bank and registers 100% ownership, provided cash is sufficient. Buying a property is not the same as constructing a building.

**Joint purchase:** Active player proposes a second player and simple equity split (default 50/50). Contribution amounts equal ownership shares of the purchase price; invited player accepts/declines on a simultaneous short timer. Apply both transfers and ownership change atomically. No legal-style development-rights contract. All property slots are jointly owned under one simple share ledger.

**Decline / timeout:** An unowned property goes to auction. **PROVISIONAL** auction is sealed-bid for 12 seconds, all eligible solvent players may submit one valid bid; highest bid wins; winner pays bank; tied bids resolve through a deterministic declared rule (earlier proposal: earliest submitted). No winners means property remains unowned. Available cash must support the bid at settlement.

**OPEN — DECISION REQUIRED:** Whether an individual who declined the initial purchase may bid; minimum bid/increments; what happens if joint purchase negotiation times out (auction or return to buy-alone); tie-break when simultaneous timestamps; how current balance commitments across auctions/loans are reserved.

## 8. Corridors and development eligibility

Each corridor has three named properties. Ownership/control is **counted regardless of acquisition order**.

| Corridor status | Unlocked developments |
|---|---|
| 1 / 3 | Shop, Small Business (commercial slot) |
| 2 / 3 | Basic House, Duplex (residential); Office Building (commercial) |
| 3 / 3 | Premium Apartments, Apartment Block, Luxury Mansion; Shopping Complex, Skyscraper; Hotel |

Having an unlocked tier gives permission to spend money to build; it does not award any building for free. A player who loses qualifying corridor control keeps already-created developments running but cannot initiate further upgrades that depend on the missing tier.

**Joint ownership nuance:** Earlier design direction allowed joint-owned properties to count toward owners' corridor progress, but exactly how a property shared with an unrelated player contributes is **OPEN — DECISION REQUIRED**. V1 suggestion: count an owned share as one property toward that player's corridor only if a positive, valid share exists, but explicitly test for unintended double-unlocks. Never implement development-rights agreements or extra side contracts.

## 9. Triple-slot property developments

Every standard land property has **three distinct simultaneous slots**: **commercial**, **residential**, **hotel**. One active building per slot, so a property can contain a shop/office/skyscraper, a house/duplex/apartment/mansion, and a hotel at the same time. A shop and an office cannot coexist as separate commercial developments. Utilities have no building slots.

### 9.1 Commercial catalog — prototype middle-class baseline

| Building | Unlock | Build price | Gross GO income | Maintenance per GO | Net per GO |
|---|---:|---:|---:|---:|---:|
| Shop | 1/3 | ₦6,000 | ₦2,600 | ₦400 | ₦2,200 |
| Small Business | 1/3 | ₦9,000 | ₦3,800 | ₦700 | ₦3,100 |
| Office Building | 2/3 | ₦17,000 | ₦7,100 | ₦1,300 | ₦5,800 |
| Shopping Complex | 3/3 | ₦26,000 | ₦13,000 | ₦2,600 | ₦10,400 |
| Skyscraper | 3/3 | ₦40,000 | ₦21,000 | ₦5,000 | ₦16,000 |

### 9.2 Residential catalog — prototype middle-class baseline

| Building | Unlock | Build price | Rent per landing | Maintenance per GO |
|---|---:|---:|---:|---:|
| Basic House | 2/3 | ₦7,000 | ₦4,200 | ₦300 |
| Duplex | 2/3 | ₦13,000 | ₦7,600 | ₦650 |
| Premium Apartments | 3/3 | ₦15,000 | ₦9,000 | ₦850 |
| Apartment Block | 3/3 | ₦18,500 | ₦13,500 | ₦1,200 |
| Luxury Mansion | 3/3 | ₦31,000 | ₦22,000 | ₦2,200 |

### 9.3 Hotel slot — hybrid

| Building | Unlock | Build price | Gross GO income | Maintenance per GO | Landing hospitality fee |
|---|---:|---:|---:|---:|---:|
| Hotel | 3/3 | ₦34,000 | ₦7,000 | ₦2,000 | ₦6,000 |

These prices are **PROVISIONAL v1 prototype economy**, based on middle-class property baseline. They are not final balance figures; triple-slot development can significantly increase liquidity. Hotel is **its own slot**, not part of the commercial upgrade chain.

### 9.4 Construction and upgrade rules

- Construction is separate from acquiring land; active player pays the applicable location-adjusted cost.
- Construction is allowed in the active player's optional-actions window, subject to corridor unlock, ownership, cash, seizure/collateral restrictions and partner approval.
- One construction or upgrade action per active player turn (**LOCKED**).
- Construction is instant on approval; show an animation but record outcome immediately server-side.
- In-category upgrade replaces the existing building. **PROVISIONAL** price = positive difference between new and old construction cost + 10% renovation fee on that difference; no cash-out for downgrading using the upgrade command.
- Redevelopment/sale uses **60% of construction value** as a credit, subject to location multipliers and the agreed valuation policy.
- Losing corridor control blocks future upgrades above the remaining unlock, but already built developments continue working.
- Property seized by EFCC cannot be upgraded, sold or traded during seizure.
- For joint land, owners must approve new construction; costs, maintenance, rent and GO income split by shares.

**OPEN — DECISION REQUIRED:** Whether construction from an empty slot is charged as one action (expected yes); whether direct construction of any unlocked tier is allowed (recommended yes) or each upgrade must be sequential; whether hotel has upgrade levels; exact construction cost multipliers and asset resale value definitions; partner declining/being offline; how joint-owner construction contributions are funded/reserved.

### 9.5 Location multipliers (provisional design candidates)

Previously proposed modifiers, not yet approved as final:

| Tier | Construction | Rent | Commercial GO |
|---|---:|---:|---:|
| Low-cost | 0.75× | 0.65× | 0.80× |
| Middle-class | 1.00× | 1.00× | 1.00× |
| Premium | 1.45× | 1.55× | 1.45× |
| Ultra-premium | 2.15× | 2.30× | 1.90× |

**OPEN — DECISION REQUIRED:** Assign a tier explicitly to each of six corridors, determine a hotel modifier and maintenance modifier, and define rounding. Never guess based solely on a property's real-world prestige.

## 10. Rent, hotels and payment collection

**Residential:** Rent is charged only when an opponent lands on a property with an active residential development. An owner must *notice and manually claim* during the 12-second window. If no eligible claim arrives in time, occupant pays nothing. Claims accepted once; double tapping never double charges.

**Hotel:** Has *both* GO income and a landing hospitality fee. Previous proposal for a property with both hotel and residential: show **one combined 12-second claim opportunity** containing distinct rent and hospitality line items. One successful claim transfers both; no claim forfeits both. This is **PROVISIONAL** and should be confirmed before final engine implementation.

**Commercial:** Does not charge landing rent; generates passive income via GO.

**Joint-owned land:** Either joint owner may claim, once per landing; automatically distribute net rental proceeds according to shares. A player never pays rent to their own wholly owned property. **OPEN — DECISION REQUIRED:** Does a co-owner who lands on a jointly owned property pay other owners' shares? Recommend only the others' shares, or exempt co-owners entirely for simplicity; obtain approval.

**Insufficient funds:** A mandatory rent claim that exceeds player's available cash enters payment/asset resolution rather than silently reducing balance below zero. **OPEN — DECISION REQUIRED** finalize liquidation rules before full gameplay.

## 11. Utilities: Airport, Refinery, Railway

These three are **purchasable independent utility spaces**, not corridors and not buildable land. They can be bought, traded, jointly owned and pledged as eligible collateral. When an opponent lands on a utility, its owner receives an **automatic** fee: **no manual claim**.

| Owned utility count | Automatic fee per landing |
|---:|---:|
| 1 | ₦2,000 |
| 2 | ₦5,000 |
| 3 | ₦9,000 |

The count refers to utilities controlled by the receiving player; prices Railway ₦14k, Airport ₦16k, Refinery ₦18k. Fees do not depend on die value. An unowned utility enters purchase/auction flow.

**OPEN — DECISION REQUIRED:** Joint ownership and set-bonus count; co-owner landing fee behavior; whether utility under seizure is eligible in the raid pool (initial design: raid focus is developed land); whether utility fee is suspended during EFCC events. Use a policy interface for shared-utility rules.

## 12. Trading and joint ownership

Transactions should be simple and legible. Support: (1) property for cash; (2) property-for-property swap; (3) swap plus cash; (4) joint property purchase; (5) joint construction proposal. Only one counteroffer per proposal is **PROVISIONAL**. No complex contracts, development rights licensing, leaseholds or custom profit-sharing schedules.

**Standard trade flow:** Player taps Trade → selects another player → selects offered/requested land and optional cash → server stores offer with expiration → recipient accepts, declines or makes permitted counteroffer → on acceptance server rechecks cash, ownership and locks → applies all transfers atomically → emits trade-completed event → recomputes corridor/control status.

**Joint ownership ledger:** Total shares sum to 100%. Default proposed 50/50, editable shares. All three building slots on the property share the **same ownership shares**. Basic profits, build costs and maintenance divide proportionally. Joint partners approve builds and joint EFCC payments; an owner may cover a protection/settlement shortfall without automatically changing equity.

**Reserved/blocked:** Properties pledged as collateral, EFCC seized, or undergoing another exclusive transaction cannot be transferred in conflicting trades. No client can submit the same accepted offer twice. Trade acceptance must also validate that each participant is still active.

**OPEN — DECISION REQUIRED:** Whether secondary sales of fractional equity are supported (recommend *no* for v1); how a solo property becomes jointly owned outside initial purchase; partner refusal to pay build contribution; escrow/reservation for pending offers; counteroffer deadline; lending against jointly owned property share versus whole asset. Design for two joint owners initially rather than arbitrary numbers unless specifically expanded.

## 13. Loans: two distinct contracts

Loans are **player-to-player**. The game bank does not create the principal. Funding moves from lender's current cash to borrower upon loan acceptance. Any fee/interest changes the total repayment obligation, not the initial transferred principal. Loans can be repaid **any time, including outside the borrower's turn**. Use clear on-screen due indicators and one-click Repay.

### 13.1 Fixed-deadline property-backed loan

Borrower selects a property as collateral, amount, lender and offered term. Lender accepts/rejects. Recommended preset terms: **2, 4 or 8 full table rounds**, with **10%, 15%, 25%** total loan fee respectively (**PROVISIONAL**). E.g., borrower receives ₦20,000 and owes ₦22,000 after two rounds at 10%. Deadline is based on round boundaries, never wall-clock minutes. Borrower can make partial or full repayment before the deadline, including out of turn.

If the debt remains unpaid when the fixed due condition occurs, pledged property is transferred **automatically to the lender**. Other existing interests and improvements must follow the property unless a liquidation rule says otherwise. Collateral cannot be sold or pledged again while debt active. A seized property does not freeze the loan deadline.

**PROVISIONAL lender safeguard:** Principal ≤75% of the pledged asset's bank valuation. Determine how building value, hotel, existing ownership and location factor into valuation.

### 13.2 Income-sharing loan

Borrower chooses an income-producing property, lender, principal, total payoff amount and a percentage of **collected net income** (after maintenance) diverted automatically to the lender until payoff is complete. E.g., loan ₦25,000, payoff ₦30,000, lender takes 40% of eligible property income. Each actual income event reduces debt by the amount diverted. No earned income means no remittance. Additional repayments can be made manually at any time. Payments must be capped at remaining debt to avoid overpayment.

If borrower becomes bankrupt before full repayment, the bank **auctions the pledged property** and pays the lender up to the unpaid balance out of sale proceeds. Remainder enters bankruptcy estate. If sale proceeds are insufficient, the lender bears the difference to the extent established by liquidation rules.

### 13.3 General restrictions and implications

- One active secured loan per property. No repeat pledging.
- No self-loans.
- Lender must own enough uncommitted cash to fund principal.
- Shared property requires all co-owners' approval to pledge entire asset.
- Loan records persist and survive disconnects or skipped turns.
- Repayments transfer cash; never mint lender cash from nothing.
- Outstanding loan is borrower's liability and lender's receivable at endgame; avoid counting both principal and property multiple times.
- A property becoming seized by EFCC does not cancel the debt.

**OPEN — DECISION REQUIRED:** Priority on bankruptcy with simultaneous secured debts; action when borrower dies before fixed-loan due round; partial repayment followed by default (does lender still receive the entire property? previous direction yes); whether a property may simultaneously be jointly owned and collateralized; income share on hotel + commercial + residential combined or only a chosen slot (initial discussion: one selected property's income; recommended all net income from that property, clearly shown); counting current round toward term; end-of-game outstanding debt treatment and settlement.

## 14. EFCC system: warning, protection and raid

EFCC raids are an **independent periodic global game mechanic**; landing on the EFCC Holding tile is a separate action. Raids are meant to start when players have built material income-producing investments, not immediately at the start.

### 14.1 Preliminary activation and frequency

- No raids in first 12 full rounds (**PROVISIONAL**).
- First raid eligible after at least three income-producing developed properties and one Stage-2-or-higher development (**PROVISIONAL**).
- After a raid, at least eight full rounds before another warning (**PROVISIONAL**).
- Maximum three scheduled raids per match (**PROVISIONAL**).
- For 3-player matches, exposure eligibility may be adjusted to avoid complete suppression of raids (**OPEN**).

### 14.2 Phase A — advance warning

One full round before an operation, broadcast a warning that EFCC will raid **next round**. The target remains unknown. Players have a protection window (exact duration / closing conditions **OPEN**). Payments are secret while choices are pending.

### 14.3 Phase B — personal protection

Each player may secretly pay a **general personal protection fee** that covers **all wholly owned eligible properties**, not each property separately. This protection is scoped to the announced raid and not automatically to future raids.

**PROVISIONAL fee formula:** `min(₦15,000, ₦2,000 + ₦750 × sum(personally owned developed-property exposure))`. Exposure indicator shown qualitatively (low/moderate/high), not the exact selection probability. Paid fees are nonrefundable even if a different player/property is raided.

### 14.4 Phase C — additional protection for jointly owned property

Personal protection does **not automatically protect jointly owned property**. Its owners may pay an additional **joint-property protection fee**. This fee becomes lower when one or both owners have already paid personal protection.

**PROVISIONAL:** Base fee = `₦2,000 + ₦750 × property exposure`. Up to 50% discount according to personally protected owners' equity share. E.g., two 50/50 owners who both personally protect pay 50% of base joint fee; if one protects, pay 75% of base. Owners may contribute their default ownership shares, or one may cover the other's shortfall. Protection activates **only when joint fee is fully funded**. If it remains underfunded by cutoff, it is inactive; refund handling for incomplete protection **OPEN** (recommend automatic refund).

### 14.5 Phase D — raid selection and reveal

**The raid always happens**, including when *every player* paid protection. Select eligible target property using exposure-weighted randomness across **all eligible properties, including protected properties**. Protection cannot reduce selection weight. Reveal selected asset and animation. If protected: inspection occurs, officials leave, no seizure/settlement. Other protection fees remain spent. Reveal who paid when/if public post-raid transparency is enabled (**PROVISIONAL**).

### 14.6 Phase E — unprotected decision

If unprotected, owner(s) choose:

1. **Full settlement**: pay a property-dependent price; property remains operational.
2. **Seizure**: property is sealed for **three full table rounds**. Ownership stays with current owner(s), but all development income and landing fees stop; cannot develop, sell or trade during seizure. Existing loan obligations continue.

**PROVISIONAL settlement:** `₦4,000 + ₦3,000 × property exposure`, subject to later city/tier multiplier. Joint owners can split proportional to shares; either can cover remainder; if incomplete payment, property is seized and attempted partial contributions should be refunded. A one-off *reopening charge* of 20% of construction value was suggested once but never explicitly confirmed — **DO NOT IMPLEMENT BY DEFAULT**.

### 14.7 Exposure

| Development | Exposure points |
|---|---:|
| Shop | 1 |
| Small Business | 2 |
| Basic House | 1 |
| Duplex | 2 |
| Office Building | 3 |
| Apartment Block | 3 |
| Premium Apartments | 4 |
| Luxury Mansion | 4 |
| Shopping Complex | 6 |
| Hotel | 7 |
| Skyscraper | 9 |

For triple-slot land, **PROVISIONAL recommendation**: sum all active development exposure values and apply a city/tier factor. Empty land is not a profitable business and should not be an eligible raid target under the intended rule.

**OPEN — DECISION REQUIRED:** Exact raid warning-to-selection timeline when a table round has multiple players; whether same asset can be raided consecutively; selection eligibility and seizure conflicts; visibility of protection after raid; raid target based on property exposure vs portfolio exposure; behavior if player goes bankrupt during warning; no eligible properties remain; whether a protected property under existing seizure can be chosen; whether a settlement can be financed by instant loan response.

## 15. EFCC Holding, Free Parking and taxes

These are independent landing-space effects.

### 15.1 EFCC Holding (#15)

Player chooses to **pay ₦5,000 immediately** or **miss one future movement turn**. Missed turn counts toward table-round completion. A held player may still receive money and manage outstanding obligations, subject to finalized pause policy. This is **LOCKED** as a choice, with exact timing of skipped turn **OPEN**. Do not treat landing here as an automatic global raid.

### 15.2 Free Parking / Park (#8)

Pure safe landing. **No cash reward, no fine, no tax jackpot**.

### 15.3 Income Tax (#5)

Pay **5% of current cash**, minimum **₦1,000**, maximum **₦10,000**. Do not charge more than player can pay without invoking the normal payment/insolvency process. **OPEN:** tax rounding (recommend nearest naira) and whether minimum applies to zero cash (earlier agreed yes unless insolvency).

### 15.4 Property Tax (#22)

Pay **3%** of combined assessed value of player's property holdings, capped at **₦12,000**. For shared assets, assess the player's share only. Earlier baseline assessment: land price + **70% of construction cost**; utilities inclusion **OPEN** (recommend yes in asset assessment unless intentionally excluded). No minimum specified. Tax calculation is authoritative and itemizable.

## 16. Chance deck — 16 cards (approved conceptual deck; exact effects baseline)

One Chance tile (#25). Deck comprises 16 individual equally weighted cards on a fresh shuffle; draw without replacement until reshuffle. A card may be temporarily held if the effect explicitly creates a holdable bonus; define handling so unique cards aren't simultaneously drawn more than allowed. Avoid chained card draws and contradictory transport rules.

| ID | Name | Effect |
|---|---|---|
| C01 | Danfo Express | Advance to GO; trigger one GO investment payout |
| C02 | Lekki Expressway | Teleport to Lekki Phase 1; resolve landing, no implied GO payout |
| C03 | Island Connection | Teleport to Victoria Island; resolve landing |
| C04 | Billionaire Invitation | Teleport to Banana Island; resolve landing |
| C05 | Mainland Express | Teleport to Yaba; resolve landing |
| C06 | Third Mainland Traffic | Move backward 3; resolve landing; no GO payout |
| C07 | Uber Driver Knows Road | Move forward 6; resolve landing and ordinary GO crossing |
| C08 | Business Windfall | Receive ₦8,000 from bank |
| C09 | Vehicle Repairs | Pay ₦4,000 to bank |
| C10 | Unexpected Contract | Receive ₦5,000 from bank |
| C11 | Lagos Wahala | Pay ₦6,000 to bank |
| C12 | Detty December | Commercial buildings +25% gross GO income at next eligible payout (scope all players) |
| C13 | Fuel Scarcity | Commercial buildings +25% maintenance at next eligible payout (scope all players) |
| C14 | Construction Boom | Holder's next construction costs 20% less; expires after 4 table rounds |
| C15 | EFCC Insider Tip | Holder's next personal protection fee is 50% lower |
| C16 | Rent Inspector | Automatically collect holder's next eligible residential rent payment |

**OPEN — DECISION REQUIRED:** Exactly when global 'next GO' temporary modifiers expire per player; how percentage modifiers combine with tier modifiers; whether Rent Inspector affects hotel hospitality fee as well; whether saving a card counts as being held vs applied automatically; capitalization/payout cap handling.

## 17. Community Chest deck — 16 cards (approved conceptual deck; exact effects baseline)

One Community Chest tile (#6). Same shuffled/dealt-without-replacement policy.

| ID | Name | Effect |
|---|---|---|
| H01 | Birthday Alert | Receive ₦2,000 from each other active player |
| H02 | Family Billing | Pay ₦4,000 to bank |
| H03 | Government Grant | Receive ₦8,000 from bank |
| H04 | Wedding Contribution | Pay ₦2,000 to every other active player |
| H05 | Tax Refund | Receive ₦5,000 from bank |
| H06 | Hospital Bills | Pay ₦6,000 to bank |
| H07 | Side Hustle Pays | Receive ₦4,000 from bank |
| H08 | Community Donation | Pay ₦3,000 to bank |
| H09 | Property Maintenance Relief | Waive maintenance on one owned building at next GO payout |
| H10 | Unexpected Repairs | Pay ₦1,000 per developed property owned, cap ₦6,000 |
| H11 | Investor Bonus | Receive ₦3,000 per completed corridor, cap ₦9,000 |
| H12 | Aunty Sent Something | Receive ₦5,000 from bank |
| H13 | Electricity Bill | Pay ₦3,000 to bank |
| H14 | Tenant Pays Arrears | Receive ₦4,000 per owned residential-developed property, cap ₦8,000 |
| H15 | Business Permit Approved | Receive ₦5,000 if own a commercial development, otherwise ₦2,000 |
| H16 | Neighborhood Levy | Pay ₦2,000 per owned property, cap ₦8,000 |

**OPEN — DECISION REQUIRED:** How joint properties are counted on per-property cards; behavior when a direct player-to-player payment can't be satisfied; whether utility counts as a 'property' for Neighborhood Levy; fees scaling when 3 vs 6 participants; whether 'completed corridor' permits joint ownership for Investor Bonus.

## 18. Bankruptcy, asset liquidation and victory

Bankruptcy means a player cannot satisfy mandatory obligations under the allowed liquidation/borrowing options. They leave active play. Eliminated players' positions and deals need a clear settlement. **Do not declare bankruptcy only because cash falls below an amount while sellable assets exist**, unless the adopted rules expressly require immediate cash payment.

**LOCKED win conditions:** If one solvent player remains, immediate winner. If multiple remain when the configured round limit ends, **highest net worth wins**. Show final leaderboard and valuation breakdown. Endgame valuation is about *wealth*, not just cash.

### 18.1 Provisional valuation

`Net Worth = Cash + Owned land value + Owned utility value + 70% of remaining building construction value + Net loan receivables − Outstanding liabilities`.

For jointly owned assets, allocate each asset valuation exactly once across owners by percentages (do not also add 'partnership equity' a second time). Cash is counted at face value. Pledged land still belongs to borrower until default/transfer, but collateral and debt should be accounted consistently. Seized land stays owned but may be subject to a valuation penalty (**OPEN**, previously suggested but not approved).

### 18.2 Liquidation

Players may liquidate buildings at a discount, sell/trade land when eligible, seek loans and satisfy debts. Property-backed loan collateral may transfer directly upon missed deadline; income-sharing loan security is sold by bank on bankruptcy, lender paid up to outstanding debt, remainder allocated to estate. For other unsecured creditors and rent creditors, a priority schedule is **OPEN — DECISION REQUIRED**. No negative cash or hidden unpaid obligations allowed as 'success'.

### 18.3 Endgame timing

Provisional 48-round full-table cap. A final-five-round alert can signal the approaching valuation. Finishing at the end of a full round avoids first-turn advantage. Preserve pending mandatory resolution before final valuation. **OPEN:** tie-breaking, unfinished loan due rounds and temporary modifiers, skipped turns, and late connection failures at round 48.

## 19. Player interaction catalogue (UX → command → result)

| Situation | Player-facing action | Server result | UI feedback |
|---|---|---|---|
| Active turn begins | Roll | Activate one die server-side | 3-second roll/token animation |
| Arrives at unowned land | Buy / Partner / Pass | Purchase or auction | Purchase sheet, owner marker |
| Arrives at owned residential land | Owner taps Collect within 12 s | Rent transfer once, else waived | Countdown, success / escaped alert |
| Arrives at hotel property | Owner collects landing fee (combined window proposed) | Hospitality/rent transfer | Rent + hotel breakdown |
| Arrives at commercial-only land | No rent action | Landing resolved | Property details, continue |
| Arrives at utility | Auto fee | Charge landing player, pay utility owners | Service-fee toast |
| Passes GO | No further input normally | Net commercial/hotel payout and costs | Itemized Payday animation |
| Arrives at Chance / Chest | Draw / reveal | Apply typed card effect | Card reveal and effect animation |
| Arrives at EFCC Holding | Pay ₦5k / miss turn | Cash deduction or skip flag | Two-choice sheet |
| Arrives at tax space | Acknowledge bill | Mandatory payment/insolvency | Calculation + receipt |
| Build slot vacant | Pick slot/building, confirm | Charge, create building | Building preview updates |
| Upgrade slot | Select replacement tier, confirm | Upgrade economics + replace | Before/after income delta |
| Sell building | Confirm liquidation | Remove building; credit salvage | Asset disappears + cash update |
| Offer trade | Select target, assets, cash | Pending trade | Offer card to recipient |
| Respond to trade | Accept / reject / counter | Atomic transfer or closure | Corridor update, success/fail |
| Borrow against land | Select lender, amount, collateral, term | Loan created after acceptance | Debt clock + collateral badge |
| Income share loan | Select property and income percentage | Loan created, auto remittances | Debt progress display |
| Repay loan | Enter amount, repay anytime | Transfer funds, reduce debt | Loan status update |
| EFCC warning | Protect personally, join protection | Fees held/charged | Secret protection indicator |
| EFCC raid | Target revealed | Protected pass or settlement/seizure | Dramatic raid outcome |
| On seizure | No action to undo except settled workflow | Freeze all property incomes 3 full rounds | Lock/tape overlay + expiry |
| Player bankrupt | Resolve debt and liquidation | Elimination and asset transfers | Bankruptcy summary |
| Game ends | View results / rematch | Persist winning outcome | Final net-worth leaderboard |

## 20. Real-time consistency and fairness constraints

- Authoritative state changes happen on the server, not through PixiJS or Zustand alone.
- Every gameplay command carries a unique idempotency ID and participant identity.
- Validate turn/phase/deadline and legal action before mutation.
- Process every match transition serially (transactional lock or versioned compare-and-swap); publish only after commit.
- Attach monotonically increasing state versions/sequence IDs. Reconnect via snapshot then missed-event recovery.
- On reconnect, never restart expired rent, auction, or loan timers; recover from server deadline.
- A client can render optimistic animation while waiting but cannot spend authoritative money before confirmation.
- Secret EFCC protection decisions and sealed bids must not be exposed through subscriptions or debug payloads.
- Joint owner approvals must be idempotent and atomic. Cash/reserved-funds checks must be repeated when committing.
- Deterministic RNG injection for unit tests; secure server RNG in live play.
- Cap money carefully and log every bank-issued/removed amount for audit and balance analysis.

## 21. Suggested machine-readable rule boundaries

Expose game rules as typed data, not buried UI code. At minimum: `board.ts`, `corridors.ts`, `buildings.ts`, `utilities.ts`, `cards.ts`, `fees.ts`, `timers.ts`, `raid.ts`, `loans.ts`, `valuation.ts`. Version rule configurations per match so changing prices next month does not alter matches in progress.

Required game phases: waiting, start, turn-start, roll/move, landing, conditional rent claim, optional actions, turn-end, pending auction, pending multi-party approval, pre-raid warning/protection, raid target/settlement, insolvency resolution and finished. Pause/resume decisions must be explicit: a trade popup may be visual-only while phase countdown proceeds, unless the server purposely suspends it.

## 22. Essential test cases

**Board/movement:** 1–28 unique and correct order/corners; wrap 28→1; one fair die; GO income once; backward card no GO; teleport to Lekki without phantom GO payout; Chance chained event guard.

**Ownership:** Buy vs auction, insufficient cash, simultaneous purchase attempt, three corridor properties in any order, separated-but-same-color groups across a corner, joint shares sum 100%, property trade recalculates corridor level.

**Buildings:** Empty vs occupied triple slots; one building per slot; shop + duplex + hotel all coexist; incorrect corridor tier rejected; one build per turn; shared costs correct; seizure blocks each of three incomes; construction fee and 10% renovation calculated once.

**Rent/utility:** Claim at 11.9 seconds accepted; claim after 12 rejected; two owners claiming same event only one succeeds; automatic utilities no claim; hotel + house combined transfer once; owner landing self-property doesn't pay self.

**Loans:** Loan principal transferred (not created); partial early repay; due after exactly 2 full table rounds; default transfers pledged land; seized collateral still runs down deadline; income-sharing dividend only on realized net income; no over-repay; same property cannot secure two active loans; bankruptcy lender proceeds cannot exceed receivable.

**EFCC:** Protection secret, discount correct for 0/1/2 protected owners, protected assets remain targetable, everyone protected still produces raid animation, unprotected seizure lasts exactly 3 full rounds, full settlement avoids seizure, raid doesn't retroactively choose after protection outcomes known.

**Cards/taxes:** 16 distinct cards/deck; card draws without replacement; birthday transfer with 3 and 6 players; tax minimum/caps; shared-asset tax; economic modifier expires; insufficient-funds tax enters insolvency resolution.

**Match end:** Highest net-worth wins on end round; last solvent wins early; no double-counted joint equity; outstanding loans net properly; skipped turn doesn't break full-round accounting; reconnect restores deadline and assets.

## 23. Open decision register (do not assume these are finalized)

| ID | Area | Question requiring explicit policy |
|---|---|---|
| D01 | Match pacing | One 48-round limit for 3–6 players, or player-count-dependent limits? |
| D02 | Cash cap | What happens to incoming cash above ₦1m: discard, bank escrow, or reject? |
| D03 | Corridor control | Does any positive jointly owned share count as 1/3 toward each co-owner's corridor? |
| D04 | Landing fees | Residential rent + hotel fee claimed together in one 12-second window? |
| D05 | Joint self-landing | Is a co-owner exempt, or charged for other owners' percentages? |
| D06 | Economic modifiers | Final tier multipliers for each corridor, hotel income and all maintenance |
| D07 | Utility sets | How count jointly owned utilities toward the 1/2/3 utility fee tiers? |
| D08 | Insufficient funds | Order of voluntary sales, loans, forced liquidation and bankruptcy |
| D09 | Loan bankruptcy | Collateral-backed fixed loan treatment on early bankruptcy and shortfall priorities |
| D10 | Loan due dates | Exact inclusion/exclusion of current round; expiry timing during skipped turns |
| D11 | EFCC | Exact first-raid thresholds, frequency and warnings when targets disappear |
| D12 | EFCC joint fees | Incomplete protection payments refunded? Partner deadlines? |
| D13 | Seizure | Reopening cost proposed once but not approved—default none |
| D14 | Auctions | Min bid, eligibility of decliner, ties, reserved balances, zero-bid outcome |
| D15 | Global card effects | How 'next GO' affects all players and when effect expires |
| D16 | Endgame | Tie break, outstanding loan maturity, seized asset valuation |
| D17 | Turn timers | Rolling timeout and status of out-of-turn actions during mandatory resolution |
| D18 | Group ownership | Whether joint property remains capped at exactly 2 owners or expands to more |
| D19 | Cash-flow | What if combined maintenance at GO is larger than income and cash? |
| D20 | Player departures | Disconnect, forfeiture and host departure policy |

**Implementation policy:** Ship the deterministic foundational features first. Build unresolved mechanics behind configuration or TODO decision gates; never conceal arbitrary product decisions in code. Prefer short written decision proposals with illustrative examples and unit tests.

## 24. Suggested implementation order and acceptance gates

**Phase A — board and authoritative core:** Canonical board/corridors, players, one die, 28-tile movement, turn-state machine, deadlines, persistence, reconnect, property purchase/auction, basic GO. **Gate:** Three clients observe identical board state after rolls, purchases and refresh.

**Phase B — revenue and buildings:** Triple-slot catalogue, corridor permissions, construction/replacement, maintenance, GO payout, manual residential rent, hotels, utilities. **Gate:** A completed corridor can build shop + house + hotel where eligible; earnings and fees correct from tests.

**Phase C — marketplace:** Simple swaps/trades, joint purchase, co-owner approvals, fixed collateral loans, income-sharing loans, defaults. **Gate:** Competing commands cannot duplicate cash or change ownership inconsistently.

**Phase D — cards, EFCC and insolvency:** Chance/Chest decks, tax, EFCC Holding, warning/protection/selection/seizure, bankruptcy, final valuation. **Gate:** Full match completes in deterministic headless tests and multiple-browser playtest.

**Phase E — balance and polish:** Measure turns/game, cash flows, corridor completions, trade counts, premium construction, rent evasion rates, loan defaults, bankruptcies and player feedback. Tune config without rewriting engine. **Gate:** Human playtest sessions meet the intended ~45–60 minute range for lobby sizes selected.

## 25. Worked examples and authoritative acceptance narratives

**Example A — two slots, then three:** Player owns Banana Island only, builds Shop if funds suffice. Later obtains Eko Atlantic → can add Duplex on Banana Island while keeping Shop. Later obtains Victoria Island → can upgrade Shop into Skyscraper *and*, on a separate turn, build Hotel in the third slot. Banana Island now generates commercial GO income + hotel GO income, and can collect residential rent + hotel landing fee as appropriate.

**Example B — missed rent:** Chidi lands on Yaba with a Duplex; Amaka owns it. Server announces claimable rent ₦7,600 and 12-second deadline. Amaka fails to claim. `RENT_EVADED` event issued and Chidi retains ₦7,600; Amaka cannot claim retroactively.

**Example C — income share:** Chidi lends ₦20,000 to Amaka, total due ₦24,000; 40% of selected property's realized net earnings repaid automatically. A ₦5,000 net payout diverts ₦2,000 to Chidi; debt falls to ₦22,000. If full balance is paid early, later payouts remain with Amaka.

**Example D — collateral loss:** Amaka borrows ₦20,000 against Yaba on 2-round term at 10% fee; owes ₦22,000. If deadline arrives with ₦5,000 outstanding, collateral transfer is triggered under the fixed-loan rule (subject to bankruptcy distinctions). Yaba and its eligible developments now belong to lender. Loan closes according to explicit settlement bookkeeping.

**Example E — EFCC cooperation:** Two players own Osapa London 60/40, with Office + House + Hotel. Both paid personal protection. They also fund the discounted joint-property protection fee in full. EFCC still chooses Osapa London in the random raid pool. Officers inspect, see the protection status, and leave: no seizure or extra settlement. Both personal and joint fees are spent.

**Example F — losing corridor:** Player owns all three Lekki properties and develops a Skyscraper on Chevron. They sell Osapa London. Corridor falls to 2/3. Existing Skyscraper continues operating, but player cannot build a new Stage 3 Hotel or Skyscraper unless they regain 3/3.

**Example G — endgame net worth:** Player A holds ₦20k cash, ₦80k land, ₦30k remaining building valuation and owes ₦15k; net worth = ₦115k. Player B holds ₦60k cash, ₦65k assets and no debt; net worth ₦125k. B wins on round limit despite A owning more buildings.

## 26. Decision log (October 2026)

These decisions override the sections above where they conflict.

**Scope:** Version 1 ships the full spec: joint ownership, both loan types, EFCC raids, cards and trades.

**Board, turns and pacing**
- No auctions. An unbought property stays unowned (D14 closed; §7 auction flow removed).
- Round cap scales down as player count goes up (D01). Exact numbers set from simulations.
- Turn order is a server shuffle at match start.
- Turn timing stays as in §5: roll, up to 30 s landing, up to 30 s actions. After a roll, the landing and action timers get 4 s more to cover the die and the walk on screen.
- EFCC Holding "miss a turn" skips the player's very next turn.
- Players walk from GO up the left edge, starting on Makoko, and reach Banana Island last. Tiles stay where they are on screen; only the numbering in §3 changed.
- No cash ceiling. The ₦1,000,000 cap is removed (D02 closed).

**Rent and building**
- Residential rent and the hotel landing fee are collected automatically, like utilities. The 12-second manual claim is removed (D04 closed).
- Rent Inspector (C16) becomes **Rent Free Pass**: the holder skips paying their next rent or hotel fee.
- No limit on builds per turn. Building happens only on your own turn, after landing.
- Build evenly: among the properties you own in a corridor, no property may have 2 or more buildings than another.
- Corridor tiers (D06): Low-cost = Mainland Low-Cost; Middle-class = Mainland Residential, Mainland Central; Premium = Mainland Premium, Lekki; Ultra-premium = Island Elite.

**Shared property**
- At most two owners (D18). Splits are 25/75, 50/50 or 75/25 only.
- A property becomes shared by buying it together on landing, or by the owner selling a share in a trade.
- A co-owner who lands on shared property pays nothing (D05 closed).
- A shared property counts toward an owner's corridor only if they own 50% or more (D03 closed).
- On per-property cards, a shared property counts as one for each owner.

**Money trouble**
- If a player owes more than their cash: 60 s to sell buildings (60% back), sell land to the bank (50% back) or borrow. On timeout the server sells cheapest first. Still short means bankrupt (D08 closed).
- A negative payday at GO pays ₦0. GO never takes money (D19 closed).
- Property Tax includes utilities in assessed value.

**Loans**
- Fixed loans use the preset terms only (2/4/8 rounds at 10/15/25%).
- Loan principal is capped at 75% of the pledged property's value.

**EFCC**
- Raid timing scales with match length (for example, first raid after 25% of rounds, then every 20%) (D11).
- Personal protection also covers your shared properties, but only if every owner paid. The separate joint protection fee is removed (D12 closed).
- Who paid for protection is revealed after each raid.

**Players and endgame**
- 3 missed turns in a row means removed and bankrupt (D20). No Leave Match button during a match.
- Before the match starts, leaving the lobby frees the seat. If the host leaves, the next seated player becomes host.
- Only removed or bankrupt players may keep watching a match.
- Net worth tie: more cash wins; if still tied, the players share the win (D16).

**Final details**
- Utilities never count as properties on per-property cards.
- Utilities can't be shared (D07 closed). Only land can have two owners.
- Bankruptcy with loans (D09): a fixed-loan lender takes the pledged property; for an income-share loan, the bank buys the property at liquidation value and pays the lender up to what's owed.
- Loan due dates (D10): the term starts counting after the current round ends. A 2-round loan is due at the end of the 2nd full round after that.
- "Next GO" cards (D15): each player's next GO after the draw uses the effect once, then it ends for them.
- Rounding: percentages round to the nearest naira. Leftover naira from a split go to the bigger share (lower seat on a 50/50 tie).

---

**End of specification.** All sections marked OPEN require a product decision before that mechanic is considered production complete. Maintain this document and a versioned rules configuration as the single gameplay source of truth.
