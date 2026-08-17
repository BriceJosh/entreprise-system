const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true
    },

    password: {
      type: String,
      required: true
    },

    username: {
      type: String,
      required: true,
      trim: true
    },

    role: {
      type: String,
      enum: ['directeur', 'secretaire'],
      required: true
    },

    poste: {
      type: String,
      enum: [
        'services',
        'secretaire_1',
        'secretaire_2',
        'secretaire_3',
        'secretaire_4',
        'polyvalent'
      ],
      default: 'services'
    },

    doit_changer_mdp: {
      type: Boolean,
      default: true
    },

    site_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Site',
      default: null
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('User', userSchema);
