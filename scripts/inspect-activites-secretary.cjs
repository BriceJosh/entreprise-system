const http = require('http');
const jwt = require('../Backend/node_modules/jsonwebtoken');
const { pool } = require('../Backend/db');

const API_URL = 'http://127.0.0.1:5000';
const JWT_SECRET = 'MaPhraseSecretPourLeProjetEnt2026';

async function run() {
  const usersRes = await pool.query("SELECT * FROM users WHERE email = 'secretaire1.difakpota@espacecommercial.com' LIMIT 1");
  const sec = usersRes.rows[0];

  const token = jwt.sign(
    { userId: sec.id, role: sec.role, poste: sec.poste, site_id: sec.site_id },
    JWT_SECRET,
    { expiresIn: '1h' }
  );

  const req = http.get(`${API_URL}/api/activites`, { headers: { Authorization: `Bearer ${token}` } }, res => {
    let b = '';
    res.on('data', c => b += c);
    res.on('end', () => {
      console.log('Status code :', res.statusCode);
      const data = JSON.parse(b);
      console.log('Nombre activites reçues :', data.length);
      console.log('Activités :', JSON.stringify(data, null, 2));
      process.exit(0);
    });
  });
}

run().catch(console.error);
