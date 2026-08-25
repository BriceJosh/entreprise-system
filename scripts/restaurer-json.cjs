/**
 * RESTAURATION DE DONNEES JSON EXTRAITES DES FICHIERS WIREDTIGER (.wt)
 *
 * Re-injecte dans MongoDB les fichiers JSON produits par l'extraction
 * BSON (format Extended JSON : {"$oid":...}, {"$date":...}, {"$numberInt":...}).
 *
 * Usage (depuis la racine du projet) :
 *   node scripts\restaurer-json.cjs
 *   node scripts\restaurer-json.cjs <dossierJson> <nomBase>
 *
 * Defauts : dossier = .\data_recuperee_json ; base = entreprise_db
 */

const path = require('path');
const fs = require('fs');

let MongoClient;
let EJSON;
try {
    const backendModules = path.join(__dirname, '..', 'Backend', 'node_modules');
    ({ MongoClient } = require(path.join(backendModules, 'mongodb')));
    ({ EJSON } = require(path.join(backendModules, 'bson')));
} catch (e) {
    console.error('[ERREUR] Driver mongodb/bson introuvable dans Backend/node_modules.');
    console.error('         Lancez d\'abord : cd Backend ; npm install');
    process.exit(1);
}

const inputDir = path.resolve(process.argv[2] || path.join(process.cwd(), 'data_recuperee_json'));
const dbName = process.argv[3] || 'entreprise_db';
const uri = 'mongodb://127.0.0.1:27017/?directConnection=true';

(async () => {
    if (!fs.existsSync(inputDir)) {
        console.error(`[ERREUR] Dossier introuvable : ${inputDir}`);
        process.exit(1);
    }

    const fichiers = fs.readdirSync(inputDir).filter((f) => f.toLowerCase().endsWith('.json'));
    if (fichiers.length === 0) {
        console.error(`[ERREUR] Aucun fichier JSON dans : ${inputDir}`);
        process.exit(1);
    }

    const client = new MongoClient(uri, { serverSelectionTimeoutMS: 5000 });
    await client.connect();
    console.log(`[OK] Connecte a MongoDB - base cible : "${dbName}"`);
    const db = client.db(dbName);

    let totalInsere = 0;
    let totalDoublon = 0;
    let totalErreur = 0;

    for (const fichier of fichiers) {
        const nomCollection = fichier.replace(/\.json$/i, '');
        let brut;
        try {
            brut = fs.readFileSync(path.join(inputDir, fichier), 'utf8');
        } catch (e) {
            console.error(`[ERREUR] Lecture impossible : ${fichier} (${e.message})`);
            totalErreur++;
            continue;
        }

        let docs;
        try {
            // Conversion Extended JSON -> vrais types BSON (ObjectId, Date...)
            const parse = EJSON.parse(brut, { relaxed: true });
            docs = Array.isArray(parse) ? parse : (parse.docs || parse.documents || [parse]);
        } catch (e) {
            console.error(`[ERREUR] JSON invalide dans ${fichier} : ${e.message}`);
            totalErreur++;
            continue;
        }

        if (!Array.isArray(docs) || docs.length === 0) {
            console.log(`[${nomCollection}] aucun document, ignore.`);
            continue;
        }

        try {
            const res = await db.collection(nomCollection).insertMany(docs, { ordered: false });
            console.log(`[${nomCollection}] ${res.insertedCount}/${docs.length} document(s) insere(s).`);
            totalInsere += res.insertedCount;
        } catch (err) {
            const inseres = err.result?.insertedCount ?? 0;
            const writeErrors = err.writeErrors || [];
            const doublons = writeErrors.filter((w) => w.code === 11000).length;
            const autres = writeErrors.filter((w) => w.code !== 11000);
            console.log(`[${nomCollection}] ${inseres}/${docs.length} insere(s), ${doublons} doublon(s)_id${autres.length ? `, ${autres.length} erreur(s)` : ''}.`);
            if (autres.length) {
                autres.slice(0, 3).forEach((w) => console.error(`   >> ${w.errmsg}`));
                totalErreur += autres.length;
            }
            totalInsere += inseres;
            totalDoublon += doublons;
        }
    }

    console.log('\n=========================================');
    console.log(`INSERES : ${totalInsere} | DOUBLONS ignores : ${totalDoublon} | ERREURS : ${totalErreur}`);

    // Verification immediate du contenu
    const bases = await client.db().admin().listDatabases();
    const cible = bases.databases.find((b) => b.name === dbName);
    if (cible) {
        const cols = await db.listCollections().toArray();
        console.log(`Contenu de "${dbName}" apres restauration :`);
        for (const c of cols) {
            const n = await db.collection(c.name).countDocuments();
            console.log(`   - ${c.name.padEnd(20)} ${String(n).padStart(7)} document(s)`);
        }
    }
    await client.close();

    if (totalErreur > 0) process.exit(1);
})();
