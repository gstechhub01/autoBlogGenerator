import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Navigation from './Navigation';

const ScheduledPage = () => {
  const [scheduledConfigs, setScheduledConfigs] = useState([]);
  const API_BASE = import.meta.env.VITE_API_BASE_URL;

  useEffect(() => {
    const fetchScheduledConfigs = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await fetch(`${API_BASE}/configs`, {
          headers: token ? { 'Authorization': `Bearer ${token}` } : {}
        });
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
      <Navigation />
      <h2>Scheduled Blog Posts</h2>
      <div className="card">
        {scheduledConfigs && scheduledConfigs.length === 0 ? (
          <p>No scheduled posts found.</p>
        ) : scheduledConfigs && scheduledConfigs.length > 0 ? (
          <ul>
            {scheduledConfigs.map((cfg, idx) => (
              <li key={cfg.id || idx}>
                <strong>{cfg.keywords?.[0] || 'Untitled'}</strong> - Scheduled for: {cfg.scheduleTime}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-gray-400 italic">No data available.</p>
        )}
      </div>
    </div>
  );
};

export default ScheduledPage;
