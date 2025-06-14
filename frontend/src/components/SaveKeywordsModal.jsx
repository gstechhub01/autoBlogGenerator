import React, { useState } from 'react';

const SaveKeywordsModal = ({ isOpen, onClose, selectedSite, apiBase }) => {
  const [keywords, setKeywords] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const handleSave = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      // Accept only commas as separators
      const keywordsArr = keywords.split(',').map(k => k.trim()).filter(Boolean);
      if (!keywordsArr.length ) {
        setError('Please enter keywords');
        setLoading(false);
        return;
      }
      const token = localStorage.getItem('token');
      // Get userId from token (decode JWT)
      let userId = null;
      if (token) {
        try {
          const payload = JSON.parse(atob(token.split('.')[1]));
          userId = payload.userId;
        } catch {}
      }
      if (!userId) {
        setError('User not authenticated. Please log in again.');
        setLoading(false);
        return;
      }
      const response = await fetch(`${apiBase}/bulk-save-keywords`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          keywords: keywordsArr,
          userId
        })
      });
      let data;
      try {
        data = await response.json();
      } catch (jsonErr) {
        setError('Server error: Invalid response.');
        setLoading(false);
        return;
      }
      if (response.ok && data.success) {
        setSuccess('Keywords saved successfully!');
        setKeywords('');
        setScheduledTime('');
      } else {
        setError(data.error || 'Failed to save keywords');
      }
    } catch (err) {
      setError('Error saving keywords: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop">
      <div className="modal-content">
        <h2 className="text-xl font-bold mb-4">Save Keywords</h2>
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label>Keywords (comma separated)</label>
            <textarea
              value={keywords}
              onChange={e => setKeywords(e.target.value)}
              placeholder="Enter keywords separated by commas"
              className="w-full p-2 border rounded-md"
              required
              rows={5}
            />
          </div>
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
              {loading ? 'Saving...' : 'Save Keywords'}
            </button>
          </div>
          {error && <div className="error-message text-red-600">{error}</div>}
          {success && <div className="success-message text-green-600">{success}</div>}
        </form>
      </div>
    </div>
  );
};

export default SaveKeywordsModal;
