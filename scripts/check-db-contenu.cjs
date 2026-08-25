/**
 * INSPECTION DE LA BASE - Entreprise System
 *
 * Liste toutes les bases MongoDB visibles, leurs collections et
 * le nombre de documents de chacune. Sert a verifier apres une
 * panne si les donnees sont reellement presentes ou non.
 *
 * Usage (depuis la racine du projet) :
 *   node scripts\check-db-contenu.cjs
 *   node scripts\check-db-contenu.cjs "mongodb://127.0.0.1:27017/?directConnection=true"
 */

const path = require('path');

// Le driver mongodb est fourni par les dependances du Backend (mongoose)
let MongoClient;
try {
    ({ MongoClient } = require(path.join(__dirname, '..', 'Backend', 'node_modules', 'mongodb')));
} catch (e) {
    console.error('[ERREUR] Driver mongodb introuvable dans Backend/node_modules.');
    console.error('         Lancez d\'abord : cd Backend ; npm install');
    process.exit(1);
}

const uri = process.argv[2] || 'mongodb://127.0.0.1:27017/?directConnection=true';
const SYSTEME = ['admin', 'local', 'config'];

(async () => {
    const client = new MongoClient(uri, { serverSelectionTimeoutMS: 5000 });
    try {
        await client.connect();
        console.log('[OK] Connecte a :', uri.split('@').pop());

        const infos = await client.db().admin().listDatabases();
        const bases = infos.databases || [];

        if (bases.length === 0) {
            console.log('[INFO] Aucune base trouvee.');
            return;
        }

        let totalDocs = 0;
        for (const b of bases) {
            const db = client.db(b.name);
            const tailleMo = (b.sizeOnDisk / (1024 * 1024)).toFixed(1);

            if (SYSTEME.includes(b.name)) {
                console.log(`\n[${b.name}] (systeme, ${tailleMo} Mo) - ignoree`);
                continue;
            }

            const cols = await db.listCollections().toArray();
            console.log(`\n[${b.name}] ${tailleMo} Mo, ${cols.length} collection(s)`);

            if (cols.length === 0) {
                console.log('  >> VIDE : aucune collection visible !');
                continue;
            }
            for (const c of cols) {
                const n = await db.collection(c.name).countDocuments();
                totalDocs += n;
                console.log(`   - ${c.name.padEnd(20)} ${String(n).padStart(7)} document(s)`);
            }
        }

        console.log('\n=========================================');
        console.log(`TOTAL documents (hors systeme) : ${totalDocs}`);
        if (totalDocs === 0) {
            console.log('>> La base apparait VIDE.');
            console.log('   Si des fichiers collection-*.wt existent encore dans le dossier data,');
            console.log('   les donnees sont peut-etre recuperables (catalogue endommage seulement).');
        } else {
            console.log('>> Les donnees sont bien presentes.');
        }
    } catch (err) {
        console.error('[ERREUR] ', err.message);
        process.exit(1);
    } finally {
        await client.close();
    }
})();
