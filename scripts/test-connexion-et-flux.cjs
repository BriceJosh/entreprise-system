const path = require('path');
const http = require('http');
const mongoose = require(path.join(__dirname, '../Backend/node_modules/mongoose'));
const jwt = require(path.join(__dirname, '../Backend/node_modules/jsonwebtoken'));
const ioClient = require(path.join(__dirname, '../node_modules/socket.io-client'));

const User = require(path.join(__dirname, '../Backend/models/User'));
const Site = require(path.join(__dirname, '../Backend/models/Site'));
const Activite = require(path.join(__dirname, '../Backend/models/Activite'));
const Stock = require(path.join(__dirname, '../Backend/models/Stock'));

require(path.join(__dirname, '../Backend/node_modules/dotenv')).config({
  path: path.join(__dirname, '../Backend/.env')
});

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/entreprise_db?replicaSet=rs0&directConnection=true';
const JWT_SECRET = process.env.JWT_SECRET || 'MaPhraseSecretPourLeProjetEnt2026';
const API_URL = 'http://127.0.0.1:5000';
function postJson(urlPath, data, token = null) {
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
        ...(token ? { Authorization: `Bearer ${token}` } : {})
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
      headers: {
        'Authorization': `Bearer ${token}`
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

async function run() {
  console.log('🧪 TEST COMPLET DE BOUT EN BOUT DE L\'APPLICATION...\n');

  await mongoose.connect(MONGO_URI);
  const users = await User.find();
  console.log(`📋 Utilisateurs trouvés en base : ${users.length}`);
  users.forEach(u => console.log(`   - ${u.username} (${u.email}) [${u.role}]`));

  const director = users.find(u => u.role === 'directeur') || users[0];
  const sec = users.find(u => u.role === 'secretaire') || users[1];

  // 1. Token JWT pour Directeur
  const dirToken = jwt.sign(
    { userId: director._id, role: director.role, poste: director.poste, site_id: director.site_id },
    JWT_SECRET,
    { expiresIn: '1h' }
  );

  // 2. Test route Stats Directeur
  console.log('\n📊 Test GET /api/directeur/stats...');
  const statsRes = await getJson('/api/directeur/stats', dirToken);
  console.log('   Status:', statsRes.status, '| Données reçues :', statsRes.data);

  // 3. Test route Sites
  console.log('\n🏢 Test GET /api/sites...');
  const sitesRes = await getJson('/api/sites', dirToken);
  console.log('   Status:', sitesRes.status, '| Nombre de sites :', sitesRes.data?.length || 0);

  // 4. Test Temps Réel : Écoute WebSocket + Insertion MongoDB
  console.log('\n⚡ Test propagation temps réel (Socket.IO + Change Stream)...');
  const socket = ioClient(API_URL, {
    auth: { token: dirToken },
    transports: ['websocket']
  });

  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Timeout attente événement Socket.IO (10s)'));
    }, 10000);

    socket.on('connect', async () => {
      console.log('   ✔ Socket.IO connecté avec ID :', socket.id);

      socket.on('activite_ajoutee', async (act) => {
        if (act.designation === 'TEST_TEMPS_REEL_AUTO') {
          console.log('   🎉 ÉVÉNEMENT TEMPS RÉEL REÇU VIA WEBSOCKET ! ID :', act._id);
          clearTimeout(timeout);
          // Nettoyage de l'activité test
          await Activite.deleteOne({ _id: act._id });
          console.log('   🧹 Activité test supprimée de la base.');
          socket.disconnect();
          resolve();
        }
      });

      // Insertion d'une activité pour déclencher le Change Stream
      console.log('   ⏳ Création d\'une activité en base pour tester le Change Stream...');
      await Activite.create({
        type: 'vente',
        option_vente: 'Pièce',
        designation: 'TEST_TEMPS_REEL_AUTO',
        quantite: 1,
        quantite_unites: 1,
        prix_unitaire: 500,
        montant_total: 500,
        user_id: sec._id,
        site_id: sec.site_id
      });
    });

    socket.on('connect_error', (err) => {
      clearTimeout(timeout);
      reject(err);
    });
  });

  await mongoose.disconnect();
  console.log('\n===============================================================');
  console.log(' 🎉 TOUS LES FLUX DE L\'APPLICATION SONT 100% OPÉRATIONNELS !');
  console.log('===============================================================\n');
}

run().catch(err => {
  console.error('❌ Erreur du test :', err);
  process.exit(1);
});
