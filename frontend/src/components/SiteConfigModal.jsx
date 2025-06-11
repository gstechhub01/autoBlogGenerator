import React, { useState, useEffect } from 'react';

const SiteConfigModal = ({ isOpen, onClose, onSave, apiBase }) => {
  const [sites, setSites] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  useEffect(() => {
    if (isOpen) {
      fetchSites();
    }
  }, [isOpen]);

  const fetchSites = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${apiBase}/site-configs`);
      const data = await response.json();
      if (response.ok) {
        setSites(data.sites || []);
      } else {
        setError('Failed to load site configurations');
      }
    } catch (err) {
      setError('Failed to load site configurations');
    } finally {
      setLoading(false);
    }
  };

  const handleSiteChange = (idx, field, value) => {
    setSites(prev => prev.map((site, i) => i === idx ? { ...site, [field]: value } : site));
  };

  const addSite = () => {
    setSites(prev => [...prev, { url: '', username: '', password: '' }]);
  };

  const removeSite = (idx) => {
    setSites(prev => prev.filter((_, i) => i !== idx));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);
    
    try {
      const res = await fetch(`${apiBase}/save-site-configs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sites }),
      });
      const data = await res.json();
      
      if (res.ok) {
        setSuccess('Site configurations saved successfully!');
        setTimeout(() => {
          onSave && onSave();
        }, 1500);
      } else {
        setError(data.error || 'Failed to save configurations');
      }
    } catch (err) {
      setError('Failed to save configurations');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop">
      <div className="modal-content">
        <button
          className="absolute top-4 right-4 text-gray-400 hover:text-red-500 text-2xl font-bold transition-colors"
          onClick={onClose}
          aria-label="Close"
        >
          ×
        </button>
        
        <h2 className="text-2xl font-bold mb-6 text-blue-700">Manage Site Configurations</h2>
        
        {loading && !sites.length ? (
          <div className="flex justify-center items-center py-8">
            <div className="spinner"></div>
          </div>
        ) : (
          <form onSubmit={handleSave} className="space-y-6">
            {sites.map((site, idx) => (
              <div key={idx} className="card bg-blue-50 border-blue-200">
                <div className="space-y-3">
                  <input
                    type="text"
                    placeholder="Site URL"
                    className="w-full"
                    value={site.url}
                    onChange={e => handleSiteChange(idx, 'url', e.target.value)}
                    required
                  />
                  <input
                    type="text"
                    placeholder="Username"
                    className="w-full"
                    value={site.username}
                    onChange={e => handleSiteChange(idx, 'username', e.target.value)}
                    required
                  />
                  <input
                    type="password"
                    placeholder="App Password"
                    className="w-full"
                    value={site.password}
                    onChange={e => handleSiteChange(idx, 'password', e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => removeSite(idx)}
                    className="btn-danger text-sm"
                  >
                    Remove Site
                  </button>
                </div>
              </div>
            ))}
            
            <button
              type="button"
              onClick={addSite}
              className="btn-success w-full"
            >
              Add New Site
            </button>
            
            {error && <div className="error-message">{error}</div>}
            {success && <div className="success-message">{success}</div>}
            
            <button
              type="submit"
              className="btn-primary w-full py-3 text-lg"
              disabled={loading}
            >
              {loading ? (
                <span className="flex items-center justify-center">
                  <div className="spinner mr-2"></div>
                  Saving...
                </span>
              ) : (
                'Save Configurations'
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default SiteConfigModal;
