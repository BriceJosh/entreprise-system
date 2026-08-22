# 🚀 Guide de Déploiement Complet sur Windows Server (Production Locale & Multi-Agences)

Ce guide décrit la procédure pour installer et exécuter l'application **Entreprise System** sur un serveur dédié **Windows Server**, avec une base de données **MongoDB locale sans frais cloud**, et un accès distant sécurisé pour toutes vos agences via **Cloudflare Tunnel**.

---

## 📑 Sommaire

1. [Prérequis à installer sur Windows Server](#1-prérequis-à-installer-sur-windows-server)
2. [Installation et Déploiement Automatisé](#2-installation-et-déploiement-automatisé)
3. [Migration des données depuis MongoDB Atlas (Cloud ➔ Local)](#3-migration-des-données-depuis-mongodb-atlas)
4. [Configuration de Cloudflare Tunnel (Accès multi-agences)](#4-configuration-de-cloudflare-tunnel)
5. [Sauvegardes automatiques quotidiennes](#5-sauvegardes-automatiques-quotidiennes)
6. [Mises à jour futures de l'application](#6-mises-à-jour-futures)

---

## 1. Prérequis à installer sur Windows Server

Sur la machine Windows Server, téléchargez et installez les logiciels suivants :

1. **Node.js LTS** (version 20 ou 22) : [https://nodejs.org/](https://nodejs.org/) _(Cochez "Automatically install the necessary tools")_.
2. **Git pour Windows** : [https://git-scm.com/download/win](https://git-scm.com/download/win).
3. **MongoDB Community Server** : [https://www.mongodb.com/try/download/community](https://www.mongodb.com/try/download/community) _(Installer en tant que Service Windows "Network Service user", laissez les chemins par défaut)_.

---

## 2. Installation et Déploiement Automatisé

### Étape 2.1 : Copier ou Cloner le projet sur le serveur

Ouvrez **PowerShell** sur le serveur et placez-vous dans votre dossier de destination (ex: `C:\ProjetEnt`) :

```powershell
cd C:\ProjetEnt\entreprise-system
```

### Étape 2.2 : Configurer le fichier `Backend/.env`

Vérifiez que le fichier `Backend/.env` contient bien les paramètres de production locale :

```ini
PORT=5000
NODE_ENV=production
MONGO_URI=mongodb://127.0.0.1:27017/entreprise_db?replicaSet=rs0&directConnection=true
JWT_SECRET=MaPhraseSecretPourLeProjetEnt2026
```

### Étape 2.3 : Exécuter le script d'installation automatique

Ouvrez **PowerShell en tant qu'Administrateur** dans le dossier du projet et lancez :

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\setup-windows-server.ps1
```

Ce script effectue automatiquement :

- L'installation globale de PM2 et sa configuration de démarrage au boot de Windows.
- L'installation des dépendances Frontend et Backend.
- La compilation du Frontend React (`npm run build`).
- L'activation du Replica Set MongoDB (`rs0`) indispensable pour les Change Streams temps réel.
- Le démarrage du service applicatif avec PM2.
- L'ouverture du port 5000 dans le Pare-feu Windows.

---

## 3. Migration des données depuis MongoDB Atlas

Si vous avez déjà des utilisateurs, des agences, des stocks ou des activités enregistrés sur MongoDB Atlas (Cloud) et souhaitez les transférer dans votre base locale :

Dans PowerShell :

```powershell
node .\scripts\migrate-cloud-to-local.cjs
```

_Toutes les collections seront importées dans votre MongoDB local sans aucune perte._

---

## 4. Configuration de Cloudflare Tunnel (Accès pour toutes les agences)

Cloudflare Tunnel permet à toutes vos agences réparties dans différentes villes d'accéder à l'application via un nom de domaine sécurisé (ex: `https://app.monentreprise.com`) sans ouvrir aucun port sur votre box / routeur internet.

### Étape 4.1 : Créer le Tunnel sur Cloudflare

1. Créez un compte sur [Cloudflare](https://dash.cloudflare.com/) et ajoutez votre nom de domaine.
2. Allez dans **Zero Trust** (menu de gauche) > **Networks** > **Tunnels**.
3. Cliquez sur **Add a Tunnel** (ou **Create a Tunnel**), sélectionnez **Cloudflared**, et nommez-le (ex: `serveur-entreprise`).
4. Choisissez l'environnement **Windows 64-bit**.
5. Cloudflare affichera une commande avec un **TOKEN** (ex: `eyJhIjoi...`).

### Étape 4.2 : Installer le connecteur sur Windows Server

Dans **PowerShell (Administrateur)** sur le serveur :

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\install-cloudflared.ps1 -TunnelToken "VOTRE_TOKEN_CLOUDFLARE"
```

### Étape 4.3 : Configurer l'adresse publique sur Cloudflare

Dans la console Cloudflare, sous l'onglet **Public Hostnames** :

- **Subdomain** : `app` (ou `directeur`, `caisse`, etc.)
- **Domain** : `monentreprise.com` (sélectionnez votre domaine)
- **Type** : `HTTP`
- **URL** : `localhost:5000`
- Dans **Additional application settings** > **HTTP Settings** : Cochez **WebSockets**.
- Cliquez sur **Save hostname**.

🎉 Votre application est désormais accessible en HTTPS sécurisé par toutes les agences : `https://app.monentreprise.com` !

---

## 5. Sauvegardes automatiques quotidiennes

Un script PowerShell de sauvegarde automatique est disponible sous `scripts/backup-db.ps1`.

Pour automatiser la sauvegarde tous les jours à 23h00 avec le **Planificateur de tâches Windows** :

1. Ouvrez `taskschd.msc` (Planificateur de tâches).
2. Créez une tâche de base : Nom = `Backup MongoDB Entreprise`.
3. Déclencheur = `Tous les jours à 23:00`.
4. Action = `Démarrer un programme` :
   - **Programme/script** : `powershell.exe`
   - **Arguments** : `-ExecutionPolicy Bypass -File "C:\ProjetEnt\entreprise-system\scripts\backup-db.ps1"`

---

## 6. Mises à jour futures

Lorsque vous modifierez votre code source dans le futur, il vous suffira de lancer sur le serveur :

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\update-app.ps1
```

Ce script installe les nouveaux packages, reconstruit le Frontend (`dist/`) et redémarre le service PM2 sans interruption prolongée.

---

## 7. Dépannage : "Base de données indisponible" / WebSocket hors service

Si l'application affiche *"La base de données est actuellement indisponible"* ou si le temps réel (Socket.IO) ne fonctionne plus, c'est que **le service MongoDB du serveur est arrêté** ou que **le processus Node.js (PM2) est tombé**.

### Étape 7.1 : Diagnostic automatique (recommandé)

Dans **PowerShell en Administrateur**, dans le dossier du projet :

```powershell
git pull
powershell -ExecutionPolicy Bypass -File .\scripts\diagnostic-serveur.ps1
```

Le script vérifie : le service MongoDB, le port 27017, l'application PM2, l'API HTTP, la connexion réelle à la base et Socket.IO.

### Étape 7.2 : Réparation automatique

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\diagnostic-serveur.ps1 -Reparer
```

### Étape 7.3 : Réparation de la base MongoDB (service qui refuse de démarrer)

Si le service MongoDB reste à l'état *Stopped* même après `-Reparer` (souvent après un arrêt brutal du serveur : coupure de courant, crash Windows), les fichiers de données peuvent être endommagés (corruption WiredTiger). Le script de diagnostic affiche alors automatiquement les dernières lignes du log, l'espace disque et la cause probable.

Pour réparer la base :

```powershell
# Recuperer d'abord le script depuis le depot
git pull

# Reparer avec sauvegarde prealable des donnees (recommande)
powershell -ExecutionPolicy Bypass -File .\scripts\reparer-mongodb.ps1 -Sauvegarde
```

Le script s'occupe de tout : localisation de MongoDB, vérification de l'espace disque, arrêt propre du service, sauvegarde optionnelle (`-Sauvegarde`), exécution de `mongod --repair`, redémarrage et test du port 27017. Il affiche ensuite les étapes suivantes (`pm2 restart entreprise-system` puis re-diagnostic).

> ⚠️ La réparation nécessite un espace libre sur le disque d'environ la taille des données. Utilisez `-Forcer` pour tenter malgré tout.

### Étape 7.4 : Réparation manuelle (si besoin)

```powershell
# 1. Redémarrer MongoDB
Get-Service *MongoDB* | Start-Service

# 2. Redémarrer l'application
cd C:\ProjetEnt\entreprise-system
pm2 restart entreprise-system --update-env

# 3. Vérifier
pm2 logs entreprise-system --lines 50
```

> 💡 Depuis la mise à jour du code, les Change Streams temps réel se réactivent **automatiquement** dès que MongoDB revient — un simple redémarrage de MongoDB suffit, plus besoin de redémarrer l'application.
