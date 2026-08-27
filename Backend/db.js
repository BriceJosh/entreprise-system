const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const { Pool, Client } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres@127.0.0.1:5432/entreprise_db';

const pool = new Pool({
  connectionString: DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000
});

pool.on('error', (err) => {
  console.error('❌ Erreur inattendue du pool PostgreSQL :', err.message);
});

async function query(text, params) {
  const start = Date.now();
  const res = await pool.query(text, params);
  const duration = Date.now() - start;
  if (process.env.DEBUG_SQL === 'true') {
    console.log('Executed query', { text, duration, rows: res.rowCount });
  }
  return res;
}

const NUMERIC_FIELDS = new Set([
  'quantite',
  'quantite_unites',
  'quantite_entree',
  'prix_unitaire',
  'montant_total',
  'montant',
  'montant_paye',
  'monnaie_rendue',
  'prix_vente',
  'prix_vente_unite',
  'prix_vente_detail',
  'prix_vente_gros',
  'prix_total',
  'prix_vente_unitaire',
  'surface_m2',
  'prix_m2',
  'longueur',
  'largeur',
  'seuil_alerte',
  'multiplicateur_detail',
  'multiplicateur_gros',
  'reste',
  'reste_a_payer'
]);

function formatDoc(row) {
  if (!row) return null;
  const doc = { ...row };
  if (doc.id) {
    doc._id = doc.id;
  }
  if (doc.created_at) {
    doc.createdAt = doc.created_at;
  }
  if (doc.updated_at) {
    doc.updatedAt = doc.updated_at;
  }

  // Conversion automatique des colonnes numériques PostgreSQL (strings) en Number JavaScript
  for (const [k, v] of Object.entries(doc)) {
    if (v != null && NUMERIC_FIELDS.has(k) && typeof v === 'string') {
      const num = Number(v);
      if (!Number.isNaN(num)) {
        doc[k] = num;
      }
    }
  }

  return doc;
}

function formatDocs(rows) {
  if (!Array.isArray(rows)) return [];
  return rows.map(formatDoc);
}
let listenerClient = null;

async function listenAppEvents(io) {
  try {
    if (listenerClient) {
      try { await listenerClient.end(); } catch (_) {}
    }

    listenerClient = new Client({ connectionString: DATABASE_URL });
    await listenerClient.connect();

    await listenerClient.query('LISTEN app_events');
    console.log('⚡ PostgreSQL LISTEN app_events actif (Temps Réel ultra-rapide).');

    listenerClient.on('notification', (msg) => {
      if (msg.channel !== 'app_events' || !msg.payload) return;

      try {
        const payload = JSON.parse(msg.payload);
        const { table, action, data } = payload;
        const doc = formatDoc(data);
        if (!doc) return;

        if (table === 'activites') {
          const userId = doc.user_id;
          const siteId = doc.site_id;
          if (action === 'INSERT') {
            if (userId) io.to(`user_${userId}`).emit('activite_ajoutee', doc);
            if (siteId) io.to(`site_${siteId}`).emit('activite_ajoutee', doc);
            io.to('role_directeur').emit('activite_ajoutee', doc);
          } else if (action === 'UPDATE') {
            const updatePayload = { _id: doc._id, updatedFields: doc };
            if (userId) io.to(`user_${userId}`).emit('activite_modifiee', updatePayload);
            io.to('role_directeur').emit('activite_modifiee', updatePayload);
          } else if (action === 'DELETE') {
            io.to('role_directeur').emit('activite_supprimee', doc._id);
          }
        } else if (table === 'stocks') {
          const siteId = doc.site_id;
          if (siteId) io.to(`site_${siteId}`).emit('stock_mis_a_jour', doc);
          io.to('role_directeur').emit('stock_mis_a_jour', doc);
        } else if (table === 'depenses') {
          const userId = doc.user_id;
          if (action === 'INSERT') {
            if (userId) io.to(`user_${userId}`).emit('depense_ajoutee', doc);
            io.to('role_directeur').emit('depense_ajoutee', doc);
          } else if (action === 'DELETE') {
            io.to('role_directeur').emit('depense_supprimee', doc._id);
          }
        } else if (table === 'depots_banque') {
          const userId = doc.user_id;
          if (action === 'INSERT') {
            if (userId) io.to(`user_${userId}`).emit('depot_banque_ajoute', doc);
            io.to('role_directeur').emit('depot_banque_ajoute', doc);
          }
        } else if (table === 'credits') {
          const userId = doc.user_id;
          const event = action === 'INSERT' ? 'credit_ajoute' : 'credit_mis_a_jour';
          if (userId) io.to(`user_${userId}`).emit(event, doc);
          io.to('role_directeur').emit(event, doc);
        } else if (table === 'recus') {
          io.emit('recu_cree', doc);
        }
      } catch (err) {
        console.error('Erreur traitement notification PostgreSQL :', err.message);
      }
    });

    listenerClient.on('error', (err) => {
      console.warn('⚠️ Connexion LISTEN PostgreSQL perdue :', err.message);
      setTimeout(() => listenAppEvents(io), 5000);
    });
  } catch (err) {
    console.warn('⚠️ Erreur initialisation LISTEN PostgreSQL :', err.message);
    setTimeout(() => listenAppEvents(io), 5000);
  }
}

module.exports = {
  pool,
  query,
  formatDoc,
  formatDocs,
  listenAppEvents
};
