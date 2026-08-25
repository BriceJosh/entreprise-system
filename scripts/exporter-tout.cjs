/**
 * EXPORT COMPLET D'UNE INSTANCE MONGODB VERS DES FICHIERS JSON (EJSON)
 *
 * Se connecte a un mongod en marche et exporte TOUTES les bases
 * (hors systemes) dans des fichiers .json par collection, au format
 * Extended JSON - directement compatibles avec scripts\restaurer-json.cjs
 *
 * Usage (depuis la racine du projet) :
 *   node scripts\exporter-tout.cjs                    -> port 27099, dossier .\export_complet
 *   node scripts\exporter-tout.cjs 27017              -> port personnalise
 *   node scripts\exporter-tout.cjs 27099 mon_dossier  -> dossier personnalise
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
    process.exit(1);
}

const port = process.argv[2] || '27099';
const outputRoot = path.resolve(process.argv[3] || path.join(process.cwd(), 'export_complet'));
const uri = `mongodb://127.0.0.1:${port}/?directConnection=true`;
const SYSTEME = ['admin', 'local', 'config'];

(async () => {
    const client = new MongoClient(uri, { serverSelectionTimeoutMS: 5000 });
    await client.connect();
    console.log(`[OK] Connecte a ${uri}`);

    fs.mkdirSync(outputRoot, { recursive: true });

    const bases = await client.db().admin().listDatabases();
    let totalDocs = 0;
    let totalFichiers = 0;

    for (const b of bases.databases || []) {
        if (SYSTEME.includes(b.name)) continue;
        const db = client.db(b.name);
        const cols = await db.listCollections().toArray();
        if (cols.length === 0) {
            console.log(`[${b.name}] vide, ignoree.`);
            continue;
        }

        const dossierBase = path.join(outputRoot, b.name);
        fs.mkdirSync(dossierBase, { recursive: true });
        console.log(`\n[${b.name}] -> ${dossierBase}`);

        for (const c of cols) {
            try {
                const docs = await db.collection(c.name).find({}).toArray();
                const fichier = path.join(dossierBase, `${c.name}.json`);
                fs.writeFileSync(fichier, EJSON.stringify(docs, null, 2, { relaxed: false }), 'utf8');
                console.log(`   - ${c.name.padEnd(22)} ${String(docs.length).padStart(7)} document(s) -> ${c.name}.json`);
                totalDocs += docs.length;
                totalFichiers++;
            } catch (e) {
                console.error(`   - ${c.name} : ERREUR ${e.message}`);
            }
        }
    }

    console.log('\n=========================================');
    console.log(`EXPORT TERMINE : ${totalFichiers} collection(s), ${totalDocs} document(s)`);
    console.log(`Fichiers ecrits dans : ${outputRoot}`);
    console.log('\nPour reinjecter ensuite (exemple base entreprise_db) :');
    console.log(`  node scripts\\restaurer-json.cjs "${path.join(outputRoot, 'entreprise_db')}" entreprise_db`);
    await client.close();
})().catch((e) => {
    console.error('[ERREUR]', e.message);
    console.error('>> Verifiez que mongod tourne sur ce port.');
    process.exit(1);
});
