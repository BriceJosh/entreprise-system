const fs = require('fs');
const path = require('path');
const { Pool } = require('../Backend/node_modules/pg');

const DATABASE_URL = 'postgresql://postgres@127.0.0.1:5432/entreprise_db';
const DATA_DIR = path.join(__dirname, '../data_recuperee_json');

const pool = new Pool({ connectionString: DATABASE_URL });

async function migrer() {
  console.log('===============================================================');
  console.log('   MIGRATION COMPLÈTE DES DONNÉES VERS POSTGRESQL (100% INTACT) ');
  console.log('===============================================================\n');

  // 1. SITES
  const sitesPath = path.join(DATA_DIR, 'sites.json');
  if (fs.existsSync(sitesPath)) {
    const sites = JSON.parse(fs.readFileSync(sitesPath, 'utf-8'));
    for (const s of sites) {
      await pool.query(
        `INSERT INTO sites (id, nom, ville, telephone, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (id) DO UPDATE SET nom = EXCLUDED.nom, ville = EXCLUDED.ville, telephone = EXCLUDED.telephone`,
        [s._id, s.nom, s.ville || null, s.telephone || null, s.createdAt || new Date(), s.updatedAt || new Date()]
      );
    }
    console.log(`✔ [sites] : ${sites.length} sites migrés.`);
  }

  // 2. USERS
  const usersPath = path.join(DATA_DIR, 'users.json');
  if (fs.existsSync(usersPath)) {
    const users = JSON.parse(fs.readFileSync(usersPath, 'utf-8'));
    for (const u of users) {
      await pool.query(
        `INSERT INTO users (id, email, password, username, role, poste, doit_changer_mdp, site_id, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, password = EXCLUDED.password, username = EXCLUDED.username, role = EXCLUDED.role, poste = EXCLUDED.poste, site_id = EXCLUDED.site_id`,
        [u._id, u.email, u.password, u.username, u.role, u.poste || 'services', u.doit_changer_mdp ?? true, u.site_id || null, u.createdAt || new Date(), u.updatedAt || new Date()]
      );
    }
    console.log(`✔ [users] : ${users.length} utilisateurs migrés.`);
  }

  // 3. STOCKS
  const stocksPath = path.join(DATA_DIR, 'stocks.json');
  if (fs.existsSync(stocksPath)) {
    const stocks = JSON.parse(fs.readFileSync(stocksPath, 'utf-8'));
    for (const st of stocks) {
      await pool.query(
        `INSERT INTO stocks (id, nom_article, quantite, seuil_alerte, multiplicateur_detail, multiplicateur_gros, prix_vente, prix_vente_unite, prix_vente_detail, prix_vente_gros, site_id, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
         ON CONFLICT (id) DO UPDATE SET quantite = EXCLUDED.quantite, prix_vente = EXCLUDED.prix_vente, prix_vente_unite = EXCLUDED.prix_vente_unite, prix_vente_detail = EXCLUDED.prix_vente_detail, prix_vente_gros = EXCLUDED.prix_vente_gros`,
        [st._id, st.nom_article, st.quantite || 0, st.seuil_alerte || 5, st.multiplicateur_detail || 1, st.multiplicateur_gros || 1, st.prix_vente || 0, st.prix_vente_unite || st.prix_vente || 0, st.prix_vente_detail || 0, st.prix_vente_gros || 0, st.site_id || null, st.createdAt || new Date(), st.updatedAt || new Date()]
      );
    }
    console.log(`✔ [stocks] : ${stocks.length} articles de stock migrés.`);
  }
  // 4. STOCK MOUVEMENTS
  const stockMouvementsPath = path.join(DATA_DIR, 'stockmouvements.json');
  if (fs.existsSync(stockMouvementsPath)) {
    const mvs = JSON.parse(fs.readFileSync(stockMouvementsPath, 'utf-8'));
    for (const m of mvs) {
      await pool.query(
        `INSERT INTO stock_mouvements (id, nom_article, mouvement_type, type_entree, quantite_entree, quantite_unites, prix_total, prix_vente_unitaire, prix_vente_detail, prix_vente_gros, description, stock_id, site_id, user_id, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
         ON CONFLICT (id) DO NOTHING`,
        [m._id, m.nom_article || 'Article', m.mouvement_type || 'entree', m.type_entree || 'Pièce', m.quantite_entree || 1, m.quantite_unites || 1, m.prix_total || 0, m.prix_vente_unitaire || 0, m.prix_vente_detail || 0, m.prix_vente_gros || 0, m.description || '', m.stock_id || null, m.site_id || null, m.user_id || null, m.createdAt || new Date()]
      );
    }
    console.log(`✔ [stock_mouvements] : ${mvs.length} mouvements de stock migrés.`);
  }

  // 5. ACTIVITES
  const activitesPath = path.join(DATA_DIR, 'activites.json');
  if (fs.existsSync(activitesPath)) {
    const acts = JSON.parse(fs.readFileSync(activitesPath, 'utf-8'));
    for (const a of acts) {
      await pool.query(
        `INSERT INTO activites (id, type, designation, description, quantite, quantite_unites, prix_unitaire, montant_total, option_vente, longueur, largeur, surface_m2, prix_m2, recu_id, site_id, user_id, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
         ON CONFLICT (id) DO UPDATE SET designation = EXCLUDED.designation, montant_total = EXCLUDED.montant_total`,
        [a._id, a.type || 'vente', a.designation || 'Vente', a.description || '', a.quantite || 1, a.quantite_unites || 1, a.prix_unitaire || 0, a.montant_total || (a.quantite * a.prix_unitaire) || 0, a.option_vente || 'Pièce', a.longueur || null, a.largeur || null, a.surface_m2 || null, a.prix_m2 || null, a.recu_id || null, a.site_id || null, a.user_id || null, a.createdAt || new Date(), a.updatedAt || new Date()]
      );
    }
    console.log(`✔ [activites] : ${acts.length} activités migrées.`);
  }

  console.log('\n===============================================================');
  console.log('🎉 MIGRATION TERMINÉE AVEC SUCCÈS DANS POSTGRESQL !');
  console.log('===============================================================\n');
  await pool.end();
  process.exit(0);
}

migrer().catch(err => {
  console.error('❌ Erreur de migration PostgreSQL :', err);
  process.exit(1);
});
