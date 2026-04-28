import { Link, NavLink } from 'react-router-dom';
import { Building2, ClipboardCheck, Plus } from 'lucide-react';

function Header() {
  return (
    <header className="app-header">
      <div className="header-inner">
        <Link to="/" className="brand">
          <span className="brand-mark" aria-hidden="true">
            <ClipboardCheck size={22} />
          </span>
          <span>
            <span className="brand-title">Attendance Tracker</span>
            <span className="brand-subtitle">
              <Building2 size={13} aria-hidden="true" />
              Admin Console
            </span>
          </span>
        </Link>
        <nav className="nav-actions" aria-label="Admin navigation">
          <NavLink to="/" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            Dashboard
          </NavLink>
          <NavLink to="/create" className="button button-primary compact">
            <Plus size={18} aria-hidden="true" />
            New Training
          </NavLink>
        </nav>
      </div>
    </header>
  );
}

export default Header;
