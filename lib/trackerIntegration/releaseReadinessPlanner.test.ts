import { describe, expect, it } from 'vitest';

import {
  effectiveReleaseReadyStatusKey,
  releaseReadinessEmptyListHintSpec,
  taskMatchesReleaseReadinessFilter,
} from './releaseReadinessPlanner';

describe('effectiveReleaseReadyStatusKey', () => {
  it('falls back to rc when null or empty', () => {
    expect(effectiveReleaseReadyStatusKey({ readyStatusKey: null })).toBe('rc');
    expect(effectiveReleaseReadyStatusKey({ readyStatusKey: '' })).toBe('rc');
  });

  it('uses configured key when set', () => {
    expect(
      effectiveReleaseReadyStatusKey({ readyStatusKey: 'readyForDeploy' })
    ).toBe('readyForDeploy');
  });
});

describe('taskMatchesReleaseReadinessFilter', () => {
  it('uses RC when readyStatusKey omitted', () => {
    const rules = { readyStatusKey: null };
    expect(taskMatchesReleaseReadinessFilter({ originalStatus: 'rc' }, rules)).toBe(
      true
    );
    expect(taskMatchesReleaseReadinessFilter({ originalStatus: 'RC' }, rules)).toBe(
      true
    );
    expect(
      taskMatchesReleaseReadinessFilter({ originalStatus: 'readyForDeploy' }, rules)
    ).toBe(false);
  });

  it('uses configured status key when set', () => {
    const rules = { readyStatusKey: 'readyForDeploy' };
    expect(
      taskMatchesReleaseReadinessFilter({ originalStatus: 'readyForDeploy' }, rules)
    ).toBe(true);
    expect(
      taskMatchesReleaseReadinessFilter({ originalStatus: 'READYFORDEPLOY' }, rules)
    ).toBe(true);
    expect(taskMatchesReleaseReadinessFilter({ originalStatus: 'rc' }, rules)).toBe(
      false
    );
  });
});

describe('releaseReadinessEmptyListHintSpec', () => {
  it('uses default RC when key omitted', () => {
    expect(releaseReadinessEmptyListHintSpec({ readyStatusKey: null })).toEqual({
      kind: 'default_rc',
    });
  });

  it('returns custom status key when configured', () => {
    expect(releaseReadinessEmptyListHintSpec({ readyStatusKey: 'done' })).toEqual({
      kind: 'custom_status',
      statusKey: 'done',
    });
  });
});
