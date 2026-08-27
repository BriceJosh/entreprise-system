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
      headers: { Authorization: `Bearer ${token}` }
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

async function testCaisseAndHistorique() {
  console.log('🧪 TEST DES ROUTES CAISSE & HISTORIQUE...\n');

  const usersRes = await pool.query('SELECT * FROM users WHERE role = $1 LIMIT 1', ['directeur']);
  const dir = usersRes.rows[0];

  const token = jwt.sign(
    { userId: dir.id, role: dir.role, poste: dir.poste, site_id: dir.site_id },
    JWT_SECRET,
    { expiresIn: '1h' }
  );

  const routes = [
    '/api/caisse/resume',
    '/api/caisse/journal',
    '/api/historique'
  ];

  for (const r of routes) {
    const res = await getJson(r, token);
    console.log(`- ${r.padEnd(25)} -> Status : ${res.status} | Données reçues :`, typeof res.data === 'object' ? '✔ OK' : res.data);
  }

  await pool.end();
  process.exit(0);
}

testCaisseAndHistorique().catch(console.error);
