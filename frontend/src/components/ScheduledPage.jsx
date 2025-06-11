import React, { useEffect, useState } from 'react';

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
