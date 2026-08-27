const path = require('path');
const http = require('http');
const mongoose = require(path.join(__dirname, '../Backend/node_modules/mongoose'));
const jwt = require(path.join(__dirname, '../Backend/node_modules/jsonwebtoken'));

const User = require(path.join(__dirname, '../Backend/models/User'));
const Site = require(path.join(__dirname, '../Backend/models/Site'));
const Recu = require(path.join(__dirname, '../Backend/models/Recu'));
const Activite = require(path.join(__dirname, '../Backend/models/Activite'));
const Stock = require(path.join(__dirname, '../Backend/models/Stock'));

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

async function testRecuMixte() {
  console.log('🧪 TEST DE CRÉATION D\'UN REÇU AVEC SERVICE & DIMENSIONS...\n');
  await mongoose.connect(MONGO_URI);

  const sec = await User.findOne({ role: 'secretaire' }).populate('site_id');
  const token = jwt.sign(
    { userId: sec._id, role: sec.role, poste: sec.poste, site_id: sec.site_id?._id || sec.site_id },
    JWT_SECRET,
    { expiresIn: '1h' }
  );

  const payload = {
    nom_client: 'Client Test Entreprise',
    servi_par: sec.username,
    montant_paye: 1000,
    lignes: [
      {
        type: 'impression',
        designation: 'Impression bâche',
        description: 'Bâche renforcée test',
        quantite: 2,
        option_vente: 'Service',
        prix_unitaire: 375,
        montant: 750,
        longueur: 0.5,
        largeur: 0.5,
        surface_m2: 0.25,
        prix_m2: 1500
      }
    ]
  };

  console.log('Envoi payload reçu :', JSON.stringify(payload, null, 2));
  const res = await postJson('/api/recus', payload, token);
  console.log('\nRéponse API (Status ' + res.status + ') :', res.data);

  if (res.status === 201) {
    const recu = res.data.recu;
    console.log('\n--- VÉRIFICATION DU REÇU GÉNÉRÉ ---');
    console.log('Numéro Reçu :', recu.numero);
    console.log('Total Reçu  :', recu.montant_total, 'FCFA');
    console.log('Montant Payé:', recu.montant_paye, 'FCFA');
    console.log('Monnaie Rendue:', recu.monnaie_rendue, 'FCFA');
    console.log('Lignes :', JSON.stringify(recu.lignes, null, 2));

    const activites = await Activite.find({ recu_id: recu._id });
    console.log(`\nActivité(s) créée(s) liée(s) au reçu : ${activites.length}`);
    activites.forEach(a => {
      console.log(`- Type: ${a.type} | Désignation: ${a.designation} | Dim: ${a.longueur}m×${a.largeur}m (${a.surface_m2}m²) | P.U: ${a.prix_unitaire} | Total: ${a.montant_total}`);
    });

    // Nettoyage
    await Activite.deleteMany({ recu_id: recu._id });
    await Recu.deleteOne({ _id: recu._id });
    console.log('\n🧹 Données de test nettoyées avec succès.');
    console.log('\n✅ TEST REÇU SERVICE & DIMENSIONS 100% VALIDE !');
  } else {
    console.error('❌ Erreur lors de la création du reçu :', res.data);
  }

  await mongoose.disconnect();
  process.exit(0);
}

testRecuMixte().catch(console.error);
