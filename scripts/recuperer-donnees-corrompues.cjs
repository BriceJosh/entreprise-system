const fs = require("fs");
const path = require("path");
const { BSON } = require("../Backend/node_modules/bson");

// Dossier contenant les fichiers de secours (.wt)
const SOURCE_DIR = process.argv[2] || "C:\\data_sauvegarde_secours";
const OUTPUT_DIR = path.join(__dirname, "../data_recuperee_json");

function detecterCollection(doc) {
  if (!doc || typeof doc !== "object") return null;

  // Recu
  if (
    doc.numero &&
    (doc.lignes ||
      doc.montant_total !== undefined ||
      doc.total !== undefined ||
      doc.client_nom !== undefined)
  ) {
    return "recus";
  }
  // Activite
  if (
    doc.type &&
    ["impression", "vente", "depense"].includes(doc.type) &&
    (doc.designation !== undefined || doc.montant_total !== undefined)
  ) {
    return "activites";
  }
  // User
  if (doc.username && doc.password) {
    return "users";
  }
  // Depense
  if (
    doc.motif &&
    doc.montant !== undefined &&
    (doc.beneficiaire !== undefined || doc.justificatif !== undefined)
  ) {
    return "depenses";
  }
  // Depot Banque
  if (
    (doc.banque && doc.montant !== undefined) ||
    doc.bordereau ||
    doc.numeroBordereau
  ) {
    return "depotbanques";
  }
  // Credit
  if (
    doc.client &&
    doc.montant !== undefined &&
    (doc.reste !== undefined || doc.statut !== undefined)
  ) {
    return "credits";
  }
  // Stock Mouvement
  if (doc.mouvement_type || doc.stock_id || doc.produit_id) {
    return "stockmouvements";
  }
  // Stock
  if (
    doc.nom &&
    (doc.quantite !== undefined ||
      doc.prix_unitaire !== undefined ||
      doc.seuil_alerte !== undefined ||
      doc.stock_actuel !== undefined)
  ) {
    return "stocks";
  }
  // Site
  if (
    doc.nom &&
    (doc.code !== undefined ||
      doc.ville !== undefined ||
      doc.telephone !== undefined)
  ) {
    return "sites";
  }
  // Impression
  if (doc.recu_id && doc.nb_impressions !== undefined) {
    return "impressions";
  }

  return null;
}

function scannerFichier(filePath, collectionsMap) {
  console.log(`🔍 Analyse du fichier : ${path.basename(filePath)} (${(fs.statSync(filePath).size / 1024 / 1024).toFixed(2)} Mo)...`);
  const buffer = fs.readFileSync(filePath);
  const total = buffer.length;
  let count = 0;

  for (let i = 0; i < total - 5; i++) {
    // Vérifier la taille potentielle d'un document BSON
    const len = buffer.readInt32LE(i);

    // Taille plausible d'un document MongoDB : entre 15 octets et 16 Mo
    if (len >= 15 && len <= 16 * 1024 * 1024 && (i + len) <= total) {
      // Un document BSON valide se termine par 0x00
      if (buffer[i + len - 1] === 0x00) {
        try {
          const slice = buffer.subarray(i, i + len);
          const doc = BSON.deserialize(slice, { promoteBuffers: false, promoteLongs: true });

          if (doc && doc._id && typeof doc === 'object') {
            const collName = detecterCollection(doc);
            if (collName) {
              const idStr = doc._id.toString();
              if (!collectionsMap[collName]) collectionsMap[collName] = new Map();

              // Si le document existe déjà, garder le plus récent si date présente
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
        } catch (_) {
          // Ce n'était pas un document BSON valide, on continue d'avancer
        }
      }
    }
  }

  return count;
}

async function main() {
  console.log("==========================================================");
  console.log(" 🩺 EXTRACTION CHIRURGICALE DES DONNÉES WIREDTIGER (BSON)  ");
  console.log("==========================================================");

  if (!fs.existsSync(SOURCE_DIR)) {
    console.error(`❌ Dossier source introuvable : ${SOURCE_DIR}`);
    console.error("Vérifiez le chemin ou passez-le en argument.");
    process.exit(1);
  }

  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const files = fs.readdirSync(SOURCE_DIR)
    .filter(f => f.endsWith('.wt') && !f.startsWith('WiredTiger') && !f.startsWith('sizeStorer') && !f.startsWith('_mdb_catalog'));

  console.log(`📁 ${files.length} fichier(s) .wt trouvés dans ${SOURCE_DIR}.\n`);

  const collectionsMap = {};
  let totalDocs = 0;

  for (const f of files) {
    const fullPath = path.join(SOURCE_DIR, f);
    const found = scannerFichier(fullPath, collectionsMap);
    if (found > 0) {
      console.log(`   ✨ ${found} document(s) extrait(s) de ${f}`);
      totalDocs += found;
    }
  }

  console.log("\n==========================================================");
  console.log(`📊 TOTAL DES DOCUMENTS RÉCUPÉRÉS : ${totalDocs}`);
  console.log("==========================================================");

  for (const [coll, docsMap] of Object.entries(collectionsMap)) {
    const arr = Array.from(docsMap.values());
    console.log(`  - [${coll}] : ${arr.length} document(s) uniques`);
    const jsonPath = path.join(OUTPUT_DIR, `${coll}.json`);
    fs.writeFileSync(jsonPath, JSON.stringify(arr, null, 2), 'utf-8');
  }

  console.log(`\n💾 Tous les fichiers JSON ont été écrits dans : ${OUTPUT_DIR}`);
  console.log("==========================================================");
}

main().catch(console.error);
