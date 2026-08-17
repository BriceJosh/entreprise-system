const mongoose = require('mongoose');

/**
 * Argent versé par une agence sur son compte bancaire.
 * Ce mouvement ne représente ni une dépense ni un crédit fournisseur.
 */
const depotBanqueSchema = new mongoose.Schema(
  {
    banque: {
      type: String,
      trim: true,
      default: 'Banque'
    },
    montant: {
      type: Number,
      required: [true, 'Le montant du dépôt est obligatoire.'],
      min: [0.01, 'Le montant du dépôt doit être supérieur à 0.']
    },
    reference: {
      type: String,
      trim: true,
      default: ''
    },
    note: {
      type: String,
      trim: true,
      default: ''
    },
    date_depot: {
      type: Date,
      default: Date.now
    },
    site_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Site',
      required: [true, 'Le site est obligatoire.'],
      index: true
    },
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, "L'utilisateur est obligatoire."]
    }
  },
  { timestamps: true }
);

depotBanqueSchema.index({ site_id: 1, date_depot: -1 });

module.exports = mongoose.model('DepotBanque', depotBanqueSchema);
