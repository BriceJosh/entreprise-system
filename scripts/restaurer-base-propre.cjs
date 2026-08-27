const fs = require('fs');
const path = require('path');
const mongoose = require(path.join(__dirname, '../Backend/node_modules/mongoose'));

const INPUT_DIR = path.join(__dirname, '../data_recuperee_json');
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/entreprise_db?replicaSet=rs0&directConnection=true';

function transformMongoTypes(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) {
    return obj.map(transformMongoTypes);
  }
  const res = {};
  for (const [key, val] of Object.entries(obj)) {
    if (typeof val === 'string' && /^[0-9a-fA-F]{24}$/.test(val) && (key === '_id' || key.endsWith('_id') || key.endsWith('Id'))) {
      res[key] = new mongoose.Types.ObjectId(val);
    } else if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(val) && (key.includes('At') || key === 'date')) {
      res[key] = new Date(val);
    } else if (typeof val === 'object' && val !== null) {
      if (val.$oid) {
        res[key] = new mongoose.Types.ObjectId(val.$oid);
      } else if (val.$date) {
        res[key] = new Date(val.$date);
      } else {
        res[key] = transformMongoTypes(val);
      }
    } else {
      res[key] = val;
    }
  }
  return res;
}
async function restaurer() {
  console.log('==========================================================');
  console.log(' 📥 RESTAURATION TYPÉE DES DONNÉES DANS ENTREPRISE_DB     ');
  console.log('==========================================================\n');

  if (!fs.existsSync(INPUT_DIR)) {
    console.error(`❌ Dossier ${INPUT_DIR} introuvable.`);
    process.exit(1);
  }

  console.log(`1. Connexion à MongoDB (${MONGO_URI})...`);
  const conn = await mongoose.createConnection(MONGO_URI).asPromise();
  console.log('✅ Connecté à MongoDB avec succès.');

  const files = fs.readdirSync(INPUT_DIR).filter(f => f.endsWith('.json'));

  let grandTotal = 0;
  for (const f of files) {
    const collName = path.basename(f, '.json');
    const filePath = path.join(INPUT_DIR, f);
    const raw = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    const rawList = Array.isArray(raw) ? raw : [raw];
    if (rawList.length === 0) continue;

    const docs = rawList.map(transformMongoTypes);
    const coll = conn.db.collection(collName);

    let ok = 0;
    for (const doc of docs) {
      if (doc._id) {
        await coll.replaceOne({ _id: doc._id }, doc, { upsert: true });
        ok++;
      } else {
        await coll.insertOne(doc);
        ok++;
      }
    }
    console.log(`   ✔ [${collName.padEnd(16)}] : ${ok}/${docs.length} documents insérés/mis à jour.`);
    grandTotal += ok;
  }

  console.log('\n==========================================================');
  console.log(`🎉 RESTAURATION TERMINÉE : ${grandTotal} documents actifs en base !`);
  console.log('==========================================================\n');

  await conn.close();
  process.exit(0);
}

restaurer().catch((err) => {
  console.error('❌ Erreur de restauration :', err);
  process.exit(1);
});
