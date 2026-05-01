import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

function ProtectedRoute() {
  const { token, user, loading } = useAuth();

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  if (loading) {
    return (
      <main className="public-page">
        <section className="public-panel">
          <div className="empty-state public">
            <div className="spinner" />
            <p>Checking your session...</p>
          </div>
        </section>
      </main>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}

export default ProtectedRoute;
