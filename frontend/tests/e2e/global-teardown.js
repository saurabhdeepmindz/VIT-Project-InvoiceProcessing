/**
 * global-teardown.js — refreshes latest/ pointer and prunes old runs.
 *
 * Runs once per Playwright invocation (aggregate OR each EPIC in per-EPIC
 * orchestration). In per-EPIC mode every child process points latest/ at
 * the same pinned run folder — idempotent, no race.
 *
 * Retention cap:
 *   E2E_KEEP_RUNS  integer, default 10. 0 disables pruning.
 */

const { getOutputRoot, pruneOldRuns, writeLatestPointer } = require('./lib/run-dir.js');

module.exports = async function globalTeardown() {
  const outputRoot = getOutputRoot();
  const runDir = process.env.E2E_RUN_DIR;

  if (runDir) {
    try {
      writeLatestPointer(outputRoot, runDir);
    } catch (err) {
      console.warn(`[teardown] writeLatestPointer failed: ${err.message}`);
    }
  }

  const keep = Number(process.env.E2E_KEEP_RUNS ?? 10);
  try {
    pruneOldRuns(outputRoot, keep);
  } catch (err) {
    console.warn(`[teardown] pruneOldRuns failed: ${err.message}`);
  }
};
