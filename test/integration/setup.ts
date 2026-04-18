/**
 * Vitest integration test setup.
 *
 * Starts the mock server before all tests in the integration project and
 * shuts it down afterwards. The server URL is exposed via MOCK_BASE_URL so
 * test files don't hardcode the port.
 */

import * as http from 'http';
import { afterAll, beforeAll } from 'vitest';
import { createApp } from '../mock/mock-server';

export const MOCK_PORT = Number(process.env.MOCK_PORT) || 3001;
export const MOCK_BASE_URL = `http://localhost:${MOCK_PORT}`;

let server: http.Server;

beforeAll(async () => {
  const app = createApp();
  await new Promise<void>((resolve, reject) => {
    server = app.listen(MOCK_PORT, resolve);
    server.once('error', reject);
  });
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
  });
});
