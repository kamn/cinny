import { atom } from 'jotai';
import { atomFamily } from 'jotai/utils';

export type RoomRightPanelState = null | 'members' | { phase: 'thread'; rootEventId: string };

const createRightPanelAtom = () => atom<RoomRightPanelState>(null);
export type TRoomRightPanelAtom = ReturnType<typeof createRightPanelAtom>;

export const roomRightPanelAtomFamily = atomFamily<string, TRoomRightPanelAtom>(() =>
  createRightPanelAtom()
);
