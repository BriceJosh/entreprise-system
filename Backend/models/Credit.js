const mongoose = require('mongoose');

const paiementSchema = new mongoose.Schema(
  {
    montant: {
      type: Number,
      required: true,
      min: [0.01, 'Le paiement doit être supérieur à 0.']
    },
    date_paiement: {
      type: Date,
      default: Date.now
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
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    }
  },
  { _id: true }
);

/**
 * Achat effectué par une agence auprès d'un fournisseur et qui reste à payer.
 */
const creditSchema = new mongoose.Schema(
  {
    fournisseur: {
      type: String,
      trim: true,
      required: [true, 'Le fournisseur est obligatoire.']
    },
    designation: {
      type: String,
      trim: true,
      required: [true, "La désignation de l'achat est obligatoire."]
    },
    montant_total: {
      type: Number,
      required: [true, 'Le montant total est obligatoire.'],
      min: [0.01, 'Le montant total doit être supérieur à 0.']
    },
    montant_paye: {
      type: Number,
      default: 0,
      min: 0
    },
    reste_a_payer: {
      type: Number,
      default: 0,
      min: 0
    },
    statut: {
      type: String,
      enum: ['ouvert', 'partiellement_paye', 'solde'],
      default: 'ouvert'
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
    date_achat: {
      type: Date,
      default: Date.now
    },
    paiements: {
      type: [paiementSchema],
      default: []
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

creditSchema.pre('validate', function synchroniserMontants(next) {
  const total = Number(this.montant_total) || 0;
  const paiements = Array.isArray(this.paiements) ? this.paiements : [];
  const paye = paiements.reduce(
    (somme, paiement) => somme + (Number(paiement.montant) || 0),
    0
  );

  this.montant_paye = paye;
  this.reste_a_payer = Math.max(0, total - paye);
  this.statut = paye <= 0
    ? 'ouvert'
    : this.reste_a_payer <= 0
      ? 'solde'
      : 'partiellement_paye';

  next();
});

creditSchema.index({ site_id: 1, date_achat: -1 });
creditSchema.index({ site_id: 1, statut: 1 });

module.exports = mongoose.model('Credit', creditSchema);
