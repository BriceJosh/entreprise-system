const { pool } = require('../Backend/db');
const bcrypt = require('../Backend/node_modules/bcryptjs');

async function run() {
  const res = await pool.query('SELECT id, email, username, password, role, poste FROM users');
  console.log('--- UTILISATEURS DANS POSTGRESQL ---');
  for (const u of res.rows) {
    console.log(`Email: ${u.email} | User: ${u.username} | Role: ${u.role}`);
    const isDirecteur = await bcrypt.compare('Directeur2026!', u.password);
    const is123456 = await bcrypt.compare('123456', u.password);
    const isPassword = await bcrypt.compare('password', u.password);
    console.log(`   - 'Directeur2026!' : ${isDirecteur}`);
    console.log(`   - '123456'         : ${is123456}`);
    console.log(`   - 'password'       : ${isPassword}`);
  }
  await pool.end();
}
run();
