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

