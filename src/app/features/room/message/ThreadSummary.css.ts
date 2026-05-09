import { style } from '@vanilla-extract/css';
import { color, config, toRem } from 'folds';

export const ThreadSummary = style({
  display: 'flex',
  alignItems: 'center',
  gap: config.space.S200,
  width: '100%',
  marginTop: toRem(2),
  padding: `${toRem(2)} ${config.space.S200}`,
  borderRadius: config.radii.R300,
  // Button reset — moved out of inline styles so the visual contract lives
  // alongside the rest of the ThreadSummary tokens.
  background: 'none',
  border: 'none',
  textAlign: 'left',
  font: 'inherit',
  color: 'inherit',
  selectors: {
    'button&': {
      cursor: 'pointer',
    },
    ':hover&': {
      backgroundColor: color.SurfaceVariant.Container,
    },
  },
});

export const ThreadSummaryOverflow = style({
  marginLeft: config.space.S100,
});

export const ThreadSummaryIcon = style({
  opacity: config.opacity.P500,
});

export const ThreadSummaryCount = style({
  fontWeight: config.fontWeight.W500,
});

// Stacked avatar list for thread participants. Each avatar overlaps the next
// by ~6px so the row reads as a participant cluster, not a list.
export const ThreadSummaryAvatars = style({
  display: 'inline-flex',
  alignItems: 'center',
});

// Each avatar slot overlaps the previous by ~6px so the row reads as a
// participant cluster. The folds <Avatar size="200" radii="Pill"> child
// owns the actual sizing/circle clip; this wrapper just handles the stack
// offset and the surface-colored ring around each avatar.
export const ThreadSummaryAvatar = style({
  display: 'inline-block',
  borderRadius: '50%',
  border: `${toRem(2)} solid ${color.Surface.Container}`,
  flexShrink: 0,
  marginLeft: toRem(-6),
  selectors: {
    '&:first-child': {
      marginLeft: 0,
    },
  },
});

export const ThreadSummaryUnreadDot = style({
  width: toRem(8),
  height: toRem(8),
  borderRadius: '50%',
  backgroundColor: color.Primary.Main,
  flexShrink: 0,
});

export const ThreadSummaryUnreadHighlight = style({
  backgroundColor: color.Critical.Main,
});
