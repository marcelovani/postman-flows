// Global Vitest setup — runs before every test suite.
// Keep this file minimal; suite-specific setup belongs in test/<suite>/setup.ts.

import { vi } from 'vitest';

// Silence console output in tests unless LOG_LEVEL is set to a higher level.
process.env.LOG_LEVEL = process.env.LOG_LEVEL ?? 'silent';

// Expose vi globally so test files can use it without importing.
(globalThis as Record<string, unknown>).vi = vi;
