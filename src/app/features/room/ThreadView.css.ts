import { style } from '@vanilla-extract/css';
import { config } from 'folds';

export const ThreadViewHeader = style({
  flexShrink: 0,
  padding: `0 ${config.space.S400}`,
  borderBottomWidth: config.borderWidth.B300,
});

export const ThreadViewContentBase = style({
  position: 'relative',
  overflow: 'hidden',
});

export const ThreadViewContent = style({
  padding: config.space.S400,
});

export const ThreadEmpty = style({
  padding: config.space.S400,
  textAlign: 'center',
});
