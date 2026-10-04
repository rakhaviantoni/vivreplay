CREATE TABLE `tournament_match_summaries` (
  `id` TEXT PRIMARY KEY NOT NULL,
  `event_id` TEXT NOT NULL REFERENCES `tournament_events`(`id`),
  `round` TEXT NOT NULL,
  `best_of` INTEGER NOT NULL DEFAULT 1,
  `leader_one_code` TEXT NOT NULL,
  `archetype_one` TEXT NOT NULL,
  `player_one_name` TEXT,
  `leader_two_code` TEXT NOT NULL,
  `archetype_two` TEXT NOT NULL,
  `player_two_name` TEXT,
  `score_one` INTEGER NOT NULL,
  `score_two` INTEGER NOT NULL,
  `winner_leader_code` TEXT NOT NULL,
  `summary` TEXT NOT NULL,
  `source_name` TEXT NOT NULL,
  `source_url` TEXT NOT NULL,
  `evidence_status` TEXT NOT NULL DEFAULT 'SUMMARY_ONLY',
  `created_at` TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE INDEX `tournament_match_summary_pair` ON `tournament_match_summaries` (`leader_one_code`,`leader_two_code`,`event_id`);
--> statement-breakpoint
CREATE INDEX `tournament_match_summary_event` ON `tournament_match_summaries` (`event_id`,`round`);
--> statement-breakpoint
INSERT INTO `tournament_events` (`id`,`slug`,`game_slug`,`name`,`event_date`,`organizer`,`region`,`format`,`player_count`,`published_decklist_count`,`source_name`,`source_url`) VALUES
('dallas-na-finals-2026','dallas-na-championship-finals-season-1-2026','onepiece','2026 North America Championship Finals Season 1 — Dallas','2026-09-19','Play!TCG','North America','OP17 · Championship Finals',NULL,0,'Play!TCG / OnePieceDB','https://en.onepiece-cardgame.com/events/2026/bcgfest26-27/dallas/');
--> statement-breakpoint
INSERT INTO `tournament_match_summaries` (`id`,`event_id`,`round`,`best_of`,`leader_one_code`,`archetype_one`,`leader_two_code`,`archetype_two`,`score_one`,`score_two`,`winner_leader_code`,`summary`,`source_name`,`source_url`,`evidence_status`) VALUES
('dallas-2026-grand-final-mihawk-enel','dallas-na-finals-2026','Grand Final',3,'OP14-020','Green Dracule Mihawk','OP15-058','Purple Enel',2,0,'OP14-020','Green Mihawk wins the best-of-three 2–0. Mihawk develops Perona, Otama, Kin’emon, Oden, Samurai, Law, Yasopp, and the stage while initially withholding attacks on Enel’s leader, denying Enel life cards and event counters. Mihawk clears small Enel bodies including Pudding, Shura, and Satori to prevent board development. At 10 DON, 10-cost Shanks rests Enel’s board and brings a 12k rush threat. With the stage and leader ability, Mihawk applies 15k–17k attacks to Enel’s 10k leader and 6-cost Enel characters, forcing counters or losing key pieces. Oden repeatedly restricts the 6-cost Enel from attacking or blocking. Enel’s Shura, Mamaragan, Lightning Dragon, Gum-Gum Lightning, and 6-cost Enel pushes are answered by Mihawk’s draw, rest effects, removal, Trichiliocosm, and I Never Bother to Remember the Faces of Trash. Game 1 ends after Mihawk starves Enel, uses multiple Shanks, and closes. Game 2 repeats the plan with a stronger Mihawk curve and multiple Shanks; Enel cannot break through the counters and removal. The supplied summary frames the match as evidence of Mihawk’s resource denial, draw, rush threats, and defensive strength.','User-provided browser AI match summary','https://www.youtube.com/watch?v=IoRlCxsn474','SUMMARY_ONLY'),
('dallas-2026-top16-sabo-rocks','dallas-na-finals-2026','Top 16',3,'OP13-004','Red/Black Sabo','OP17-039','Blue Rocks.D.Xebec',1,2,'OP17-039','Red/Black Sabo wins game 1, then Blue Rocks stabilizes and wins games 2 and 3, taking the set 2–1 and advancing to Top 8. Game 1: Sabo goes first and develops Usopp and Nami into Jaguar D. Saul, Loki, and Pirates Docking Six, building a wide board that Loki and the leader turn into 6k–8k attackers and defenders. Rocks gets value from Streusen, Captain John, Linlin, then 10-cost Rocks and Newgate, but the hand becomes awkward and many counters are spent surviving Sabo’s attacks. Sabo closes with an 18k Luffy attack while Rocks has too few counters. Game 2: Sabo misses early Usopp and develops slowly, relying on Pirates Docking Six and Sanji to improve a weak hand. Rocks finds Streusen and curves through Kyo, Linlin, Shiki, Newgate, then 10-cost Rocks. Shiki’s −3000 effects with Linlin and Newgate remove key Sabo threats. A Shiki plus Stussy turn pressures Sabo’s board and Stussy locks down Sabo’s attacks. Without a timely Robin/Loki chain, Sabo concedes. Game 3: Sabo chooses second; Rocks again finds Streusen and develops Linlin and Shiki while Sabo’s curve is awkward. Loki, 8-cost Luffy, and Brook create a midgame push that threatens lethal, but repeated Shiki effects, Linlin counters, and Stussy plays reverse the tempo. Stussy first helps Rocks survive and force game 3, then stops Sabo’s potential lethal in the final turn. Sabo concedes facing multiple large attacks with low life, too few bodies, and insufficient counters.','User-provided match analysis summary','https://www.youtube.com/watch?v=IoRlCxsn474','SUMMARY_ONLY');
