const http = require('http');
const jwt = require('../Backend/node_modules/jsonwebtoken');
const { pool } = require('../Backend/db');

const API_URL = 'http://127.0.0.1:5000';
const JWT_SECRET = 'MaPhraseSecretPourLeProjetEnt2026';

function getJson(urlPath, token) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlPath, API_URL);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`
      }
    };
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => { body += chunk; });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(body) });
        } catch {
          resolve({ status: res.statusCode, raw: body });
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function testAll() {
  console.log('🧪 TEST DES ROUTES API AVEC POSTGRESQL...\n');

  const usersRes = await pool.query('SELECT * FROM users WHERE role = $1 LIMIT 1', ['directeur']);
  const dir = usersRes.rows[0];

  const token = jwt.sign(
    { userId: dir.id, role: dir.role, poste: dir.poste, site_id: dir.site_id },
    JWT_SECRET,
    { expiresIn: '1h' }
  );

  const routes = [
    '/api/sites',
    '/api/stocks',
    '/api/activites',
    '/api/directeur/stats',
    '/api/users/secretaires',
    '/api/depenses',
    '/api/depots-banque',
    '/api/credits'
  ];

  let ok = true;
  for (const r of routes) {
    const res = await getJson(r, token);
    const count = Array.isArray(res.data) ? res.data.length : (typeof res.data === 'object' ? Object.keys(res.data).length : 'N/A');
    if (res.status === 200) {
      console.log(`✔ [200 OK] ${r.padEnd(25)} : ${count} élément(s)`);
    } else {
      console.error(`❌ [${res.status} FAIL] ${r.padEnd(25)} :`, res.data);
      ok = false;
    }
  }

  await pool.end();
  if (ok) {
    console.log('\n🎉 TOUTES LES ROUTES SONT OPÉRATIONNELLES SANS AUCUNE ERREUR !');
    process.exit(0);
  } else {
    process.exit(1);
  }
}

testAll().catch(console.error);
