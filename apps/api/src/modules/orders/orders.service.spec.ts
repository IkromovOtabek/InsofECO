import { ORDER_TRANSITIONS, canTransition, cancellationPenalty, splitVolumeIntoTrips } from '@insof/shared';

describe('order rules', () => {
  it('splits volume into trips by capacity', () => {
    expect(splitVolumeIntoTrips(25, 8)).toEqual([8, 8, 8, 1]);
    expect(splitVolumeIntoTrips(16, 8)).toEqual([8, 8]);
    expect(splitVolumeIntoTrips(0, 8)).toEqual([]);
  });

  it('only TADBIRKOR confirms', () => {
    expect(canTransition(ORDER_TRANSITIONS, 'SUBMITTED', 'CONFIRMED', 'TADBIRKOR')).toBe(true);
    expect(canTransition(ORDER_TRANSITIONS, 'SUBMITTED', 'CONFIRMED', 'QURUVCHI')).toBe(false);
    expect(canTransition(ORDER_TRANSITIONS, 'COMPLETED', 'DRAFT', 'TADBIRKOR')).toBe(false);
  });

  it('cancellation penalty only inside 24h window', () => {
    const now = new Date('2026-09-17T08:00:00Z');
    expect(cancellationPenalty(1_000_000, new Date('2026-09-19T08:00:00Z'), now)).toBe(0);
    expect(cancellationPenalty(1_000_000, new Date('2026-09-17T20:00:00Z'), now)).toBe(100_000);
  });
});
