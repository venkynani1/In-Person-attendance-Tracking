import { Link, NavLink } from 'react-router-dom';
import { ClipboardCheck, LogOut, Plus, ShieldCheck, UserCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';

function Header() {
  const { user, logout } = useAuth();

  return (
    <header className="app-header">
      <div className="header-inner">
        <Link to="/" className="brand">
          <span className="brand-mark" aria-hidden="true">
            <ClipboardCheck size={22} />
          </span>
          <span>
            <span className="brand-title">Attendance Command Center</span>
            <span className="brand-subtitle">Enterprise QR attendance</span>
          </span>
        </Link>
        <nav className="nav-actions" aria-label="Admin navigation">
          <NavLink to="/" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            Dashboard
          </NavLink>
          {user?.role === 'MASTER_ADMIN' && (
            <Link to="/#approvals" className="nav-link">
              Pending Approvals
            </Link>
          )}
          {user && (
            <div className="header-account">
              <span className="user-chip">
                <UserCircle size={16} aria-hidden="true" />
                {user.username}
              </span>
              <span className={`role-badge role-${user.role.toLowerCase().replace('_', '-')}`}>
                <ShieldCheck size={14} aria-hidden="true" />
                {user.role === 'MASTER_ADMIN' ? 'MASTER ADMIN' : 'ADMIN'}
              </span>
            </div>
          )}
          <NavLink to="/create" className="button button-primary compact">
            <Plus size={18} aria-hidden="true" />
            New Training
          </NavLink>
          <button className="icon-button" type="button" onClick={logout} title="Logout">
            <LogOut size={18} aria-hidden="true" />
            <span className="sr-only">Logout</span>
          </button>
        </nav>
      </div>
    </header>
  );
}

export default Header;
