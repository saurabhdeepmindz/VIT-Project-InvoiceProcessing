/**
 * run-dir.js — shared helpers for per-run test-output folders. CommonJS so
 * Playwright's config loader (which uses require) can consume it directly.
 *
 * Layout:
 *   tests/e2e/test-output/runs/2026-04-21/run-01/{report,results}/
 *   tests/e2e/test-output/runs/2026-04-21/run-02/...
 *   tests/e2e/test-output/latest.json            { "runDir": "runs/…/run-XX" }
 *   tests/e2e/test-output/latest/                copy of the latest run
 *
 * Exposes:
 *   computeRunDir(outputRoot)         Reserves the next run-NN folder for today.
 *                                     Honours E2E_RUN_DIR if already set.
 *   writeLatestPointer(root, runDir)  Writes latest.json + refreshes latest/ copy.
 *   pruneOldRuns(root, keep)          Deletes runs past the retention cap.
 *   getOutputRoot()                   Absolute path to test-output/.
 */

const {
  mkdirSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
  cpSync,
  existsSync,
} = require('node:fs');
const { join, relative, resolve } = require('node:path');

const RUNS_SUBDIR = 'runs';

function pad2(n) {
  return String(n).padStart(2, '0');
}

function today() {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function computeRunDir(outputRoot) {
  // Already pinned by an orchestrator (run-per-epic) OR by a prior config
  // load in the same process tree (Playwright re-loads the config in each
  // worker). Both cases reuse the same folder; we just return it.
  const pinned = process.env.E2E_RUN_DIR;
  if (pinned && pinned.trim().length > 0) {
    mkdirSync(pinned, { recursive: true });
    return resolve(pinned);
  }

  const dayDir = join(outputRoot, RUNS_SUBDIR, today());
  mkdirSync(dayDir, { recursive: true });

  const existing = readdirSync(dayDir)
    .filter((name) => /^run-\d+$/.test(name))
    .map((name) => Number(name.slice(4)))
    .filter((n) => Number.isFinite(n));

  const next = existing.length ? Math.max(...existing) + 1 : 1;
  const runDir = resolve(join(dayDir, `run-${pad2(next)}`));
  mkdirSync(runDir, { recursive: true });

  // Pin for every subsequent config load in this process tree (workers,
  // teardown, etc.). Idempotent: the conditional above short-circuits.
  process.env.E2E_RUN_DIR = runDir;
  return runDir;
}

function writeLatestPointer(outputRoot, runDir) {
  const relPath = relative(outputRoot, runDir).replace(/\\/g, '/');
  const latestJson = join(outputRoot, 'latest.json');
  writeFileSync(
    latestJson,
    JSON.stringify(
      { runDir: relPath, updatedAt: new Date().toISOString() },
      null,
      2,
    ),
    'utf-8',
  );

  const latestDir = join(outputRoot, 'latest');
  if (existsSync(latestDir)) rmSync(latestDir, { recursive: true, force: true });
  try {
    cpSync(runDir, latestDir, { recursive: true });
  } catch (err) {
    console.warn(`[run-dir] failed to refresh latest/ copy: ${err.message}`);
  }
}

function pruneOldRuns(outputRoot, keep) {
  if (!Number.isFinite(keep) || keep <= 0) return;
  const runsRoot = join(outputRoot, RUNS_SUBDIR);
  if (!existsSync(runsRoot)) return;

  const all = [];
  for (const day of readdirSync(runsRoot)) {
    const dayPath = join(runsRoot, day);
    if (!statSync(dayPath).isDirectory()) continue;
    for (const run of readdirSync(dayPath)) {
      const runPath = join(dayPath, run);
      if (!statSync(runPath).isDirectory()) continue;
      if (!/^run-\d+$/.test(run)) continue;
      all.push({ path: runPath, mtime: statSync(runPath).mtimeMs });
    }
  }

  all.sort((a, b) => b.mtime - a.mtime);
  const victims = all.slice(keep);
  for (const v of victims) {
    try {
      rmSync(v.path, { recursive: true, force: true });
    } catch (err) {
      console.warn(`[run-dir] failed to prune ${v.path}: ${err.message}`);
    }
  }

  // Prune now-empty day folders.
  for (const day of readdirSync(runsRoot)) {
    const dayPath = join(runsRoot, day);
    if (!statSync(dayPath).isDirectory()) continue;
    const children = readdirSync(dayPath);
    if (!children.length) {
      try {
        rmSync(dayPath, { recursive: true, force: true });
      } catch {
        /* ignore */
      }
    }
  }
}

function getOutputRoot() {
  return resolve(__dirname, '..', 'test-output');
}

module.exports = {
  computeRunDir,
  writeLatestPointer,
  pruneOldRuns,
  getOutputRoot,
};
