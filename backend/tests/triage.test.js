/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import request from 'supertest';
import app from '../src/app.js';
import { connectDB } from '../src/config/db.js';

beforeAll(async () => {
  await connectDB(); // no MONGODB_URI in test env -> in-memory fallback, seeded
});

describe('POST /api/issues/triage (AI Issue Triage)', () => {
  it('rejects a description that is too short', async () => {
    const res = await request(app)
      .post('/api/issues/triage')
      .send({ description: 'hi' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/at least 5 characters/i);
  });

  it('rejects a missing description', async () => {
    const res = await request(app)
      .post('/api/issues/triage')
      .send({});

    expect(res.status).toBe(400);
  });

  it('returns a structured triage object without GEMINI_API_KEY configured (fallback simulation)', async () => {
    const res = await request(app)
      .post('/api/issues/triage')
      .send({ description: 'The AC is leaking water and making a loud noise.' });

    expect(res.status).toBe(200);
    expect(res.body.triage).toBeDefined();

    const { triage } = res.body;
    expect(typeof triage.title).toBe('string');
    expect(typeof triage.category).toBe('string');
    expect(typeof triage.priority).toBe('string');
    expect(Array.isArray(triage.possibleCauses)).toBe(true);
    expect(Array.isArray(triage.initialChecks)).toBe(true);
    expect(typeof triage.safetyWarning).toBe('string');
  });
});
