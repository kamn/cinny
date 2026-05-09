import { Box, Icon, Icons, Text } from 'folds';
import {
  MatrixEvent,
  NotificationCountType,
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
import * as css from './ThreadSummary.css';

type ThreadSummaryProps = {
  room: Room;
  mEvent: MatrixEvent;
  onOpen?: (rootEventId: string) => void;
};

const MAX_AVATARS = 4;

// Walk thread events and gather unique senders, ordered by most recent
// participation first. The thread root itself counts.
function collectParticipants(thread: Thread): string[] {
  const events = thread.liveTimeline.getEvents();
  const seen = new Set<string>();
  const ordered: string[] = [];
  // Walk newest -> oldest so the most recently active participants come first.
  for (let i = events.length - 1; i >= 0; i -= 1) {
    const sender = events[i]?.getSender();
    if (sender && !seen.has(sender)) {
      seen.add(sender);
      ordered.push(sender);
    }
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
  const eventId = mEvent.getId();
  const [thread, setThread] = useState<Thread | null>(() =>
    eventId ? room.getThread(eventId) : null
  );
  const [, setTick] = useState(0);
  const [unreadTotal, setUnreadTotal] = useState(() =>
    eventId ? room.getThreadUnreadNotificationCount(eventId, NotificationCountType.Total) : 0
  );
  const [unreadHighlight, setUnreadHighlight] = useState(() =>
    eventId ? room.getThreadUnreadNotificationCount(eventId, NotificationCountType.Highlight) : 0
  );

  useEffect(() => {
    if (!eventId) return undefined;

    const sync = () => {
      setThread(room.getThread(eventId));
      setTick((n) => n + 1);
    };
    sync();

    room.on(ThreadEvent.New, sync);
    room.on(ThreadEvent.Update, sync);

    return () => {
      room.off(ThreadEvent.New, sync);
      room.off(ThreadEvent.Update, sync);
    };
  }, [room, eventId]);

  useEffect(() => {
    if (!eventId) return undefined;
    const refresh = () => {
      setUnreadTotal(room.getThreadUnreadNotificationCount(eventId, NotificationCountType.Total));
      setUnreadHighlight(
        room.getThreadUnreadNotificationCount(eventId, NotificationCountType.Highlight)
      );
    };
    // Re-read counts whenever the SDK signals notification or receipt changes,
    // including thread-scoped variants. RoomEvent.UnreadNotifications is the
    // primary signal; RoomEvent.Receipt covers the case where reading on a
    // device clears the count.
    room.on(RoomEvent.UnreadNotifications, refresh);
    room.on(RoomEvent.Receipt, refresh);
    room.on(ThreadEvent.Update, refresh);
    refresh();
    return () => {
      room.off(RoomEvent.UnreadNotifications, refresh);
      room.off(RoomEvent.Receipt, refresh);
      room.off(ThreadEvent.Update, refresh);
    };
  }, [room, eventId]);

  const participants = useMemo(() => (thread ? collectParticipants(thread) : []), [thread]);

  if (!thread || thread.length === 0) return null;

  const handleClick = () => {
    if (eventId) onOpen?.(eventId);
  };

  const visibleAvatars = participants.slice(0, MAX_AVATARS);
  const overflow = participants.length - visibleAvatars.length;
  const hasUnread = unreadTotal > 0 || unreadHighlight > 0;

  return (
    <button
      type="button"
      className={css.ThreadSummary}
      onClick={handleClick}
      aria-label={`Open thread, ${thread.length} ${thread.length === 1 ? 'reply' : 'replies'}${
        hasUnread ? ', new activity' : ''
      }`}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        background: 'none',
        border: 'none',
        textAlign: 'left',
        font: 'inherit',
        color: 'inherit',
        width: '100%',
      }}
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
                <UserAvatar
                  userId={userId}
                  src={src}
                  alt={displayName}
                  renderFallback={() => <Icon size="50" src={Icons.User} filled />}
                />
              </span>
            );
          })}
          {overflow > 0 && (
            <Text as="span" size="T200" priority="300" style={{ marginLeft: '0.25rem' }}>
              +{overflow}
            </Text>
          )}
        </Box>
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
    </button>
  );
}
