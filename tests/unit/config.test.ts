import { describe, expect, it } from 'vitest';
import { PUBLIC_URL } from '../../src/config';

describe('PUBLIC_URL', () => {
  it('defaults to the canonical domain without a trailing slash', () => {
    expect(PUBLIC_URL).toBe('https://gogogo.rodeo');
  });
});
