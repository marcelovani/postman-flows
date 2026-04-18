/**
 * Run command — assembles a temporary flat collection for a flow and passes
 * it to newman.run().
 *
 * The temporary collection is built in memory and never written to disk.
 * It contains only the requests belonging to the flow, in the declared order,
 * and strips any collection-level scripts that reference `_flow_steps` (a
 * routing helper that is unnecessary when running a flat sequence).
 */

import * as fs from 'fs';
import * as path from 'path';
import newman, { type NewmanRunOptions } from 'newman';
import { findRequest, loadCollection, resolveCollectionPath, resolveEnvironmentPath } from '../lib/collection.js';
import { extractFlowDef, findFlowRequest, listFlows } from '../lib/flows.js';
import type { FlowDef, PostmanCollection, RunOptions } from '../lib/types.js';

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Build the temporary flat collection that Newman will run.
 * Exported for unit-testability.
 */
export function buildTempCollection(
  collection: PostmanCollection,
  flowDef: FlowDef,
): Record<string, unknown> {
  const flowItems = flowDef.steps.map((stepName) => {
    const req = findRequest(collection.item, stepName);
    if (!req) throw new Error(`Step "${stepName}" not found in collection.`);
    return req;
  });

  return {
    info: {
      ...collection.info,
      name: `${collection.info.name} — Flow: ${flowDef.name}`,
    },
    // Strip collection-level test scripts that reference _flow_steps.
    // Those are routing helpers for running the whole collection; they are
    // unnecessary (and break flow isolation) when running a flat sequence.
    event: (collection.event ?? []).filter((e) => {
      const src = (e.script?.exec ?? []).join('\n');
      return !src.includes('_flow_steps');
    }),
    item: flowItems,
  };
}

/** Run a single pre-resolved flow definition. */
async function runFlowDef(
  collection: PostmanCollection,
  flowDef: FlowDef,
  envPath: string | undefined,
  resultsDir: string | undefined,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const tempCollection = buildTempCollection(collection, flowDef);

    if (resultsDir) {
      fs.mkdirSync(resultsDir, { recursive: true });
    }

    console.log(`\n▶ Running flow: ${flowDef.name}`);
    console.log(`  Steps: ${flowDef.steps.join(' → ')}\n`);

    const reporters: string[] = ['cli'];
    const reporter: Record<string, unknown> = {};

    if (resultsDir) {
      reporters.push('junit', 'htmlextra');
      reporter['junit'] = { export: path.join(resultsDir, 'results.xml') };
      reporter['htmlextra'] = { export: path.join(resultsDir, 'report.html') };
    }

    newman.run(
      {
        collection: tempCollection as NewmanRunOptions['collection'],
        environment: envPath,
        insecure: true,
        reporters,
        reporter,
      },
      (err, summary) => {
        if (err) return reject(err);
        const failed = summary.run.failures.length;
        if (failed > 0) {
          console.error(`\n❌ Flow "${flowDef.name}" had ${failed} failure(s).`);
          return reject(new Error(`${failed} failure(s)`));
        }
        console.log(`\n✅ Flow "${flowDef.name}" passed.`);
        resolve();
      },
    );
  });
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Run a single named flow. */
export async function runFlow(opts: RunOptions & { flow: string }): Promise<void> {
  const collectionPath = resolveCollectionPath(opts.collection);
  const envPath = resolveEnvironmentPath(opts.env);
  const resultsDir =
    opts.resultsDir !== undefined
      ? opts.resultsDir
      : path.join(process.cwd(), 'tests', 'results', 'newman');

  const collection = loadCollection(collectionPath);
  const flowReq = findFlowRequest(collection, opts.flow);
  const flowDef = extractFlowDef(flowReq);
  await runFlowDef(collection, flowDef, envPath, resultsDir);
}

/** Run every flow defined in the collection's Flows/ folder, in order. */
export async function runAllFlows(opts: RunOptions): Promise<void> {
  const collectionPath = resolveCollectionPath(opts.collection);
  const envPath = resolveEnvironmentPath(opts.env);
  const resultsDir =
    opts.resultsDir !== undefined
      ? opts.resultsDir
      : path.join(process.cwd(), 'tests', 'results', 'newman');

  const collection = loadCollection(collectionPath);
  const flowRequests = listFlows(collection);

  if (flowRequests.length === 0) {
    throw new Error('No flows found in collection Flows/ folder.');
  }

  for (const flowReq of flowRequests) {
    const flowDef = extractFlowDef(flowReq);
    await runFlowDef(collection, flowDef, envPath, resultsDir);
  }

  console.log('\n✅ All flows passed.');
}
