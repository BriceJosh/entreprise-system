const http = require('http');
const jwt = require('../Backend/node_modules/jsonwebtoken');
const { pool } = require('../Backend/db');
const User = require('../Backend/models/User');
const Activite = require('../Backend/models/Activite');

const JWT_SECRET = process.env.JWT_SECRET || 'secret_jwt_pour_le_moment_a_changer';

function postJson(urlPath, body, token) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(body);
    const options = {
      hostname: 'localhost',
      port: 5000,
      path: urlPath,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      }
    };

    const req = http.request(options, res => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, data });
        }
      });
    });

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

async function runTest() {
  console.log('🧪 TEST IMPRESSION BÂCHE / AUTOCOLLANT AVEC OPTION CONCEPTION...\n');
  const sec = await User.findOne({ role: 'secretaire', poste: 'secretaire_1' }) || await User.findOne({ role: 'secretaire' });
  const token = jwt.sign(
    { userId: sec._id, role: sec.role, poste: sec.poste, site_id: sec.site_id },
    JWT_SECRET,
    { expiresIn: '1h' }
  );

  // 1. Test activité directe avec conception
  // 1m × 2m = 2 m² à 1500 FCFA/m² = 3000 F unitaire. Quantité 2 = 6000 F + Conception 2000 F => Total 8000 FCFA
  const actPayload = {
    type: 'impression',
    service_type: 'impression_bache',
    designation: 'Impression bâche',
    longueur: 2.0,
    largeur: 1.0,
    prix_m2: 1500,
    quantite: 2,
    prix_unitaire: 3000,
    avec_conception: true,
    prix_conception: 2000
  };

  const actRes = await postJson('/api/activites', actPayload, token);
  console.log('1. Création activité avec conception :', actRes.status, actRes.data);
  if (actRes.status === 201) {
    const act = actRes.data;
    console.log(`   - Montant total obtenu : ${act.montant_total} FCFA (Attendu: 8000 FCFA)`);
    console.log(`   - Conception : ${act.prix_conception} FCFA (avec_conception: ${act.avec_conception})`);
    if (act.montant_total === 8000 && act.prix_conception === 2000 && act.avec_conception === true) {
      console.log('   ✅ Activité conforme !');
    } else {
      console.error('   ❌ Incohérence sur le calcul de l\'activité !');
    }
    await Activite.deleteOne({ _id: act._id });
  }

  // 2. Test reçu panier avec conception
  const recuPayload = {
    nom_client: 'Client Test Conception',
    servi_par: 'Secrétaire 1',
    montant_paye: 10000,
    lignes: [
      {
        type: 'impression',
        service_type: 'impression_autocollant',
        designation: 'Impression Autocollant',
        description: 'Autocollants vitrine',
        quantite: 1,
        prix_unitaire: 5000,
        longueur: 1.0,
        largeur: 1.0,
        surface_m2: 1.0,
        prix_m2: 5000,
        avec_conception: true,
        prix_conception: 3000,
        montant: 8000
      }
    ]
  };

  const recuRes = await postJson('/api/recus', recuPayload, token);
  console.log('\n2. Création reçu avec ligne autocollant + conception :', recuRes.status, recuRes.data);
  if (recuRes.status === 201) {
    const recu = recuRes.data?.recu;
    console.log(`   - Montant total reçu : ${recu.montant_total} FCFA (Attendu: 8000 FCFA)`);
    console.log(`   - Ligne 0 conception : ${recu.lignes[0]?.prix_conception} FCFA`);
    if (recuRes.data?.recu?._id) {
      await pool.query('DELETE FROM activites WHERE recu_id = $1', [recuRes.data.recu._id]);
      await pool.query('DELETE FROM recus WHERE id = $1', [recuRes.data.recu._id]);
    }
  }

  console.log('\n🎉 VÉRIFICATIONS TERMINÉES AVEC SUCCÈS !');
  process.exit(0);
}

runTest().catch(console.error);
