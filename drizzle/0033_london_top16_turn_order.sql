UPDATE `tournament_match_summaries`
SET `summary` = replace(
  `summary`,
  'Game 2:' || char(10) || 'Mihawk slows the pace',
  'Game 2:' || char(10) || 'Mihawk goes first. Mihawk slows the pace'
)
WHERE `id` = 'london-offline-regional-2026-semifinal-rocks-mihawk';
--> statement-breakpoint
UPDATE `tournament_match_summaries`
SET `summary` = replace(
  replace(
    replace(`summary`, 'Game 1:' || char(10) || 'Both players', 'Game 1:' || char(10) || 'Mihawk goes first. Both players'),
    'Game 2:' || char(10) || 'Both starts', 'Game 2:' || char(10) || 'Enel goes first. Both starts'
  ),
  'Game 3:' || char(10) || 'Enel opens', 'Game 3:' || char(10) || 'Mihawk goes first. Enel opens'
)
WHERE `id` = 'london-offline-regional-2026-grand-final-mihawk-enel';
--> statement-breakpoint
INSERT OR IGNORE INTO `tournament_match_summaries`
  (`id`,`event_id`,`round`,`best_of`,`leader_one_code`,`archetype_one`,`player_one_name`,`leader_two_code`,`archetype_two`,`player_two_name`,`score_one`,`score_two`,`winner_leader_code`,`winner_side`,`series_complete`,`score_complete`,`summary`,`source_name`,`source_url`,`evidence_status`)
VALUES
  ('london-offline-regional-2026-top16-rocks-robin','london-offline-regional-2026','Top 16',3,'OP17-039','Blue Rocks.D.Xebec','Pere','OP09-062','Purple/Yellow Nico Robin','Gianluca',2,1,'OP17-039',1,1,1,'Game 1:' || char(10) || 'Robin goes first and develops Yamato into 10-cost Linlin, then finds a second Linlin and builds a board with Smoothie and Perospero triggers. Rocks stabilizes with Shiki and Newgate. A 4-cost Kaido removes a rested Linlin, forcing Robin to redevelop and spend more cards. Rocks builds around Shiki, Newgate, and 10-cost Rocks, then closes through Robin’s defenses to win Game 1.' || char(10) || char(10) || 'Game 2:' || char(10) || 'Rocks goes first. Robin curves Pudding into ramp and multiple 10-cost Linlins, with Sweet 3 Generals and trigger bodies adding pressure. Rocks develops Shiki, Newgate, and 10-cost Rocks but cannot keep pace with Robin’s life gain and large attacks. Gianluca wins Game 2 and ties the match.' || char(10) || char(10) || 'Game 3:' || char(10) || 'Robin goes first. Both players slow down around the clock. Rocks builds Shiki, Newgate, and 10-cost Rocks; Robin answers with Sweet 3 Generals and trigger characters. They reach overtime with life tied. Rocks finishes with more cards left in deck and wins Game 3 on the tournament tiebreak, taking the match 2–1.','User-provided match recap','https://tickets.organizedplay.events/Event/Index/175','VERIFIED');
