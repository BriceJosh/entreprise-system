const path = require('path');
const { getServiceTypes, SERVICE_LABELS } = require('../Backend/config/permissions');

const testCases = [
  {
    nom: 'Secrétaire 1 Tabligbo',
    user: { poste: 'secretaire_1', site: { nom: 'Agence Tabligbo', ville: 'Tabligbo' } },
    attendu: ['photocopie', 'impression_bache', 'impression_autocollant', 'autre_service']
  },
  {
    nom: 'Secrétaire 2 Tabligbo',
    user: { poste: 'secretaire_2', site: { nom: 'Agence Tabligbo', ville: 'Tabligbo' } },
    attendu: ['impression_papier_blanc_noir', 'impression_papier_couleur', 'photocopie', 'saisie', 'plastification', 'maintenance', 'scanner', 'autre_service']
  },
  {
    nom: 'Secrétaire 3 Tabligbo',
    user: { poste: 'secretaire_3', site: { nom: 'Agence Tabligbo', ville: 'Tabligbo' } },
    attendu: []
  },
  {
    nom: 'Secrétaire 4 Tabligbo',
    user: { poste: 'secretaire_4', site: { nom: 'Agence Tabligbo', ville: 'Tabligbo' } },
    attendu: ['impression_papier_blanc_noir', 'impression_papier_couleur', 'photocopie', 'saisie', 'scanner', 'autre_service']
  },
  {
    nom: 'Secrétaire 1 Difakpota',
    user: { poste: 'secretaire_1', site: { nom: 'Agence Difakpota', ville: 'Difakpota' } },
    attendu: ['photocopie', 'impression_papier_blanc_noir', 'impression_papier_couleur', 'impression_bache', 'impression_autocollant', 'autre_service']
  },
  {
    nom: 'Secrétaire 1 Adétikopé',
    user: { poste: 'secretaire_1', site: { nom: 'Agence Adétikopé', ville: 'Adétikopé' } },
    attendu: ['photocopie', 'impression_papier_blanc_noir', 'impression_papier_couleur', 'impression_bache', 'impression_autocollant', 'impression_dtf', 'autre_service']
  }
];

console.log('🧪 VÉRIFICATION DES SERVICES PAR SECRÉTARIAT & SITE...\n');
let allOk = true;

testCases.forEach(tc => {
  const result = getServiceTypes(tc.user);
  const ok = JSON.stringify(result) === JSON.stringify(tc.attendu);
  console.log(`📌 ${tc.nom} :`);
  console.log('   Services obtenus :', result.map(s => SERVICE_LABELS[s] || s).join(', '));
  if (ok) {
    console.log('   ✅ CONFORME');
  } else {
    console.error('   ❌ NON CONFORME (attendu: ' + tc.attendu.join(', ') + ')');
    allOk = false;
  }
  console.log('');
});

if (allOk) {
  console.log('🎉 TOUS LES SECRÉTARIATS ONT EXACTEMENT LES SERVICES DEMANDÉS !');
  process.exit(0);
} else {
  process.exit(1);
}
