CREATE TABLE `tournament_events` (
  `id` TEXT PRIMARY KEY NOT NULL,
  `slug` TEXT NOT NULL UNIQUE,
  `game_slug` TEXT NOT NULL,
  `name` TEXT NOT NULL,
  `event_date` TEXT NOT NULL,
  `organizer` TEXT,
  `region` TEXT,
  `format` TEXT,
  `player_count` INTEGER,
  `published_decklist_count` INTEGER NOT NULL DEFAULT 0,
  `source_name` TEXT NOT NULL,
  `source_url` TEXT NOT NULL,
  `created_at` TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE INDEX `tournament_event_date` ON `tournament_events` (`event_date`);
--> statement-breakpoint
CREATE TABLE `tournament_finishes` (
  `id` TEXT PRIMARY KEY NOT NULL,
  `event_id` TEXT NOT NULL REFERENCES `tournament_events`(`id`),
  `place` INTEGER NOT NULL,
  `player_name` TEXT NOT NULL,
  `leader_code` TEXT,
  `archetype` TEXT,
  `deck_source_url` TEXT NOT NULL,
  `source_name` TEXT NOT NULL,
  `list_status` TEXT NOT NULL DEFAULT 'PENDING',
  `list_verified_at` TEXT,
  `created_at` TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (`event_id`, `place`),
  UNIQUE (`event_id`, `deck_source_url`)
);
--> statement-breakpoint
CREATE INDEX `tournament_finish_leader` ON `tournament_finishes` (`leader_code`, `event_id`, `place`);
--> statement-breakpoint
CREATE TABLE `tournament_deck_cards` (
  `finish_id` TEXT NOT NULL REFERENCES `tournament_finishes`(`id`),
  `card_code` TEXT NOT NULL,
  `quantity` INTEGER NOT NULL CHECK (`quantity` BETWEEN 1 AND 4),
  `created_at` TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`finish_id`, `card_code`)
);
--> statement-breakpoint
CREATE INDEX `tournament_deck_card_code` ON `tournament_deck_cards` (`card_code`);
--> statement-breakpoint
CREATE TABLE `tournament_matches` (
  `id` TEXT PRIMARY KEY NOT NULL,
  `event_id` TEXT NOT NULL REFERENCES `tournament_events`(`id`),
  `round` TEXT,
  `player_finish_id` TEXT NOT NULL REFERENCES `tournament_finishes`(`id`),
  `opponent_finish_id` TEXT NOT NULL REFERENCES `tournament_finishes`(`id`),
  `winner_finish_id` TEXT REFERENCES `tournament_finishes`(`id`),
  `source_name` TEXT NOT NULL,
  `source_url` TEXT NOT NULL,
  `verification_status` TEXT NOT NULL DEFAULT 'PENDING',
  `created_at` TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE INDEX `tournament_match_pair` ON `tournament_matches` (`player_finish_id`, `opponent_finish_id`);
--> statement-breakpoint
CREATE INDEX `tournament_match_event` ON `tournament_matches` (`event_id`, `round`);
--> statement-breakpoint
INSERT INTO `tournament_events` (`id`,`slug`,`game_slug`,`name`,`event_date`,`organizer`,`region`,`format`,`player_count`,`published_decklist_count`,`source_name`,`source_url`) VALUES
('sangsang-mexico-2026','sangsang-mexico-regionals-2026','onepiece','2026 SangSang Event''s Mexico Regionals','2026-09-22','SangSang Event','Mexico','Regional',1024,16,'OnePieceDB','https://onepiecedb.io/tournaments/2026%2BSangSang%2BEvent%27s%2BMexico%2BRegionals/2026-09-22');
--> statement-breakpoint
INSERT INTO `tournament_finishes` (`id`,`event_id`,`place`,`player_name`,`leader_code`,`archetype`,`deck_source_url`,`source_name`) VALUES
('sang-2026-01','sangsang-mexico-2026',1,'Canepis','OP14-020','Green Dracule Mihawk','https://onepiecedb.io/deck/dracule-mihawk-by-canepis-2775','OnePieceDB'),
('sang-2026-02','sangsang-mexico-2026',2,'Eduardo De La O','ST30-001','Red/Green Luffy & Ace','https://onepiecedb.io/deck/luffy-ace-by-eduardo-de-la-o-2776','OnePieceDB'),
('sang-2026-03','sangsang-mexico-2026',3,'Soto','OP09-062','Purple/Yellow Nico Robin','https://onepiecedb.io/deck/nico-robin-by-soto-2777','OnePieceDB'),
('sang-2026-04','sangsang-mexico-2026',4,'Hebi','OP16-001','Red Portgas.D.Ace','https://onepiecedb.io/deck/portgasdace-by-hebi-2778','OnePieceDB'),
('sang-2026-05','sangsang-mexico-2026',5,'JoymemeX','OP17-039','Blue Rocks.D.Xebec','https://onepiecedb.io/deck/rocksdxebec-by-joymemex-2779','OnePieceDB'),
('sang-2026-06','sangsang-mexico-2026',6,'Gilbert','OP11-041','Blue/Yellow Nami','https://onepiecedb.io/deck/nami-by-gilbert-2780','OnePieceDB'),
('sang-2026-07','sangsang-mexico-2026',7,'Ramon','OP13-004','Red/Black Sabo','https://onepiecedb.io/deck/sabo-by-ramon-2781','OnePieceDB'),
('sang-2026-08','sangsang-mexico-2026',8,'Haru Urara','OP09-062','Purple/Yellow Nico Robin','https://onepiecedb.io/deck/nico-robin-by-haru-urara-2782','OnePieceDB'),
('sang-2026-09','sangsang-mexico-2026',9,'Kaido','OP15-058','Purple Enel','https://onepiecedb.io/deck/enel-by-kaido-2783','OnePieceDB'),
('sang-2026-10','sangsang-mexico-2026',10,'Siiu','OP17-039','Blue Rocks.D.Xebec','https://onepiecedb.io/deck/rocksdxebec-by-siiu-2784','OnePieceDB'),
('sang-2026-11','sangsang-mexico-2026',11,'Powder','OP14-020','Green Dracule Mihawk','https://onepiecedb.io/deck/dracule-mihawk-by-powder-2785','OnePieceDB'),
('sang-2026-12','sangsang-mexico-2026',12,'Vaterrie','ST30-001','Red/Green Luffy & Ace','https://onepiecedb.io/deck/luffy-ace-by-vaterrie-2786','OnePieceDB'),
('sang-2026-13','sangsang-mexico-2026',13,'Emmanuel H','OP14-020','Green Dracule Mihawk','https://onepiecedb.io/deck/dracule-mihawk-by-emmanuel-h-2787','OnePieceDB'),
('sang-2026-14','sangsang-mexico-2026',14,'Krs Raezz','OP14-020','Green Dracule Mihawk','https://onepiecedb.io/deck/dracule-mihawk-by-krs-raezz-2788','OnePieceDB'),
('sang-2026-15','sangsang-mexico-2026',15,'Buggy D. Clown',NULL,'Purple Kaido','https://onepiecedb.io/deck/kaido-by-buggy-d-clown-2789','OnePieceDB'),
('sang-2026-16','sangsang-mexico-2026',16,'Derikojeda','OP09-062','Purple/Yellow Nico Robin','https://onepiecedb.io/deck/nico-robin-by-derikojeda-2790','OnePieceDB');
--> statement-breakpoint
UPDATE `tournament_finishes` SET `leader_code`='OP17-058' WHERE `id`='sang-2026-15';
--> statement-breakpoint
CREATE TRIGGER `verified_tournament_deck_has_50_cards`
BEFORE UPDATE OF `list_status` ON `tournament_finishes`
WHEN NEW.`list_status`='VERIFIED' AND (SELECT COALESCE(SUM(`quantity`),0) FROM `tournament_deck_cards` WHERE `finish_id`=NEW.`id`) != 50
BEGIN SELECT RAISE(ABORT, 'A verified tournament deck must have exactly 50 main-deck cards.'); END;
--> statement-breakpoint
CREATE TRIGGER `verified_tournament_deck_cards_immutable_insert`
BEFORE INSERT ON `tournament_deck_cards`
WHEN (SELECT `list_status` FROM `tournament_finishes` WHERE `id`=NEW.`finish_id`)='VERIFIED'
BEGIN SELECT RAISE(ABORT, 'Downgrade verification before changing a verified tournament deck.'); END;
--> statement-breakpoint
CREATE TRIGGER `verified_tournament_deck_cards_immutable_update`
BEFORE UPDATE ON `tournament_deck_cards`
WHEN (SELECT `list_status` FROM `tournament_finishes` WHERE `id`=OLD.`finish_id`)='VERIFIED'
BEGIN SELECT RAISE(ABORT, 'Downgrade verification before changing a verified tournament deck.'); END;
--> statement-breakpoint
CREATE TRIGGER `verified_tournament_deck_cards_immutable_delete`
BEFORE DELETE ON `tournament_deck_cards`
WHEN (SELECT `list_status` FROM `tournament_finishes` WHERE `id`=OLD.`finish_id`)='VERIFIED'
BEGIN SELECT RAISE(ABORT, 'Downgrade verification before changing a verified tournament deck.'); END;
--> statement-breakpoint
INSERT INTO `tournament_deck_cards` (`finish_id`,`card_code`,`quantity`) VALUES
('sang-2026-01','OP07-022',4),('sang-2026-01','OP12-034',4),('sang-2026-01','ST32-001',4),('sang-2026-01','OP06-033',3),('sang-2026-01','OP12-023',4),('sang-2026-01','OP17-031',4),('sang-2026-01','ST32-002',4),('sang-2026-01','OP13-031',4),('sang-2026-01','OP17-022',3),('sang-2026-01','ST24-004',1),('sang-2026-01','OP01-055',2),('sang-2026-01','OP06-038',3),('sang-2026-01','OP14-038',4),('sang-2026-01','OP08-036',3),('sang-2026-01','OP14-039',3),
('sang-2026-02','EB02-017',4),('sang-2026-02','EB04-002',4),('sang-2026-02','OP01-016',4),('sang-2026-02','OP12-015',4),('sang-2026-02','ST30-012',4),('sang-2026-02','ST21-014',4),('sang-2026-02','ST31-001',4),('sang-2026-02','OP04-016',4),('sang-2026-02','OP12-018',2),('sang-2026-02','OP12-037',2),('sang-2026-02','OP13-040',2),('sang-2026-02','OP14-019',4),('sang-2026-02','OP17-017',3),('sang-2026-02','OP06-017',1),('sang-2026-02','ST31-005',4),
('sang-2026-03','ST34-003',3),('sang-2026-03','OP17-113',3),('sang-2026-03','OP17-074',4),('sang-2026-03','OP17-107',4),('sang-2026-03','OP17-109',4),('sang-2026-03','OP17-111',2),('sang-2026-03','OP05-073',2),('sang-2026-03','OP12-112',3),('sang-2026-03','OP17-102',4),('sang-2026-03','EB04-058',2),('sang-2026-03','OP17-106',4),('sang-2026-03','OP17-114',4),('sang-2026-03','OP16-119',4),('sang-2026-03','OP17-112',4),('sang-2026-03','OP09-078',3),
('sang-2026-04','OP13-016',4),('sang-2026-04','OP17-016',2),('sang-2026-04','OP16-015',4),('sang-2026-04','OP16-017',4),('sang-2026-04','OP16-118',2),('sang-2026-04','OP16-011',4),('sang-2026-04','OP16-014',4),('sang-2026-04','ST23-001',2),('sang-2026-04','OP16-004',4),('sang-2026-04','OP17-006',4),('sang-2026-04','OP16-003',4),('sang-2026-04','OP17-005',4),('sang-2026-04','OP04-016',2),('sang-2026-04','OP17-017',2),('sang-2026-04','OP16-021',4),
('sang-2026-05','OP08-051',2),('sang-2026-05','OP17-050',3),('sang-2026-05','OP17-045',4),('sang-2026-05','OP17-054',4),('sang-2026-05','OP17-044',3),('sang-2026-05','OP17-041',4),('sang-2026-05','OP17-046',4),('sang-2026-05','OP17-049',4),('sang-2026-05','OP17-040',4),('sang-2026-05','OP17-048',4),('sang-2026-05','OP17-118',4),('sang-2026-05','OP17-055',4),('sang-2026-05','OP17-056',4),('sang-2026-05','EB02-030',2),
('sang-2026-06','OP14-102',3),('sang-2026-06','OP11-106',2),('sang-2026-06','OP17-109',3),('sang-2026-06','OP06-104',3),('sang-2026-06','OP15-113',1),('sang-2026-06','OP12-112',4),('sang-2026-06','OP14-110',2),('sang-2026-06','OP16-056',3),('sang-2026-06','OP14-111',2),('sang-2026-06','ST29-009',2),('sang-2026-06','OP15-119',1),('sang-2026-06','EB04-058',4),('sang-2026-06','EB03-053',4),('sang-2026-06','OP11-054',1),('sang-2026-06','EB03-024',4),('sang-2026-06','EB03-055',4),('sang-2026-06','OP14-104',3),('sang-2026-06','EB04-061',3),('sang-2026-06','OP06-058',1),
('sang-2026-07','OP01-016',2),('sang-2026-07','OP17-084',3),('sang-2026-07','OP17-086',3),('sang-2026-07','OP17-080',4),('sang-2026-07','OP17-082',3),('sang-2026-07','OP17-083',2),('sang-2026-07','OP17-087',3),('sang-2026-07','OP17-095',4),('sang-2026-07','ST01-011',4),('sang-2026-07','OP17-089',4),('sang-2026-07','OP15-088',4),('sang-2026-07','OP17-119',4),('sang-2026-07','OP17-093',4),('sang-2026-07','OP04-016',2),('sang-2026-07','OP17-096',3),('sang-2026-07','OP17-098',1),
('sang-2026-08','OP17-113',4),('sang-2026-08','ST34-003',2),('sang-2026-08','OP17-074',4),('sang-2026-08','OP17-107',4),('sang-2026-08','OP17-109',4),('sang-2026-08','OP05-073',2),('sang-2026-08','OP12-112',2),('sang-2026-08','OP17-102',4),('sang-2026-08','EB04-058',2),('sang-2026-08','OP17-106',4),('sang-2026-08','OP17-114',4),('sang-2026-08','OP17-110',2),('sang-2026-08','OP16-119',4),('sang-2026-08','OP17-112',4),('sang-2026-08','OP09-078',4),
('sang-2026-12','EB02-017',4),('sang-2026-12','EB04-002',4),('sang-2026-12','OP01-016',4),('sang-2026-12','OP12-015',4),('sang-2026-12','ST30-012',4),('sang-2026-12','ST21-014',4),('sang-2026-12','ST31-001',4),('sang-2026-12','OP15-032',1),('sang-2026-12','OP04-016',4),('sang-2026-12','OP12-037',3),('sang-2026-12','OP13-040',3),('sang-2026-12','OP14-019',2),('sang-2026-12','OP17-017',4),('sang-2026-12','OP06-018',1),('sang-2026-12','ST31-005',4),
('sang-2026-16','OP11-070',1),('sang-2026-16','OP17-113',4),('sang-2026-16','ST34-003',1),('sang-2026-16','OP17-074',4),('sang-2026-16','OP17-107',4),('sang-2026-16','OP17-109',4),('sang-2026-16','OP17-111',1),('sang-2026-16','OP05-073',2),('sang-2026-16','OP17-102',4),('sang-2026-16','EB04-058',3),('sang-2026-16','OP17-106',4),('sang-2026-16','OP17-114',4),('sang-2026-16','OP17-110',1),('sang-2026-16','OP16-119',4),('sang-2026-16','OP17-112',4),('sang-2026-16','OP09-078',4),('sang-2026-16','OP07-076',1);
--> statement-breakpoint
UPDATE `tournament_finishes` SET `list_status`='VERIFIED',`list_verified_at`=CURRENT_TIMESTAMP WHERE `id` IN ('sang-2026-01','sang-2026-02','sang-2026-03','sang-2026-04','sang-2026-05','sang-2026-06','sang-2026-07','sang-2026-08','sang-2026-12','sang-2026-16');
