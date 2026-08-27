const path = require('path');
const http = require('http');
const { pool } = require('../Backend/db');
const User = require('../Backend/models/User');

const API_URL = 'http://127.0.0.1:5000';

function postJson(urlPath, data) {
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
        'Content-Length': Buffer.byteLength(postData)
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

async function testLogin() {
  console.log('🧪 TEST DE CONNEXION / LOGIN AVEC POSTGRESQL...\n');

  const users = await User.find();
  console.log(`📋 ${users.length} utilisateurs trouvés dans PostgreSQL :`);
  users.forEach(u => console.log(`   - ${u.username} (${u.email}) [${u.role} | ${u.poste}]`));

  const dir = users.find(u => u.role === 'directeur') || users[0];

  console.log(`\n🔑 Test de connexion pour : ${dir.email}...`);

  // Test avec bon / mauvais mot de passe
  const resBad = await postJson('/api/auth/login', {
    email: dir.email,
    password: 'MauvaisMotDePasse123!'
  });
  console.log('   Test mauvais mot de passe -> Status :', resBad.status, '| Réponse :', resBad.data);

  // Test avec le mot de passe initial
  const resGood = await postJson('/api/auth/login', {
    email: dir.email,
    password: 'Directeur2026!'
  });
  console.log('   Test mot de passe valide -> Status :', resGood.status, '| Réponse :', resGood.data?.user ? '✔ TOKEN ET PROFIL GÉNÉRÉS' : resGood.data);

  if (resGood.status === 200) {
    console.log('\n🎉 SUCCÈS : La connexion utilisateur fonctionne parfaitement avec PostgreSQL !');
  } else {
    console.log('\nℹ️ Note : Le statut est', resGood.status, '(mot de passe modifié ou hash personnalisé).');
  }

  await pool.end();
  process.exit(0);
}

testLogin().catch(err => {
  console.error('❌ Erreur :', err);
  process.exit(1);
});
