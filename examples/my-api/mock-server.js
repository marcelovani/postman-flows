/**
 * Mock server for the my-api example collection.
 * Implements exactly the endpoints the two flows exercise.
 *
 * Usage:
 *   node examples/my-api/mock-server.js
 *   # then in another terminal:
 *   npx newman-flows run --all \
 *     --collection ./examples/my-api/my-api.postman_collection.json \
 *     --env ./examples/my-api/local.postman_environment.json
 */

const http = require('http');

// --- in-memory state ---
let items = [];
let invitations = [];
const members = {}; // { [item_id]: [user_id, ...] }

const users = {
  'admin@example.com': { id: 'user-admin', email: 'admin@example.com', password: 'password' },
  'member@example.com': { id: 'user-member', email: 'member@example.com', password: 'password' },
};

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function readBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => {
      try {
        resolve(JSON.parse(body));
      } catch {
        resolve({});
      }
    });
  });
}

function send(res, status, body) {
  const json = JSON.stringify(body);
  res.writeHead(status, { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(json) });
  res.end(json);
}

const server = http.createServer(async (req, res) => {
  const url = req.url.split('?')[0];
  const method = req.method;

  // POST /api/auth/login
  if (method === 'POST' && url === '/api/auth/login') {
    const body = await readBody(req);
    const user = users[body.username];
    if (!user || user.password !== body.password) {
      return send(res, 401, { error: 'Invalid credentials' });
    }
    return send(res, 200, {
      access_token: `mock-token-${user.id}`,
      user: { id: user.id, email: user.email },
    });
  }

  // POST /api/items
  if (method === 'POST' && url === '/api/items') {
    const body = await readBody(req);
    const item = { id: uid(), name: body.name, status: body.status || 'active' };
    items.push(item);
    return send(res, 201, item);
  }

  // GET /api/items
  if (method === 'GET' && url === '/api/items') {
    return send(res, 200, items);
  }

  // PATCH /api/items/:id
  const patchItem = url.match(/^\/api\/items\/([^/]+)$/);
  if (method === 'PATCH' && patchItem) {
    const body = await readBody(req);
    const item = items.find((i) => i.id === patchItem[1]);
    if (!item) return send(res, 404, { error: 'Not found' });
    Object.assign(item, body);
    return send(res, 200, item);
  }

  // GET /api/items/:id
  const getItem = url.match(/^\/api\/items\/([^/]+)$/);
  if (method === 'GET' && getItem) {
    const item = items.find((i) => i.id === getItem[1]);
    if (!item) return send(res, 404, { error: 'Not found' });
    return send(res, 200, item);
  }

  // POST /api/items/:id/invitations
  const createInvitation = url.match(/^\/api\/items\/([^/]+)\/invitations$/);
  if (method === 'POST' && createInvitation) {
    const body = await readBody(req);
    const inv = { id: uid(), item_id: createInvitation[1], invitee_email: body.email, status: 'pending' };
    invitations.push(inv);
    return send(res, 201, inv);
  }

  // POST /api/invitations/:id/accept
  const acceptInvitation = url.match(/^\/api\/invitations\/([^/]+)\/accept$/);
  if (method === 'POST' && acceptInvitation) {
    const inv = invitations.find((i) => i.id === acceptInvitation[1]);
    if (!inv) return send(res, 404, { error: 'Not found' });
    inv.status = 'accepted';
    const invitedUser = Object.values(users).find((u) => u.email === inv.invitee_email);
    if (invitedUser) {
      if (!members[inv.item_id]) members[inv.item_id] = [];
      if (!members[inv.item_id].find((m) => m.id === invitedUser.id)) {
        members[inv.item_id].push({ id: invitedUser.id, email: invitedUser.email });
      }
    }
    return send(res, 200, { status: 'accepted' });
  }

  // GET /api/items/:id/members
  const getMembers = url.match(/^\/api\/items\/([^/]+)\/members$/);
  if (method === 'GET' && getMembers) {
    return send(res, 200, members[getMembers[1]] || []);
  }

  send(res, 404, { error: 'Not found' });
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log(`Mock server running on http://localhost:${PORT}`);
  console.log('Press Ctrl+C to stop.');
});
