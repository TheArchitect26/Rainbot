# Street runner, rank rewards and challenge progression

## Original editable runner

Street Spark is a free, original cartoon streetwear runner: rounded head, warm editable skin tones, swept/curl hair or cap, expressive eyes, and sneakers. It uses the existing animation rig, camera, collision dimensions and power-up effects; the older robot and every saved robot palette remain selectable. It is inspired by the reference's playful cartoon appeal rather than reproducing its character design.

The studio can save eight custom designs with a tee, hoodie or jacket; shorts or joggers; quiff, curls or cap; skin/hair/shoe colors; suit/trim/glow colors; and the existing material finishes. All clothes and appearances are cosmetic. Geometry/materials are created once and reused when switching designs. No imported image, per-frame mesh construction or second gameplay system is needed.

The named Night Shift (rank level 4), Varsity Ace (8) and Apex Runner (30) outfits join the existing rank reward collection, with earned headphones, a star badge and a laurel respectively. Those accessories become selectable for custom street runners at the corresponding ranks. They cannot be coin-purchased. Older saves automatically receive cosmetics for rank levels already earned, without replaying coin rewards or resetting progress. Basic custom clothing is free; rank accessories provide a visible earned reward even when players reproduce similar palettes. Nothing alters gameplay stats.

## Twelve run challenge levels

Player XP rank earns cosmetics. Run challenge level describes the hazards currently encountered; it advances every 150m, independently of player rank. Everyone starts each run at challenge 1, preserving a fair daily course. At 1650m the run reaches level 12 and continues at maximum difficulty. It does not award an automatic clear or promise an unbeatable final boss.

| Challenge | Starts | Base speed (m/s) | Skill focus |
| --- | ---: | ---: | --- |
| 1 First Steps | 0m | 18 | Barriers plus compulsory jump/slide gates |
| 2 Lane Artist | 150m | 19.5 | Adjacent safe-lane slaloms |
| 3 Air Time | 300m | 21 | Full-width low gates: jump |
| 4 Under the Feed | 450m | 22.5 | Full-width overhead gates: slide |
| 5 Drone District | 600m | 24 | Moving hazards |
| 6 Switch Rhythm | 750m | 25.5 | Alternating jump/slide gates |
| 7 Cross Traffic | 900m | 27 | Faster mixed sequences and route choices |
| 8 Pressure Test | 1050m | 28.5 | Boss pressure and mixed movement |
| 9 Signal Storm | 1200m | 30 | Warning interpretation |
| 10 Overclock | 1350m | 32 | Timing plus lane precision |
| 11 Last Firewall | 1500m | 34 | Full hazard repertoire |
| 12 Algorithm Breaker | 1650m | 36 | Maximum-speed mixed survival |

A seeded compulsory jump or slide gate appears every third normal encounter from the first tier. Other skills are introduced progressively and mixed using the seeded generator; later levels reuse and recombine them rather than adding twelve separate control schemes. The compact HUD shows the current challenge; boss warnings take priority over stage and chaos messages. Boss waves mix jump and slide gates with solid walls while retaining an open lane. Existing powers, four visual zones, chaos events, missions and telegraphed bosses remain.

Full-width gates require an action rather than a safe lane. Mixed rows never fill all lanes with full walls; slaloms preserve an adjacent open lane, and drones do not share a row with a forced corridor. Compound gates reserve at least 1.25 seconds (covering a low-gravity jump and recovery) at the forecast stacked boost/turbo speed across tier boundaries, including recovery after a gate. Power-ups accompany hazards rather than replacing them with empty road. Speed boost increases speed but does not grant immunity; a shield absorbs one hit. Rules version is `challenge-4`, keeping rankings separate from the easier previous course. WEAVE adds a three-row adjacent-lane route; GAUNTLET chains jump, route choice and slide with recovery between rows. Moving-barrier drift is bounded within each authored lane so an open lane remains clear. Boss hazards retain their two-second collision lead across speed tiers, clear old hazards, and always leave a normal-play section after victory to prevent high-speed back-to-back boss fights.

## What still needs playtesting

Automated pattern/seed/projection tests establish mechanical bounds, not enjoyable balance. Test every tier on an actual phone, including airborne low-gravity transitions, boost expiry, reversed controls, boss handover and a sustained max-tier run. Speed and pressure are deliberately capped; avoid making rank punish returning players by raising their starting difficulty. The global leaderboard remains casual and requires deployment; see [LEADERBOARD.md](LEADERBOARD.md).
