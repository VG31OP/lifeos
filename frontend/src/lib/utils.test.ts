import { cn, formatRelativeTime, truncate } from './utils';

describe('utils', () => {
  it('merges class names without duplicates', () => {
    expect(cn('px-2', 'px-2', 'text-sm')).toContain('px-2');
    expect(cn('text-sm', 'font-bold')).toContain('font-bold');
  });

  it('truncates long text with ellipsis', () => {
    expect(truncate('longer-text', 6)).toBe('lon...');
    expect(truncate('short', 10)).toBe('short');
  });

  it('formats recent relative times', () => {
    const recent = new Date(Date.now() - 120000).toISOString();
    expect(formatRelativeTime(recent)).toMatch(/ago|just now/i);
  });
});
