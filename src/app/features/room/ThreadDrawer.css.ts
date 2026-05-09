import { style } from '@vanilla-extract/css';
import { config, toRem } from 'folds';

export const ThreadDrawer = style({
  width: toRem(380),
});

export const ThreadDrawerHeader = style({
  flexShrink: 0,
  padding: `0 ${config.space.S200} 0 ${config.space.S400}`,
  borderBottomWidth: config.borderWidth.B300,
});

export const ThreadDrawerContentBase = style({
  position: 'relative',
  overflow: 'hidden',
});

export const ThreadDrawerContent = style({
  padding: config.space.S200,
});

export const ThreadEmpty = style({
  padding: config.space.S400,
  textAlign: 'center',
});
