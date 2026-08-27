const http = require('http');

const API_URL = 'http://127.0.0.1:5000';

const COMPTES = [
  { email: 'tous.medannou@espacecommercial.com', mdp: 'Directeur2026!' },
  { email: 'secretaire1.tabligbo@espacecommercial.com', mdp: 'Tabligbo12026!' },
  { email: 'secretaire2.tabligbo@espacecommercial.com', mdp: 'Tabligbo22026!' },
  { email: 'secretaire3.tabligbo@espacecommercial.com', mdp: 'Tabligbo32026!' },
  { email: 'secretaire4.tabligbo@espacecommercial.com', mdp: 'Tabligbo42026!' },
  { email: 'secretaire1.adetikope@espacecommercial.com', mdp: 'Adetikope2026!' },
  { email: 'secretaire1.difakpota@espacecommercial.com', mdp: 'Difakpota2026!' }
];

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

async function run() {
  console.log('🧪 TEST DES 7 COMPTES DE CONNEXION...\n');
  let ok = true;

  for (const c of COMPTES) {
    const res = await postJson('/api/auth/login', { email: c.email, password: c.mdp });
    if (res.status === 200 && res.data.token) {
      const u = res.data.user;
      console.log(`✔ [OK 200] ${u.username} (${c.email})`);
      console.log(`   Rôle : ${u.role} | Site : ${u.site_id?.nom || 'Direction'}`);
      console.log(`   Permissions : [${u.permissions.join(', ')}]`);
      console.log(`   Services (${u.serviceTypes?.length || 0}) : [${(u.serviceTypes || []).join(', ')}]`);
    } else {
      console.error(`❌ [FAIL ${res.status}] ${c.email} :`, res.data);
      ok = false;
    }
    console.log('');
  }

  if (ok) {
    console.log('🎉 TOUS LES COMPTES SE CONNECTENT SANS AUCUNE ERREUR SERVEUR !');
    process.exit(0);
  } else {
    process.exit(1);
  }
}

run().catch(console.error);
