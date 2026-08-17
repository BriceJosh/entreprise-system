require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('MongoDB connecté.');

  const updates = [
    {
      email: 'secretaire1.adetikope@espacecommercial.com',
      poste: 'services'
    },
    {
      email: 'secretaire1.difakpota@espacecommercial.com',
      poste: 'polyvalent'
    },
    {
      email: 'secretaire1.tabligbo@espacecommercial.com',
      poste: 'secretaire_1'
    },
    {
      email: 'secretaire2.tabligbo@espacecommercial.com',
      poste: 'secretaire_2'
    },
    {
      email: 'secretaire3.tabligbo@espacecommercial.com',
      poste: 'secretaire_3'
    },
    {
      email: 'secretaire4.tabligbo@espacecommercial.com',
      poste: 'secretaire_4'
    }
  ];

  for (const item of updates) {
    const result = await User.updateOne(
      { email: item.email, role: 'secretaire' },
      { $set: { poste: item.poste } }
    );

    console.log(`${item.email} -> ${item.poste} | matched=${result.matchedCount} modified=${result.modifiedCount}`);
  }

  await mongoose.disconnect();
  console.log('Migration terminée.');
}

main().catch(async error => {
  console.error('Migration échouée :', error);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
