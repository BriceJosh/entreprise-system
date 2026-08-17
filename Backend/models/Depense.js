// models/Depense.js
const mongoose = require('mongoose');

const depenseSchema = new mongoose.Schema({
  motif: { 
    type: String, 
    required: [true, 'Le motif de la dépense est obligatoire'] 
  },
  montant: { 
    type: Number, 
    required: [true, 'Le montant est obligatoire'] 
  },
  // La référence vers l'agence/site concerné
  site_id: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Site', // Assure-toi que le nom correspond à ton modèle Site
    required: true 
  },
  // Celui qui a enregistré la dépense (le secrétaire ou l'agent)
  user_id: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User'  // Assure-toi que le nom correspond à ton modèle Utilisateur
  },
  date: { 
    type: Date, 
    default: Date.now 
  }
}, { 
  timestamps: true // Ajoute automatiquement createdAt et updatedAt
});

module.exports = mongoose.model('Depense', depenseSchema);