# Safe Copy Queue Test Matrix

## Environment
- App: Wrap Preview
- Mode options: `FAST`, `SOLID`
- Queue capacity: `5` checks maximum

## Test 1: Sequential Run (2 pairs, FAST)
1. Open Safe Copy.
2. Add two queue rows (`01`, `02`), set labels, source and destination for both.
3. Set mode to `FAST`.
4. Click `Start Verification`.
5. Validate:
   - Row `01` starts first, then row `02`.
   - Both complete with final statuses (`done`/`failed`/`cancelled` as applicable).
   - Queue summary updates counts.

## Test 2: Cancel Mid-Queue (3 pairs, cancel during pair 2)
1. Add three valid queue rows.
2. Start queue run.
3. When row `02` is running, click `Cancel Queue`.
4. Validate:
   - Running row transitions to `cancelled` (or completes if it races to finish).
   - Remaining pending rows are marked `cancelled`.
   - Queue job reflects cancellation in Jobs panel.

## Test 3: Combined Report Exports
1. Run queue with at least 3 checks and labels.
2. Click `Export Combined Markdown` and `Export Combined PDF`.
3. Validate:
   - Files are generated in selected output directory.
   - Report includes `Check 01..03` sections in index order.
   - Each section shows label, source/destination paths, status and summary counts.
   - Branding footer includes `© Alan Alves. All rights reserved.`

## Test 4: Queue Persistence Across Navigation
1. Create/edit multiple queue rows.
2. Navigate away from Safe Copy to other tabs and return.
3. Validate:
   - Queue rows, labels, source/destination paths remain.
   - Row order remains stable and compact (`01..N`).

## Test 5: No JSON Export in UI
1. Inspect Safe Copy queue row actions and queue-level actions.
2. Validate:
   - Only Markdown and PDF export actions are visible.
   - No JSON export button appears in Safe Copy UI.
