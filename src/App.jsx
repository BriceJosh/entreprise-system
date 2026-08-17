import { BrowserRouter as Router, Routes, Route, Navigate, Link } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/Login';
import ChangerMdp from './pages/ChangerMdp';
import ProtectedRoute from './components/ProtectedRoute';
import DashboardDirecteur from './pages/DashboardDirecteur';
import DashboardSecretaire from './pages/DashboardSecretaire';
import Profil from './pages/Profil';
import Historique from './Pages/Historique';

// Composant de repli en cas d'accès non autorisé (403)
const NonAutorise = () => (
  <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 text-center p-4">
    <h1 className="text-4xl font-black text-red-600 mb-2">403</h1>
    <h2 className="text-xl font-bold text-gray-800 mb-4">Accès Refusé</h2>
    <p className="text-sm text-gray-500 max-w-md mb-6">
      Vous n'avez pas les permissions nécessaires pour accéder à cette page.
    </p>
    <Link 
      to="/login" 
      className="bg-emerald-600 text-white font-bold px-6 py-2.5 rounded-xl text-xs uppercase tracking-wider hover:bg-emerald-700 transition-all shadow-sm"
    >
      Retour à la connexion
    </Link>
  </div>
);

// Wrappers pour transmettre le profil utilisateur aux composants
function DashboardDirecteurWrapper() {
  const { user } = useAuth();
  return <DashboardDirecteur profil={user} />;
}

function DashboardSecretaireWrapper() {
  const { user } = useAuth();
  return <DashboardSecretaire profil={user} />;
}

function ProfilWrapper() {
  const { user } = useAuth();
  return <Profil profil={user} />;
}

function ChangerMdpWrapper() {
  const { user } = useAuth();
  return <ChangerMdp profil={user} />;
}

function HistoriqueWrapper() {
  const { user } = useAuth();
  return <Historique profil={user} />;
}

// Redirection intelligente sur la racine `/`
function HomeRedirect() {
  const { user, role, doitChangerMdp } = useAuth();

  // 1. Non connecté -> direction Login
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // 2. Doit changer son mot de passe -> direction Changer MDP
  if (doitChangerMdp) {
    return <Navigate to="/changer-mdp" replace />;
  }

  // 3. Redirection selon le rôle
  if (role === 'directeur' || role === 'admin') {
    return <Navigate to="/dashboard-directeur" replace />;
  }

  return <Navigate to="/dashboard-secretaire" replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          {/* Racine avec redirection intelligente */}
          <Route path="/" element={<HomeRedirect />} />

          {/* Route publique */}
          <Route path="/login" element={<Login />} />

          {/* Route privée : Changement de mot de passe obligatoire */}
          <Route 
            path="/changer-mdp" 
            element={
              <ProtectedRoute allowPendingPasswordChange={true}>
                <ChangerMdpWrapper />
              </ProtectedRoute>
            } 
          />

          {/* Route privée : Réservée au Directeur / Admin */}
          <Route 
            path="/dashboard-directeur" 
            element={
              <ProtectedRoute allowedRoles={['directeur', 'admin']}>
                <DashboardDirecteurWrapper />
              </ProtectedRoute>
            } 
          />

          {/* Route privée : Accessible à tous les utilisateurs connectés */}
          <Route 
            path="/profil" 
            element={
              <ProtectedRoute>
                <ProfilWrapper />
              </ProtectedRoute>
            } 
          />

          <Route
            path="/historique"
            element={
              <ProtectedRoute allowedRoles={['directeur', 'admin', 'secretaire', 'caissier']}>
                <HistoriqueWrapper />
              </ProtectedRoute>
            }
          />

          {/* Route privée : Réservée aux Secrétaires / Caissiers */}
          <Route 
            path="/dashboard-secretaire" 
            element={
              <ProtectedRoute allowedRoles={['secretaire', 'caissier']}>
                <DashboardSecretaireWrapper />
              </ProtectedRoute>
            } 
          />

          {/* Page d'accès refusé */}
          <Route path="/non-autorise" element={<NonAutorise />} />
          
          {/* Redirection par défaut pour les URLs non reconnues */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}
