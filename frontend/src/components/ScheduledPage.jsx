import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

const ScheduledPage = () => {
  const [scheduledConfigs, setScheduledConfigs] = useState([]);
  const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

  useEffect(() => {
    const fetchScheduledConfigs = async () => {
      try {
        const res = await fetch(`${API_BASE}/configs`);
        const data = await res.json();
        if (data.success) {
          // Filter configs that are scheduled but not yet run
          setScheduledConfigs(data.configs.filter(cfg => cfg.scheduleTime && !cfg.hasRun));
        }
      } catch (err) {
        // handle error
      }
    };
    fetchScheduledConfigs();
  }, [API_BASE]);

  return (
    <div className="container">
      <nav style={{ marginBottom: '1rem' }}>
        <Link to="/" className="btn-secondary" style={{ marginRight: 8 }}>Home</Link>
        <Link to="/posts" className="btn-secondary" style={{ marginRight: 8 }}>Published Posts</Link>
        <Link to="/scheduled" className="btn-secondary">Scheduled Posts</Link>
      </nav>
      <h2>Scheduled Blog Posts</h2>
      <div className="card">
        {scheduledConfigs.length === 0 ? (
          <p>No scheduled posts found.</p>
        ) : (
          <ul>
            {scheduledConfigs.map((cfg, idx) => (
              <li key={cfg.id || idx}>
                <strong>{cfg.keywords?.[0] || 'Untitled'}</strong> - Scheduled for: {cfg.scheduleTime}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default ScheduledPage;
