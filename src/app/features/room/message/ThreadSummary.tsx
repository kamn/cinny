import { Box, Icon, Icons, Text } from 'folds';
import { MatrixEvent, Room, Thread, ThreadEvent } from 'matrix-js-sdk';
import React, { useEffect, useState } from 'react';
import { getMemberDisplayName, trimReplyFromBody } from '../../../utils/room';
import { getMxIdLocalPart } from '../../../utils/matrix';
import * as css from './ThreadSummary.css';

type ThreadSummaryProps = {
  room: Room;
  mEvent: MatrixEvent;
  onOpen?: (rootEventId: string) => void;
};

// Diagnostic flag — flip to true for render-time logging in DevTools
const DEBUG_THREAD_SUMMARY = false;

export function ThreadSummary({ room, mEvent, onOpen }: ThreadSummaryProps) {
  const eventId = mEvent.getId();
  const [thread, setThread] = useState<Thread | null>(() =>
    eventId ? room.getThread(eventId) : null
  );
  // Force re-render on ThreadEvent.Update without changing thread identity
  const [, setTick] = useState(0);

  useEffect(() => {
    if (!eventId) return undefined;

    const sync = () => {
      const t = room.getThread(eventId);
      setThread(t);
      setTick((n) => n + 1);
    };

    // initial sync (in case the thread was created between render and effect mount)
    sync();

    // Rooms re-emit ThreadEvent.Update from every thread (room.js:reEmitter),
    // so listening on the room covers both creation and per-thread updates
    // without rebinding when a new thread is created post-mount.
    room.on(ThreadEvent.New, sync);
    room.on(ThreadEvent.Update, sync);

    return () => {
      room.off(ThreadEvent.New, sync);
      room.off(ThreadEvent.Update, sync);
    };
  }, [room, eventId]);

  if (DEBUG_THREAD_SUMMARY && eventId) {
    const isRoot = mEvent.isThreadRoot;
    const threadRootId = mEvent.threadRootId;
    // eslint-disable-next-line no-console
    console.log(
      `[ThreadSummary] event=${eventId} isRoot=${isRoot} threadRootId=${threadRootId} thread=${
        thread ? `len:${thread.length}` : 'null'
      } supportsThreads=${room.client?.supportsThreads?.()}`
    );
  }

  if (!thread || thread.length === 0) return null;

  const lastReply = thread.replyToEvent;
  const lastReplySender = lastReply?.getSender();
  const lastReplySenderName = lastReplySender
    ? getMemberDisplayName(room, lastReplySender) ?? getMxIdLocalPart(lastReplySender)
    : undefined;

  const lastReplyBody = lastReply?.isDecryptionFailure()
    ? 'Unable to decrypt'
    : trimReplyFromBody(lastReply?.getContent().body ?? '');

  const handleClick = () => {
    if (eventId) onOpen?.(eventId);
  };

  return (
    <button
      type="button"
      className={css.ThreadSummary}
      onClick={handleClick}
      aria-label={`Open thread, ${thread.length} ${
        thread.length === 1 ? 'reply' : 'replies'
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
      {lastReply && (
        <Box grow="Yes" className={css.ThreadSummaryPreview}>
          <Text as="span" size="T200" truncate>
            {lastReplySenderName && <b>{lastReplySenderName}: </b>}
            {lastReplyBody}
          </Text>
        </Box>
      )}
    </button>
  );
}
