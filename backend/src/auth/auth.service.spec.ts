/**
 * @file   auth.service.spec.ts
 *
 * Exercises the refresh-token rotation contract: after refresh, the
 * previously-used refresh token must be rejected.
 */

import { AuthService } from './auth.service';

/* ---------- in-memory helpers ---------- */

interface UserRow {
  id: string;
  email: string;
  password_hash: string;
  full_name: string | null;
  role: 'ADMIN' | 'INVOICE_OPERATOR';
  status: 'ACTIVE' | 'SUSPENDED' | 'DELETED';
  refresh_token_hash: string | null;
  reset_token_hash: string | null;
  reset_token_expires_at: Date | null;
  last_login_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

function makeUsersRepo(): import('typeorm').Repository<UserRow> {
  const rows = new Map<string, UserRow>();
  const api = {
    async findOne({ where }: { where: Partial<UserRow> }): Promise<UserRow | null> {
      for (const r of rows.values()) {
        const match = Object.entries(where).every(([k, v]) => (r as unknown as Record<string, unknown>)[k] === v);
        if (match) return r;
      }
      return null;
    },
    create(partial: Partial<UserRow>): UserRow {
      const now = new Date();
      return {
        id: partial.id ?? crypto.randomUUID(),
        email: partial.email ?? 'x@x',
        password_hash: partial.password_hash ?? '',
        full_name: partial.full_name ?? null,
        role: partial.role ?? 'INVOICE_OPERATOR',
        status: partial.status ?? 'ACTIVE',
        refresh_token_hash: partial.refresh_token_hash ?? null,
        reset_token_hash: partial.reset_token_hash ?? null,
        reset_token_expires_at: partial.reset_token_expires_at ?? null,
        last_login_at: partial.last_login_at ?? null,
        created_at: now, updated_at: now,
      };
    },
    async save(row: UserRow): Promise<UserRow> {
      rows.set(row.id, row);
      return row;
    },
    async update(id: string, patch: Partial<UserRow>): Promise<void> {
      const row = rows.get(id);
      if (row) rows.set(id, { ...row, ...patch, updated_at: new Date() });
    },
    createQueryBuilder(): unknown {
      // Not used in refresh-rotation flow; reset test uses its own repo.
      throw new Error('createQueryBuilder not implemented in stub');
    },
    _rows: rows,
  };
  return api as unknown as import('typeorm').Repository<UserRow>;
}

let tokenCounter = 0;
function makeJwt() {
  return {
    // Monotonic counter guarantees every call produces a distinct token,
    // including distinct access-vs-refresh within the same issueTokens() call.
    signAsync: jest.fn(async (payload: Record<string, unknown>) => {
      tokenCounter += 1;
      return `${JSON.stringify(payload)}.tok-${tokenCounter}`;
    }),
  } as const;
}

function makeConfig(): import('@nestjs/config').ConfigService {
  const table: Record<string, string> = {
    JWT_ACCESS_SECRET:  'test-access-secret',
    JWT_REFRESH_SECRET: 'test-refresh-secret',
    JWT_ACCESS_EXPIRY:  '15m',
    JWT_REFRESH_EXPIRY: '7d',
    BCRYPT_SALT_ROUNDS: '4',           // fast for tests
    SEED_ADMIN_EMAIL:   'admin@test',
    SEED_ADMIN_PASSWORD: 'seed-admin',
    SEED_OPERATOR_EMAIL: 'op@test',
    SEED_OPERATOR_PASSWORD: 'seed-op',
  };
  return { get: (k: string) => table[k] } as unknown as import('@nestjs/config').ConfigService;
}

const silentLogger = {
  setContext: () => silentLogger, log: jest.fn(), warn: jest.fn(), error: jest.fn(),
  audit: jest.fn(), debug: jest.fn(),
} as unknown as import('../common/logger/AppLogger').AppLogger;

describe('AuthService — refresh token rotation', () => {
  let service: AuthService;
  let repo: import('typeorm').Repository<UserRow>;
  let seedUserId: string;
  let bcrypt: typeof import('bcrypt');

  beforeAll(async () => {
    bcrypt = await import('bcrypt');
  });

  beforeEach(async () => {
    repo = makeUsersRepo();
    // Seed one user directly (skip onModuleInit's seed loop for this focused test).
    const pw = await bcrypt.hash('test-password', 4);
    const u = (repo as unknown as { create: (p: Partial<UserRow>) => UserRow }).create({
      email: 'alice@test', password_hash: pw, full_name: 'Alice',
      role: 'INVOICE_OPERATOR', status: 'ACTIVE',
    });
    seedUserId = u.id;
    await repo.save(u);

    service = new AuthService(repo as never, makeJwt() as never, makeConfig(), silentLogger);
  });

  it('rotates refresh_token_hash on each refresh and rejects old tokens', async () => {
    const login1 = await service.login({ email: 'alice@test', password: 'test-password' });
    expect(login1.refreshToken).toBeDefined();

    // Capture the stored hash after login
    const hashAfterLogin = (repo as unknown as { _rows: Map<string, UserRow> })._rows.get(seedUserId)!.refresh_token_hash;
    expect(hashAfterLogin).not.toBeNull();

    // First refresh succeeds with a DIFFERENT token and rotates the stored hash
    const login2 = await service.refresh(seedUserId, login1.refreshToken);
    expect(login2.refreshToken).not.toBe(login1.refreshToken);

    const hashAfterRefresh = (repo as unknown as { _rows: Map<string, UserRow> })._rows.get(seedUserId)!.refresh_token_hash;
    expect(hashAfterRefresh).not.toBeNull();
    expect(hashAfterRefresh).not.toBe(hashAfterLogin);

    // Refresh tokens are SHA-256d, not bcrypt'd (see AuthService.refreshTokenMatches)
    const sha256 = (s: string): string => require('crypto').createHash('sha256').update(s).digest('hex');
    expect(hashAfterLogin).toBe(sha256(login1.refreshToken));
    expect(hashAfterRefresh).toBe(sha256(login2.refreshToken));
    expect(hashAfterRefresh).not.toBe(sha256(login1.refreshToken));

    // Replaying the old refresh token must 401
    await expect(service.refresh(seedUserId, login1.refreshToken)).rejects.toThrow(/Invalid refresh token/);

    // New token still works
    const login3 = await service.refresh(seedUserId, login2.refreshToken);
    expect(login3.refreshToken).not.toBe(login2.refreshToken);
  });

  it('rejects refresh when user has logged out (refresh_token_hash cleared)', async () => {
    const login1 = await service.login({ email: 'alice@test', password: 'test-password' });
    await service.logout(seedUserId);
    await expect(service.refresh(seedUserId, login1.refreshToken)).rejects.toMatchObject({
      status: 401,
    });
  });
});
