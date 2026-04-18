/**
 * List command — prints the flows defined in a collection with their step counts.
 *
 * The output is human-readable by default. The underlying getFlowSummaries()
 * function is also exported for programmatic use when you need the raw data
 * (e.g. to build your own reporter or filter flows before running).
 */

import { extractFlowDef, listFlows } from '../lib/flows.js';
import type { PostmanCollection } from '../lib/types.js';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface FlowSummary {
  /** Exact flow name as it appears in the Flows/ folder. */
  name: string;
  /** Number of steps declared in the flow's pre-request script. */
  steps: number;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Return a summary of every flow in the collection.
 *
 * @throws {Error} If the Flows/ folder is missing.
 * @throws {Error} If any flow pre-request script is invalid or missing.
 */
export function getFlowSummaries(collection: PostmanCollection): FlowSummary[] {
  return listFlows(collection).map((flowReq) => {
    const def = extractFlowDef(flowReq);
    return { name: def.name, steps: def.steps.length };
  });
}

/**
 * Print a human-readable list of flows and their step counts to stdout.
 *
 * Returns `true` when at least one flow was printed, `false` when the
 * Flows/ folder exists but is empty (so the caller can exit non-zero if
 * desired).
 *
 * @throws {Error} If the Flows/ folder is missing or a flow script is invalid.
 */
export function printFlowList(collection: PostmanCollection): boolean {
  const summaries = getFlowSummaries(collection);

  if (summaries.length === 0) {
    console.log('No flows found in Flows/ folder.');
    return false;
  }

  const maxLen = Math.max(...summaries.map((s) => s.name.length));

  console.log(`\nFlows in "${collection.info.name}":\n`);
  for (const { name, steps } of summaries) {
    const label = steps === 1 ? '1 step ' : `${steps} steps`;
    console.log(`  • ${name.padEnd(maxLen)}   (${label})`);
  }
  console.log();

  return true;
}
