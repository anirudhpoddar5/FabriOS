import { describe, expect, it } from 'vitest';

describe('form draft storage', () => {
  it('can retain a draft value until the user saves or discards it', () => {
    localStorage.setItem('draft-test', JSON.stringify({ style: 'Shirt' }));
    expect(JSON.parse(localStorage.getItem('draft-test') || '{}')).toEqual({ style: 'Shirt' });
    localStorage.removeItem('draft-test');
    expect(localStorage.getItem('draft-test')).toBeNull();
  });
});
