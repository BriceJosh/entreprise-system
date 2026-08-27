const http = require('http');
const jwt = require('../Backend/node_modules/jsonwebtoken');
const { pool } = require('../Backend/db');

const API_URL = 'http://127.0.0.1:5000';
const JWT_SECRET = 'MaPhraseSecretPourLeProjetEnt2026';

function postJson(urlPath, data, token) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(data);
    const url = new URL(urlPath, API_URL);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
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
    req.write(postData);
    req.end();
  });
}

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

async function run() {
  console.log('🧪 TEST COMPLET CRÉATION ACTIVITÉ & AFFICHAGE MONTANT...\n');

  const usersRes = await pool.query("SELECT * FROM users WHERE email = 'secretaire1.difakpota@espacecommercial.com' LIMIT 1");
  const sec = usersRes.rows[0];

  const token = jwt.sign(
    { userId: sec.id, role: sec.role, poste: sec.poste, site_id: sec.site_id },
    JWT_SECRET,
    { expiresIn: '1h' }
  );

  // 1. Création d'une impression avec dimensions
  console.log('1. Création d\'une impression de bâche...');
  const payload = {
    type: 'impression',
    service_type: 'impression_bache',
    designation: 'Impression bâche (Test)',
    longueur: 1.0,
    largeur: 2.0,
    surface_m2: 2.0,
    prix_m2: 1500,
    quantite: 1,
    prix_unitaire: 3000
  };

  const createRes = await postJson('/api/activites', payload, token);
  console.log('   Status création :', createRes.status);
  console.log('   Montant total créé :', createRes.data?.montant_total, 'FCFA (Attendu: 3000)');

  // 2. Lecture des activités de la secrétaire
  console.log('\n2. Lecture de la liste des activités (GET /api/activites)...');
  const listRes = await getJson('/api/activites', token);
  console.log(`   ${listRes.data.length} activités récupérées.`);
  const derniere = listRes.data[0];
  console.log('   Dernière activité reçue :');
  console.log(`   - Désignation  : ${derniere.designation}`);
  console.log(`   - Quantité     : ${derniere.quantite} (${typeof derniere.quantite})`);
  console.log(`   - Prix Unit    : ${derniere.prix_unitaire} FCFA (${typeof derniere.prix_unitaire})`);
  console.log(`   - Montant Total: ${derniere.montant_total} FCFA (${typeof derniere.montant_total})`);

  // Nettoyage de l'activité de test
  if (createRes.data?._id || createRes.data?.id) {
    const actId = createRes.data._id || createRes.data.id;
    await pool.query('DELETE FROM activites WHERE id = $1', [actId]);
    console.log('\n🧹 Activité test supprimée.');
  }

  await pool.end();
  const ok = createRes.data?.montant_total === 3000 && derniere.montant_total === 3000;
  if (ok) {
    console.log('\n🎉 TOUS LES CALCULS ET AFFICHAGES DE MONTANTS SONT 100% VALIDES !');
    process.exit(0);
  } else {
    process.exit(1);
  }
}

run().catch(console.error);
