const path = require('path');
const http = require('http');
const jwt = require(path.join(__dirname, '../Backend/node_modules/jsonwebtoken'));
const ioClient = require(path.join(__dirname, '../node_modules/socket.io-client'));
const { pool } = require(path.join(__dirname, '../Backend/db'));

const User = require(path.join(__dirname, '../Backend/models/User'));
const Site = require(path.join(__dirname, '../Backend/models/Site'));
const Activite = require(path.join(__dirname, '../Backend/models/Activite'));
const Stock = require(path.join(__dirname, '../Backend/models/Stock'));

const API_URL = 'http://127.0.0.1:5000';
const JWT_SECRET = 'MaPhraseSecretPourLeProjetEnt2026';

async function audit() {
  console.log('===============================================================');
  console.log('   AUDIT COMPLET POSTGRESQL 16 & PROPAGATION TEMPS RÉEL        ');
  console.log('===============================================================\n');

  // 1. PING
  const ping = await pool.query('SELECT version(), NOW() AS now');
  console.log('✔ [1/5] PostgreSQL Version :', ping.rows[0].version.split(',')[0]);

  // 2. TABLES & COMPTEURS
  console.log('\n✔ [2/5] Inventaire des données actives :');
  const tables = ['sites', 'users', 'stocks', 'stock_mouvements', 'activites', 'recus', 'depenses', 'depots_banque', 'credits'];
  let totalRows = 0;
  for (const t of tables) {
    const res = await pool.query(`SELECT COUNT(*) AS c FROM ${t}`);
    const count = parseInt(res.rows[0].c, 10);
    totalRows += count;
    console.log(`   - ${t.padEnd(18)} : ${String(count).padStart(4)} enregistrement(s)`);
  }
  console.log(`   👉 Total global : ${totalRows} enregistrements en base.`);

  // 3. API HEALTH
  console.log('\n✔ [3/5] Test API HTTP (/api/health)...');
  const healthRes = await new Promise((resolve, reject) => {
    http.get(`${API_URL}/api/health`, (res) => {
      let body = '';
      res.on('data', c => { body += c; });
      res.on('end', () => resolve(JSON.parse(body)));
    }).on('error', reject);
  });
  console.log('   Moteur actif :', healthRes.engine, '| Statut :', healthRes.status);

  // 4. TEST SOCKET.IO & LISTEN/NOTIFY TEMPS RÉEL
  console.log('\n✔ [4/5] Test WebSocket Socket.IO + PostgreSQL LISTEN/NOTIFY...');
  const users = await User.find();
  const dir = users.find(u => u.role === 'directeur') || users[0];
  const sec = users.find(u => u.role === 'secretaire') || users[1];

  const dirToken = jwt.sign(
    { userId: dir.id, role: dir.role, poste: dir.poste, site_id: dir.site_id },
    JWT_SECRET,
    { expiresIn: '1h' }
  );

  const socket = ioClient(API_URL, {
    auth: { token: dirToken },
    transports: ['websocket']
  });

  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Timeout WebSocket 10s')), 10000);

    socket.on('connect', async () => {
      console.log('   ✔ Client Socket.IO connecté avec ID :', socket.id);

      socket.on('activite_ajoutee', async (data) => {
        if (data.designation === 'TEST_PG_REALTIME_NOTIFY') {
          console.log('   🎉 ÉVÉNEMENT REÇU EN DIRECT VIA POSTGRES NOTIFY -> SOCKET.IO !');
          console.log('      ID :', data._id, '| Montant :', data.montant_total, 'FCFA');
          clearTimeout(timer);
          await Activite.deleteOne({ _id: data._id });
          console.log('   🧹 Donnée de test nettoyée.');
          socket.disconnect();
          resolve();
        }
      });

      // Insertion dans PostgreSQL pour déclencher le trigger
      console.log('   ⏳ Insertion d\'une activité dans PostgreSQL...');
      await Activite.create({
        type: 'vente',
        option_vente: 'Pièce',
        designation: 'TEST_PG_REALTIME_NOTIFY',
        quantite: 1,
        quantite_unites: 1,
        prix_unitaire: 1000,
        montant_total: 1000,
        user_id: sec.id,
        site_id: sec.site_id
      });
    });

    socket.on('connect_error', err => {
      clearTimeout(timer);
      reject(err);
    });
  });

  console.log('\n===============================================================');
  console.log(' 🎉 POSTGRESQL 16 & LE TEMPS RÉEL SONT 100% OPÉRATIONNELS !');
  console.log('===============================================================\n');
  await pool.end();
  process.exit(0);
}

audit().catch(err => {
  console.error('❌ Erreur de l\'audit :', err);
  process.exit(1);
});
