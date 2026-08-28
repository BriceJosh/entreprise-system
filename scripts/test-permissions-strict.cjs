const { getPermissions, getServiceTypes, PERMISSIONS, SERVICE_LABELS } = require('../Backend/config/permissions');

const profiles = [
  {
    name: 'Secrétaire 1 Tabligbo',
    user: { poste: 'secretaire_1', site: { nom: 'Agence Tabligbo', ville: 'Tabligbo' } },
    mustHave: [PERMISSIONS.ACTIVITE_SERVICE],
    mustNotHave: [PERMISSIONS.VENTE, PERMISSIONS.STOCK_LECTURE, PERMISSIONS.STOCK_GESTION],
    expectedServices: ['photocopie', 'impression_bache', 'impression_autocollant', 'autre_service']
  },
  {
    name: 'Secrétaire 2 Tabligbo',
    user: { poste: 'secretaire_2', site: { nom: 'Agence Tabligbo', ville: 'Tabligbo' } },
    mustHave: [PERMISSIONS.ACTIVITE_SERVICE],
    mustNotHave: [PERMISSIONS.VENTE, PERMISSIONS.STOCK_LECTURE, PERMISSIONS.STOCK_GESTION],
    expectedServices: ['impression_papier_blanc_noir', 'impression_papier_couleur', 'photocopie', 'saisie', 'plastification', 'maintenance', 'scanner', 'autre_service']
  },
  {
    name: 'Secrétaire 3 Tabligbo',
    user: { poste: 'secretaire_3', site: { nom: 'Agence Tabligbo', ville: 'Tabligbo' } },
    mustHave: [PERMISSIONS.VENTE, PERMISSIONS.STOCK_LECTURE, PERMISSIONS.STOCK_GESTION],
    mustNotHave: [PERMISSIONS.ACTIVITE_SERVICE],
    expectedServices: []
  },
  {
    name: 'Secrétaire 4 Tabligbo',
    user: { poste: 'secretaire_4', site: { nom: 'Agence Tabligbo', ville: 'Tabligbo' } },
    mustHave: [PERMISSIONS.ACTIVITE_SERVICE, PERMISSIONS.VENTE, PERMISSIONS.STOCK_LECTURE, PERMISSIONS.STOCK_PAPIER_GESTION],
    mustNotHave: [],
    expectedServices: ['impression_papier_blanc_noir', 'impression_papier_couleur', 'autre_service']
  },
  {
    name: 'Secrétaire 1 Adétikopé',
    user: { poste: 'secretaire_1', site: { nom: 'Agence Adétikopé', ville: 'Adétikopé' } },
    mustHave: [PERMISSIONS.ACTIVITE_SERVICE],
    mustNotHave: [PERMISSIONS.VENTE, PERMISSIONS.STOCK_LECTURE, PERMISSIONS.STOCK_GESTION],
    expectedServices: ['photocopie', 'impression_papier_blanc_noir', 'impression_papier_couleur', 'impression_bache', 'impression_autocollant', 'impression_dtf', 'autre_service']
  },
  {
    name: 'Secrétaire 1 Difakpota',
    user: { poste: 'secretaire_1', site: { nom: 'Agence Difakpota', ville: 'Difakpota' } },
    mustHave: [PERMISSIONS.ACTIVITE_SERVICE, PERMISSIONS.VENTE, PERMISSIONS.STOCK_LECTURE],
    mustNotHave: [],
    expectedServices: ['photocopie', 'impression_papier_blanc_noir', 'impression_papier_couleur', 'impression_bache', 'impression_autocollant', 'autre_service']
  }
];

console.log('🧪 TEST STRICT DES PERMISSIONS & SERVICES...\n');
let success = true;

profiles.forEach(p => {
  const perms = getPermissions(p.user);
  const servs = getServiceTypes(p.user);

  console.log(`📌 ${p.name} :`);

  // Check must have
  const missingPerms = p.mustHave.filter(mh => !perms.includes(mh));
  if (missingPerms.length > 0) {
    console.error(`   ❌ Permissions manquantes : ${missingPerms.join(', ')}`);
    success = false;
  }

  // Check must not have
  const forbiddenPerms = p.mustNotHave.filter(mnh => perms.includes(mnh));
  if (forbiddenPerms.length > 0) {
    console.error(`   ❌ Permissions interdites présentes : ${forbiddenPerms.join(', ')}`);
    success = false;
  }

  // Check services
  const servsOk = JSON.stringify(servs) === JSON.stringify(p.expectedServices);
  if (!servsOk) {
    console.error(`   ❌ Services non conformes. Reçus: [${servs.join(', ')}], Attendus: [${p.expectedServices.join(', ')}]`);
    success = false;
  } else {
    console.log(`   ✔ Services autorisés : ${servs.length ? servs.map(s => SERVICE_LABELS[s] || s).join(', ') : 'AUCUN (Vente/Stock uniquement)'}`);
    console.log(`   ✔ Permissions vérifiées avec succès.`);
  }
  console.log('');
});

if (success) {
  console.log('🎉 TOUTES LES PERMISSIONS SONT 100% CONFORMES ET COHÉRENTES !');
  process.exit(0);
} else {
  process.exit(1);
}
