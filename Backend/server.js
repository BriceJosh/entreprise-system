const path = require('path');
const fs = require('fs');

require('dotenv').config({
  path: path.join(__dirname, '.env')
});

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool, query, listenAppEvents } = require('./db');

const User = require('./models/User');
const Activite = require('./models/Activite');
const Stock = require('./models/Stock');
const Site = require('./models/Site');
const Depense = require('./models/Depense');
const DepotBanque = require('./models/DepotBanque');
const Credit = require('./models/Credit');

const { verifyToken, checkRole } = require('./middleware/authMiddleware');
const { getPermissions, getServiceTypes } = require('./config/permissions');

const depenseRoutes = require('./routes/depenseRoutes');
const activiteRoutes = require('./routes/activites');
const stockRoutes = require('./routes/stocks');
const caisseRoutes = require('./routes/caisse');
const caisseExportRoutes = require('./routes/caisseExport');
const depotBanqueRoutes = require('./routes/depotBanqueRoutes');
const creditRoutes = require('./routes/creditRoutes');
const historiqueRoutes = require('./routes/historique');

const app = express();

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }
});

app.set('io', io);

// =============================================================
// SOCKET.IO : authentification + rooms privées
// =============================================================
io.use((socket, next) => {
  try {
    const token =
      socket.handshake.auth?.token ||
      socket.handshake.headers?.authorization?.replace(/^Bearer\s+/i, '');

    if (!token) {
      return next(new Error('Token Socket.IO manquant.'));
    }

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || 'SECRET_KEY_PAR_DEFAUT'
    );

    socket.user = decoded;
    next();
  } catch (error) {
    next(new Error('Token Socket.IO invalide ou expiré.'));
  }
});

io.on('connection', (socket) => {
  const userId = socket.user?.userId || socket.user?.id || socket.user?._id;
  const siteId = socket.user?.site_id;
  const role = socket.user?.role;

  if (userId) socket.join(`user_${userId}`);
  if (siteId) socket.join(`site_${siteId}`);
  if (role === 'directeur' || role === 'admin') {
    socket.join('role_directeur');
  }

  console.log(`🔌 Nouveau client WebSocket connecté : ${socket.id}`);

  // Compatibilité avec l'ancien frontend.
  socket.on('rejoindre_site', (requestedSiteId) => {
    if (!requestedSiteId) return;

    if (role === 'directeur' || role === 'admin') {
      socket.join(`site_${requestedSiteId}`);
      return;
    }

    if (String(requestedSiteId) === String(siteId)) {
      socket.join(`site_${siteId}`);
    }
  });

  socket.on('disconnect', () => {
    console.log(`❌ Client WebSocket déconnecté : ${socket.id}`);
  });
});

// =============================================================
// POSTGRESQL & TEMPS RÉEL (LISTEN / NOTIFY)
// =============================================================
let dbConnected = false;

const TELEPHONES_SITES = [
  { motif: 'difakpota', telephone: '93870704' },
  { motif: 'adetikope', telephone: '91904000' },
  { motif: 'tabligbo', telephone: '79459091' }
];

function normaliserTexteSite(valeur) {
  return String(valeur || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

async function attribuerTelephonesSites() {
  try {
    const sites = await Site.find();
    for (const site of sites) {
      const texte = normaliserTexteSite(`${site.nom} ${site.ville || ''}`);
      const cible = TELEPHONES_SITES.find((t) => texte.includes(t.motif));
      if (cible && site.telephone !== cible.telephone) {
        site.telephone = cible.telephone;
        await site.save();
        console.log(`📞 Téléphone ${cible.telephone} attribué au site « ${site.nom} ».`);
      }
    }
  } catch (err) {
    console.error('⚠️ Attribution des téléphones des sites impossible :', err.message);
  }
}

async function connectDB() {
  try {
    await pool.query('SELECT 1');
    if (!dbConnected) {
      dbConnected = true;
      console.log('✅ Connecté à PostgreSQL avec succès (ACID & Anti-Coupure) !');
      listenAppEvents(io);
      await attribuerTelephonesSites();
    }
  } catch (err) {
    dbConnected = false;
    console.error('❌ Erreur de connexion PostgreSQL :', err.message);
    console.log('🔄 Nouvelle tentative dans 5 secondes...');
    setTimeout(connectDB, 5000);
  }
}

connectDB();

// Route de santé pour Monitoring local & distant
app.get('/api/health', async (req, res) => {
  let dbPing = false;
  try {
    const r = await pool.query('SELECT NOW() AS now');
    dbPing = Boolean(r.rows && r.rows.length > 0);
  } catch (_) {
    dbPing = false;
  }

  res.json({
    status: dbPing ? 'ok' : 'degraded',
    engine: 'PostgreSQL 16 (ACID & Crash-Safe)',
    timestamp: new Date().toISOString(),
    dbConnected: dbPing,
    dbPing,
    uptimeSecondes: Math.floor(process.uptime()),
    astuce: dbPing
      ? null
      : 'PostgreSQL ne répond pas. Sur le serveur : scripts\\relancer-base-en-panne.ps1'
  });
});

// Middleware pour vérifier la connexion à la base de données
app.use((req, res, next) => {
  if (!dbConnected && !req.path.startsWith('/api/health')) {
    return res.status(503).json({
      message: "La base de données PostgreSQL est en cours de reconnexion. Veuillez réessayer dans quelques instants."
    });
  }
  next();
});

// =============================================================
// LOGIN
// =============================================================
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email }).populate('site_id', 'nom ville');

    if (!user) {
      return res.status(400).json({ message: 'Identifiants incorrects.' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Identifiants incorrects.' });
    }

    const siteIdBrut = user.site_id
      ? (user.site_id._id || user.site_id)
      : null;

    const permissions = getPermissions(user);
    const serviceTypes = getServiceTypes(user);

    const token = jwt.sign(
      {
        userId: user._id,
        role: user.role,
        poste: user.poste,
        site_id: siteIdBrut
      },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      token,
      user: {
        id: user._id,
        username: user.username,
        role: user.role,
        poste: user.poste,
        site_id: user.site_id,
        email: user.email,
        permissions,
        serviceTypes
      }
    });
  } catch (error) {
    console.error('Erreur login :', error);
    res.status(500).json({
      message: 'Erreur serveur lors de la connexion.'
    });
  }
});

// =============================================================
// ROUTES
// =============================================================
app.use('/api/activites', activiteRoutes);
app.use('/api/stocks', stockRoutes);
app.use('/api/caisse', caisseRoutes);
app.use('/api/depenses', depenseRoutes);
app.use('/api/caisse', caisseExportRoutes);
app.use('/api/depots-banque', depotBanqueRoutes);
app.use('/api/credits', creditRoutes);
app.use('/api/historique', historiqueRoutes);
app.use('/api/recus', require('./routes/recus'));

// =============================================================
// STATS DIRECTION
// =============================================================
app.get(
  '/api/directeur/stats',
  verifyToken,
  checkRole(['directeur', 'admin']),
  async (req, res) => {
    try {
      const activites = await Activite.find({
        type: { $in: ['vente', 'impression'] }
      });
      const depenses = await Depense.find();

      const totalVentesCA = activites.reduce((acc, curr) => {
        const montant = Number(
          curr.montant_total ??
          curr.montant ??
          ((curr.quantite || 0) * (curr.prix_unitaire || 0))
        ) || 0;
        return acc + montant;
      }, 0);

      const totalDepensesGlobal = depenses.reduce(
        (acc, curr) => acc + (Number(curr.montant) || 0),
        0
      );

      const chiffreAffaires = totalVentesCA - totalDepensesGlobal;
      const nombreEmployes = await User.countDocuments({ role: 'secretaire' });

      res.json({
        chiffreAffaires,
        nombreEmployes,
        totalVentes: activites.filter(a => a.type === 'vente').length,
        totalServices: activites.filter(a => a.type === 'impression').length,
        totalDepenses: totalDepensesGlobal
      });
    } catch (error) {
      console.error('Erreur stats directeur :', error);
      res.status(500).json({
        message: 'Erreur lors de la récupération des statistiques.'
      });
    }
  }
);

app.get('/api/sites', verifyToken, async (req, res) => {
  try {
    const sites = await Site.find();
    res.json(sites);
  } catch (error) {
    res.status(500).json({
      message: 'Erreur lors de la récupération des sites.'
    });
  }
});

// =============================================================
// LISTE DES SECRÉTAIRES POUR LE FILTRE DIRECTION
// =============================================================
//
// GET /api/users/secretaires?site_id=<ObjectId>
//
// Réservé à la direction. Renvoie tous les comptes secrétaires
// (avec leur site rattaché) afin que le tableau de bord global
// puisse filtrer par secrétaire même si celle-ci n'a encore
// aucune activité enregistrée.
app.get('/api/users/secretaires', verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'directeur' && req.user.role !== 'admin') {
      return res.status(403).json({
        message: 'Accès réservé à la direction.'
      });
    }

    const filtre = { role: 'secretaire' };

    if (
      req.query.site_id &&
      req.query.site_id !== 'TOUS' &&
      req.query.site_id !== 'tous' &&
      req.query.site_id !== 'null' &&
      req.query.site_id !== 'undefined'
    ) {
      filtre.site_id = req.query.site_id;
    }

    const secretaires = await User.find(filtre)
      .select('username email poste site_id')
      .populate('site_id', 'nom ville')
      .sort({ username: 1 });

    res.json(secretaires);
  } catch (error) {
    console.error('Erreur récupération secrétaires :', error);
    res.status(500).json({
      message: 'Erreur lors de la récupération des secrétaires.'
    });
  }
});

const handleChangePassword = async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?.id || req.user?._id;
    const ancienMotDePasse =
      req.body.ancienMotDePasse ||
      req.body.ancienMdp ||
      req.body.oldPassword;
    const nouveauMotDePasse =
      req.body.nouveauMotDePasse ||
      req.body.nouveauMdp ||
      req.body.nouveauPassword ||
      req.body.newPassword;

    if (!nouveauMotDePasse || String(nouveauMotDePasse).length < 6) {
      return res.status(400).json({
        message: 'Le nouveau mot de passe doit contenir au moins 6 caractères.'
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'Utilisateur non trouvé.' });
    }

    // Si l'utilisateur doit obligatoirement changer de mot de passe (première connexion),
    // ou s'il a fourni l'ancien mot de passe, on le vérifie s'il est renseigné.
    if (ancienMotDePasse) {
      const isMatch = await bcrypt.compare(ancienMotDePasse, user.password);
      if (!isMatch) {
        return res.status(400).json({
          message: "L'ancien mot de passe est incorrect."
        });
      }
    } else if (!user.doit_changer_mdp) {
      return res.status(400).json({
        message: "L'ancien mot de passe est obligatoire."
      });
    }

    user.password = await bcrypt.hash(nouveauMotDePasse, 10);
    user.doit_changer_mdp = false;
    await user.save();

    const userSansMdp = await User.findById(userId)
      .select('-password')
      .populate('site_id', 'nom ville');

    res.json({
      message: 'Mot de passe modifié avec succès !',
      user: userSansMdp
    });
  } catch (error) {
    console.error('Erreur changement mdp :', error);
    res.status(500).json({
      message: 'Erreur lors de la modification du mot de passe.'
    });
  }
};

app.post('/api/users/change-password', verifyToken, handleChangePassword);
app.put('/api/users/change-password', verifyToken, handleChangePassword);
app.post('/api/auth/changer-mdp', verifyToken, handleChangePassword);
app.put('/api/auth/changer-mdp', verifyToken, handleChangePassword);
app.post('/api/auth/change-password', verifyToken, handleChangePassword);
app.put('/api/auth/change-password', verifyToken, handleChangePassword);

// =============================================================
// SERVEUR STATIQUE & CLIENT-SIDE ROUTING (Vite Build / SPA)
// =============================================================
const distPath = path.join(__dirname, '../dist');
app.use(express.static(distPath));

// Fallback pour le routage côté client React (compatible Express 5)
app.use((req, res, next) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ message: 'Route API introuvable' });
  }
  const indexPath = path.join(distPath, 'index.html');
  if (fs.existsSync(indexPath)) {
    return res.sendFile(indexPath);
  }
  res.status(200).send('API Entreprise System opérationnelle. (Compilez le frontend avec "npm run build" pour voir l\'interface).');
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Serveur unifié démarré sur http://localhost:${PORT}`);
});
