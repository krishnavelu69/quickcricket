# QuickCricket v13 — Order requests

## Install
Export local business drafts as usual. Stop the old server with Ctrl+C. Extract this ZIP into a new folder. Open cmd in the extracted folder containing index.html, then run:

npx http-server -p 8009 -c-1

Close all QuickCricket tabs and reopen http://localhost:8009. The footer must say v13 · Order requests. Keep the same browser/address; do not clear site data. If EADDRINUSE appears, stop the old server using port 8009 first.

## Supabase setup — once
Migrations 001, 002 and 003 have already succeeded. Do not rerun them.
Open database/004-order-requests.sql in Notepad. Copy the entire CONTENTS into a NEW Supabase SQL Editor query and click Run once. Success with no rows returned is normal. If it errors, retain the exact error; do not delete tables or rerun earlier migrations.

## Test with your two accounts
1. Shop owner: publish an Active product with at least 2 units in stock. Note its stock quantity.
2. Sign in with your second customer account under Live Sports. Sports Shop → Request product. Request 1 unit and enter test name/contact details. These details are shared with the shop.
3. Sports Shop → My requests: confirm Pending. Refresh; it should remain visible.
4. Sign in as owner. Business Workspace → Incoming order requests → Refresh. Accept the request. Inventory stock should decrease by exactly 1. Refresh to confirm it persists.
5. Sign in as customer. My requests → Refresh: confirm Accepted. It is not marked paid or delivered.
6. Submit a separate request and reject it as owner; stock must stay unchanged. Submit another and cancel it as customer while Pending; stock must stay unchanged.
7. Another unrelated account must not see either participant's requests. Before public launch, verify direct API access is also blocked, not just the UI.

## Behavior and limits
Customers must sign in to submit requests. A shop owner cannot order from their own shop. Pending requests do not reserve stock. The server checks current availability and price on creation, captures that price, and locks stock during acceptance. Repeated acceptance does not deduct twice. Requests can only move from Pending to Accepted, Rejected or Cancelled. Accepted requests cannot be cancelled or refunded in this release. Payment, fulfillment and delivery workflows are not implemented.

Customer name, contact and notes are private to the customer and receiving shop. Table writes are blocked for app clients; authenticated RPC functions validate the caller and make transitions. Row-level security restricts reads. Lists show the latest 200 requests; use Refresh for updates. If sending fails, retry with unchanged details to reuse the same request reference. Check My requests before closing the form and starting a new request after an uncertain response.

Local checks: 15 model tests passed, JavaScript syntax checked, HTML IDs checked for uniqueness. The SQL migration and browser end-to-end flow have not been run against your live Supabase project. Complete the account/stock tests above before real orders.

This remains a local pilot. Public hosting, shared environment configuration, production access testing, moderation and payment integration remain future work. Existing live scoring and local draft modules are retained.
