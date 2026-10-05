-- Put inline game labels on their own lines so the match recap can render each
-- game as a separate section throughout the tournament feed.
UPDATE `tournament_match_summaries`
SET `summary` = replace(
  replace(
    replace(`summary`, ' Game 1:', char(10) || char(10) || 'Game 1:'),
    ' Game 2:', char(10) || char(10) || 'Game 2:'
  ),
  ' Game 3:', char(10) || char(10) || 'Game 3:'
)
WHERE `summary` LIKE '% Game 1:%'
   OR `summary` LIKE '% Game 2:%'
   OR `summary` LIKE '% Game 3:%';
--> statement-breakpoint
UPDATE `tournament_match_summaries`
SET `summary` = replace(
  `summary`,
  'The recap covers one featured game, not the complete match score. ',
  'The recap covers one featured game, not the complete match score.' || char(10) || char(10) || 'Featured game: '
)
WHERE `id` = 'mexico-city-2026-swiss-robin-mirror-sto-julian';
