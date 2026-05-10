import { style } from '@vanilla-extract/css';
import { color, config, toRem } from 'folds';

// Boxed thread summary affordance — borrows from Slack/Element thread badges:
// participant avatars + count + last-activity time, surrounded by a faint
// border that strengthens on hover, plus a chevron that fades in on hover so
// the affordance reads as "click to open".
export const ThreadSummary = style({
  display: 'flex',
  alignItems: 'center',
  gap: config.space.S200,
  width: '100%',
  marginTop: config.space.S100,
  padding: `${config.space.S100} ${config.space.S200}`,
  borderRadius: config.radii.R300,
  border: `${toRem(1)} solid ${color.SurfaceVariant.ContainerLine}`,
  // Button reset — moved out of inline styles so the visual contract lives
  // alongside the rest of the ThreadSummary tokens.
  background: 'none',
  textAlign: 'left',
  font: 'inherit',
  color: 'inherit',
  transition: 'background-color 80ms ease, border-color 80ms ease',
  selectors: {
    'button&': {
      cursor: 'pointer',
    },
    ':hover&': {
      backgroundColor: color.SurfaceVariant.Container,
      borderColor: color.SurfaceVariant.ContainerActive,
    },
  },
});

// Push the time + chevron to the right edge.
export const ThreadSummarySpacer = style({
  flexGrow: 1,
});

export const ThreadSummaryTime = style({
  flexShrink: 0,
});

// Chevron is invisible by default and slides in from the left on hover.
export const ThreadSummaryChevron = style({
  flexShrink: 0,
  opacity: 0,
  transform: `translateX(${toRem(-4)})`,
  transition: 'opacity 100ms ease, transform 100ms ease',
  selectors: {
    [`${ThreadSummary}:hover &`]: {
      opacity: config.opacity.P500,
      transform: 'translateX(0)',
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
