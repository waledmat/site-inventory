require('dotenv').config();
const request = require('supertest');
const app = require('../index');

// Known test credentials from seed/CLAUDE.md
const ADMIN    = { employee_id: '73106302', password: 'Admin@1234' };
const WALED    = { employee_id: 'waled',    password: 'Pass@1234' };  // storekeeper
const HASSAN   = { employee_id: '2250',     password: 'Pass@1234' };  // requester
const SUPERUSER = { employee_id: '2240',    password: 'Pass@1234' };  // superuser

// ── Helper ────────────────────────────────────────────────
async function getToken(credentials) {
  const res = await request(app).post('/api/auth/login').send(credentials);
  return res.body.token;
}

// ══════════════════════════════════════════════════════════
// HEALTH CHECK
// ══════════════════════════════════════════════════════════
describe('GET /health', () => {
  it('returns 200 with status ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.timestamp).toBeDefined();
    expect(typeof res.body.uptime).toBe('number');
  });
});

// ══════════════════════════════════════════════════════════
// AUTH — LOGIN
// ══════════════════════════════════════════════════════════
describe('POST /api/auth/login', () => {
  it('returns 200 and token for valid admin credentials', async () => {
    const res = await request(app).post('/api/auth/login').send(ADMIN);
    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.role).toBe('admin');
    expect(res.body.user.employee_id).toBe(ADMIN.employee_id);
    // password_hash must never be returned
    expect(res.body.user.password_hash).toBeUndefined();
  });

  it('returns 200 and token for valid storekeeper credentials', async () => {
    const res = await request(app).post('/api/auth/login').send(WALED);
    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.role).toBe('storekeeper');
  });

  it('returns 401 for wrong password', async () => {
    const res = await request(app).post('/api/auth/login').send({
      employee_id: ADMIN.employee_id,
      password: 'WrongPassword123',
    });
    expect(res.status).toBe(401);
    expect(res.body.error).toBeDefined();
    expect(res.body.token).toBeUndefined();
  });

  it('returns 401 for unknown employee_id', async () => {
    const res = await request(app).post('/api/auth/login').send({
      employee_id: 'DOES_NOT_EXIST',
      password: 'anything',
    });
    expect(res.status).toBe(401);
    expect(res.body.token).toBeUndefined();
  });

  it('returns 400 when employee_id is missing', async () => {
    const res = await request(app).post('/api/auth/login').send({ password: 'Admin@1234' });
    expect(res.status).toBe(400);
  });

  it('returns 400 when password is missing', async () => {
    const res = await request(app).post('/api/auth/login').send({ employee_id: '73106302' });
    expect(res.status).toBe(400);
  });
});

// ══════════════════════════════════════════════════════════
// AUTH — ME
// ══════════════════════════════════════════════════════════
describe('GET /api/auth/me', () => {
  it('returns 401 with no token', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  it('returns 401 with invalid token', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', 'Bearer invalidtoken123');
    expect(res.status).toBe(401);
  });

  it('returns 200 with valid admin token', async () => {
    const token = await getToken(ADMIN);
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    // /me returns { token, user: { ... } }
    expect(res.body.user.employee_id).toBe(ADMIN.employee_id);
    expect(res.body.user.password_hash).toBeUndefined();
  });
});

// ══════════════════════════════════════════════════════════
// ROLE-BASED ACCESS CONTROL
// ══════════════════════════════════════════════════════════
describe('Role-based access control', () => {
  it('GET /api/users — returns 401 with no token', async () => {
    const res = await request(app).get('/api/users');
    expect(res.status).toBe(401);
  });

  it('GET /api/users — returns 403 for requester role', async () => {
    const token = await getToken(HASSAN);
    const res = await request(app)
      .get('/api/users')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it('GET /api/users — returns 200 for storekeeper role (storekeepers can list users)', async () => {
    const token = await getToken(WALED);
    const res = await request(app)
      .get('/api/users')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
  });

  it('GET /api/users — returns 200 for admin role', async () => {
    const token = await getToken(ADMIN);
    const res = await request(app)
      .get('/api/users')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('GET /api/users — returns 200 for superuser role', async () => {
    const token = await getToken(SUPERUSER);
    const res = await request(app)
      .get('/api/users')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
  });
});

// ══════════════════════════════════════════════════════════
// SECURITY HEADERS
// ══════════════════════════════════════════════════════════
describe('Security headers', () => {
  it('returns security headers on every response', async () => {
    const res = await request(app).get('/health');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBe('DENY');
    expect(res.headers['strict-transport-security']).toBeDefined();
    expect(res.headers['content-security-policy']).toBeDefined();
  });
});

// ══════════════════════════════════════════════════════════
// PROJECTS
// ══════════════════════════════════════════════════════════
describe('GET /api/projects', () => {
  it('returns 401 with no token', async () => {
    const res = await request(app).get('/api/projects');
    expect(res.status).toBe(401);
  });

  it('returns 200 with valid token', async () => {
    const token = await getToken(ADMIN);
    const res = await request(app)
      .get('/api/projects')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});
