const path = require('path');

require('dotenv').config({
  path: path.join(__dirname, '.env')
});

const express = require('express');
const http = require('http');
const mongoose = require('mongoose');
const { Server } = require('socket.io');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

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
// MONGODB & CHANGE STREAMS
// =============================================================
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 5000
    });
    console.log('✅ Connecté à MongoDB Atlas avec succès !');
  } catch (err) {
    console.error('❌ Erreur de connexion MongoDB :', err.message);
    console.log('🔄 Nouvelle tentative de connexion à MongoDB dans 5 secondes...');
    setTimeout(connectDB, 5000);
  }
};

connectDB();

mongoose.connection.on('disconnected', () => {
  console.warn('⚠️ Connexion MongoDB perdue. Reconnexion...');
});

mongoose.connection.on('error', (err) => {
  console.error('❌ Erreur MongoDB :', err.message);
});

// Route de santé pour Render / Uptime monitors
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    dbConnected: mongoose.connection.readyState === 1
  });
});

app.get('/', (req, res) => {
  res.send('API Entreprise System opérationnelle');
});

// Middleware pour vérifier la connexion à la base de données
app.use((req, res, next) => {
  if (mongoose.connection.readyState !== 1 && !req.path.startsWith('/api/health')) {
    return res.status(503).json({
      message: "La base de données est actuellement indisponible. Veuillez réessayer dans quelques instants."
    });
  }
  next();
});

mongoose.connection.once('open', () => {
  console.log('✅ Activation des Change Streams pour le temps réel...');

  const activiteStream = Activite.watch([], { fullDocument: 'updateLookup' });
  activiteStream.on('change', (change) => {
    const document = change.fullDocument;

    if (change.operationType === 'insert' && document) {
      const userId = document.user_id?._id || document.user_id;
      if (userId) io.to(`user_${userId}`).emit('activite_ajoutee', document);
      io.to('role_directeur').emit('activite_ajoutee', document);
    }

    if (change.operationType === 'update') {
      const payload = {
        _id: change.documentKey._id,
        updatedFields: change.updateDescription.updatedFields
      };
      if (document?.user_id) {
        const userId = document.user_id?._id || document.user_id;
        io.to(`user_${userId}`).emit('activite_modifiee', payload);
      }
      io.to('role_directeur').emit('activite_modifiee', payload);
    }

    if (change.operationType === 'delete') {
      io.to('role_directeur').emit('activite_supprimee', change.documentKey._id);
    }
  });

  const depenseStream = Depense.watch([], { fullDocument: 'updateLookup' });
  depenseStream.on('change', (change) => {
    const document = change.fullDocument;

    if (change.operationType === 'insert' && document) {
      const userId = document.user_id?._id || document.user_id;
      if (userId) io.to(`user_${userId}`).emit('depense_ajoutee', document);
      io.to('role_directeur').emit('depense_ajoutee', document);
    }

    if (change.operationType === 'update') {
      const payload = {
        _id: change.documentKey._id,
        updatedFields: change.updateDescription.updatedFields
      };
      if (document?.user_id) {
        const userId = document.user_id?._id || document.user_id;
        io.to(`user_${userId}`).emit('depense_modifiee', payload);
      }
      io.to('role_directeur').emit('depense_modifiee', payload);
    }

    if (change.operationType === 'delete') {
      io.to('role_directeur').emit('depense_supprimee', change.documentKey._id);
    }
  });

  const stockStream = Stock.watch([], { fullDocument: 'updateLookup' });
  stockStream.on('change', (change) => {
    if (
      (change.operationType === 'insert' || change.operationType === 'update') &&
      change.fullDocument
    ) {
      const siteId = change.fullDocument.site_id?._id || change.fullDocument.site_id;
      if (siteId) io.to(`site_${siteId}`).emit('stock_mis_a_jour', change.fullDocument);
      io.to('role_directeur').emit('stock_mis_a_jour', change.fullDocument);
    }
  });

  const depotStream = DepotBanque.watch([], { fullDocument: 'updateLookup' });
  depotStream.on('change', (change) => {
    const document = change.fullDocument;
    if (change.operationType === 'insert' && document) {
      const userId = document.user_id?._id || document.user_id;
      if (userId) io.to(`user_${userId}`).emit('depot_banque_ajoute', document);
      io.to('role_directeur').emit('depot_banque_ajoute', document);
    }
  });

  const creditStream = Credit.watch([], { fullDocument: 'updateLookup' });
  creditStream.on('change', (change) => {
    const document = change.fullDocument;
    if (!document) return;
    const userId = document.user_id?._id || document.user_id;
    const event = change.operationType === 'insert' ? 'credit_ajoute' : 'credit_mis_a_jour';
    if (userId) io.to(`user_${userId}`).emit(event, document);
    io.to('role_directeur').emit(event, document);
  });
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

    const permissions = getPermissions(user.poste, user.role);
    const serviceTypes = getServiceTypes(user.poste, user.role);

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

const PORT = process.env.PORT || 5000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Serveur unifié démarré sur http://localhost:${PORT}`);
});
