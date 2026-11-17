// tests/qa-unit/logger-sanitization.test.js
// Unit tests for case-insensitive HR PII log redaction, recursive objects, arrays, circular references, and URL query sanitization ([S3-DSO-05])

const { sanitize, redactUrlQuery } = require('../../middleware/logger');

describe('Logger Sanitization & PII Redaction ([S3-DSO-05])', () => {
  describe('Case-Insensitive Sensitive Key Redaction', () => {
    test('redacts mixed-case sensitive keys (password, token, ssn, tin, salary)', () => {
      const input = {
        Password: 'secretPassword123',
        CURRENTpassword: 'oldPassword',
        NEW_PASSWORD: 'newSecretPassword',
        password_hash: '$2b$10$hashedvaluestring',
        token_hash: 'sha256hashstring',
        TOKEN: 'jwt.token.string',
        ACCESS_TOKEN: 'bearer-token',
        SECRET: 'app-secret-key',
        AUTHORIZATION: 'Bearer eyJhbGciOi...',
        Cookie: 'session=xyz',
        SSN: '000-00-0000',
        TIN: '12-3456789',
        Salary: 85000,
        normalField: 'safeValue'
      };

      const result = sanitize(input);

      expect(result.Password).toBe('[REDACTED]');
      expect(result.CURRENTpassword).toBe('[REDACTED]');
      expect(result.password_hash).toBe('[REDACTED]');
      expect(result.token_hash).toBe('[REDACTED]');
      expect(result.TOKEN).toBe('[REDACTED]');
      expect(result.ACCESS_TOKEN).toBe('[REDACTED]');
      expect(result.SECRET).toBe('[REDACTED]');
      expect(result.AUTHORIZATION).toBe('[REDACTED]');
      expect(result.Cookie).toBe('[REDACTED]');
      expect(result.SSN).toBe('[REDACTED]');
      expect(result.TIN).toBe('[REDACTED]');
      expect(result.Salary).toBe('[REDACTED]');
      expect(result.normalField).toBe('safeValue');
    });

    test('redacts HR-specific sensitive fields: birthdate and sepdate', () => {
      const hrRecord = {
        empno: '00001',
        firstname: 'Jane',
        lastname: 'Doe',
        BirthDate: '1990-05-15',
        SEPDATE: '2025-12-31',
        hiredate: '2020-01-10'
      };

      const result = sanitize(hrRecord);

      expect(result.empno).toBe('00001');
      expect(result.firstname).toBe('Jane');
      expect(result.BirthDate).toBe('[REDACTED]');
      expect(result.SEPDATE).toBe('[REDACTED]');
      expect(result.hiredate).toBe('2020-01-10');
    });
  });

  describe('Recursive Object and Array Sanitization', () => {
    test('recursively redacts nested objects and array items', () => {
      const payload = {
        id: '123',
        employee: {
          name: 'John Doe',
          compensation: {
            SALARY: 95000,
            currency: 'USD'
          }
        },
        credentials: [
          { type: 'primary', password: 'plainPassword' },
          { type: 'backup', token: 'backupToken' }
        ]
      };

      const result = sanitize(payload);

      expect(result.employee.compensation.SALARY).toBe('[REDACTED]');
      expect(result.employee.compensation.currency).toBe('USD');
      expect(result.credentials[0].password).toBe('[REDACTED]');
      expect(result.credentials[1].token).toBe('[REDACTED]');
    });

    test('gracefully handles circular references without infinite recursion', () => {
      const circularObj = { name: 'circularTest', password: 'secret' };
      circularObj.self = circularObj;

      const result = sanitize(circularObj);

      expect(result.name).toBe('circularTest');
      expect(result.password).toBe('[REDACTED]');
      expect(result.self).toBe('[CIRCULAR]');
    });

    test('returns primitives and non-objects unchanged', () => {
      expect(sanitize(null)).toBeNull();
      expect(sanitize(undefined)).toBeUndefined();
      expect(sanitize('string')).toBe('string');
      expect(sanitize(12345)).toBe(12345);
      expect(sanitize(true)).toBe(true);
    });
  });

  describe('URL Query String Redaction (redactUrlQuery)', () => {
    test('redacts sensitive query parameters: token, key, secret, password', () => {
      const url = '/api/auth/reset-password/validate?token=abcdef123456&email=user@hope.inc&key=apiSecretKey';
      const cleanUrl = redactUrlQuery(url);

      expect(cleanUrl).toContain('token=%5BREDACTED%5D');
      expect(cleanUrl).toContain('key=%5BREDACTED%5D');
      expect(cleanUrl).toContain('email=user%40hope.inc');
    });

    test('leaves non-sensitive query parameters untouched', () => {
      const url = '/api/employees?page=1&limit=20&search=Jane';
      const cleanUrl = redactUrlQuery(url);

      expect(cleanUrl).toBe(url);
    });

    test('returns URLs without query strings untouched', () => {
      const url = '/api/health';
      expect(redactUrlQuery(url)).toBe('/api/health');
      expect(redactUrlQuery(null)).toBeNull();
      expect(redactUrlQuery('')).toBe('');
    });
  });
});
