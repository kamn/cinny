---
date: 2026-05-09
topic: threads-support
---

# Visual Threads Support for Cinny

## Problem Frame

Cinny has only partial Matrix thread support today. The send path emits `m.thread` relations and threaded replies render with a `ThreadIndicator` chip, but there is no dedicated thread view, no way to see a thread's full reply chain in context, no signal on the root that replies exist, and no thread-aware unread state. Users coming from Element find threads effectively invisible.

Upstream cinny is mid-migration to an in-house Matrix SDK that does not yet support encryption, which has stalled the maintainer's own thread effort (PR #2492). For a fork that still ships on `matrix-js-sdk`, encryption already works end-to-end — the constraint is to keep new thread code on those same E2EE-honoring paths.

The user-pain framing here is admittedly thin (this is a personal-fork build; the "Element users find threads invisible" claim is observation, not measured demand) — see Outstanding Questions for whether to reframe as personal-utility or evidence the broader claim.

## Requirements

Requirements are tiered: **P0 = ship-blocking**, **P1 = needed for parity but cuttable for v1**, **P2 = polish**.

**[P0] Core thread surface**
- R1. Clicking a thread root, the existing `ThreadIndicator` chip on a threaded reply, the hover-bar `ThreadPlus` button, or the "Reply in Thread" context-menu item all open an Element-style **side drawer** that shows the thread root and its reply chain. Hover-bar/context-menu currently set a reply draft in the room input; this changes — both open the drawer instead. The room timeline remains visible to the drawer's left on desktop.
- R2. The drawer reuses cinny's existing `RoomInput` component, parameterized to post replies with `rel_type: m.thread` against the thread root. Reply, edit, react, redact, upload, and slash-command behavior matches the main timeline.
- R3. **Layout via CSS, not router.** The drawer occupies the right panel and uses width-measured `narrow` state to switch between side-by-side (desktop) and full-screen takeover (narrow viewports), mirroring element-web's `Measured`/`narrow` pattern in `ThreadView`. The drawer is hidden on `ScreenSize.Tablet` to match the existing `MembersDrawer` rule (`Room.tsx:76`); on Tablet the takeover applies. Open-thread state lives in Jotai atoms keyed by room id, not URL — deep-linking is out of scope for v1.
- R4. **Drawer + MembersDrawer are mutually exclusive in the right-panel slot** (one open at a time). Opening the thread drawer closes the members drawer and vice versa, matching element-web's `RightPanelPhases` enum approach.
- R5. Closing the drawer returns the user to their previous scroll position in the room timeline. If the room timeline was in "following" (live-scroll) mode when the drawer opened, it resumes following on close.

**[P0] Thread discovery on the root**
- R6. Thread roots in the main timeline display an **"X replies"** affordance below the root message, modeled on element-web's `ThreadSummary`:
  - Subscribes live to `ThreadEvent.Update` for `thread.length` and `thread.replyToEvent`.
  - Renders nothing when `thread.length === 0` (no "0 replies" placeholder).
  - Last-reply preview: shows the last reply's sender and a content preview; if `lastReply.isDecryptionFailure()`, shows "Unable to decrypt" in place of the preview.
  - Shows an unread indicator derived from `useUnreadNotifications(thread.room, thread.id)`-equivalent (see R12).
  - Clicking opens the drawer.

**[P1] Per-room navigation**
- R7. The room header exposes a **"Threads" button** that opens a per-room **threads list** in the right-panel slot, sorted by most recent activity. Selecting an entry opens that thread in the drawer. The list and the open-thread drawer occupy the same right-panel slot (mutually exclusive with each other and with members).

**[P2] Timeline filter**
- R8. Provide a per-room toggle to **filter thread replies out of the main timeline**, so the room reads as roots + non-threaded messages only. Default: off. (See Outstanding Questions for whether to keep this — it is the only requirement that reduces visibility rather than increases it, and may not trace to the stated user pain.)

**[P0] Encryption integrity (code constraints)**
- R9. **Send path:** all thread sends route through the same `room.sendEvent` / `mx.sendMessage` calls cinny already uses for room messages, including the `room.hasEncryptionStateEvent()` guard at send time (currently checked at `RoomTimeline.tsx:352`). No raw `/send` calls, no parallel transport.
- R10. **Receive path:** the drawer renders events read from `room.getThread(rootId).timelineSet` and listens for the same `MatrixEventEvent.Decrypted` events used by `EncryptedContent.tsx`. Decryption failures render the existing `MessageBadEncryptedContent` / `MessageNotDecryptedContent` components, identical to the room timeline. Late-decryption updates re-render the affected entries.
- R11. **Atom hygiene:** atoms managing thread state may cache **metadata only** — event IDs, timestamps, counts, sender IDs. They must not store rendered message content (`body`, `formattedBody`, decrypted file contents, decrypted attachment URLs) — those are re-derived from the live `MatrixEvent` reference at render time. The existing `IReplyDraft` pattern (`src/app/state/room/roomInputDrafts.ts:46-52`) which stores decrypted `body`/`formattedBody` strings is grandfathered for the room reply-draft case but must NOT be replicated for thread state. The thread-input draft atom either reuses `IReplyDraft` (sharing the room's existing exposure surface, no new leak) or stores only the reply event ID and re-derives content at render. No `atomWithLocalStorage` for any atom that touches thread events.
- R12. **Read receipts and unread state** are thread-scoped. With `threadSupport: true` enabled (R14), the SDK's `sendReadReceipt(event)` automatically dispatches thread-scoped receipts. The drawer triggers `sendReadReceipt` on the latest visible thread reply when the user views/scrolls within it. The room-level `markAsRead` helper (`src/app/utils/notifications.ts`) gains a thread-aware variant that walks `room.getThreads()` and marks `main` plus each thread. The R6 ThreadSummary affordance and an analogous indicator in the threads list (R7) display per-thread unread state via `room.getThreadUnreadNotificationCount(threadId, …)` (mirroring element-web's `useRoomThreadNotifications` hook in `apps/web/src/hooks/room/useRoomThreadNotifications.ts`).
- R13. The encryption rule is a code constraint, not a UX gate. Threads are not gated by room encryption state — they remain available in unencrypted rooms (as today via `m.thread`) and we add no new prompts, warnings, or auto-enable flows.

**[P0] Client SDK config**
- R14. `src/client/initMatrix.ts` passes `threadSupport: true` to `createClient()` (matching element-web's `MatrixClientPeg.ts:299`). This activates `Thread` model emissions, per-thread `EventTimelineSet`s, and thread-scoped read receipts. Enabling this changes timeline-set semantics for the existing main timeline (the SDK splits thread replies into per-thread sets); the existing `RoomTimeline.tsx` rendering code that iterates `getUnfilteredTimelineSet()` must be reviewed in planning for compatibility, and R8's filter implementation depends on this regime.

**[P0] Edge case behavior**
- R15. Edge cases the drawer must handle:
  - Thread root not yet decrypted at drawer open → show pending placeholder consistent with `MessageNotDecryptedContent`; re-render on `MatrixEventEvent.Decrypted`.
  - Thread root redacted while drawer is open → show `[Redacted]` in the drawer header; replies remain viewable; new replies still allowed (server permits, drawer reflects).
  - `thread.length === 0` (root that had replies, all redacted) → drawer shows root + empty-state message; R6 affordance no longer rendered.
  - "Reply in Thread" invoked on an event that is itself a thread reply → use the reply's `threadRootId` as the thread root, not the reply's own event ID. (Avoids attempting to create a thread rooted on a reply, which servers reject.)
  - Notification tap routing through `Notifications.tsx` for an event with `threadRootId` set → open the room and dispatch the drawer to that thread, rather than scrolling the timeline to the reply.
  - Late-joining users whose Megolm sessions don't cover thread events → events render via the same key-request / key-backup pipeline used by the main timeline (no separate suppression).

## Success Criteria

- Receiving a threaded reply in an E2EE room decrypts and renders correctly inside the drawer with no extra setup.
- A user can spot a thread on a root message without opening anything, open it in one click, send a reply, and return to the room without losing scroll position.
- A user can find an older thread via the per-room threads list within a few seconds, even if the root has scrolled far back.
- Cinny used on a phone-sized viewport (PWA) is usable for thread reading and replying; the drawer becomes a takeover, the back affordance closes the takeover before exiting the room.
- A room's unread indicator surfaces threads with unread replies; opening and reading the thread clears its unread state.
- Code review verifies (a) all thread sends go through `room.sendEvent` with `hasEncryptionStateEvent()` guard, (b) all thread renders read from `room.getThread().timelineSet` with the standard decryption listener, (c) no atom value contains a `body`/`formattedBody` string keyed by thread or thread-root ID (R11), (d) `markAsRead` reaches every active thread.

## Scope Boundaries

- Not building a global "all threads across all rooms" inbox (Element has `ThreadsActivityCentre`; out of scope for v1).
- Not building notification-rule UI for "notify only on participated threads" (PR #2586's territory; defer).
- Not gating threads on room encryption state. No auto-enable E2EE, no warnings, no per-room thread-disabled mode.
- Not adopting the in-house SDK migration path that blocks upstream PR #2492. This work targets `matrix-js-sdk` as it ships in cinny `dev` today.
- Not landing this upstream as the primary goal. Personal fork first; revisit upstream only if the maintainer's SDK direction changes (see Outstanding Questions for the tripwire).
- Not implementing thread-permalink URL routing or deep-link sharing — drawer state is atom-only for v1.
- Not implementing keyboard navigation polish (Tab order through drawer, focus restoration on close) beyond a basic FocusTrap on drawer open and Escape-to-close. Full A11y polish deferred.

## Key Decisions

- **Element-style side drawer in a unified right-panel slot.** Matches user mental model from Element-web (`ThreadView` in `BaseCard`), reuses existing cinny `MembersDrawer` slot mechanics, keeps room context visible on desktop, and is what PR #2787 already implements at the component level. Drawer state is atom-based (dispatcher-pattern in element-web; Jotai in cinny), not URL-based.
- **Encryption as a code constraint, not a UX gate.** We commit to never bypassing E2EE in our own code paths. Atoms hold metadata only (R11).
- **CSS-driven responsive layout, not route-based mobile takeover.** Mirrors element-web's `Measured`/`narrow` pattern. Preserves PR #2787's atom-state model.
- **PR #2787 is a candidate starting point, not a foundation.** Closed as duplicate of #2492, not for technical reasons. ~1,900 LOC across 16 files. The audit gates whether we forward-port it (faster) or rewrite on current patterns (cleaner). Critically, the side-drawer architecture decision (R3, R4) stands on its own UX/Element-pattern grounds — it is no longer justified by "PR #2787 already implements it."
- **Element-web is the reference implementation we lean on.** Specific patterns ported in spirit: `threadSupport: true` flag, `ThreadSummary` with null-at-zero and decryption-failure preview, `useRoomThreadNotifications`-style hook, `RightPanelPhases` mutual exclusion, `Action.ShowThread`/`ShowThreadPayload`-equivalent dispatch (Jotai atom in cinny).

## Dependencies / Assumptions

- Cinny `dev` continues to ship on `matrix-js-sdk` for v1 (verified: `matrix-js-sdk: 38.2.0` in `package.json`; in-house SDK not yet wired into `src/client/`).
- `matrix-js-sdk` 38.2.0's `Thread` model, `room.getThread(eventId)`, `room.threadsAggregateNotificationType`, and thread-scoped `sendReadReceipt` work as documented when `threadSupport: true` is set at `createClient()`. (Verified: element-web develop uses these against the same SDK family.)
- The existing `threadRootId` plumbing in `Reply.tsx`, `Message.tsx`, `RoomTimeline.tsx`, `RoomPinMenu.tsx`, `Notifications.tsx`, and `SearchResultGroup.tsx` is the right substrate to extend (verified: all six files already reference the field).
- The existing `MembersDrawer` slot pattern in `Room.tsx:76-81` can be generalized into a phased right-panel slot (members | thread | threads-list).

## Outstanding Questions

### Resolve Before Planning
- [Affects R3, R4][Technical] Audit PR #2787's diff against current `dev`: does it apply, is the code quality acceptable, does it implement the right-panel-slot mutual-exclusion model (R4), does it use CSS-only responsive (R3), does any of its caching violate R11? Decide forward-port vs. rewrite.
- [Affects R14][Technical] Confirm that flipping `threadSupport: true` does not break the existing `RoomTimeline.tsx` rendering (the SDK starts splitting thread replies out of `getUnfilteredTimelineSet()`). Test in a worktree before committing the change.

### Deferred to Planning
- [Affects R8][Technical] If timeline filter ships, where does it live — view-layer predicate on `RoomTimeline.tsx` rendered events, or a Jotai atom keyed per room? Defer.
- [Affects R6, R7][Technical] Per-thread unread count read path — `room.getThreadUnreadNotificationCount(threadId, type)` vs. iterating `room.getThreads()` and aggregating. Defer.

### Product Decisions (non-blocking but worth answering before planning commits scope)
- **Reframing or evidencing the user-pain claim.** Is this a personal-utility build (acceptable, but says so), or aspires to differentiate cinny in the Matrix-client landscape? The "Element users find threads invisible" claim has no documented user demand; consider rewording the Problem Frame or scoping more aggressively.
- **R7 (timeline filter) descope.** R7 is the only requirement that *hides* content; it is not anchored to the "threads are invisible" pain and conflicts with that goal directionally. Cut for v1?
- **R7 (per-room threads list) descope.** R7 covers a secondary use case ("find an older thread") that the problem frame doesn't name. PR #2787 includes a `ThreadBrowser`, so build cost is low — but ongoing maintenance against upstream merges is non-zero. Cut for v1?
- **Inline-expansion alternative.** A read-only "X replies" affordance (R6 only) plus inline expansion under the root would deliver the highest-impact bit of "threads are no longer invisible" with maybe 100–200 LOC and no encryption surface concerns. Was this evaluated and rejected, or just skipped?
- **Fork-trajectory tripwire.** Under what condition does the fork rebase onto upstream's in-house SDK? Concrete options: (a) when in-house SDK ships E2EE; (b) when upstream removes `matrix-js-sdk` from `dev`; (c) never — fork is permanently divergent. State the answer or accept the implicit "(c) by default."
- **Adoption / rollout for fork users.** Default visibility of the new R6 affordance and R7 button — on by default, behind a setting, or staged behind a feature flag for a release cycle?
- **Opportunity cost.** The cinny in-house SDK's missing E2EE is the *upstream* gating problem. Building threads downstream is one strategy choice; helping unblock the upstream SDK is another that would let threads land for *all* cinny users. Acknowledge or rebut.
- **Compounding upstream-merge cost.** 1,900 LOC across 6+ frequently-edited files (`RoomTimeline.tsx`, `Notifications.tsx`, etc.) means every upstream pull conflicts with thread code. Acceptable for personal use; should be acknowledged as ongoing carrying cost.

## Next Steps

-> Resolve the two **Resolve Before Planning** items in a short worktree spike (PR #2787 audit + `threadSupport: true` smoke test).
-> Decide the **Product Decisions** above to right-size scope.
-> Then `/ce-plan` for structured implementation planning.
