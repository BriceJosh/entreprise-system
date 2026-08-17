import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function LogoutButton() {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <button 
      onClick={handleLogout}
      className="bg-red-50 text-red-600 hover:bg-red-100 font-bold py-2 px-4 rounded-xl text-xs uppercase tracking-wider transition-colors"
    >
      Se déconnecter
    </button>
  );
}