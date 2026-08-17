const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../models/User');

const { verifyToken } = require('../middleware/authMiddleware');

// =================================================================
// ROUTE : POST /api/auth/login
// DESCRIPTION : Connexion utilisateur, récupération du site et JWT
// ACCÈS : Public
// =================================================================
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // 1. Validation de la saisie
    if (!email || !password) {
      return res.status(400).json({ message: 'Veuillez fournir un email et un mot de passe.' });
    }

    // 2. Recherche de l'utilisateur + Populating du Site (Nom et Ville)
    const user = await User.findOne({ email }).populate('site_id', 'nom ville');
    if (!user) {
      return res.status(401).json({ message: 'Identifiants incorrects.' });
    }

    // 3. Vérification du mot de passe
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Identifiants incorrects.' });
    }

    // 4. Formatage des données du site
    const siteData = user.site_id ? {
      id: user.site_id._id.toString(),
      nom: user.site_id.nom,
      ville: user.site_id.ville || 'Tabligbo'
    } : null;

    // 5. Génération du Token JWT
    const token = jwt.sign(
      {
        id: user._id,
        role: user.role,
        site_id: siteData ? siteData.id : null,
        site: siteData
      },
      process.env.JWT_SECRET || 'SECRET_KEY_PAR_DEFAUT',
      { expiresIn: '24h' }
    );

    // 6. Réponse au client avec infos utilisateur et site
    res.status(200).json({
      message: 'Connexion réussie',
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
        site: siteData,
        doit_changer_mdp: user.doit_changer_mdp || false
      }
    });

  } catch (error) {
    console.error('Erreur lors de la connexion :', error);
    res.status(500).json({ message: 'Erreur serveur lors de la connexion.' });
  }
});

// =================================================================
// ROUTE : PUT /api/auth/changer-mdp
// DESCRIPTION : Permet à un utilisateur de modifier son mot de passe
// ACCÈS : Protégé (Nécessite d'être connecté)
// =================================================================
router.put('/changer-mdp', verifyToken, async (req, res) => {
  try {
    const { ancienMotDePasse, nouveauMotDePasse } = req.body;

    // 1. Validation de la saisie
    if (!nouveauMotDePasse || nouveauMotDePasse.length < 6) {
      return res.status(400).json({ 
        message: 'Le nouveau mot de passe doit contenir au moins 6 caractères.' 
      });
    }

    // 2. Récupération de l'utilisateur dans la base de données
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'Utilisateur introuvable.' });
    }

    // 3. Vérification de l'ancien mot de passe
    const isMatch = await bcrypt.compare(ancienMotDePasse, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'L\'ancien mot de passe est incorrect.' });
    }

    // 4. Hachage du nouveau mot de passe
    const hashedPassword = await bcrypt.hash(nouveauMotDePasse, 10);

    // 5. Mise à jour dans MongoDB
    user.password = hashedPassword;
    if (user.doit_changer_mdp !== undefined) {
      user.doit_changer_mdp = false;
    }
    
    await user.save();

    // 6. Réponse positive au client (sans renvoyer le hash du mot de passe)
    const userMisAJour = await User.findById(req.user.id).select('-password');

    res.status(200).json({
      message: 'Mot de passe mis à jour avec succès !',
      user: userMisAJour
    });

  } catch (error) {
    console.error('Erreur lors du changement de mot de passe :', error);
    res.status(500).json({ message: 'Erreur serveur lors de la mise à jour du mot de passe.' });
  }
});

module.exports = router;