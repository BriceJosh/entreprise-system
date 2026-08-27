const { pool } = require('../Backend/db');
const bcrypt = require('../Backend/node_modules/bcryptjs');

const COMPTES = [
  { email: 'tous.medannou@espacecommercial.com', mdp: 'Directeur2026!' },
  { email: 'secretaire1.tabligbo@espacecommercial.com', mdp: 'Tabligbo12026!' },
  { email: 'secretaire2.tabligbo@espacecommercial.com', mdp: 'Tabligbo22026!' },
  { email: 'secretaire3.tabligbo@espacecommercial.com', mdp: 'Tabligbo32026!' },
  { email: 'secretaire4.tabligbo@espacecommercial.com', mdp: 'Tabligbo42026!' },
  { email: 'secretaire1.adetikope@espacecommercial.com', mdp: 'Adetikope2026!' },
  { email: 'secretaire1.difakpota@espacecommercial.com', mdp: 'Difakpota2026!' }
];

async function reset() {
  console.log('===============================================================');
  console.log('   RÉINITIALISATION PROPRE DES ACCÈS & MOTS DE PASSE            ');
  console.log('===============================================================\n');

  for (const c of COMPTES) {
    const hash = await bcrypt.hash(c.mdp, 10);
    await pool.query(
      'UPDATE users SET password = $1, doit_changer_mdp = false WHERE email = $2',
      [hash, c.email]
    );
    console.log(`✔ [${c.email}] -> Mot de passe mis à jour : ${c.mdp}`);
  }

  console.log('\n===============================================================');
  console.log('🎉 TOUS LES MOTS DE PASSE ONT ÉTÉ MIS À JOUR AVEC SUCCÈS !');
  console.log('===============================================================\n');
  await pool.end();
  process.exit(0);
}

reset().catch(console.error);
