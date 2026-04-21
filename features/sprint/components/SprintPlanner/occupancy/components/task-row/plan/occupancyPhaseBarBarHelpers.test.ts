import { describe, expect, it } from 'vitest';

import {
  buildOccupancyPhaseBarSurfaceClass,
  resolvePhaseBarPointerEvents,
  resolvePhaseBarStripeOverlayStyle,
} from './occupancyPhaseBarBarHelpers';

describe('resolvePhaseBarPointerEvents', () => {
  it('returns none when dimmed by context menu', () => {
    expect(resolvePhaseBarPointerEvents(true, false)).toBe('none');
  });

  it('returns none when pointerEventsNone', () => {
    expect(resolvePhaseBarPointerEvents(false, true)).toBe('none');
  });

  it('returns auto otherwise', () => {
    expect(resolvePhaseBarPointerEvents(false, false)).toBe('auto');
  });
});

describe('resolvePhaseBarStripeOverlayStyle', () => {
  it('returns undefined when background dimmed', () => {
    expect(resolvePhaseBarStripeOverlayStyle(true, true, true, { background: 'x' })).toBeUndefined();
  });

  it('returns undefined for QA extra duration combo', () => {
    expect(resolvePhaseBarStripeOverlayStyle(false, true, true, { background: 'striped' })).toBeUndefined();
  });

  it('returns qa style when visible', () => {
    const style = { opacity: 0.5 };
    expect(resolvePhaseBarStripeOverlayStyle(false, true, false, style)).toBe(style);
  });
});

describe('buildOccupancyPhaseBarSurfaceClass', () => {
  it('includes grab cursor when not link target and drag allowed', () => {
    const cls = buildOccupancyPhaseBarSurfaceClass(
      false,
      false,
      'border-dashed',
      'bg-blue',
      '',
      '',
      false,
      false
    );
    expect(cls).toContain('cursor-grab');
    expect(cls).toContain('bg-blue');
  });

  it('uses pointer cursor when drag disabled', () => {
    const cls = buildOccupancyPhaseBarSurfaceClass(
      false,
      false,
      'b1',
      'c1',
      '',
      '',
      true,
      false
    );
    expect(cls).toContain('cursor-pointer');
    expect(cls).not.toContain('cursor-grab');
  });

  it('uses dimmed border-only surface when background dimmed', () => {
    const cls = buildOccupancyPhaseBarSurfaceClass(
      false,
      true,
      'border-only',
      'bg-solid',
      '',
      '',
      false,
      false
    );
    expect(cls).toContain('bg-transparent');
    expect(cls).toContain('border-only');
  });
});
