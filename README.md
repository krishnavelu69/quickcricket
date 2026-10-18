# QuickCricket v16 — Player scoring: stage 1

No new SQL migration. Upload the contents of this folder to the existing GitHub repository root and Commit changes. Wait for Pages deployment. Confirm v16 · Player scoring on the public site. Use this build on scorer and spectator devices; older builds do not support player statistics. Back up any important current match before starting a new one.

## Quick test
Live Sports → New match. Choose 2 overs and 3 players per side. Enter three distinct player names for each side, one per line. First team bats first. Start match, choose striker, non-striker and bowler, and Confirm players.
- Score 1: striker should swap and the original striker gets 1 run / 1 ball.
- Score Wide with 0 additional runs: team and bowler gain 1, but ball count and strike stay unchanged.
- Score 4: current striker gets a boundary and 4 runs. Undo: runs, strike and player statistics restore.
- Complete six legal balls: strike changes and a different bowler must be chosen.
- Refresh: names, score and individual figures must remain.
- Open Full batting and bowling scorecards to inspect both innings.
- Save match to cloud, publish and check the spectator link on a phone. Player figures travel in the existing match data; no schema migration is needed. Confirm they update live.

Existing saved matches remain total-only. Start a NEW match to record named players; we cannot reconstruct individual attribution for older deliveries.

## Included and limitations
Named playing sides (2–15 players), opening/incoming batter selection, over-boundary bowler selection, automatic strike rotation, batting runs/balls/boundaries, bowling overs/runs/wickets and extras breakdown. Wickets support bowled, caught, LBW, stumped, hit wicket and striker/non-striker run-outs only on a LEGAL ZERO-RUN delivery. No-ball bat runs are supported. No-ball byes, dismissals on illegal balls, wickets with completed runs, free-hit restrictions, penalty runs, retirements, substitutions, captain/wicketkeeper roles, toss and reusable team profiles are future scorer stages. This is a pilot, not complete rules support. Use normal over-end bowler changes; injury replacements mid-over are not implemented. Undo restores the last scoring event; manual innings endings do not have their own separate undo event yet.

The Retry connection button now hides after successful connection. Profile and merchant features remain in the package but are paused while scorer development continues.

## Checks
29 tests passed across the existing suite and new player-scoring tests, including the actual app's automatic innings change and undo restoration. JavaScript syntax, HTML IDs and script files checked. Browser executable unavailable in this environment: live browser, offline restore and spectator synchronization still require user validation. No live Supabase data was changed by the assistant.

---
Previous v15 instructions:

# QuickCricket v15 — Profiles & photos

## Install this release
1. Open database/005-profiles-photos.sql in Notepad. Copy its CONTENTS into a NEW Supabase SQL Editor query. Run ONCE, after migrations 001–004. Do not rerun any migration that already succeeded. This migration creates the photo bucket and access policies as well as profile fields. No separate bucket setup is needed.
2. Extract this ZIP into a new folder. Upload the CONTENTS of the app folder to your GitHub quickcricket repository root and Commit changes. Wait for the latest Pages deployment to turn green.
3. Open your public site on phone and laptop. Confirm v15 · Profiles & photos. Local development remains on localhost:8009 if needed; use the public site to test across devices.

## What to test
- Home → My profile / Community: enter your name, area/district, sports and bio. Choose a profile photo and cover. Save, then refresh and confirm they persist.
- Profiles stay out of the public directory until you tick Show my profile. With that option enabled, confirm another account sees it. Untick it and save to remove the listing. Another user must not be able to edit your record, including through direct API requests.
- Business Workspace → Online business profiles → Edit business: add a description, logo and cover. Save and refresh to confirm. Your existing profiles are retained.
- My online products → Edit product: choose a photo, save, and check it in Sports Shop. Only active published products appear. Expand About shop to see business description/cover. Existing order requests continue to work.
- Try a non-image and a photo over 5 MB: uploads must be rejected. Test owner access with a second account before real customers use uploads.

## Photo behavior
JPEG, PNG and WebP inputs up to 5 MB are supported. HEIC and video are not supported in this release. On iPhone, export an unsupported HEIC photo as JPEG. Images are resized to at most 1600 pixels on the longest edge and re-encoded as JPEG before uploading; transparency becomes white and embedded metadata is not copied.

The image bucket is PUBLIC: uploaded images can be opened by anyone who has their URL, even when a personal profile or product is unpublished. The UI explains this before upload. Do not upload private documents. Removing an image from a profile/product hides its reference but does not erase the stored file. Replacements and failed saves can leave unused files; owner file deletion and automatic cleanup remain future work. Storage quotas/bandwidth must be monitored before launch.

Personal profiles have owner-only writes and optional public reads. Merchant private contacts remain excluded from the public catalog. Photo uploads/deletion are restricted to the signed-in user's folder. No service-role or secret keys are shipped. This release requires live RLS/storage tests in your Supabase project; no live migration or upload was performed by the assistant.

## Verification performed
20 local tests passed (including file limits, path validation, resize/re-encode flow, mobile configuration, orders and existing models). All JavaScript passed syntax checks, HTML IDs are unique and script targets exist. Browser automation could not run because its browser executable is unavailable; phone layout and full upload flow still need the tests above.

## Next milestones
Team profiles, captain/member permissions and invitations; promotional video uploads; then stories/reels and live video with paid viewing. Rankings remain planned at community/district/country scope, with rules undecided. These features are not included in v15. Current goal: integrated beta by 31 October 2026 and public launch in late November or December, subject to validation.

