/**
 * @file   invoice.validator.spec.ts
 * @module Invoice (EPIC-002) — unit tests
 */

import { InvoiceValidator } from './invoice.validator';
import {
  FileValidationException,
  UrlHostNotAllowedException,
} from '../common/exceptions';

describe('InvoiceValidator', () => {
  const validator = new InvoiceValidator();

  const sampleFile = {
    originalname: 'test.csv',
    mimetype: 'text/csv',
    size: 1_024,
  };

  describe('validateFile', () => {
    it('accepts a valid CSV', () => {
      expect(() => validator.validateFile(sampleFile)).not.toThrow();
    });

    it('rejects missing file', () => {
      expect(() => validator.validateFile(undefined)).toThrow(FileValidationException);
    });

    it('accepts .csv extension even with unexpected MIME', () => {
      expect(() =>
        validator.validateFile({ ...sampleFile, mimetype: 'application/octet-stream' }),
      ).not.toThrow();
    });

    it('rejects non-csv extension with unexpected MIME', () => {
      expect(() =>
        validator.validateFile({
          originalname: 'photo.png',
          mimetype: 'image/png',
          size: 1024,
        }),
      ).toThrow(FileValidationException);
    });

    it('rejects oversized files', () => {
      expect(() =>
        validator.validateFile({ ...sampleFile, size: 100 * 1024 * 1024 }, 50),
      ).toThrow(FileValidationException);
    });
  });

  describe('parseAndExtractUrls', () => {
    const allowlist = ['*'];

    it('parses sample format with "Invoice Links:" header (trailing colon)', () => {
      const csv = Buffer.from(
        'Invoice Links:\nhttps://example.com/a.jpg\nhttps://example.com/b.pdf\n',
      );
      const result = validator.parseAndExtractUrls(csv, allowlist);
      expect(result.rows).toHaveLength(2);
      expect(result.rows[0]).toMatchObject({ rowNumber: 1, url: 'https://example.com/a.jpg' });
      expect(result.detectedHeader).toBe('Invoice Links');
    });

    it('accepts header alias "url"', () => {
      const csv = Buffer.from('url\nhttps://example.com/a.jpg\n');
      expect(validator.parseAndExtractUrls(csv, allowlist).rows).toHaveLength(1);
    });

    it('strips UTF-8 BOM', () => {
      const csv = Buffer.concat([
        Buffer.from([0xef, 0xbb, 0xbf]),
        Buffer.from('Invoice Links:\nhttps://example.com/a.jpg\n'),
      ]);
      expect(validator.parseAndExtractUrls(csv, allowlist).rows).toHaveLength(1);
    });

    it('rejects empty CSV', () => {
      expect(() => validator.parseAndExtractUrls(Buffer.from('Invoice Links:\n'), allowlist)).toThrow(FileValidationException);
    });

    it('rejects CSV without recognised URL header', () => {
      const csv = Buffer.from('name,price\nA,10\n');
      expect(() => validator.parseAndExtractUrls(csv, allowlist)).toThrow(FileValidationException);
    });

    it('rejects row with empty URL cell (multi-column CSV)', () => {
      const csv = Buffer.from('Invoice Links,label\n,alpha\nhttps://example.com/a.jpg,beta\n');
      expect(() => validator.parseAndExtractUrls(csv, allowlist)).toThrow(FileValidationException);
    });

    it('silently skips fully-blank lines (csv-parse default)', () => {
      const csv = Buffer.from('Invoice Links:\n\nhttps://example.com/a.jpg\n');
      const result = validator.parseAndExtractUrls(csv, allowlist);
      expect(result.rows).toHaveLength(1);
    });

    it('rejects invalid URL', () => {
      const csv = Buffer.from('Invoice Links:\nnot-a-url\n');
      expect(() => validator.parseAndExtractUrls(csv, allowlist)).toThrow(FileValidationException);
    });

    it('rejects non-http(s) protocol', () => {
      const csv = Buffer.from('Invoice Links:\nfile:///etc/passwd\n');
      expect(() => validator.parseAndExtractUrls(csv, allowlist)).toThrow(FileValidationException);
    });
  });

  describe('enforceHostAllowlist', () => {
    it('allows any host when allowlist contains "*"', () => {
      expect(() => validator.enforceHostAllowlist('example.com', ['*'])).not.toThrow();
    });

    it('allows exact host match', () => {
      expect(() => validator.enforceHostAllowlist('api.bridgestone.com', ['api.bridgestone.com'])).not.toThrow();
    });

    it('allows wildcard subdomain', () => {
      expect(() => validator.enforceHostAllowlist('x.bridgestone.com', ['*.bridgestone.com'])).not.toThrow();
      expect(() => validator.enforceHostAllowlist('bridgestone.com', ['*.bridgestone.com'])).not.toThrow();
    });

    it('rejects host not in allowlist', () => {
      expect(() => validator.enforceHostAllowlist('evil.example.com', ['api.bridgestone.com'])).toThrow(UrlHostNotAllowedException);
    });

    it('is case-insensitive', () => {
      expect(() => validator.enforceHostAllowlist('API.BRIDGESTONE.COM', ['api.bridgestone.com'])).not.toThrow();
    });
  });
});
