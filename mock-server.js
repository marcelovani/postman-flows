#!/usr/bin/env node
'use strict';

/**
 * mock-server.js
 *
 * A lightweight Express server that mocks every API endpoint used by the
 * Postman collection. State (organisations, invitations) is held in memory
 * so that variables set by one request (e.g. organisation_id) are available
 * to subsequent requests in the same flow.
 *
 * Usage:
 *   node mock-server.js          # starts on port 3000
 *   PORT=4000 node mock-server.js
 */

const express = require('express');
const app = express();
app.use(express.json());

// ---------------------------------------------------------------------------
// In-memory state
// ---------------------------------------------------------------------------

const orgs        = {};   // { [id]: { id, name, members: [{id, email}] } }
const invitations = {};   // { [id]: { id, orgId, email, status } }

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

function requireAuth(req, res) {
  const auth = req.headers.authorization || '';
  if (!auth.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or invalid Authorization header' });
    return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// Health check
// ---------------------------------------------------------------------------

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

// ---------------------------------------------------------------------------
// Authentication
//
// POST /api/auth/login
// Body: { username, password }
// Returns a token derived from the username so admin and member tokens differ.
// ---------------------------------------------------------------------------

app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body || {};

  if (!username || !password) {
    return res.status(400).json({ error: 'username and password are required' });
  }

  const token = `mock-token-${username.replace(/[^a-z0-9]/gi, '-')}-${uid()}`;

  res.status(200).json({
    access_token: token,
    user: {
      id:    `user-${uid()}`,
      email: username,
    },
  });
});

// ---------------------------------------------------------------------------
// Organisations
// ---------------------------------------------------------------------------

// POST /api/organisations — create
app.post('/api/organisations', (req, res) => {
  if (!requireAuth(req, res)) return;

  const { name } = req.body || {};
  if (!name) return res.status(400).json({ error: 'name is required' });

  const id  = `org-${uid()}`;
  const org = { id, name, members: [{ id: `user-${uid()}`, email: 'admin@example.com' }] };
  orgs[id]  = org;

  res.status(201).json(org);
});

// PATCH /api/organisations/:id — update name
app.patch('/api/organisations/:id', (req, res) => {
  if (!requireAuth(req, res)) return;

  const org = orgs[req.params.id];
  if (!org) return res.status(404).json({ error: 'Organisation not found' });

  if (req.body.name) org.name = req.body.name;

  res.status(200).json(org);
});

// GET /api/organisations/:id — read
app.get('/api/organisations/:id', (req, res) => {
  if (!requireAuth(req, res)) return;

  const org = orgs[req.params.id];
  if (!org) return res.status(404).json({ error: 'Organisation not found' });

  res.status(200).json(org);
});

// ---------------------------------------------------------------------------
// Invitations
// ---------------------------------------------------------------------------

// POST /api/organisations/:id/invitations — send invitation
app.post('/api/organisations/:id/invitations', (req, res) => {
  if (!requireAuth(req, res)) return;

  const org = orgs[req.params.id];
  if (!org) return res.status(404).json({ error: 'Organisation not found' });

  const { email } = req.body || {};
  if (!email) return res.status(400).json({ error: 'email is required' });

  const id         = `inv-${uid()}`;
  invitations[id]  = { id, orgId: req.params.id, email, status: 'pending' };

  res.status(201).json(invitations[id]);
});

// POST /api/invitations/:id/accept — accept invitation
app.post('/api/invitations/:id/accept', (req, res) => {
  if (!requireAuth(req, res)) return;

  const inv = invitations[req.params.id];
  if (!inv) return res.status(404).json({ error: 'Invitation not found' });

  if (inv.status === 'accepted') {
    return res.status(409).json({ error: 'Invitation already accepted' });
  }

  inv.status = 'accepted';

  // Add the invited member to the organisation
  const org = orgs[inv.orgId];
  if (org) {
    org.members.push({ id: `user-${uid()}`, email: inv.email });
  }

  res.status(200).json({ status: 'accepted', invitationId: inv.id });
});

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`[mock] Server listening at http://localhost:${PORT}`);
  console.log(`[mock] Endpoints:`);
  console.log(`[mock]   POST   /api/auth/login`);
  console.log(`[mock]   POST   /api/organisations`);
  console.log(`[mock]   PATCH  /api/organisations/:id`);
  console.log(`[mock]   GET    /api/organisations/:id`);
  console.log(`[mock]   POST   /api/organisations/:id/invitations`);
  console.log(`[mock]   POST   /api/invitations/:id/accept`);
});
