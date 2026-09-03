const path = require('path');
const { getPermissions, getServiceTypes, hasPermission, PERMISSIONS } = require('../Backend/config/permissions');

const tests = [
  {
    nom: 'Secrétaire 1 Tabligbo',
    user: { poste: 'secretaire_1', site: { nom: 'Agence Tabligbo', ville: 'Tabligbo' } },
    doitAvoirService: true,
    doitAvoirVente: false,
    doitAvoirStock: false,
    servicesCount: 4
  },
  {
    nom: 'Secrétaire 2 Tabligbo',
    user: { poste: 'secretaire_2', site: { nom: 'Agence Tabligbo', ville: 'Tabligbo' } },
    doitAvoirService: true,
    doitAvoirVente: false,
    doitAvoirStock: false,
    servicesCount: 8
  },
  {
    nom: 'Secrétaire 3 Tabligbo',
    user: { poste: 'secretaire_3', site: { nom: 'Agence Tabligbo', ville: 'Tabligbo' } },
    doitAvoirService: false,
    doitAvoirVente: true,
    doitAvoirStock: true,
    servicesCount: 0
  },
  {
    nom: 'Secrétaire 4 Tabligbo',
    user: { poste: 'secretaire_4', site: { nom: 'Agence Tabligbo', ville: 'Tabligbo' } },
    doitAvoirService: true,
    doitAvoirVente: true,
    doitAvoirStock: true,
    servicesCount: 6
  },
  {
    nom: 'Secrétaire 1 Adétikopé',
    user: { poste: 'secretaire_1', site: { nom: 'Agence Adétikopé', ville: 'Adétikopé' } },
    doitAvoirService: true,
    doitAvoirVente: false,
    doitAvoirStock: false,
    servicesCount: 7
  },
  {
    nom: 'Secrétaire 1 Difakpota',
    user: { poste: 'secretaire_1', site: { nom: 'Agence Difakpota', ville: 'Difakpota' } },
    doitAvoirService: true,
    doitAvoirVente: true,
    doitAvoirStock: true,
    servicesCount: 6
  }
];

console.log('🧪 TEST DES RÈGLES DE PERMISSIONS STRICTES...\n');
let ok = true;

tests.forEach(t => {
  const perms = getPermissions(t.user);
  const servs = getServiceTypes(t.user);
  const aService = hasPermission(t.user, PERMISSIONS.ACTIVITE_SERVICE);
  const aVente = hasPermission(t.user, PERMISSIONS.VENTE);
  const aStock = hasPermission(t.user, PERMISSIONS.STOCK_LECTURE);

  const checkService = aService === t.doitAvoirService && servs.length === t.servicesCount;
  const checkVente = aVente === t.doitAvoirVente;
  const checkStock = aStock === t.doitAvoirStock;

  console.log(`📌 ${t.nom} :`);
  console.log(`   - Service : ${aService ? 'OUI' : 'NON'} (${servs.length} services) -> ${checkService ? '✔ OK' : '❌ ERREUR'}`);
  console.log(`   - Vente   : ${aVente ? 'OUI' : 'NON'} -> ${checkVente ? '✔ OK' : '❌ ERREUR'}`);
  console.log(`   - Stock   : ${aStock ? 'OUI' : 'NON'} -> ${checkStock ? '✔ OK' : '❌ ERREUR'}`);

  if (!checkService || !checkVente || !checkStock) {
    ok = false;
  }
  console.log('');
});

if (ok) {
  console.log('🎉 TOUTES LES PERMISSIONS SONT STRICTEMENT RESPECTÉES ET CONFORMES !');
  process.exit(0);
} else {
  process.exit(1);
}
