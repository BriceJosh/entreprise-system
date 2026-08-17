import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ProtectedRoute({ 
  children, 
  allowedRoles, 
  allowPendingPasswordChange = false 
}) {
  const { user, role, doitChangerMdp, loading } = useAuth();

  // 1. Attente du chargement du contexte d'authentification
  if (loading) {
    return null;
  }

  // 2. Si non connecté -> Redirection vers /login
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // 3. Si le mot de passe doit être obligatoirement changé 
  // et que la route n'est pas explicitement autorisée pendant cette étape
  if (doitChangerMdp && !allowPendingPasswordChange) {
    return <Navigate to="/changer-mdp" replace />;
  }

  // 4. Extrait le rôle de façon sécurisée
  const userRole = role || user?.role || user?.profil?.role;

  // 5. Vérification des privilèges
  if (allowedRoles && !allowedRoles.includes(userRole)) {
    // Redirige intelligemment vers le dashboard correspondant au rôle au lieu de /login
    const redirectPath = (userRole === 'directeur' || userRole === 'admin') 
      ? '/dashboard-directeur' 
      : '/dashboard-secretaire';

    return <Navigate to={redirectPath} replace />;
  }

  return children;
}