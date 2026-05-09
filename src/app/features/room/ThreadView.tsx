import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { HTMLReactParserOptions } from 'html-react-parser';
import {
  Avatar,
  Box,
  Header,
  Icon,
  IconButton,
  Icons,
  Scroll,
  Text,
  Tooltip,
  TooltipProvider,
  config,
} from 'folds';
import { Opts as LinkifyOpts } from 'linkifyjs';
import {
  EventType,
  MatrixEvent,
  MatrixEventEvent,
  Room,
  RoomEvent,
  Thread,
  ThreadEvent,
} from 'matrix-js-sdk';
import * as css from './ThreadView.css';
import { useEditor } from '../../components/editor';
import { useMatrixClient } from '../../hooks/useMatrixClient';
import { useMediaAuthentication } from '../../hooks/useMediaAuthentication';
import { useMentionClickHandler } from '../../hooks/useMentionClickHandler';
import { useSpoilerClickHandler } from '../../hooks/useSpoilerClickHandler';
import { useMatrixEventRenderer } from '../../hooks/useMatrixEventRenderer';
import { useSetting } from '../../state/hooks/settings';
import { settingsAtom } from '../../state/settings';
import {
  factoryRenderLinkifyWithMention,
  getReactCustomHtmlParser,
  LINKIFY_OPTS,
  makeMentionCustomProps,
  renderMatrixMention,
} from '../../plugins/react-custom-html-parser';
import { getEditedEvent, getMemberAvatarMxc, getMemberDisplayName } from '../../utils/room';
import { getMxIdLocalPart, mxcUrlToHttp } from '../../utils/matrix';
import {
  AvatarBase,
  ImageContent,
  MessageNotDecryptedContent,
  MessageUnsupportedContent,
  MSticker,
  ModernLayout,
  RedactedContent,
  Time,
  Username,
  UsernameBold,
} from '../../components/message';
import { EncryptedContent } from './message';
import { RenderMessageContent } from '../../components/RenderMessageContent';
import { Image } from '../../components/media';
import { ImageViewer } from '../../components/image-viewer';
import { UserAvatar } from '../../components/user-avatar';
import { GetContentCallback, MessageEvent } from '../../../types/matrix/room';
import * as customHtmlCss from '../../styles/CustomHtml.css';
import { Page } from '../../components/page';
import { useRoomPermissions } from '../../hooks/useRoomPermissions';
import { usePowerLevelsContext } from '../../hooks/usePowerLevels';
import { useRoomCreators } from '../../hooks/useRoomCreators';
import { RoomInput } from './RoomInput';
import { RoomInputPlaceholder } from './RoomInputPlaceholder';

type ThreadEventItemProps = {
  room: Room;
  mEvent: MatrixEvent;
  renderContent: ReturnType<
    typeof useMatrixEventRenderer<[MatrixEvent, string, GetContentCallback]>
  >;
  hour24Clock: boolean;
  dateFormatString: string;
};

function ThreadEventItem({
  room,
  mEvent,
  renderContent,
  hour24Clock,
  dateFormatString,
}: ThreadEventItemProps) {
  const mx = useMatrixClient();
  const useAuthentication = useMediaAuthentication();
  const senderId = mEvent.getSender() ?? '';
  const displayName =
    getMemberDisplayName(room, senderId) ?? getMxIdLocalPart(senderId) ?? senderId;
  const senderAvatarMxc = getMemberAvatarMxc(room, senderId);
  const editedEvent = getEditedEvent(mEvent.getId() ?? '', mEvent, room.getUnfilteredTimelineSet());
  const getContent = (() =>
    editedEvent?.getContent()['m.new_content'] ?? mEvent.getContent()) as GetContentCallback;

  return (
    <ModernLayout
      before={
        <AvatarBase>
          <Avatar size="300">
            <UserAvatar
              userId={senderId}
              src={
                senderAvatarMxc
                  ? mxcUrlToHttp(mx, senderAvatarMxc, useAuthentication, 48, 48, 'crop') ??
                    undefined
                  : undefined
              }
              alt={displayName}
              renderFallback={() => <Icon size="200" src={Icons.User} filled />}
            />
          </Avatar>
        </AvatarBase>
      }
    >
      <Box gap="200" alignItems="Baseline">
        <Username>
          <Text as="span" size="T400" truncate>
            <UsernameBold>{displayName}</UsernameBold>
          </Text>
        </Username>
        <Time ts={mEvent.getTs()} hour24Clock={hour24Clock} dateFormatString={dateFormatString} />
      </Box>
      {renderContent(mEvent.getType() ?? '', false, mEvent, displayName, getContent)}
    </ModernLayout>
  );
}

type ThreadViewHeaderProps = {
  room: Room;
  onBack: () => void;
};

function ThreadViewHeader({ room, onBack }: ThreadViewHeaderProps) {
  const roomName = room.name || 'Room';

  return (
    <Header className={css.ThreadViewHeader} variant="Surface" size="600">
      <Box grow="Yes" alignItems="Center" gap="200">
        <Box shrink="No" alignItems="Center">
          <TooltipProvider
            position="Bottom"
            align="Start"
            offset={4}
            tooltip={
              <Tooltip>
                <Text>Back to {roomName}</Text>
              </Tooltip>
            }
          >
            {(triggerRef) => (
              <IconButton ref={triggerRef} variant="Surface" onClick={onBack}>
                <Icon src={Icons.ArrowLeft} />
              </IconButton>
            )}
          </TooltipProvider>
        </Box>
        <Box grow="Yes" alignItems="Center" gap="200">
          <Icon size="200" src={Icons.Thread} />
          <Box direction="Column">
            <Text size="H5" truncate>
              Thread
            </Text>
            <Text size="T200" priority="300" truncate>
              {roomName}
            </Text>
          </Box>
        </Box>
      </Box>
    </Header>
  );
}

type ThreadViewProps = {
  room: Room;
  rootEventId: string;
  onBack: () => void;
};

export function ThreadView({ room, rootEventId, onBack }: ThreadViewProps) {
  const mx = useMatrixClient();
  const useAuthentication = useMediaAuthentication();
  const scrollRef = useRef<HTMLDivElement>(null);
  const pageRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLDivElement>(null);
  const editor = useEditor();
  const powerLevels = usePowerLevelsContext();
  const creators = useRoomCreators(room);
  const permissions = useRoomPermissions(creators, powerLevels);
  const canMessage = permissions.event(EventType.RoomMessage, mx.getSafeUserId());

  const [mediaAutoLoad] = useSetting(settingsAtom, 'mediaAutoLoad');
  const [showUrlPreview] = useSetting(settingsAtom, 'urlPreview');
  const [hour24Clock] = useSetting(settingsAtom, 'hour24Clock');
  const [dateFormatString] = useSetting(settingsAtom, 'dateFormatString');

  const [thread, setThread] = useState<Thread | null>(() => room.getThread(rootEventId));
  const [, setTick] = useState(0);

  useEffect(() => {
    const sync = () => {
      setThread(room.getThread(rootEventId));
      setTick((n) => n + 1);
    };

    sync();

    room.on(ThreadEvent.New, sync);
    room.on(ThreadEvent.Update, sync);
    room.on(RoomEvent.Timeline, sync);
    room.on(MatrixEventEvent.Decrypted, sync);

    return () => {
      room.off(ThreadEvent.New, sync);
      room.off(ThreadEvent.Update, sync);
      room.off(RoomEvent.Timeline, sync);
      room.off(MatrixEventEvent.Decrypted, sync);
    };
  }, [room, rootEventId]);

  const handleBack = useCallback(() => {
    onBack();
  }, [onBack]);

  // Make plain history navigation also exit threads — pressing Esc with focus
  // on the body returns to the room timeline. (Composer Esc is handled by
  // RoomInput for clearing reply drafts; that takes precedence.)
  useEffect(() => {
    const onKey = (evt: KeyboardEvent) => {
      if (evt.key === 'Escape') {
        const active = document.activeElement;
        const isInComposer =
          active instanceof HTMLElement &&
          (active.isContentEditable || active.tagName === 'INPUT' || active.tagName === 'TEXTAREA');
        if (!isInComposer) {
          handleBack();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleBack]);

  const mentionClickHandler = useMentionClickHandler(room.roomId);
  const spoilerClickHandler = useSpoilerClickHandler();

  const linkifyOpts = useMemo<LinkifyOpts>(
    () => ({
      ...LINKIFY_OPTS,
      render: factoryRenderLinkifyWithMention((href) =>
        renderMatrixMention(mx, room.roomId, href, makeMentionCustomProps(mentionClickHandler))
      ),
    }),
    [mx, room, mentionClickHandler]
  );
  const htmlReactParserOptions = useMemo<HTMLReactParserOptions>(
    () =>
      getReactCustomHtmlParser(mx, room.roomId, {
        linkifyOpts,
        useAuthentication,
        handleSpoilerClick: spoilerClickHandler,
        handleMentionClick: mentionClickHandler,
      }),
    [mx, room, linkifyOpts, mentionClickHandler, spoilerClickHandler, useAuthentication]
  );

  const renderContent = useMatrixEventRenderer<[MatrixEvent, string, GetContentCallback]>(
    {
      [MessageEvent.RoomMessage]: (event, displayName, getContent) => {
        if (event.isRedacted()) {
          return <RedactedContent reason={event.getUnsigned().redacted_because?.content.reason} />;
        }
        return (
          <RenderMessageContent
            displayName={displayName}
            msgType={event.getContent().msgtype ?? ''}
            ts={event.getTs()}
            getContent={getContent}
            edited={!!event.replacingEvent()}
            mediaAutoLoad={mediaAutoLoad}
            urlPreview={showUrlPreview}
            htmlReactParserOptions={htmlReactParserOptions}
            linkifyOpts={linkifyOpts}
            outlineAttachment
          />
        );
      },
      [MessageEvent.RoomMessageEncrypted]: (event, displayName) => {
        const eventId = event.getId();
        if (!eventId) {
          return (
            <Text>
              <MessageNotDecryptedContent />
            </Text>
          );
        }
        return (
          <EncryptedContent mEvent={event}>
            {() => {
              if (event.isRedacted()) return <RedactedContent />;
              if (event.getType() === MessageEvent.RoomMessage) {
                const editedEvent = getEditedEvent(eventId, event, room.getUnfilteredTimelineSet());
                const getContent = (() =>
                  editedEvent?.getContent()['m.new_content'] ??
                  event.getContent()) as GetContentCallback;
                return (
                  <RenderMessageContent
                    displayName={displayName}
                    msgType={event.getContent().msgtype ?? ''}
                    ts={event.getTs()}
                    edited={!!editedEvent || !!event.replacingEvent()}
                    getContent={getContent}
                    mediaAutoLoad={mediaAutoLoad}
                    urlPreview={showUrlPreview}
                    htmlReactParserOptions={htmlReactParserOptions}
                    linkifyOpts={linkifyOpts}
                    outlineAttachment
                  />
                );
              }
              if (event.getType() === MessageEvent.Sticker) {
                return (
                  <MSticker
                    content={event.getContent()}
                    renderImageContent={(props) => (
                      <ImageContent
                        {...props}
                        autoPlay={mediaAutoLoad}
                        renderImage={(p) => <Image {...p} loading="lazy" />}
                        renderViewer={(p) => <ImageViewer {...p} />}
                      />
                    )}
                  />
                );
              }
              return (
                <Text>
                  <MessageUnsupportedContent />
                </Text>
              );
            }}
          </EncryptedContent>
        );
      },
    },
    undefined,
    (event) => {
      if (event.isRedacted()) {
        return <RedactedContent reason={event.getUnsigned().redacted_because?.content.reason} />;
      }
      return (
        <Box grow="Yes" direction="Column">
          <Text size="T200" priority="300">
            <code className={customHtmlCss.Code}>{event.getType()}</code>
            {' event'}
          </Text>
        </Box>
      );
    }
  );

  const rootEvent = thread?.rootEvent ?? room.findEventById(rootEventId);
  const replies: MatrixEvent[] = useMemo(() => {
    if (!thread) return [];
    const events: MatrixEvent[] = thread.liveTimeline.getEvents();
    return events.filter((evt: MatrixEvent) => evt.getId() !== rootEventId);
  }, [thread, rootEventId]);

  return (
    <Page ref={pageRef}>
      <ThreadViewHeader room={room} onBack={handleBack} />
      <Box className={css.ThreadViewContentBase} grow="Yes">
        <Scroll ref={scrollRef} variant="Surface" size="300" visibility="Hover" hideTrack>
          <Box className={css.ThreadViewContent} direction="Column" gap="400">
            {rootEvent ? (
              <ThreadEventItem
                room={room}
                mEvent={rootEvent}
                renderContent={renderContent}
                hour24Clock={hour24Clock}
                dateFormatString={dateFormatString}
              />
            ) : (
              <Box className={css.ThreadEmpty}>
                <Text size="T200" priority="300">
                  Loading thread root…
                </Text>
              </Box>
            )}
            {replies.length === 0 ? (
              <Box className={css.ThreadEmpty}>
                <Text size="T200" priority="300">
                  No replies yet.
                </Text>
              </Box>
            ) : (
              replies.map((mEvent) => (
                <ThreadEventItem
                  key={mEvent.getId()}
                  room={room}
                  mEvent={mEvent}
                  renderContent={renderContent}
                  hour24Clock={hour24Clock}
                  dateFormatString={dateFormatString}
                />
              ))
            )}
          </Box>
        </Scroll>
      </Box>
      <Box shrink="No" direction="Column">
        <div style={{ padding: `0 ${config.space.S400}` }}>
          {canMessage ? (
            <RoomInput
              ref={inputRef}
              editor={editor}
              roomId={room.roomId}
              room={room}
              fileDropContainerRef={pageRef}
              threadRootId={rootEventId}
            />
          ) : (
            <RoomInputPlaceholder
              style={{ padding: config.space.S200 }}
              alignItems="Center"
              justifyContent="Center"
            >
              <Text align="Center">You do not have permission to post in this thread</Text>
            </RoomInputPlaceholder>
          )}
        </div>
      </Box>
    </Page>
  );
}
