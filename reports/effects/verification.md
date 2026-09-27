# Effect verification — 27 September 2026

## Verified locally

The suite contains 89 passing tests. These are engine-state scenarios, not certification of every card in the catalog.

| Scenario | Evidence |
| --- | --- |
| Shalria searches, trashes the remainder, then requests a hand discard | Engine execution pauses at both selections; newly found cards can be discarded |
| Shalria finds no eligible card or the player chooses none | Remaining inspected cards enter Trash; the hand discard still occurs; an empty hand does not deadlock |
| Boa search eligibility | Luffy or a red Event accepted; unrelated cards rejected |
| Buggy orders the top three | Exact permutation required; subsequent draw follows the chosen order |
| Search chooses two cards | Unselected cards move below untouched deck cards before the next draw |
| Tsuru reduces an opponent Character's cost | Opponent Leader rejected; a 4-cost Character reduced by 2 becomes a legal cost-2 removal target |
| DON!! additions and readying | Active/rested language distinguished; multiple cost-area DON!! can be readied; attached DON!! rejected |
| Hand-trash costs | Wrong zone, type, trait, colour, amount, unknown and duplicate IDs rejected |
| Milling | Top cards move to Trash without a player-selected replacement |
| Adjacent ability timings | Shared On Play/When Attacking body retained; inline Trigger separated from Trigger-card requirements |

TypeScript checking and production build passed. The local `/api/play/rules` endpoint returned HTTP 200 and 2,997 published card rules. Browser smoke testing confirmed the table loads and a hand card can be paid for and played without console errors; it did not verify every effect interaction.

## Board changes

- Search completion uses the shared executor and keeps the command position for a following discard.
- Future draws and searches use the actual deck order.
- Mandatory follow-up discards cannot be declined.
- Targeted On Play cost reduction, removal, return, and rest sequences use the shared executor when every step in that sequence is supported by this board path.
- The tutorial opponent's hand and Character area use different physical card instances.
- Published schemas arriving after board setup are attached without resetting the match.

## Still incomplete

The published rules are unchanged. In the downloaded published snapshot, Boa lacks its search restrictions, Buggy is incorrectly represented as a search, and Shalria has discard before search and lacks the trait restriction. The local corrected candidates are not active database revisions.

Search remainder ordering, all multi-target counts, all optional target choices, custom resolver execution, timing dispatch, replacement effects, and turn/battle duration expiry still need further work and board-level verification. Some board paths still use separate handlers. No catalog-wide gameplay-complete claim is justified.

The current candidate report compares 2,997 cards and identifies 1,313 semantic schema differences across 4,288 parsed timing entries. Parsing now yields PARSED status rather than automatically claiming IMPLEMENTED or TESTED. No database writes or deployment were performed for this verification pass.

## Additional regression pass

96 tests pass after these fixes:

- K.O., opponent-rest, and cost-reduction actions preserve explicit target counts. Up-to choices allow zero, multiple targets are validated before mutation, and all-target actions resolve without choosing a single card.
- The board target chooser supports multiple selections and choosing none for those schemas.
- Battle power and keyword grants expire separately from turn-long grants; turn-end cost modifiers expire on either player's cards. Leaving play clears those modifiers and their expiry records.
- Self-trash is an activation cost, bound to its actual source. A card already in Trash cannot pay it again. Rest-self and DON-return costs are no longer duplicated in the subsequent action list.
- The board's self-trash attachment flow updates the source zone and releases its attached DON!! rested.

These are local changes. Production schemas are unchanged. This pass does not complete replacement effects, all timing windows, or every duration type.

## Independent abilities and discard sequencing

Added engine scenarios for independent abilities at the same timing: declining an optional cost only skips its own ability, and conditions are reevaluated for each independent ability. Discard-before-draw and draw-before-discard now have separate state-transition tests. The board routes supported hand-discard/draw sequences through the shared executor and resumes the saved command after selection. These changes do not implement player-chosen ordering of simultaneous abilities or every conditional clause.

## Life ordering pass

Engine scenarios now verify top/bottom placement, explicit placement choice, source ownership and unknown-ID rejection, attached DON!! release, exact Life reorder permutations, and the identity of the next Life card taken in battle. Life-to-hand and Life-to-Trash clear Life face-up state. Ambiguous add-to-Life actions and source-dependent reorder variants return an explicit unsupported error instead of log-only success.

These Life changes are engine-level. The board still needs a corresponding complete Life selection interface; they are not claimed as browser-verified or deployed.

## Life board integration and effect-play pass

The tutorial now reserves actual deck instances for Life, displays the engine's player Life count, and uses the ordered opponent Life instances for damage. Supported cost-free On Play Life sequences enter the shared target flow, including card ordering and owner/placement choices where specified. These UI paths compile but still require targeted browser scenarios against corrected stored schemas.

Additional engine scenarios cover recovery prompting, unknown IDs, mixed-colour recovery, effect-play summoning restrictions, invalid Event targets, and Stage replacement. The suite has 107 passing tests. Playing beyond the Character limit currently reports that replacement is needed; its replacement chooser remains unfinished. Published rules remain unchanged.
