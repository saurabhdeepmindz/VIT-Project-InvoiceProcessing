#!/usr/bin/env node
/**
 * run-per-epic.mjs
 *
 * Orchestrates a separate Playwright run for each EPIC folder. All EPICs
 * share ONE timestamped run folder (test-output/runs/YYYY-MM-DD/run-XX/),
 * with per-EPIC subfolders inside it. Each sub-run runs Playwright with
 *   E2E_RUN_DIR=<shared-run-dir>
 *   E2E_OUTPUT_SCOPE=<epic-folder>
 *
 * Output:
 *   tests/e2e/test-output/runs/YYYY-MM-DD/run-XX/
 *     report-epic-001-auth/{html,junit.xml,results.json,summary.md}
 *     report-epic-002-upload/…
 *     results-epic-001-auth/
 *     …
 *
 * Exit status:
 *   0 — every EPIC passed (or skipped gracefully)
 *   1 — at least one EPIC had failing tests
 *
 * Usage:
 *   node tests/e2e/run-per-epic.mjs                           # every EPIC
 *   node tests/e2e/run-per-epic.mjs epic-001-auth epic-002-upload
 */

import { readdirSync, statSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { computeRunDir, getOutputRoot } = require('./lib/run-dir.js');

const __dirname = dirname(fileURLToPath(import.meta.url));
const E2E_DIR = __dirname;                                    // tests/e2e
const FRONTEND_DIR = resolve(__dirname, '..', '..');          // repo/frontend

function discoverEpicFolders() {
  return readdirSync(E2E_DIR)
    .filter((name) => name.startsWith('epic-'))
    .filter((name) => statSync(resolve(E2E_DIR, name)).isDirectory())
    .sort();
}

function runOne(epic, sharedRunDir) {
  console.log(`\n──── ${epic} ──────────────────────────────────────────`);
  // NOTE: do NOT pass --reporter here — that would override the config's
  // html/junit/json reporters, leaving the scoped report folder empty.
  const result = spawnSync(
    'npx',
    ['playwright', 'test', epic],
    {
      cwd: FRONTEND_DIR,
      env: {
        ...process.env,
        E2E_RUN_DIR: sharedRunDir,
        E2E_OUTPUT_SCOPE: epic,
      },
      stdio: 'inherit',
      shell: true,
    },
  );
  return result.status === 0;
}

function summarizeOne(epic, sharedRunDir) {
  const jsonPath = resolve(sharedRunDir, `report-${epic}`, 'results.json');
  if (!existsSync(jsonPath)) {
    console.warn(`  ⚠ no results.json at ${jsonPath}`);
    return;
  }
  spawnSync(
    'python',
    [resolve(E2E_DIR, 'summarize.py'), jsonPath],
    { stdio: 'inherit', shell: true },
  );
}

function main() {
  const requested = process.argv.slice(2);
  const epics = requested.length ? requested : discoverEpicFolders();
  if (!epics.length) {
    console.error('No EPIC folders found under tests/e2e/.');
    process.exit(2);
  }

  const sharedRunDir = computeRunDir(getOutputRoot());
  console.log(
    `Running ${epics.length} EPIC(s) into ${sharedRunDir}:\n  ${epics.join(', ')}`,
  );
  const outcomes = [];
  for (const epic of epics) {
    const ok = runOne(epic, sharedRunDir);
    outcomes.push({ epic, ok });
    summarizeOne(epic, sharedRunDir);
  }

  console.log('\n════ Per-EPIC run summary ═══════════════════════════════');
  for (const { epic, ok } of outcomes) {
    console.log(`  ${ok ? '✓' : '✗'} ${epic}`);
  }
  const failed = outcomes.filter((o) => !o.ok).length;
  if (failed) {
    console.log(
      `\n${failed} EPIC(s) had failures. See ${sharedRunDir}/report-<epic>/.`,
    );
    process.exit(1);
  }
  console.log(`\nAll EPICs green. Reports under ${sharedRunDir}/report-<epic>/.`);
}

main();
