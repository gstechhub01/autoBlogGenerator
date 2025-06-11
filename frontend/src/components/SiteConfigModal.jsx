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
    setError(null);
    try {
      const res = await fetch(`${apiBase}/site-configs`);
      const data = await res.json();
      if (data.success) {
        setSites(data.siteConfigs);
      } else {
        setError('Failed to load site configs');
      }
    } catch (err) {
      setError('Failed to load site configs');
    } finally {
      setLoading(false);
    }
  };

  const handleSiteChange = (idx, field, value) => {
    setSites(sites => sites.map((site, i) => i === idx ? { ...site, [field]: value } : site));
  };

  const addSite = () => {
    setSites(prev => [...prev, { url: '', username: '', password: '' }]);
  };

  const removeSite = (idx) => {
    setSites(sites => sites.filter((_, i) => i !== idx));
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
      if (!data.success) {
        throw new Error(data.error || 'Failed to save');
      }
      setSuccess('Saved!');
      if (onSave) {
        onSave();
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop">
      <div className="modal-content">
        <h3 className="text-2xl font-bold mb-6 text-blue-700">Site Settings</h3>
        <form onSubmit={handleSave} className="space-y-6">
          {sites.map((site, idx) => (
            <div key={idx} className="field-group card bg-blue-50 border-blue-200 p-4 rounded-md shadow-sm">
              <div className="space-y-3">
                <input
                  type="text"
                  placeholder="Site URL"
                  className="w-full p-2 border rounded-md"
                  value={site.url}
                  onChange={e => handleSiteChange(idx, 'url', e.target.value)}
                  required
                />
                <input
                  type="text"
                  placeholder="Username"
                  className="w-full p-2 border rounded-md"
                  value={site.username}
                  onChange={e => handleSiteChange(idx, 'username', e.target.value)}
                  required
                />
                <input
                  type="password"
                  placeholder="Password"
                  className="w-full p-2 border rounded-md"
                  value={site.password}
                  onChange={e => handleSiteChange(idx, 'password', e.target.value)}
                  required
                />
                <button
                  type="button"
                  onClick={() => removeSite(idx)}
                  className="remove-btn text-red-600 hover:text-red-800"
                >
                  Remove Site
                </button>
              </div>
            </div>
          ))}
          
          <button
            type="button"
            onClick={addSite}
            className="add-btn w-full bg-blue-600 text-white py-2 rounded-md hover:bg-blue-700 transition-colors"
          >
            Add Site
          </button>
          
          <div className="flex justify-between">
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary bg-gray-200 text-gray-700 py-2 px-4 rounded-md hover:bg-gray-300 transition-colors"
            >
              Close
            </button>
            <button
              type="submit"
              className="btn-success bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700 transition-colors"
              disabled={loading}
            >
              {loading ? 'Saving...' : 'Save'}
            </button>
          </div>
          
          {error && <div className="error-message text-red-600">{error}</div>}
          {success && <div className="success-message text-green-600">{success}</div>}
        </form>
      </div>
    </div>
  );
};

export default SiteConfigModal;
