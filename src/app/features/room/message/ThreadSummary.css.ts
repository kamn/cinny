import { globalStyle, style } from '@vanilla-extract/css';
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

// Stacked avatar list for thread participants. Each avatar overlaps the next
// by ~6px so the row reads as a participant cluster, not a list.
export const ThreadSummaryAvatars = style({
  display: 'inline-flex',
  alignItems: 'center',
});

export const ThreadSummaryAvatar = style({
  display: 'inline-block',
  width: toRem(20),
  height: toRem(20),
  borderRadius: '50%',
  border: `${toRem(2)} solid ${color.Surface.Container}`,
  overflow: 'hidden',
  flexShrink: 0,
  marginLeft: toRem(-6),
  selectors: {
    '&:first-child': {
      marginLeft: 0,
    },
  },
});

// Constrain folds AvatarImage / AvatarFallback descendants. Without this the
// underlying <img> uses its intrinsic dimensions and stretches the avatar oval.
globalStyle(`${ThreadSummaryAvatar} > *`, {
  width: '100%',
  height: '100%',
  display: 'block',
});
globalStyle(`${ThreadSummaryAvatar} img`, {
  objectFit: 'cover',
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
