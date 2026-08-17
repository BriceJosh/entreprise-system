require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('./models/User');

const app = express();
app.use(cors());
app.use(express.json());

// 1. Connexion à MongoDB Atlas
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("✅ Connecté à MongoDB Atlas avec succès !"))
  .catch((err) => console.error("❌ Erreur de connexion MongoDB :", err));

// 2. Route de Connexion (Login)
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    // Vérifier si l'utilisateur existe
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: "Identifiants incorrects." });
    }

    // Vérifier le mot de passe 
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Identifiants incorrects." });
    }

    // Générer un Token JWT en utilisant la clé secrète du fichier .env
    const token = jwt.sign(
      { userId: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    // Renvoyer les infos utilisateur au Front-end
    res.json({
      token,
      user: {
        id: user._id,
        username: user.username,
        role: user.role,
        site_id: user.site_id,
        email: user.email
      }
    });

  } catch (error) {
    res.status(500).json({ message: "Erreur serveur lors de la connexion." });
  }
});

// 3. Démarrage du serveur
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Serveur backend démarré sur http://localhost:${PORT}`));