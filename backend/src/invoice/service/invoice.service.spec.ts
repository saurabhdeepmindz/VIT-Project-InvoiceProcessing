/**
 * @file   invoice.service.spec.ts
 *
 * Unit tests for InvoiceService with all collaborators mocked.
 * Covers: duplicate detection, happy-path event emission, error propagation.
 */

import { InvoiceService } from './invoice.service';
import { InvoiceValidator } from '../invoice.validator';
import { InvoiceTransformer } from '../invoice.transformer';
import { DuplicateCsvException } from '../../common/exceptions';
import { INVOICE_EVENTS } from '../constants';

describe('InvoiceService', () => {
  let service: InvoiceService;

  const batchRepo = {
    findByCsvHash: jest.fn(),
    findById:      jest.fn(),
    save:          jest.fn(),
    listByUser:    jest.fn(),
  };
  const fileStorage = {
    uploadBuffer: jest.fn(async (_b: Buffer, p: string) => p),
  };
  const eventEmitter = { emit: jest.fn() };
  const config = {
    get: jest.fn((k: string) => {
      const table: Record<string, string> = {
        MAX_UPLOAD_SIZE_MB: '50',
        IMG_URL_HOST_ALLOWLIST: '*',
        UPLOAD_DIR_PATH: 'upload/',
      };
      return table[k];
    }),
  };
  const logger = { setContext: () => logger, log: jest.fn(), warn: jest.fn(), error: jest.fn(), audit: jest.fn(), debug: jest.fn() };

  const dataSource = {
    transaction: jest.fn(async (cb: (tx: unknown) => Promise<unknown>) => {
      const txRepos = {
        getRepository: () => ({
          create: (x: Record<string, unknown>) => x,
          save: async (x: Record<string, unknown>) => ({
            ...x,
            id: x.id ?? 'new-batch-id',
            created_at: new Date('2026-04-20T00:00:00Z'),
            updated_at: new Date('2026-04-20T00:00:00Z'),
          }),
          insert: async () => undefined,
        }),
      };
      return cb(txRepos);
    }),
    getRepository: () => ({
      findOne: async () => null,
    }),
  };

  const validator = new InvoiceValidator();
  const transformer = new InvoiceTransformer();

  beforeEach(() => {
    jest.clearAllMocks();
    service = new InvoiceService(
      batchRepo as never,
      validator,
      transformer,
      fileStorage as never,
      eventEmitter as never,
      config as never,
      logger as never,
      dataSource as never,
    );
  });

  const csvFile = {
    originalname: 'my.csv',
    mimetype: 'text/csv',
    size: 100,
    buffer: Buffer.from('Invoice Links:\nhttps://a.com/x.jpg\nhttps://a.com/y.jpg\n'),
  };

  it('rejects duplicate CSV by content hash with 409', async () => {
    batchRepo.findByCsvHash.mockResolvedValue({ id: 'existing-batch' });
    await expect(service.createBatchFromCsv(csvFile, 'user-1')).rejects.toBeInstanceOf(DuplicateCsvException);
    expect(fileStorage.uploadBuffer).not.toHaveBeenCalled();
    expect(eventEmitter.emit).not.toHaveBeenCalled();
  });

  it('creates batch + emits event on valid CSV', async () => {
    batchRepo.findByCsvHash.mockResolvedValue(null);

    const result = await service.createBatchFromCsv(csvFile, 'user-1');

    expect(fileStorage.uploadBuffer).toHaveBeenCalledTimes(1);
    expect(dataSource.transaction).toHaveBeenCalledTimes(1);
    expect(eventEmitter.emit).toHaveBeenCalledWith(INVOICE_EVENTS.UPLOADED, expect.objectContaining({
      userId: 'user-1', recordCount: 2,
    }));
    expect(result).toMatchObject({
      totalRecords: 2, status: 'UPLOADED',
    });
    expect(result.csvContentHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('propagates validator errors without calling storage', async () => {
    batchRepo.findByCsvHash.mockResolvedValue(null);
    const bad = { ...csvFile, buffer: Buffer.from('no,valid,header\n1,2,3\n') };
    await expect(service.createBatchFromCsv(bad, 'user-1')).rejects.toThrow();
    expect(fileStorage.uploadBuffer).not.toHaveBeenCalled();
    expect(eventEmitter.emit).not.toHaveBeenCalled();
  });
});
