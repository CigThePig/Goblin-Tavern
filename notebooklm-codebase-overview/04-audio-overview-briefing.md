# Audio Overview Briefing

*This document is written specifically to steer NotebookLM's Audio Overview. It tells the hosts what story to tell, what to emphasise, what to avoid, and roughly how to pace the conversation.*

## Intended audience

The creator's parents. They are supportive but are **not** assumed to be programmers. Assume warmth and interest, but no technical background. The goal is to help them genuinely understand — and feel proud of — what their child (Ross) has built, even though there isn't a flashy finished game to look at yet.

## Desired tone

Warm, clear, and conversational, like two thoughtful friends explaining a project they admire. Impressed, but **grounded and honest** — never hyped, never salesy. The hosts should sound like they *get it* and want to help the listener get it too. A little gentle humour about the goblin-tavern premise is welcome; cynicism is not.

## Main story

The one big idea to land:

> **Ross is building a game from the inside out. Most games start with what you see — the art, the buttons, the cards. This one starts with the hidden "brain" that makes the world feel alive. So even though there isn't a polished, finished game to show yet, a huge amount of careful, clever work has already gone into the part you can't see: a tavern that remembers, reacts, builds up problems over time, and can explain itself.**

Everything else in the audio should serve that story. The emotional payoff for the listener is: *"Oh — so the reason it's hard to show off is exactly the reason it's impressive."*

A good, repeatable line for the hosts:

> "A lot of games are built front-to-back: the menus and pictures first, then someone tries to make it all mean something. Ross is doing the opposite — building the living world first, so the visible game can grow out of something real."

## Key points to emphasise

1. **What the game *is*, in plain terms.** You run a scruffy goblin tavern — hiring staff, keeping regulars happy, managing money, handling trouble like health inspections, debt, and rowdy crowds. You play one day at a time, making decisions presented as written "cards."

2. **The "living place" angle.** The tavern *remembers*. Characters hold grudges and loyalties. Problems build quietly in the background — staff burnout, debt, pests, a souring relationship with the landlord — and boil over into situations you have to handle. This is the heart of the appeal.

3. **The "source of truth" principle.** There's a rule running through the whole project: the simulation decides what's true, and the cards can only *reveal* that truth, never invent it. This is even enforced by automatic tests. It's why the world feels coherent.

4. **The scale and discipline of the work.** This is a large, serious project — roughly a hundred thousand lines of game logic, tens of thousands more lines of automated tests, over a hundred planning documents, all organised cleanly into about thirty self-contained systems. It was *planned*, then built against the plan, over many stages. (Don't drown the listener in numbers — pick one or two, like "over a hundred thousand lines" and "hundreds of automated tests," and let them stand for the rest.)

5. **It *is* playable, but plain.** There's a real, clickable web version you can play today — start a tavern, make decisions, watch things change, save your progress. But it's deliberately plain and text-heavy, not a polished, animated product. Be clear about both halves of that.

6. **Why building this way is smart, not slow.** Building the simulation first means the future cards and choices can be grounded in things the world genuinely tracks — so decisions will feel like they matter, instead of feeling disconnected.

7. **The human story.** This is a self-directed creative project of real ambition. It reflects persistence, systems thinking, and imagination. The reason it's hard for Ross to explain out loud is that most of the value lives inside the logic — and that's exactly why it deserves admiration.

## Things to avoid

- **Do not say the game is finished.** It is a strong foundation with a playable but unpolished interface. Frame it as "a serious foundation for a game in progress," never "a finished game."
- **Do not claim it has polished visuals, art, or animation.** It is intentionally plain and text-heavy right now.
- **Do not overhype or use marketing language** ("revolutionary," "groundbreaking," "AAA"). The honesty is what makes it land.
- **Do not drown the audio in jargon or file names.** Translate everything into plain images. If a technical term slips in, immediately rephrase it in everyday language.
- **Do not psychoanalyse the creator.** It's fine to note this is a self-directed, ambitious personal project that's hard to explain verbally. Don't go further than that or speculate about anything personal.
- **Do not pretend every system is fully fleshed out.** Some features (like a gentle onboarding for new players, and richer written content) are designed and partly built but still growing. Be accurate about "built" versus "planned."
- **Do not invent specifics.** Stick to what's in these documents — the premise, the systems, the build order, the honest state of things.

## Plain-language translations the hosts can lean on

- "Simulation engine" → "the hidden brain of the tavern" or "the machinery behind the scenes."
- "Deterministic" → "it behaves exactly the same way every time, so it's reliable and replayable."
- "Pressures" → "slow-building problems that creep up in the background until they boil over."
- "Memory system" → "the tavern actually remembers what's happened and who did what."
- "Causes / attribution" → "the game keeps a paper trail, so it can always explain *why* something changed."
- "Issue seeds" → "the moment the game decides which situation to put in front of you."
- "Composed cards" → "the writing adapts to the situation instead of being one fixed script."
- "Voice profiles" → "each character has a consistent personality and way of talking."
- "Gates / tests" → "automatic proofreaders and inspectors that catch problems before they reach the player."

## Suggested metaphors

- **Building a house from the basement up.** The foundation and wiring go in first; the windows and front door come later. You can't photograph wiring, but you'd never want a house without it.
- **A stage play before the set is built.** The characters, their relationships, and the plot machinery are all working — the painted scenery just hasn't been hung yet.
- **An iceberg.** The small visible tip is the screens and cards; the enormous part underwater is the simulation doing all the real work.

## Suggested audio arc

Aim for a natural, flowing conversation — roughly this shape:

1. **Open with the premise, lightly.** "So Ross is making a game where you run a goblin tavern..." Set the scene: hiring staff, keeping regulars happy, handling trouble. Make it sound fun and human.

2. **Raise the honest puzzle.** "Here's the funny thing — if you asked to *see* it, there isn't a flashy game to look at yet. So what's actually been built?" This sets up the whole story.

3. **Reveal the big idea — building inside-out.** Explain that Ross built the hidden "brain" first, on purpose, before the visuals. Use the house-from-the-basement metaphor.

4. **Bring the world to life with examples.** Spend the warm middle of the conversation here. Talk about the tavern *remembering*, problems building up quietly, characters holding grudges, the game keeping a paper trail so it can explain itself. Use concrete little scenes (the skipped maintenance that becomes a cracked beam; the short-changed regular who turns cold).

5. **Acknowledge the scale and care.** Note that this is a big, disciplined, well-planned body of work — heavily tested, cleanly organised — not a casual experiment. Keep the numbers light.

6. **Be honest about where it stands.** There's a real but plain playable version; the polish and the richer writing are still to come; some features are planned. Frame this constructively — it's exactly where a thoughtful foundation-first project should be at this stage.

7. **Close on the human note.** Land the point that the hardest, most valuable work here is invisible by nature — and that's precisely why it's worth being proud of. The tavern is already alive in the code; the windows and front door are simply still being built.

Keep the ending warm and grounded, not grandiose. The feeling to leave the listener with is quiet pride and genuine understanding — "I finally get what they've been working on, and it's a real achievement."
