# QuickCricket v26 verification

This release implements a working first pass across the requested live-sports areas. It does not certify every competition rule, browser or database configuration.

## Automated checks completed

Run from the extracted folder with Node.js:

```sh
node --test --test-reporter=dot tests/*.test.cjs
```

122 automated JavaScript tests passed. Coverage includes existing marketplace, auth configuration, navigation and scorer tests; retirement/return; timed out; pre-delivery run-out; injury bowler restrictions; penalties; rare dismissals; insights; group tables; stable player IDs; Super Over archiving; scorecard escaping; cloud-write serialization, revision-conflict handling and handover auto-sync suppression.

An application-harness test completes both innings of a 20-over match, refreshing from offline local storage after every over. This is a simulated application test, not a physical-phone/browser rendering test.

## Deployment checks still required

The SQL migration, RLS behaviour and aggregate-statistics query have not been executed against your Supabase project. No database administrator credentials or live authenticated test sessions were available here. The optional SQL verification script checks scorer assignment, lease exclusion, revision rejection, revocation and write grants inside a transaction that rolls back test data. It does not replace the two-account browser checks below.

Run these together after deploying v26 and migration 006:

| Check | Expected result |
| --- | --- |
| Chrome and Safari, fresh launch and refresh | Footer v26; existing sign-in works; current section/match remains open. |
| Two saved teams, three players each | Reload hub on second device; published teams visible publicly, drafts only to owner. |
| Start from saved squads; add date/venue/competition/format | Metadata, playing side and linked player IDs retained on refresh. |
| Score full short match with wides, no-balls, free hit and run-out | Totals, extras, legal balls, batter ends and bowling figures match the scorer's written record. |
| Retire hurt, return at an available slot; retired out; injury bowler change | No extra legal delivery; correct wicket/eligibility handling. Undo/Redo restores state. |
| Add penalty, pause, try scoring, resume | Batting-side extras increase; delivery entry blocked while paused; resume restores scoring. |
| Abandoned/no result, Undo/Redo | Outcome and prior active state restored correctly. |
| Tie then Super Over, print scorecard and restore backup | Regulation and Super Over remain separate; one over/two wickets; final result retained. |
| Earlier correction after crossing innings | Backup first; rollback removes selected and later events; rescore to correct totals. |
| Generate grouped fixtures, record win/tie/no result, add semifinal/final | Group tables use 2/1/0 points; knockout results do not add group points. |
| Link completed match IDs to fixtures, load statistics | Leaderboard reflects linked accessible matches; career totals exclude Super Over runs. |
| Owner assigns scorer using their account UUID | Assigned scorer can load by ID and claim after handover; unrelated account cannot save. |
| Try claim/write from a second device while first holds control | Claim rejected; score not overwritten. |
| Hand over, then score on second device | First device does not automatically reclaim; reload first device before reuse. |
| Revoke assigned scorer during an active match | Further server writes rejected; local edits not silently uploaded. |
| Airplane mode, several balls, refresh, reconnect | Local score retained; sync succeeds only if cloud revision is unchanged. |
| Edit cloud elsewhere while original device is offline | Original device reports conflict; local backup remains available; no silent overwrite. |
| Public spectator on unsigned-in phone | Sees published score and updates; cannot edit or access private drafts. |
| Favourite and enable alerts, score from another device | Inline alert on next poll while app is open; OS notification only if supported/permitted. |
| Team/tournament export and restore | Existing owned documents updated with version checks; copied documents private; player IDs retained. |

Do not clear site storage during testing. Download a match backup before correcting, restoring or switching matches.

## Scope boundaries

Read `START-HERE-v26.txt` for deferred DLS, closed-app push, NRR, automatic bracket advancement, fielding-side penalties, team logos and special player-replacement rules. These are explicit remaining items, not completed launch features.

## Implementation notes

- `sports-core.js`: pure match-administration, insights, Super Over and competition logic.
- `sports-ui.js`: hub, squad setup, profiles, fixtures, favourites and controls.
- `database/006-live-sports.sql`: versioned match writes, private scoring leases, assignments, published sports documents and RLS-respecting career aggregates.
- Existing match JSON stays version 1 with optional additive fields; v25 backups remain readable. Direct database writes from v25 are revoked after migration.
- Database migration uses existing `matches` columns, adds `qc_revision`, and preserves match rows. It changes write permissions intentionally. Its functions handle text or enum `status` through the existing column type.
- Career aggregates use the database's accessible completed match rows. Imported matches saved again as new cloud IDs are separate records; avoid publishing duplicate copies of the same match.

Rules and platform references consulted:

- [ICC Men's T20I playing conditions, October 2026](https://images.icc-cricket.com/image/upload/prd/bsxcho7ufe2pjban0wjp.pdf)
- [Supabase database functions](https://supabase.com/docs/guides/database/functions)
- [Supabase row-level security](https://supabase.com/docs/guides/database/postgres/row-level-security)
