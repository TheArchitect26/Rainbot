# Replayability review — 20 October 2026

## Verdict

BRAINROT RUN has a credible short-session runner loop. It is worth testing with players; there is no evidence yet that it has sustained retention or will become “addictive.” Code review and automated tests cannot establish that. Aim for voluntary enjoyment, mastery and clear stopping points.

## What supports returning

| Existing feature | Why it could help | Evidence / limitation |
| --- | --- | --- |
| Three lanes, jump and slide | Easy to start, room to improve timing | `GameEngine.ts`; timing and input regression coverage is synthetic, not device usability evidence |
| Escalating zones, powers and bosses | Changes the demands within a run | Stage starts at 0/300/700/1200m; boss begins around 450m, then repeats; endurance alone can still feel repetitive |
| Seeded daily challenge | A repeatable course gives practice a purpose | Generation determinism tested; no social leaderboard or human competition is implemented |
| XP, levels, coin unlocks and daily missions | Gives progress beyond a single high score | Local progression survives reload; pacing has not been validated with players |
| Tutorial and rapid restart | Reduces the cost of learning | Tutorial completion/replay/skip tested; rapid restarts may mean enthusiasm OR repeated unfair deaths |
| Saved skin studio | Gives players authorship and a runner they recognize | Eight free custom palette slots, three finishes, live model preview; cosmetic only, same silhouette and mechanics |
| Offline PWA and Android packaging | Low friction and play without a connection | Browser offline test and Android debug CI; physical device performance still needs testing |

## Biggest risks, in order

1. **Readability and perceived fairness.** A death that seems unavoidable discourages another run. The revised camera uses a higher, relative rig with limited lane following, an 18m look target, fixed horizon through jumps/slides and very small motion. Projection tests check lane visibility 12m ahead, but cannot prove every obstacle is unoccluded at every speed. Test real screens with thumbs, HUD, powers and boss effects visible.
2. **Control reversal and overlapping events.** Reversed controls can feel like the game betraying learned actions, especially around bosses. Keep the warning understandable; observe whether players can explain their death. Consider tuning or removing this event only if playtests show confusion. No event rules changed in this update.
3. **Repetition.** Color changes, score and faster obstacles eventually lose novelty. See whether existing bosses and daily courses already provide enough variety before adding more systems. Authored obstacle patterns with readable decisions may help more than more currencies.
4. **Reward pacing and clarity.** Existing skins cost 100–1200 coins, with separate level milestone unlocks. The closet now explicitly says coins OR a free level unlock. Measure real time-to-first-choice; do not infer balance from prices alone. Custom colors are free and can reproduce curated palettes, so curated skins need recognizable appeal beyond exclusivity. Material finishes help a little; all skins still share a silhouette. Test whether players value the collection before investing in bespoke accessories.
5. **Performance on modest phones.** A hitch near a barrier feels like unfair input. The studio preview is DPR 1, 240×180, capped at 30fps, skips hidden rendering and reuses materials across edits. It releases resources on close. Device thermal and GPU behavior remain unmeasured.
6. **Local-only saves.** Clearing app/browser data or uninstalling can erase progress. The storage fallback keeps a session playable when persistence fails, but cannot promise durable saves. No account or cloud synchronization is present.

## Focused playtest before expanding scope

Recruit 10–20 people unfamiliar with the game, including modest Android devices. Let them start without coaching. Ask them to explain controls, the next obstacle and each death. Observe tutorial completion/skip, first-run duration, voluntary retries and whether they discover/customize a skin. Ask what made them stop. Invite them to play again the next day without pressure and record voluntary returns with consent.

Local diagnostics already help with run counts, death causes, duration, FPS samples, tutorial use and rapid restarts (`src/utils/analytics.ts`). These do not measure player cohorts, daily retention or addiction. FPS is sampled, not a full frame-time trace. Combine diagnostics with observation; do not treat many restarts or long sessions as proof of enjoyment.

A useful next iteration follows evidence: fix repeated unclear deaths first, then tune reward pacing, then consider obstacle variety. Do not add punitive streaks, paid advantages, loot boxes or pressure notifications to manufacture return visits.

## Device checklist for this change

- Open Skins, create a named runner, change all three colors and finish; save, restart the app and confirm it stays equipped.
- Edit and cancel; then edit and save. Delete an equipped custom runner and confirm the default is selected. Existing coin purchases and level unlocks must remain.
- Test the closet at 320px width and short landscape height, keyboard focus, screen reader labels and reduced-motion preference.
- Run each lane through jump, slide, boost and boss phases. Can you identify obstacles early without the character, thumbs or HUD hiding them?
- Test background/resume and a several-minute session on a physical Android device. Report device model, frame drops and unclear deaths.
