const mongoose = require('mongoose');

const siteSchema = new mongoose.Schema({
  nom: { type: String, required: true },
  ville: { type: String, required: true },
  telephone: { type: String, trim: true, default: '' }, // Affiché sur les reçus clients
  actif: { type: Boolean, default: true } // Permettra de désactiver une agence fermée plus tard
}, { timestamps: true });

module.exports = mongoose.model('Site', siteSchema);