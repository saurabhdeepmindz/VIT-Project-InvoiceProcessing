/**
 * @file   image-fetch.service.spec.ts
 *
 * Unit tests for ImageFetchService — SSRF allowlist + retry contracts.
 * Network I/O via axios is mocked.
 */

import { ImageFetchService } from './image-fetch.service';
import {
  UrlFetchException, UrlHostNotAllowedException,
} from '../../common/exceptions';

jest.mock('axios');

// Re-import after mock
import axios, { AxiosError } from 'axios';

const mockedAxios = axios as jest.Mocked<typeof axios>;

const configFor = (overrides: Record<string, string> = {}) => {
  const table: Record<string, string> = {
    IMG_MAX_DOWNLOAD_MB: '30',
    IMG_DOWNLOAD_TIMEOUT_MS: '1000',
    IMG_DOWNLOAD_RETRY: '2',
    IMG_DOWNLOAD_BACKOFF_MS: '1',   // make retries near-instant in tests
    IMG_URL_HOST_ALLOWLIST: 'allowed.example.com',
    ...overrides,
  };
  return { get: <T = string>(k: string): T => table[k] as T };
};

const silentLogger = { setContext: () => silentLogger, log: jest.fn(), warn: jest.fn(), error: jest.fn(), audit: jest.fn(), debug: jest.fn() };

const okResponse = (bytes = Buffer.from('hello world')) => ({
  data: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
  headers: { 'content-type': 'image/jpeg' },
  config: { url: 'https://allowed.example.com/file.jpg' },
  status: 200,
});

describe('ImageFetchService', () => {
  beforeEach(() => { jest.clearAllMocks(); });

  it('rejects host not in allowlist (SSRF)', async () => {
    const svc = new ImageFetchService(configFor() as never, silentLogger as never);
    await expect(svc.fetch('https://evil.example.com/x.jpg')).rejects.toBeInstanceOf(UrlHostNotAllowedException);
    expect(mockedAxios.get).not.toHaveBeenCalled();
  });

  it('allows wildcard allowlist ("*")', async () => {
    mockedAxios.get.mockResolvedValueOnce(okResponse());
    const svc = new ImageFetchService(configFor({ IMG_URL_HOST_ALLOWLIST: '*' }) as never, silentLogger as never);
    const res = await svc.fetch('https://random.example.com/a.jpg');
    expect(res.attempts).toBe(1);
    expect(res.sha256).toMatch(/^[0-9a-f]{64}$/);
  });

  it('retries on transient 500, succeeds, returns hash', async () => {
    const err500 = new AxiosError('Server Error');
    err500.response = { status: 500, statusText: 'Server Error', data: null, headers: {}, config: {} as never };
    mockedAxios.get.mockRejectedValueOnce(err500).mockResolvedValueOnce(okResponse());

    const svc = new ImageFetchService(configFor() as never, silentLogger as never);
    const res = await svc.fetch('https://allowed.example.com/a.jpg');
    expect(res.attempts).toBe(2);
    expect(mockedAxios.get).toHaveBeenCalledTimes(2);
  });

  it('does NOT retry on 400 (non-retryable)', async () => {
    const err400 = new AxiosError('Bad Request');
    err400.response = { status: 400, statusText: 'Bad Request', data: null, headers: {}, config: {} as never };
    mockedAxios.get.mockRejectedValue(err400);

    const svc = new ImageFetchService(configFor() as never, silentLogger as never);
    await expect(svc.fetch('https://allowed.example.com/a.jpg')).rejects.toBeInstanceOf(UrlFetchException);
    expect(mockedAxios.get).toHaveBeenCalledTimes(1);  // no retries on 4xx
  });

  it('fails after all retries exhausted', async () => {
    const err500 = new AxiosError('Server Error');
    err500.response = { status: 503, statusText: 'Service Unavailable', data: null, headers: {}, config: {} as never };
    mockedAxios.get.mockRejectedValue(err500);

    const svc = new ImageFetchService(configFor() as never, silentLogger as never);  // retries=2 => 3 total attempts
    await expect(svc.fetch('https://allowed.example.com/a.jpg')).rejects.toBeInstanceOf(UrlFetchException);
    expect(mockedAxios.get).toHaveBeenCalledTimes(3);
  });

  it('rejects non-http(s) protocol at allowlist check', async () => {
    const svc = new ImageFetchService(configFor() as never, silentLogger as never);
    await expect(svc.fetch('file:///etc/passwd')).rejects.toBeInstanceOf(UrlFetchException);
    expect(mockedAxios.get).not.toHaveBeenCalled();
  });
});
