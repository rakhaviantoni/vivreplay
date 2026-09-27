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
