import React from 'react';
import { Link, useLocation } from 'react-router-dom';

const navLinks = [
  { to: '/', label: 'Home' },
  { to: '/posts', label: 'Published Posts' },
  { to: '/scheduled', label: 'Scheduled Posts' },
  { to: '/keywords', label: 'Keywords' }, // New link
];

const Navigation = () => {
  const location = useLocation();
  return (
    <nav className="main-nav" style={{ marginBottom: '2rem', width: '100%' }}>
      {navLinks.map((link, idx) => (
        <Link
          key={link.to}
          to={link.to}
          className={`btn-secondary nav-link${location.pathname === link.to ? ' active' : ''}`}
          style={{ marginRight: idx < navLinks.length - 1 ? 12 : 0 }}
        >
          {link.label}
        </Link>
      ))}
    </nav>
  );
};

export default Navigation;
