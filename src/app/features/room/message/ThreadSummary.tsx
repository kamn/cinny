import { Avatar, Box, Icon, Icons, Text } from 'folds';
import {
  MatrixEvent,
  NotificationCountType,
  RelationType,
  RoomEvent,
  Room,
  Thread,
  ThreadEvent,
} from 'matrix-js-sdk';
import classNames from 'classnames';
import React, { useEffect, useMemo, useState } from 'react';
import { getMemberAvatarMxc, getMemberDisplayName } from '../../../utils/room';
import { getMxIdLocalPart, mxcUrlToHttp } from '../../../utils/matrix';
import { useMatrixClient } from '../../../hooks/useMatrixClient';
import { useMediaAuthentication } from '../../../hooks/useMediaAuthentication';
import { UserAvatar } from '../../../components/user-avatar';
import { Time } from '../../../components/message';
import { useSetting } from '../../../state/hooks/settings';
import { settingsAtom } from '../../../state/settings';
import * as css from './ThreadSummary.css';

type ThreadSummaryProps = {
  room: Room;
  mEvent: MatrixEvent;
  onOpen?: (rootEventId: string) => void;
};

const MAX_AVATARS = 4;

// Walk thread events and gather unique senders, ordered by most recent
// participation first. The thread root itself counts. Edits and reactions are
// skipped — they aggregate state, not participation.
function collectParticipants(thread: Thread): string[] {
  const events = thread.liveTimeline.getEvents();
  const seen = new Set<string>();
  const ordered: string[] = [];
  // Walk newest -> oldest so the most recently active participants come first.
  for (let i = events.length - 1; i >= 0; i -= 1) {
    const ev = events[i];
    if (!ev) continue;
    if (ev.isRelation(RelationType.Annotation) || ev.isRelation(RelationType.Replace)) continue;
    const sender = ev.getSender();
    if (sender && !seen.has(sender)) {
      seen.add(sender);
      ordered.push(sender);
    }
    // Early exit: we only render MAX_AVATARS plus a "+N" indicator, so
    // there is no need to walk the full timeline of long threads. We pass
    // MAX_AVATARS + 1 so the overflow count is correct as soon as we have
    // at least one extra participant.
    if (ordered.length >= MAX_AVATARS + 1) break;
  }
  // Always include the root sender if not already (e.g. thread.length === 0).
  const rootSender = thread.rootEvent?.getSender();
  if (rootSender && !seen.has(rootSender)) {
    seen.add(rootSender);
    ordered.push(rootSender);
  }
  return ordered;
}

export function ThreadSummary({ room, mEvent, onOpen }: ThreadSummaryProps) {
  const mx = useMatrixClient();
  const useAuthentication = useMediaAuthentication();
  const [hour24Clock] = useSetting(settingsAtom, 'hour24Clock');
  const [dateFormatString] = useSetting(settingsAtom, 'dateFormatString');
  const eventId = mEvent.getId();
  const [thread, setThread] = useState<Thread | null>(() =>
    eventId ? room.getThread(eventId) : null
  );
  const [tick, setTick] = useState(0);
  const [unreadTotal, setUnreadTotal] = useState(() =>
    eventId ? room.getThreadUnreadNotificationCount(eventId, NotificationCountType.Total) : 0
  );
  const [unreadHighlight, setUnreadHighlight] = useState(() =>
    eventId ? room.getThreadUnreadNotificationCount(eventId, NotificationCountType.Highlight) : 0
  );

  useEffect(() => {
    if (!eventId) return undefined;

    const handler = () => {
      setThread(room.getThread(eventId));
      setTick((n) => n + 1);
      setUnreadTotal(room.getThreadUnreadNotificationCount(eventId, NotificationCountType.Total));
      setUnreadHighlight(
        room.getThreadUnreadNotificationCount(eventId, NotificationCountType.Highlight)
      );
    };
    handler();

    // Subscribe once each: ThreadEvent.New / Update keep our Thread reference
    // and avatar list fresh; RoomEvent.UnreadNotifications and
    // RoomEvent.Receipt cover thread-scoped unread bookkeeping (including
    // clearing on read receipts from this device).
    room.on(ThreadEvent.New, handler);
    room.on(ThreadEvent.Update, handler);
    room.on(RoomEvent.UnreadNotifications, handler);
    room.on(RoomEvent.Receipt, handler);

    return () => {
      room.off(ThreadEvent.New, handler);
      room.off(ThreadEvent.Update, handler);
      room.off(RoomEvent.UnreadNotifications, handler);
      room.off(RoomEvent.Receipt, handler);
    };
  }, [room, eventId]);

  const participants = useMemo(
    () => (thread ? collectParticipants(thread) : []),
    // tick re-runs participant collection when the thread's live timeline
    // mutates without changing the Thread reference (matrix-js-sdk reuses
    // the same instance across thread updates).
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [thread, tick]
  );

  if (!thread || thread.length === 0) return null;

  const handleClick = () => {
    if (eventId) onOpen?.(eventId);
  };

  const visibleAvatars = participants.slice(0, MAX_AVATARS);
  const overflow = participants.length - visibleAvatars.length;
  const hasUnread = unreadTotal > 0 || unreadHighlight > 0;
  // thread.replyToEvent prefers the lastPendingEvent, then lastEvent, then
  // lastReply() — so this matches what users would consider "the last
  // activity" in the thread (Slack/Element use the same surface).
  const lastReply = thread.replyToEvent;
  const lastReplyTs = lastReply?.getTs();

  return (
    <Box
      as="button"
      type="button"
      className={css.ThreadSummary}
      onClick={handleClick}
      aria-label={`Open thread, ${thread.length} ${thread.length === 1 ? 'reply' : 'replies'}${
        hasUnread ? ', new activity' : ''
      }`}
    >
      <Icon className={css.ThreadSummaryIcon} size="100" src={Icons.Thread} />
      <Text as="span" size="T200" className={css.ThreadSummaryCount}>
        {thread.length} {thread.length === 1 ? 'reply' : 'replies'}
      </Text>
      {visibleAvatars.length > 0 && (
        <Box className={css.ThreadSummaryAvatars}>
          {visibleAvatars.map((userId) => {
            const displayName =
              getMemberDisplayName(room, userId) ?? getMxIdLocalPart(userId) ?? userId;
            const mxc = getMemberAvatarMxc(room, userId);
            const src = mxc
              ? mxcUrlToHttp(mx, mxc, useAuthentication, 24, 24, 'crop') ?? undefined
              : undefined;
            return (
              <span
                key={userId}
                className={css.ThreadSummaryAvatar}
                title={displayName}
                aria-hidden
              >
                <Avatar size="200" radii="Pill">
                  <UserAvatar
                    userId={userId}
                    src={src}
                    alt={displayName}
                    renderFallback={() => <Icon size="50" src={Icons.User} filled />}
                  />
                </Avatar>
              </span>
            );
          })}
          {overflow > 0 && (
            <Text as="span" size="T200" priority="300" className={css.ThreadSummaryOverflow}>
              +{overflow}
            </Text>
          )}
        </Box>
      )}
      <span className={css.ThreadSummarySpacer} />
      {lastReplyTs !== undefined && (
        <Time
          className={css.ThreadSummaryTime}
          ts={lastReplyTs}
          compact
          hour24Clock={hour24Clock}
          dateFormatString={dateFormatString}
        />
      )}
      {hasUnread && (
        <span
          className={classNames(
            css.ThreadSummaryUnreadDot,
            unreadHighlight > 0 && css.ThreadSummaryUnreadHighlight
          )}
          aria-hidden
        />
      )}
      <Icon className={css.ThreadSummaryChevron} size="100" src={Icons.ChevronRight} />
    </Box>
  );
}
