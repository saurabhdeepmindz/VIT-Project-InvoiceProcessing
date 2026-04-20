/**
 * @file   pdf-inspect.service.spec.ts
 *
 * Unit tests for PdfInspectService — detection + safety around non-PDFs.
 * Note: full page-count assertion requires a real PDF byte stream; skipped here
 * to keep this spec dep-free. The smoke-test in the integration demo covers it.
 */

import { PdfInspectService } from './pdf-inspect.service';

const silentLogger = { setContext: () => silentLogger, log: jest.fn(), warn: jest.fn(), error: jest.fn(), audit: jest.fn(), debug: jest.fn() };

describe('PdfInspectService', () => {
  const svc = new PdfInspectService(silentLogger as never);

  it('identifies a JPG buffer as non-PDF, pageCount=1', async () => {
    const jpgHeader = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 16, 0x4a, 0x46, 0x49, 0x46, 0]);
    const res = await svc.inspect(jpgHeader);
    expect(res).toEqual({ isPdf: false, pageCount: 1 });
  });

  it('identifies a PDF header', async () => {
    // Minimal parsing-incompatible PDF stub: header only.
    // We expect inspect() to detect PDF but throw on parse failure.
    const pdfLikeHeader = Buffer.from('%PDF-1.4\n garbage garbage garbage');
    await expect(svc.inspect(pdfLikeHeader)).rejects.toMatchObject({
      response: { error: 'PDF_CONVERSION_ERROR' },
    });
  });

  it('returns non-PDF for empty buffer', async () => {
    const res = await svc.inspect(Buffer.alloc(0));
    expect(res).toEqual({ isPdf: false, pageCount: 1 });
  });
});
