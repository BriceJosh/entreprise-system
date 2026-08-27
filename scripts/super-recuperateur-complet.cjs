const fs = require('fs');
const path = require('path');
const { BSON } = require('../Backend/node_modules/bson');

// Liste des dossiers contenant potentiellement des donnees
const CANDIDATE_DIRS = [
  'C:\\Program Files\\MongoDB\\Server\\8.0\\data',
  'C:\\Program Files\\MongoDB\\Server\\8.0\\data_backup_20260826_081725',
  'C:\\Program Files\\MongoDB\\Server\\8.0\\data_corrompu',
  'C:\\Program Files\\MongoDB\\Server\\8.0\\data_corrompu_final',
  'C:\\Program Files\\MongoDB\\Server\\8.0\\data_backup_20260824_230308',
  'C:\\Program Files\\MongoDB\\Server\\8.0\\data_backup_20260823_000648',
  'C:\\Program Files\\MongoDB\\Server\\8.0\\data_backup_20260822_235219',
  'C:\\Program Files\\MongoDB\\Server\\8.0\\data_vide',
  'C:\\Program Files\\MongoDB\\Server\\8.0\\data_HS',
  'C:\\Program Files\\MongoDB\\Server\\7.0\\data',
  'C:\\data_sauvegarde_secours',
  'C:\\secours_bis',
  'C:\\temp\\data_rescue',
  'C:\\temp\\data_repair',
  'C:\\temp\\data_rescue\\data_sauvegarde_secours',
  'C:\\Backups\\Backup_Final_20260825\\entreprise_db',
  'C:\\Program Files\\MongoDB\\Tools\\100\\bin\\dump\\entreprise_db'
];

const OUTPUT_DIR = path.join(__dirname, '../data_recuperee_json');
function detecterCollection(doc) {
  if (!doc || typeof doc !== 'object') return null;

  // Recu
  if (doc.numero && (doc.lignes || doc.montant_total !== undefined || doc.client_nom !== undefined)) {
    return 'recus';
  }
  // Activite
  if (doc.type && ['impression', 'vente', 'depense'].includes(doc.type) && (doc.designation !== undefined || doc.montant_total !== undefined)) {
    return 'activites';
  }
  // User
  if (doc.username && doc.password) {
    return 'users';
  }
  // Depense
  if (doc.motif && doc.montant !== undefined && (doc.beneficiaire !== undefined || doc.justificatif !== undefined || doc.mode_paiement !== undefined)) {
    return 'depenses';
  }
  // Depot Banque
  if ((doc.banque && doc.montant !== undefined) || doc.numeroBordereau || doc.bordereau) {
    return 'depotbanques';
  }
  // Credit
  if (doc.client && doc.montant !== undefined && (doc.reste !== undefined || doc.statut !== undefined)) {
    return 'credits';
  }
  // Stock Mouvement
  if (doc.mouvement_type || doc.stock_id || doc.produit_id) {
    return 'stockmouvements';
  }
  // Stock
  if (doc.nom && (doc.quantite !== undefined || doc.prix_unitaire !== undefined || doc.stock_actuel !== undefined || doc.seuil_alerte !== undefined)) {
    return 'stocks';
  }
  // Site
  if (doc.nom && (doc.code !== undefined || doc.ville !== undefined || doc.telephone !== undefined)) {
    return 'sites';
  }
  // Impression
  if (doc.recu_id && doc.nb_impressions !== undefined) {
    return 'impressions';
  }

  return null;
}

function parseBsonFile(filePath, collectionsMap) {
  try {
    const buffer = fs.readFileSync(filePath);
    let offset = 0;
    let count = 0;
    while (offset < buffer.length) {
      if (offset + 4 > buffer.length) break;
      const docSize = buffer.readInt32LE(offset);
      if (docSize <= 0 || offset + docSize > buffer.length) break;
      const slice = buffer.subarray(offset, offset + docSize);
      try {
        const doc = BSON.deserialize(slice);
        if (doc && doc._id) {
          const coll = detecterCollection(doc) || path.basename(filePath, '.bson');
          if (coll) {
            if (!collectionsMap[coll]) collectionsMap[coll] = new Map();
            const idStr = doc._id.toString();
            collectionsMap[coll].set(idStr, doc);
            count++;
          }
        }
      } catch (e) {}
      offset += docSize;
    }
    return count;
  } catch (e) {
    return 0;
  }
}
function parseWtFile(filePath, collectionsMap) {
  try {
    const buffer = fs.readFileSync(filePath);
    const total = buffer.length;
    let count = 0;

    for (let i = 0; i < total - 5; i++) {
      const len = buffer.readInt32LE(i);
      if (len >= 15 && len <= 16 * 1024 * 1024 && (i + len) <= total) {
        if (buffer[i + len - 1] === 0x00) {
          try {
            const slice = buffer.subarray(i, i + len);
            const doc = BSON.deserialize(slice, { promoteBuffers: false, promoteLongs: true });

            if (doc && doc._id && typeof doc === 'object') {
              const collName = detecterCollection(doc);
              if (collName) {
                const idStr = doc._id.toString();
                if (!collectionsMap[collName]) collectionsMap[collName] = new Map();

                const existant = collectionsMap[collName].get(idStr);
                if (!existant) {
                  collectionsMap[collName].set(idStr, doc);
                  count++;
                } else {
                  const dateExistant = existant.updatedAt || existant.createdAt || existant.date;
                  const dateNouveau = doc.updatedAt || doc.createdAt || doc.date;
                  if (dateNouveau && (!dateExistant || new Date(dateNouveau) > new Date(dateExistant))) {
                    collectionsMap[collName].set(idStr, doc);
                  }
                }
              }
            }
          } catch (_) {}
        }
      }
    }
    return count;
  } catch (e) {
    return 0;
  }
}

async function scanAll() {
  console.log('===============================================================');
  console.log('   RECHERCHE GLOBALE ET SAUVETAGE EXHAUSTIF DE TOUTES LES DONNÉES');
  console.log('===============================================================\n');

  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const collectionsMap = {};
  const scannedFiles = new Set();

  for (const dir of CANDIDATE_DIRS) {
    if (!fs.existsSync(dir)) continue;
    console.log(`📁 Scan du dossier : ${dir}`);

    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const ent of entries) {
      if (ent.isFile()) {
        const full = path.join(dir, ent.name);
        if (scannedFiles.has(full)) continue;
        scannedFiles.add(full);

        if (ent.name.endsWith('.bson')) {
          const c = parseBsonFile(full, collectionsMap);
          if (c > 0) console.log(`   💎 [BSON] ${ent.name} -> ${c} document(s)`);
        } else if (ent.name.endsWith('.wt') && !ent.name.startsWith('WiredTiger') && !ent.name.startsWith('sizeStorer') && !ent.name.startsWith('_mdb_catalog')) {
          const c = parseWtFile(full, collectionsMap);
          if (c > 0) console.log(`   ✨ [WT] ${ent.name} -> ${c} document(s)`);
        }
      }
    }
  }

  console.log('\n===============================================================');
  console.log('   BILAN DES DONNÉES RÉCUPÉRÉES PAR COLLECTION');
  console.log('===============================================================');
  let totalDocs = 0;
  for (const [coll, map] of Object.entries(collectionsMap)) {
    const list = Array.from(map.values());
    console.log(`  - ${coll.padEnd(18)} : ${String(list.length).padStart(4)} documents uniques`);
    totalDocs += list.length;
    const jsonPath = path.join(OUTPUT_DIR, `${coll}.json`);
    fs.writeFileSync(jsonPath, JSON.stringify(list, null, 2), 'utf-8');
  }

  console.log(`\n🎯 TOTAL GLOBAL : ${totalDocs} documents sauvegardés dans : ${OUTPUT_DIR}\n`);
}

scanAll().catch(console.error);
