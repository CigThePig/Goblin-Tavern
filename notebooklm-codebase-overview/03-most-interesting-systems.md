# Goblin Tavern — The Most Interesting Systems

*A closer look at the parts of the project that show real design thinking, written for a curious non-programmer. Each section explains what a system does, why it matters, why it's technically interesting, and a concrete example of what it makes possible in the game.*

These ten systems were chosen because they are genuinely present in the code (not just planned), and because each one is harder and more thoughtful than it might first appear.

---

## 1. The "source of truth" rule that runs through everything

### What it does
There's a single design principle written into the project like a constitution: **the simulation is the only thing allowed to decide what's true.** The cards, the reports, and the screens may *reveal, explain, or dramatise* what's happening — but they can never invent a fact or contradict one.

### Why it matters
This is the quiet decision that holds the whole project together. It's the reason the game world feels coherent: a card can't claim your cook quit if the simulation still has them on staff, and a report can't say you earned coin you didn't earn.

### Why it is technically interesting
Most projects state a principle like this and then quietly break it under deadline pressure. Here, it's actually *enforced by automated tests* — there's a whole category of checks (the "coherence" and "faithfulness" gates) whose entire job is to catch any card text that claims something the simulation doesn't support. Building the discipline into the test suite, not just the documentation, is the hard and admirable part.

### Example in gameplay
A card opens with "Your cook hasn't slept right in days." That line only appears because the simulation genuinely has that cook's fatigue meter high. If it weren't, a different, truthful opening line would be chosen instead. The player can trust that what they read is real.

---

## 2. Deterministic, controlled randomness

### What it does
The game uses randomness — which customers show up, how a dice-roll of a risky choice lands — but it's a *controlled* kind. Everything random flows through a seeded random-number generator. Give it the same starting "seed" and the same decisions, and you get exactly the same outcomes, every single time.

### Why it matters
This is what makes the game **replayable and trustworthy**. It also makes it possible to test thoroughly: you can run the same scenario a thousand times and know that any difference in outcome is a real bug, not just luck.

### Why it is technically interesting
Plain randomness is easy; *reproducible* randomness threaded carefully through a complex system is not. The project goes a step further with "named streams" — separate random channels for different purposes — so that, for example, rolling for which name a new character gets doesn't accidentally shift the outcome of an unrelated dice roll elsewhere. Keeping randomness reproducible *and* independent across systems is a subtle, professional touch.

### Example in gameplay
You lose a tense night and want to know what you could have done differently. Because the run is deterministic, you could replay the exact same week with one different decision and see precisely how it changes — the world won't reshuffle underneath you.

---

## 3. The pressure system — problems that build in the background

### What it does
The tavern carries about twenty different **pressures** — slow-building meters like staff burnout, debt, pest infestation, inspection risk, a souring relationship with the landlord, or rising tension with a local faction. Each one has a current value, a trend (rising or easing), and a list of what's feeding it.

### Why it matters
This is what makes the tavern feel *alive even when you're not looking*. Problems don't pop out of nowhere; they accumulate. A crisis is the visible tip of a trend that's been building for days.

### Why it is technically interesting
The pressures aren't independent — they're wired into a web where one can feed another (overworked staff can drive up the risk of violence and damage reputation, for instance). Modelling that interconnection while keeping it understandable and stable — so it builds tension without spiralling into chaos — is a real design challenge, and the project handles it with dedicated calculators per pressure plus an explicit "feedback" system for the links between them.

### Example in gameplay
You've been skipping maintenance to save coin. For days, nothing visible happens — but the maintenance pressure quietly climbs. One morning it crosses a threshold and surfaces as a card: a beam has cracked, and now the repair is far more expensive than the cleaning you skipped would have been.

---

## 4. The memory system — a world that remembers

### What it does
The tavern records **memories** — things that happened, who was involved, and where. Memories have a strength that fades over time, and many are attached to specific people (a regular, a staff member, a faction).

### Why it matters
Memory is what turns a sequence of disconnected days into a *story*. It's the difference between a customer who's a fresh face every visit and one who walks in still annoyed about last week.

### Why it is technically interesting
The system has to decide how memories stack (does a new slight replace the old one, refresh it, or pile on top?), how fast they fade, and how to clean up expired ones — all while staying efficient and consistent. It also detects *patterns* over time (e.g. "burnout has been rising for five days straight" becomes its own memory). Recognising emergent patterns, not just storing isolated events, is the sophisticated part.

### Example in gameplay
A regular you short-changed three times now greets you coldly and is quicker to take offence — because the simulation is holding a strengthening grudge memory tied specifically to them, and the card layer reads that grudge when it writes their next visit.

---

## 5. Causes — a world that can explain itself

### What it does
Whenever an important number changes, the simulation records *why*: a little entry noting the source ("rowdy crowd damaged the common room"), the size of the effect, and a readable description.

### Why it matters
This is what lets the game be **transparent** rather than mysterious. When your reputation drops, the game can tell you the reasons instead of leaving you guessing — which is essential for a management game where players need to learn from their decisions.

### Why it is technically interesting
It's a form of automatic bookkeeping that runs across every system at once. Getting every meaningful change to leave behind an honest, readable "paper trail" — without that bookkeeping becoming overwhelming noise — requires careful, consistent discipline throughout the codebase.

### Example in gameplay
You tap on your falling reputation and the game shows: "Down 2 steps — a fight broke out Tuesday, and a customer found a hair in their stew on Thursday." The drop isn't arbitrary; it's accounted for.

---

## 6. Issue seeds — how the game decides what to put in front of you

### What it does
Each day, a set of generators looks at the tavern's current state and produces **issue seeds**: structured descriptions of the situations the tavern is facing right now. There are around twenty *families* of these (food safety, stock shortage, staff burnout, customer complaints, supplier offers, inspections, debt, rumours, rival taverns, and more).

### Why it matters
This is the bridge between the simulation and the cards — the moment where raw tracked state becomes "here's a thing the player should deal with." It's the gear that connects the basement to the ground floor.

### Why it is technically interesting
A seed isn't just "show a card." It carries the stakes, the timing (morning, mid-service, or closing), the possible responses, and a profile of the *consequences* each response would have — including effects that won't land until later. It also guards against contradictions (it won't generate a "your roof is leaking" situation on a day you just repaired the roof). Designing this structured, self-consistent hand-off so the card layer has everything it needs is what makes future cards able to feel grounded.

### Example in gameplay
Because staff burnout has been climbing and a particular cook is the most stressed, the day produces a "staff burnout" seed centred on *that* cook, with sensible options (give them a day off, push through, hire help) and the simulation already knowing what each option would cost.

---

## 7. Composed cards — writing that adapts to the situation

### What it does
Instead of one fixed block of text per card, cards are **assembled from slots**, and each slot picks the best-fitting line from a pool of options based on the current situation. A character's tone, the severity of a problem, and the history between people all influence which lines get chosen.

### Why it matters
This is how the game gets *variety and specificity* without an author having to hand-write a separate card for every possible combination of circumstances — which would be effectively impossible.

### Why it is technically interesting
The assembly is **deterministic** (the same situation always produces the same card, so the world is stable) yet **varied** (different situations produce genuinely different writing). When several lines fit equally well, a hashing trick spreads the choice consistently rather than picking randomly. Balancing "always the same for the same input" against "feels fresh and specific" is a real tension, and the system threads it carefully.

### Example in gameplay
A drink order from a warm, chatty regular you know well reads completely differently from the same mechanical order placed by a terse, formal stranger — even though, underneath, both are "this customer wants an ale." The personality and history shape the words.

---

## 8. Character voice — people who sound like themselves

### What it does
Staff, regulars, suppliers, factions, and notable townsfolk each carry a small, fixed **voice profile**: how terse or wordy they are, how warm or cold, how formal or casual, how plain or flowery — sometimes with a verbal tic. These traits are generated once and stay with the character.

### Why it matters
Consistent voice is what makes characters feel like *individuals* rather than interchangeable text. It's a big part of turning a management sim into a place with a cast.

### Why it is technically interesting
The traits are deliberately **bounded** (a small set of possibilities, stored as plain data), which keeps the writing manageable while still producing distinct personalities. Most strikingly, there's a dedicated quality check — a "cross-situation" gate — that verifies a given character *sounds recognisably the same across every different kind of card they appear in.* Enforcing personality consistency automatically, across unrelated parts of the game, is unusually thoughtful.

### Example in gameplay
Your gruff, blunt cleaner says "Floor's done. Leaving." in one card and is equally curt when complaining about a mess in another — and the game has actually *checked* that they don't suddenly turn eloquent just because a different card type is doing the talking.

---

## 9. The quality "gates" — robots that proofread the writing

### What it does
Before any card type ships, it must pass a battery of about a dozen automated **gates**. Each checks one dimension of quality: that every slot has a safe fallback line (coverage); that there's both a generic and more specific option (specificity); that lines stay within word budgets and avoid awkward trailing dots (voice bounds); that "fact-stating" lines match the simulation (coherence); that the same situation always renders the same card (determinism); that a pool of lines actually produces variety across many situations (diversity); that no two lines are near-duplicates (dedupe); that the previews of what each choice does are varied and clear (preview variety and legibility); that two choices never render to the same button text (choice distinctness); and that the most important fact is actually named rather than buried (legibility).

### Why it matters
This is the project's defence against the slow rot that creeps into any writing-heavy game: repetitive lines, choices that look identical, text that drifts away from what's actually happening. The gates catch all of that automatically.

### Why it is technically interesting
Writing software that can *judge writing* — and judge it well enough to catch real problems without flagging good text — is genuinely hard. The fact that there are around a dozen distinct gates, each targeting a specific failure mode the project actually ran into during playtests, shows this grew from real experience, not theory.

### Example in gameplay
The reason you never see a card with three identical "Reputation goes up a bit" preview lines, or two choices both labelled "Cut the deal," is that a gate would refuse to let that card ship in the first place.

---

## 10. The deliberate "inside-out" build order

### What it does
This isn't a single file — it's the overarching strategy visible across the whole project: build the deep simulation *first*, prove it works, and only then grow the cards and screens out of what the simulation already tracks.

### Why it matters
It's the answer to the obvious question — "why isn't there a flashy game to show yet?" The order is intentional. By tracking real pressures, histories, and relationships first, every future card and choice can be grounded in something the world genuinely understands, so player decisions carry real weight.

### Why it is technically interesting
Most games are built the opposite way and pay for it later, when the visible content and the underlying logic don't line up. Committing to the harder, less immediately rewarding order — and sticking to it across more than a hundred documented stages of work — takes both discipline and a clear vision. The supporting infrastructure (the "signals" question-desk, the issue-seed hand-off, the gates) exists precisely so that the cards can later be added *cleanly* on top of a solid foundation.

### Example in gameplay
When the card writing eventually fills out, a player won't get generic filler. They'll get a "the miners' guild is unhappy with you" card *because* the simulation has actually been tracking that faction's souring mood for weeks — so the moment lands with real history behind it.

---

## A note on what ties these together

Read together, these systems point at one ambition: a small tavern that behaves like a **living, remembering, self-explaining place**, and a writing layer that's structurally forbidden from lying about it. The pressures give it slow-building tension, the memories and causes give it continuity and honesty, the issue seeds turn its state into situations, and the composed cards with their voice profiles and quality gates turn those situations into writing that feels specific and consistent. None of these is flashy on its own — but together they're the hard, invisible machinery that makes a game world feel alive.
