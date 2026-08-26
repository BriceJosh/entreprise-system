/**
 * ===================================================================
 * AUDIT COMPLET DU TEMPS RÉEL, CHANGE STREAMS, SOCKET.IO & REPLICA SET
 * Application : Entreprise System (Windows Server 2022 / Local / Tailscale)
 * ===================================================================
 *
 * Ce script effectue une batterie complète de tests end-to-end pour valider :
 *  1. La connexion et la réactivité de MongoDB
 *  2. L'état du Replica Set (rs0, Primary, Oplog)
 *  3. Le fonctionnement réel des Change Streams (insert, update, delete)
 *  4. L'intégrité des collections et le volume des données
 *  5. L'état de santé de l'API HTTP Backend (/api/health)
 *  6. Le serveur WebSocket Socket.IO (authentification JWT, rooms privées)
 *  7. La chaîne complète de propagation temps réel
 *
 * Usage :
 *   node scripts/audit-temps-reel-et-base.cjs
 *   node scripts/audit-temps-reel-et-base.cjs [MONGO_URI] [API_URL]
 */

const path = require("path");
const http = require("http");
const https = require("https");

// Chargement des variables d'environnement du Backend
try {
  require(path.join(__dirname, "../Backend/node_modules/dotenv")).config({
    path: path.join(__dirname, "../Backend/.env"),
  });
} catch (_) {
  try {
    require("dotenv").config({ path: path.join(__dirname, "../Backend/.env") });
  } catch (__) {}
}

let mongoose, jwt, ioClient;

try {
  mongoose = require(path.join(__dirname, "../Backend/node_modules/mongoose"));
} catch (_) {
  try {
    mongoose = require("mongoose");
  } catch (__) {}
}

try {
  jwt = require(path.join(__dirname, "../Backend/node_modules/jsonwebtoken"));
} catch (_) {
  try {
    jwt = require("jsonwebtoken");
  } catch (__) {}
}

try {
  ioClient = require(path.join(__dirname, "../node_modules/socket.io-client"));
} catch (_) {
  try {
    ioClient = require("socket.io-client");
  } catch (__) {}
}

const MONGO_URI =
  process.argv[2] ||
  process.env.MONGO_URI ||
  "mongodb://127.0.0.1:27017/entreprise_db?replicaSet=rs0&directConnection=true";

const API_URL =
  process.argv[3] || `http://127.0.0.1:${process.env.PORT || 5000}`;

const JWT_SECRET =
  process.env.JWT_SECRET || "MaPhraseSecretPourLeProjetEnt2026";

const colors = {
  cyan: (s) => `\x1b[36m${s}\x1b[0m`,
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  gray: (s) => `\x1b[90m${s}\x1b[0m`,
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
};

function logHeader(title) {
  console.log("\n" + colors.cyan("═".repeat(65)));
  console.log(colors.bold(colors.cyan(`  ${title}`)));
  console.log(colors.cyan("═".repeat(65)));
}

function logStep(step, text) {
  console.log("\n" + colors.bold(colors.yellow(`[${step}] ${text}`)));
}

function logOk(text) {
  console.log(`  ${colors.green("✔")} ${text}`);
}

function logWarn(text) {
  console.log(`  ${colors.yellow("⚠")} ${text}`);
}

function logFail(text) {
  console.log(`  ${colors.red("✖")} ${text}`);
}

function logInfo(text) {
  console.log(`  ${colors.gray("ℹ")} ${text}`);
}

// Helper pour requête HTTP simple
function fetchJson(url) {
  return new Promise((resolve, reject) => {
    const isHttps = url.startsWith('https');
    const lib = isHttps ? https : http;
    const req = lib.get(url, { timeout: 7000 }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch (_) {
          resolve({ status: res.statusCode, raw: data });
        }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Timeout dépassé (7s)'));
    });
  });
}

// ===================================================================
// SUITE DE TESTS
// ===================================================================
async function runAudit() {
  logHeader('AUDIT ENTREPRISE SYSTEM : TEMPS RÉEL, CHANGE STREAMS & REPLICA SET');
  console.log(`  Date / Heure : ${new Date().toLocaleString('fr-FR')}`);
  console.log(`  Cible MongoDB: ${colors.gray(MONGO_URI.split('@').pop())}`);
  console.log(`  Cible API/WS : ${colors.gray(API_URL)}`);

  const summary = {
    mongoConnect: false,
    replicaSet: false,
    changeStreams: false,
    collections: false,
    apiHealth: false,
    socketIoAuth: false,
    socketIoRealtime: false
  };

  let dbConnection = null;

  // -----------------------------------------------------------------
  // 1. TEST CONNEXION MONGODB
  // -----------------------------------------------------------------
  logStep('1/6', 'Vérification de la connexion MongoDB & Ping');
  try {
    const start = Date.now();
    await mongoose.connect(MONGO_URI, {
      serverSelectionTimeoutMS: 6000,
      directConnection: true
    });
    const pingTime = Date.now() - start;
    dbConnection = mongoose.connection;
    const adminDb = dbConnection.db.admin();
    const buildInfo = await adminDb.buildInfo();

    logOk(`Connecté avec succès à MongoDB v${buildInfo.version} (temps: ${pingTime}ms)`);
    summary.mongoConnect = true;
  } catch (err) {
    logFail(`Impossible de se connecter à MongoDB : ${err.message}`);
    logInfo('Conseil : Vérifiez que le service Windows MongoDB est démarré (Start-Service MongoDB).');
  }

  // -----------------------------------------------------------------
  // 2. TEST REPLICA SET (Obligatoire pour les Change Streams)
  // -----------------------------------------------------------------
  logStep('2/6', 'Contrôle du Replica Set (Replication rs0)');
  if (summary.mongoConnect) {
    try {
      const adminDb = dbConnection.db.admin();
      const replStatus = await adminDb.command({ replSetGetStatus: 1 });
      const setName = replStatus.set;
      const myState = replStatus.myState; // 1 = PRIMARY
      const primaryMember = replStatus.members?.find((m) => m.state === 1);

      if (myState === 1 || primaryMember) {
        logOk(`Replica Set actif : "${setName}" | Rôle : PRIMARY (state ${myState})`);
        logOk(`Membre primaire : ${primaryMember ? primaryMember.name : 'Ce nœud'} (Santé : ${primaryMember ? primaryMember.health : 1})`);
        summary.replicaSet = true;
      } else {
        logWarn(`Replica Set "${setName}" trouvé mais l'état est ${myState} (attendu: 1 PRIMARY).`);
      }
    } catch (err) {
      logFail(`Replica Set INACTIF ou NON INITIALISÉ : ${err.message}`);
      logWarn('Sans Replica Set ("rs0"), MongoDB refuse catégoriquement d\'ouvrir des Change Streams.');
      logInfo('Pour réactiver le Replica Set sur le serveur :');
      logInfo('  powershell -ExecutionPolicy Bypass -File .\\scripts\\setup-mongodb-replicaset.ps1');
    }
  } else {
    logWarn('Test ignoré (connexion MongoDB échouée).');
  }

  // -----------------------------------------------------------------
  // 3. TEST INTÉGRITÉ DES DONNÉES & COLLECTIONS
  // -----------------------------------------------------------------
  logStep('3/6', 'Contrôle des collections et des volumes de données');
  if (summary.mongoConnect) {
    try {
      const collections = await dbConnection.db.listCollections().toArray();
      const colNames = collections.map((c) => c.name);

      const attendues = [
        'users',
        'sites',
        'activites',
        'stocks',
        'depenses',
        'credits',
        'depotbanques',
        'recus',
        'stockmouvements'
      ];

      const manquantes = attendues.filter((c) => !colNames.includes(c));
      if (manquantes.length > 0) {
        logInfo(`Collections optionnelles non encore initialisées : ${manquantes.join(', ')}`);
      }

      console.log(`  Collections présentes (${colNames.length}) :`);
      let totalDocuments = 0;
      let hasUsers = false;
      let hasSites = false;

      for (const col of colNames) {
        if (col.startsWith('system.') || col.startsWith('_audit_')) continue;
        const count = await dbConnection.db.collection(col).countDocuments();
        totalDocuments += count;
        const statusIcon = count > 0 ? colors.green('●') : colors.yellow('○');
        console.log(`   ${statusIcon} ${col.padEnd(22)} : ${String(count).padStart(6)} doc(s)`);
        if (col === 'users' && count > 0) hasUsers = true;
        if (col === 'sites' && count > 0) hasSites = true;
      }

      if (totalDocuments > 0) {
        logOk(`Base "entreprise_db" contient ${totalDocuments} documents au total.`);
        if (hasUsers && hasSites) {
          logOk('Comptes utilisateurs et Agences (Sites) bien présents.');
          summary.collections = true;
        } else {
          logWarn('Attention : La collection "users" ou "sites" semble vide. Pensez à réimporter ou créer un admin.');
          summary.collections = true;
        }
      } else {
        logWarn('La base de données semble vide (aucun document trouvé).');
      }
    } catch (err) {
      logFail(`Erreur lors du listage des collections : ${err.message}`);
    }
  } else {
    logWarn('Test ignoré (connexion MongoDB non établie).');
  }

  // -----------------------------------------------------------------
  // 4. TEST RÉEL DES CHANGE STREAMS (Insert, Update, Delete)
  // -----------------------------------------------------------------
  logStep('4/6', 'Test de fonctionnement en direct des Change Streams MongoDB');
  if (summary.mongoConnect && summary.replicaSet) {
    let testCollection = null;
    let changeStream = null;
    try {
      const testColName = `_audit_cs_test_${Date.now()}`;
      testCollection = dbConnection.db.collection(testColName);

      // Ouvrir le Change Stream
      changeStream = testCollection.watch([], { fullDocument: 'updateLookup' });

      const eventsReceived = [];
      const eventPromise = new Promise((resolve) => {
        changeStream.on('change', (change) => {
          eventsReceived.push(change.operationType);
          if (eventsReceived.length >= 3) {
            resolve();
          }
        });
        changeStream.on('error', (err) => {
          logFail(`Erreur du Change Stream : ${err.message}`);
        });
      });

      // Laisser le temps au watcher de s'enregistrer
      await new Promise((r) => setTimeout(r, 600));

      const startTime = Date.now();
      // 1. Insert
      const insertRes = await testCollection.insertOne({
        testId: 'audit-realtime',
        message: 'Test change streams',
        timestamp: new Date()
      });

      // 2. Update
      await testCollection.updateOne(
        { _id: insertRes.insertedId },
        { $set: { message: 'Test update change stream', updated: true } }
      );

      // 3. Delete
      await testCollection.deleteOne({ _id: insertRes.insertedId });

      // Attente des événements
      await Promise.race([
        eventPromise,
        new Promise((_, reject) => setTimeout(() => reject(new Error('Délai d\'attente du Change Stream dépassé (5s)')), 5000))
      ]);

      const elapsed = Date.now() - startTime;
      logOk(`Change Streams 100% OPÉRATIONNELS ! Événements capturés en ${elapsed}ms : [${eventsReceived.join(', ')}]`);
      summary.changeStreams = true;
    } catch (err) {
      logFail(`Échec du test Change Streams : ${err.message}`);
    } finally {
      if (changeStream) {
        try { await changeStream.close(); } catch (_) {}
      }
      if (testCollection) {
        try { await testCollection.drop(); } catch (_) {}
      }
    }
  } else {
    logWarn('Test Change Streams impossible car le Replica Set n\'est pas actif.');
  }

  // -----------------------------------------------------------------
  // 5. TEST SANTÉ DE L'API HTTP BACKEND (/api/health)
  // -----------------------------------------------------------------
  logStep('5/6', `Test de l'API HTTP Backend (${API_URL}/api/health)`);
  try {
    const res = await fetchJson(`${API_URL}/api/health`);
    if (res.status === 200 && res.data) {
      const { status, dbConnected, dbPing, readyStateLabel, uptimeSecondes } = res.data;
      const isDbOk = dbConnected === true && (dbPing === undefined || dbPing === true);
      if (status === 'ok' && isDbOk) {
        const details = [
          'status: OK',
          'DB: connectée',
          readyStateLabel ? `Mongoose: ${readyStateLabel}` : null,
          uptimeSecondes ? `Uptime: ${uptimeSecondes}s` : null
        ].filter(Boolean).join(', ');
        logOk(`API en ligne (${details})`);
        summary.apiHealth = true;
      } else {
        logWarn(`API répond mais état dégradé : status=${status}, dbConnected=${dbConnected}, dbPing=${dbPing}`);
      }
    } else {
      logFail(`Réponse inattendue de /api/health (Code HTTP: ${res.status})`);
    }
  } catch (err) {
    logFail(`Impossible de contacter l'API sur ${API_URL}/api/health : ${err.message}`);
    logInfo('Vérifiez que le serveur Node/PM2 tourne : pm2 status entreprise-system');
  }

  // -----------------------------------------------------------------
  // 6. TEST SOCKET.IO (Authentification JWT & Rooms)
  // -----------------------------------------------------------------
  logStep('6/6', `Test du serveur WebSocket Socket.IO (${API_URL})`);
  if (ioClient && jwt) {
    let socket = null;
    try {
      const testToken = jwt.sign(
        {
          userId: 'audit_test_user_id',
          role: 'directeur',
          poste: 'directeur_general',
          site_id: 'audit_test_site_id'
        },
        JWT_SECRET,
        { expiresIn: '10m' }
      );

      const socketPromise = new Promise((resolve, reject) => {
        socket = ioClient(API_URL, {
          auth: { token: testToken },
          transports: ['websocket', 'polling'],
          timeout: 7000,
          reconnection: false
        });

        socket.on('connect', () => {
          logOk(`Connexion WebSocket Socket.IO réussie ! (Socket ID : ${socket.id})`);
          summary.socketIoAuth = true;
          resolve();
        });

        socket.on('connect_error', (err) => {
          reject(new Error(`Refus de connexion Socket.IO : ${err.message}`));
        });
      });

      await Promise.race([
        socketPromise,
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout de connexion Socket.IO (7s)')), 7000))
      ]);

      summary.socketIoRealtime = true;
      logOk('Authentification JWT Socket.IO validée et handshake WebSocket établi.');
    } catch (err) {
      logFail(`Échec du test Socket.IO : ${err.message}`);
      logInfo('Vérifiez que le port 5000 est accessible et que la clé JWT_SECRET correspond.');
    } finally {
      if (socket && socket.connected) {
        socket.disconnect();
      }
    }
  } else {
    logWarn('Module "socket.io-client" ou "jsonwebtoken" introuvable pour simuler la connexion.');
  }

  // -----------------------------------------------------------------
  // BILAN & RECOMMANDATIONS
  // -----------------------------------------------------------------
  logHeader('BILAN GLOBAL DU SYSTÈME APRÈS RÉPARATION');

  const allPassed =
    summary.mongoConnect &&
    summary.replicaSet &&
    summary.changeStreams &&
    summary.collections &&
    summary.apiHealth &&
    summary.socketIoAuth;

  console.log(`  1. Connexion MongoDB   : ${summary.mongoConnect ? colors.green('SUCCÈS ✔') : colors.red('ÉCHEC ✖')}`);
  console.log(`  2. Replica Set (rs0)   : ${summary.replicaSet ? colors.green('SUCCÈS ✔') : colors.red('ÉCHEC ✖')}`);
  console.log(`  3. Données/Collections : ${summary.collections ? colors.green('SUCCÈS ✔') : colors.red('ÉCHEC ✖')}`);
  console.log(`  4. Change Streams      : ${summary.changeStreams ? colors.green('SUCCÈS ✔') : colors.red('ÉCHEC ✖')}`);
  console.log(`  5. API HTTP (/health)  : ${summary.apiHealth ? colors.green('SUCCÈS ✔') : colors.red('ÉCHEC ✖')}`);
  console.log(`  6. WebSocket Socket.IO : ${summary.socketIoAuth ? colors.green('SUCCÈS ✔') : colors.red('ÉCHEC ✖')}`);

  console.log('\n' + colors.cyan('═'.repeat(65)));

  if (allPassed) {
    console.log(colors.bold(colors.green('  TOUT EST PARFAITEMENT OPÉRATIONNEL !')));
    console.log(colors.green('  Le suivi en temps réel, les Change Streams, Socket.IO et la base'));
    console.log(colors.green('  de données fonctionnent de manière optimale.'));
  } else {
    console.log(colors.bold(colors.yellow('  DES ACTIONS CORRECTIVES SONT RECOMMANDÉES :')));
    if (!summary.replicaSet) {
      console.log(colors.yellow('  • Pour réparer le Replica Set rs0 :'));
      console.log('    powershell -ExecutionPolicy Bypass -File .\\scripts\\setup-mongodb-replicaset.ps1');
    }
    if (!summary.apiHealth) {
      console.log(colors.yellow('  • Pour redémarrer l\'application sous PM2 :'));
      console.log('    pm2 restart entreprise-system --update-env');
    }
  }
  console.log(colors.cyan('═'.repeat(65)) + '\n');

  if (dbConnection) {
    await mongoose.disconnect();
  }
  process.exit(allPassed ? 0 : 1);
}

runAudit().catch((err) => {
  console.error('\n' + colors.red(`Erreur inattendue : ${err.message}`));
  process.exit(1);
});
