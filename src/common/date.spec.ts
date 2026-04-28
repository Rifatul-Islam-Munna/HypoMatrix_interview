import { toIsoDate } from './date';

describe('toIsoDate', () => {
  it('formats dates without milliseconds', () => {
    expect(toIsoDate(new Date('2024-03-01T10:00:00.000Z'))).toBe(
      '2024-03-01T10:00:00Z',
    );
  });
});
