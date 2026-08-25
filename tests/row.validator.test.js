const { validateRow } = require('../src/validators/row.validator');

describe('row.validator', () => {
  test('accepts a fully valid row', () => {
    const result = validateRow({ name: 'Ahmed Ali', email: 'ahmed@example.com', phone: '01000000001' });
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  test('rejects a row with an invalid email', () => {
    const result = validateRow({ name: 'Mohamed', email: 'invalid-email', phone: '01000000002' });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('email'))).toBe(true);
  });

  test('rejects a row with a missing name', () => {
    const result = validateRow({ name: '', email: 'sara@example.com', phone: '01000000003' });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('name'))).toBe(true);
  });

  test('rejects a row with a missing phone', () => {
    const result = validateRow({ name: 'Ali Hassan', email: 'ali@example.com', phone: '' });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('phone'))).toBe(true);
  });
});
