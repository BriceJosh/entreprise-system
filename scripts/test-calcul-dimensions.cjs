const path = require('path');
const http = require('http');
const mongoose = require(path.join(__dirname, '../Backend/node_modules/mongoose'));
const jwt = require(path.join(__dirname, '../Backend/node_modules/jsonwebtoken'));

const User = require(path.join(__dirname, '../Backend/models/User'));
const Activite = require(path.join(__dirname, '../Backend/models/Activite'));

require(path.join(__dirname, '../Backend/node_modules/dotenv')).config({
  path: path.join(__dirname, '../Backend/.env')
});

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/entreprise_db?replicaSet=rs0&directConnection=true';
const JWT_SECRET = process.env.JWT_SECRET || 'MaPhraseSecretPourLeProjetEnt2026';
const API_URL = 'http://127.0.0.1:5000';

function postJson(urlPath, data, token) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(data);
    const url = new URL(urlPath, API_URL);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
        'Authorization': `Bearer ${token}`
      }
    };
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => { body += chunk; });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(body) });
        } catch {
          resolve({ status: res.statusCode, raw: body });
        }
      });
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

async function testDimensions() {
  console.log('🧪 TEST DU CALCUL DE PRIX PAR DIMENSIONS (m²)...\n');
  await mongoose.connect(MONGO_URI);

  const sec = await User.findOne({ role: 'secretaire', poste: 'secretaire_1' }) || await User.findOne({ role: 'secretaire' });
  const token = jwt.sign(
    { userId: sec._id, role: sec.role, poste: sec.poste, site_id: sec.site_id },
    JWT_SECRET,
    { expiresIn: '1h' }
  );

  const payload = {
    type: 'impression',
    service_type: 'impression_bache',
    designation: 'Impression bâche',
    longueur: 0.5,
    largeur: 0.5,
    prix_m2: 1500,
    quantite: 2,
    prix_unitaire: 0 // Laissé à 0 pour tester le calcul automatique backend
  };

  console.log('Envoi payload :', payload);
  const res = await postJson('/api/activites', payload, token);
  console.log('\nRéponse API (Status ' + res.status + ') :', res.data);

  if (res.status === 201) {
    const act = res.data;
    console.log('\n--- VÉRIFICATION DES VALEURS ---');
    console.log('Longueur :', act.longueur, 'm (attendu: 0.5)');
    console.log('Largeur  :', act.largeur, 'm (attendu: 0.5)');
    console.log('Surface  :', act.surface_m2, 'm² (attendu: 0.25)');
    console.log('Prix m²  :', act.prix_m2, 'FCFA (attendu: 1500)');
    console.log('Prix unitaire :', act.prix_unitaire, 'FCFA (attendu: 375)');
    console.log('Montant total :', act.montant_total, 'FCFA (attendu: 750 car 2 exemplaires)');

    const ok = (
      act.surface_m2 === 0.25 &&
      act.prix_unitaire === 375 &&
      act.montant_total === 750
    );

    if (ok) {
      console.log('\n✅ SUCCÈS TOTAL : La formule 0.5m × 0.5m = 0.25 m² × 1500 FCFA/m² = 375 FCFA / unité (Total: 750 FCFA) est validée !');
    } else {
      console.error('\n❌ Divergence dans les calculs.');
    }

    // Nettoyage de l'activité test
    await Activite.deleteOne({ _id: act._id });
    console.log('🧹 Activité test nettoyée.');
  } else {
    console.error('❌ Erreur lors de la création :', res.data);
  }

  await mongoose.disconnect();
  process.exit(0);
}

testDimensions().catch(console.error);
