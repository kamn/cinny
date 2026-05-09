import { style } from '@vanilla-extract/css';
import { color, config, toRem } from 'folds';

export const ThreadSummary = style({
  marginTop: toRem(2),
  padding: `${toRem(2)} ${config.space.S200}`,
  borderRadius: config.radii.R300,
  selectors: {
    'button&': {
      cursor: 'pointer',
    },
    ':hover&': {
      backgroundColor: color.SurfaceVariant.Container,
    },
  },
});

export const ThreadSummaryIcon = style({
  opacity: config.opacity.P500,
});

export const ThreadSummaryCount = style({
  fontWeight: config.fontWeight.W500,
});

export const ThreadSummaryPreview = style({
  opacity: config.opacity.P300,
  minWidth: 0,
});
