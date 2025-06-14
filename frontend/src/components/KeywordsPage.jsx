import React, { useEffect, useState } from 'react';
import Navigation from './Navigation';

const KeywordsPage = () => {
  const [keywords, setKeywords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const API_BASE = import.meta.env.VITE_API_BASE_URL;

  useEffect(() => {
    const fetchKeywords = async () => {
      setLoading(true);
      setError(null);
      try {
        const token = localStorage.getItem('token');
        const res = await fetch(`${API_BASE}/all-keywords`, {
          headers: token ? { 'Authorization': `Bearer ${token}` } : {}
        });
        const data = await res.json();
        if (data.success) {
          setKeywords(data.keywords);
        } else {
          setError(data.error || 'Failed to fetch keywords');
        }
      } catch (err) {
        setError('Error fetching keywords: ' + err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchKeywords();
  }, [API_BASE]);

  return (
    <div className="container items-center mx-auto p-4 content-center">
      <Navigation />
      <h2 className="text-2xl font-bold mb-4">All Saved Keywords</h2>
      {loading && <div>Loading...</div>}
      {error && <div className="text-red-600">{error}</div>}
      {!loading && !error && (
        keywords && keywords.length > 0 ? (
          <table className="min-w-full border">
            <thead>
              <tr>
                <th className="border px-2 py-1">Keyword</th>
                {/* <th className="border px-2 py-1">Site</th> */}
                <th className="border px-2 py-1">Published</th>
                <th className="border px-2 py-1">Scheduled Time</th>
              </tr>
            </thead>
            <tbody>
              {keywords.map((kw, idx) => (
                <tr key={kw.id || idx}>
                  <td className="border px-2 py-1">{kw.keyword}</td>
                  {/* <td className="border px-2 py-1">{kw.site}</td> */}
                  <td className="border px-2 py-1">{kw.published ? 'Yes' : 'No'}</td>
                  <td className="border px-2 py-1">{kw.scheduled_time || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="text-gray-400 italic">No keywords found.</div>
        )
      )}
    </div>
  );
};

export default KeywordsPage;
