# Running Postman Flows in CI Without Paying for Enterprise — Our Workaround

### Demo — against the mock server

`npm test` is self-contained. It starts the mock server, runs every flow against it,
and stops it afterwards. No real API, no credentials, no network required.

```bash
npm install
npm test
```

To run a single flow against the mock server:

```bash
# Terminal 1 — start the mock server
npm run mock

# Terminal 2 — run one flow
ENV=mock node dev/Postman/run-flow.js "Organisation creation"
ENV=mock node dev/Postman/run-flow.js "Member invitation"
```

### Pointing at your real API

When adapting this for your own project, replace the mock with your real backend. Export
your Postman collection and environment files into the same folder structure, then run:

```bash
# Against a local dev server (uses environment.local.postman_environment.json)
node dev/Postman/run-flow.js "Organisation creation"

# Against a staging or CI server (uses environment.ci.postman_environment.json)
ENV=ci node dev/Postman/run-flow.js "Organisation creation"
```

The environment files contain the `base_url` and credentials for each target. For CI,
set `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `MEMBER_USERNAME`, and `MEMBER_PASSWORD` as
environment variables (or GitHub Actions secrets).

---

## CI Integration

In GitHub Actions, the flows run automatically on every push and pull request:

```yaml
- name: Run Newman — all flows
  run: npm test

- name: Store Newman artifacts
  if: always()
  uses: actions/upload-artifact@v4
  with:
    name: newman-results
    path: tests/results/newman
    retention-days: 7
```

Adding a new flow requires no changes to `run-flow.js` or the CI workflow. Drop a new
`.json` file into `dev/Postman/flows/` and it's automatically picked up on the next run.

