import { Box, Icon, Icons, Text, as } from 'folds';
import { MatrixEvent, Room, Thread, ThreadEvent } from 'matrix-js-sdk';
import React, { MouseEventHandler, useEffect, useState } from 'react';
import { getMemberDisplayName, trimReplyFromBody } from '../../../utils/room';
import { getMxIdLocalPart } from '../../../utils/matrix';
import * as css from './ThreadSummary.css';

type ThreadSummaryProps = {
  room: Room;
  mEvent: MatrixEvent;
  onOpen?: (rootEventId: string) => void;
};

export const ThreadSummary = as<'button', ThreadSummaryProps>(
  ({ room, mEvent, onOpen, ...props }, ref) => {
    const eventId = mEvent.getId();
    const [thread, setThread] = useState<Thread | undefined>(() =>
      eventId ? room.getThread(eventId) : undefined
    );
    const [, setTick] = useState(0);

    useEffect(() => {
      if (!eventId) return undefined;

      const sync = () => {
        setThread(room.getThread(eventId));
        setTick((n) => n + 1);
      };

      sync();

      const t = room.getThread(eventId);
      if (t) {
        t.on(ThreadEvent.Update, sync);
      }
      room.on(ThreadEvent.New, sync);

      return () => {
        const current = room.getThread(eventId);
        if (current) {
          current.off(ThreadEvent.Update, sync);
        }
        room.off(ThreadEvent.New, sync);
      };
    }, [room, eventId]);

    if (!thread || thread.length === 0) return null;

    const lastReply = thread.replyToEvent;
    const lastReplySender = lastReply?.getSender();
    const lastReplySenderName = lastReplySender
      ? getMemberDisplayName(room, lastReplySender) ?? getMxIdLocalPart(lastReplySender)
      : undefined;

    const lastReplyBody = lastReply?.isDecryptionFailure()
      ? 'Unable to decrypt'
      : trimReplyFromBody(lastReply?.getContent().body ?? '');

    const handleClick: MouseEventHandler<HTMLButtonElement> = () => {
      if (eventId) onOpen?.(eventId);
    };

    return (
      <Box
        as="button"
        type="button"
        className={css.ThreadSummary}
        alignItems="Center"
        gap="200"
        onClick={handleClick}
        aria-label={`Open thread, ${thread.length} ${
          thread.length === 1 ? 'reply' : 'replies'
        }`}
        {...props}
        ref={ref}
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
      </Box>
    );
  }
);
