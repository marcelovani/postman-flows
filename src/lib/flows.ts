/**
 * Flow definition extraction from a Postman collection.
 *
 * Flows live in the "Flows/" folder of the collection. Each flow is a leaf
 * request (not a sub-folder) whose pre-request script calls:
 *
 *   steps(['Step One', 'Step Two', ...]);
 *
 * The steps array is captured by running the script in a Node.js vm sandbox
 * with `steps` bound to a capture function. No other sandbox globals are
 * provided, so the script cannot perform I/O or access Node APIs.
 */

import * as vm from 'vm';
import { findFolder } from './collection.js';
import type { FlowDef, PostmanCollection, PostmanItem } from './types.js';

// ---------------------------------------------------------------------------
// Public helpers
// ---------------------------------------------------------------------------

/**
 * Return all flow requests from the Flows/ folder.
 * Sub-folders inside Flows/ are skipped — only leaf items (requests) count.
 */
export function listFlows(collection: PostmanCollection): PostmanItem[] {
  const folder = findFolder(collection.item, 'Flows');
  if (!folder) {
    throw new Error('"Flows" folder not found in collection.');
  }
  return (folder.item ?? []).filter((r) => !r.item);
}

/**
 * Extract the step names from a flow request's pre-request script.
 * Throws if the script is missing or does not call steps().
 */
export function extractFlowDef(flowReq: PostmanItem): FlowDef {
  const preReq = flowReq.event?.find((e) => e.listen === 'prerequest');
  if (!preReq?.script?.exec?.length) {
    throw new Error(`No pre-request script found in flow "${flowReq.name}".`);
  }

  const scriptSrc = preReq.script.exec.join('\n');
  let capturedSteps: string[] | null = null;

  try {
    vm.runInNewContext(scriptSrc, {
      steps: (stepsArray: string[]) => {
        capturedSteps = stepsArray;
      },
    });
  } catch (e) {
    throw new Error(
      `Failed to evaluate pre-request script in "${flowReq.name}": ${(e as Error).message}`,
    );
  }

  if (!capturedSteps || (capturedSteps as string[]).length === 0) {
    throw new Error(
      `No valid steps() call found in pre-request script of "${flowReq.name}".`,
    );
  }

  return { name: flowReq.name, steps: capturedSteps };
}

/**
 * Find a flow request by name in the Flows/ folder.
 * Throws with available flow names if not found.
 */
export function findFlowRequest(collection: PostmanCollection, flowName: string): PostmanItem {
  const flowRequests = listFlows(collection);
  const flowReq = flowRequests.find((r) => r.name === flowName);
  if (!flowReq) {
    const available = flowRequests.map((r) => r.name).join(', ');
    throw new Error(`Flow "${flowName}" not found.\nAvailable flows: ${available}`);
  }
  return flowReq;
}
