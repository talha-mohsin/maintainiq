/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import request from 'supertest';
import app from '../src/app.js';
import { connectDB } from '../src/config/db.js';

// Matches the seeded asset in src/config/db.js (ast-1 / HVAC-SR1-01).
const SEEDED_ASSET_ID = 'ast-1';

beforeAll(async () => {
  await connectDB();
});

describe('POST /api/issues (public issue reporting)', () => {
  it('rejects a request missing required fields', async () => {
    const res = await request(app)
      .post('/api/issues')
      .send({ title: 'Broken thing' }); // missing description/priority/category/assetId/reporter

    expect(res.status).toBe(400);
  });

  it('rejects an issue reported against a non-existent asset', async () => {
    const res = await request(app)
      .post('/api/issues')
      .send({
        assetId: 'ast-does-not-exist',
        title: 'Flickering display',
        description: 'The display flickers intermittently.',
        priority: 'Medium',
        category: 'Electrical',
        reporter: 'Test Reporter',
      });

    expect(res.status).toBe(404);
  });

  it('creates an issue against a valid asset and assigns a sequential issue number', async () => {
    const res = await request(app)
      .post('/api/issues')
      .send({
        assetId: SEEDED_ASSET_ID,
        title: 'Water leakage and reduced cooling',
        description: 'The AC is leaking water and cooling is weak.',
        priority: 'High',
        category: 'HVAC',
        reporter: 'Jane Reporter',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.issue).toBeDefined();

    const { issue } = res.body.data;
    expect(issue.issueNumber).toMatch(/^REQ-\d+$/);
    expect(issue.status).toBe('Reported');
    expect(issue.assetId).toBe(SEEDED_ASSET_ID);
    expect(issue.priority).toBe('High');
  });

  it('escalates the asset to Out of Service when a Critical issue is reported', async () => {
    const res = await request(app)
      .post('/api/issues')
      .send({
        assetId: SEEDED_ASSET_ID,
        title: 'Exposed live wiring near water leak',
        description: 'Exposed live wiring is in contact with a growing water leak — immediate hazard.',
        priority: 'Critical',
        category: 'Electrical',
        reporter: 'Safety Officer',
      });

    expect(res.status).toBe(201);

    const assetRes = await request(app).get(`/api/assets/public/${'HVAC-SR1-01'}`);
    expect(assetRes.status).toBe(200);
    expect(assetRes.body.data.asset.status).toBe('Out of Service');
  });
});

describe('GET /api/issues (protected)', () => {
  it('rejects an unauthenticated request', async () => {
    const res = await request(app).get('/api/issues');
    expect(res.status).toBe(401);
  });

  it('returns the issue list once logged in as Admin', async () => {
    const agent = request.agent(app);

    const loginRes = await agent
      .post('/api/auth/login')
      .send({ email: 'admin@maintainiq.com', password: 'admin123' });
    expect(loginRes.status).toBe(200);

    const issuesRes = await agent.get('/api/issues');
    expect(issuesRes.status).toBe(200);
    expect(Array.isArray(issuesRes.body.issues)).toBe(true);
    expect(issuesRes.body.issues.length).toBeGreaterThan(0);
  });
});
