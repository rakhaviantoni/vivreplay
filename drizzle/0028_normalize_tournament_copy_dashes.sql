UPDATE `tournament_events`
SET `name` = replace(`name`, '—', '-')
WHERE instr(`name`, '—') > 0;

UPDATE `tournament_match_summaries`
SET `summary` = replace(`summary`, '—', '-')
WHERE instr(`summary`, '—') > 0;
