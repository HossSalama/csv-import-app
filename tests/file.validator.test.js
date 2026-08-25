const { validateFile } = require('../src/validators/file.validator');

describe('file.validator', () => {
  test('rejects when no file is provided', () => {
    const result = validateFile(undefined);
    expect(result.valid).toBe(false);
  });

  test('accepts a valid .csv file', () => {
    const result = validateFile({ originalname: 'customers.csv', mimetype: 'text/csv', size: 1024 });
    expect(result.valid).toBe(true);
  });

  test('rejects a non-csv file', () => {
    const result = validateFile({ originalname: 'customers.xlsx', mimetype: 'application/vnd.ms-excel-fake', size: 1024 });
    expect(result.valid).toBe(false);
  });

  test('rejects a file over the size limit', () => {
    const result = validateFile({ originalname: 'customers.csv', mimetype: 'text/csv', size: 6 * 1024 * 1024 });
    expect(result.valid).toBe(false);
  });

  test('rejects an empty file', () => {
    const result = validateFile({ originalname: 'customers.csv', mimetype: 'text/csv', size: 0 });
    expect(result.valid).toBe(false);
  });
});
