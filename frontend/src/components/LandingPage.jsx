import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import BlogForm from './BlogForm';
import SiteConfigModal from './SiteConfigModal';

// Use import.meta.env for Vite projects
const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

const LandingPage = () => {
  const [siteConfigs, setSiteConfigs] = useState([]);
  const [showSiteConfigModal, setShowSiteConfigModal] = useState(false);
  const [selectedSites, setSelectedSites] = useState([]);
  const [showBlogForm, setShowBlogForm] = useState(false);

  const fetchSiteConfigs = async () => {
    try {
      const response = await fetch(`${API_BASE}/site-configs`);
      const data = await response.json();
      // console.log('Fetched site configs:', data);
      // Sanitize: always get an array of objects with url and username
      let sitesArray = [];
      if (Array.isArray(data.siteConfigs)) {
        sitesArray = data.siteConfigs.filter(site => site && typeof site === 'object' && site.url && site.username);
      } else if (Array.isArray(data.sites)) {
        sitesArray = data.sites.filter(site => site && typeof site === 'object' && site.url && site.username);
      } else if (Array.isArray(data)) {
        sitesArray = data.filter(site => site && typeof site === 'object' && site.url && site.username);
      }
      setSiteConfigs(sitesArray);
      // If there's only one site, select it by default
      if (sitesArray.length === 1) {
        setSelectedSites([0]);
      }
    } catch (error) {
      console.error('Error fetching site configs:', error);
    }
  };

  const handleSiteSelection = (index) => {
    setSelectedSites(prev => {
      if (prev.includes(index)) {
        return prev.filter(i => i !== index);
      }
      return [...prev, index];
    });
  };

  useEffect(() => {
    fetchSiteConfigs();
  }, []);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="landing-page container mx-auto">
        <div className="flex justify-between items-center mb-8">
          <header className="landing-header">
            <h1 className="text-4xl md:text-5xl font-extrabold text-gray-800 drop-shadow-sm mb-6">
              Blog Generator Dashboard
            </h1>
            <div className="flex justify-between gap-5">
              <button
                onClick={() => setShowSiteConfigModal(true)}
                className="bg-yellow-500 hover:bg-yellow-600 text-white px-5 py-3 rounded-lg font-medium shadow transition"
              >
                Manage Sites
              </button>
            </div>
          </header>

          <nav style={{ marginBottom: '1rem' }}>
            <Link to="/" className="btn-secondary" style={{ marginRight: 8 }}>Home</Link>
            <Link to="/posts" className="btn-secondary" style={{ marginRight: 8 }}>Published Posts</Link>
            <Link to="/scheduled" className="btn-secondary">Scheduled Posts</Link>
          </nav>

          <main className="landing-content grid grid-cols-1 md:grid-cols-4 gap-8">
            {/* Configured Sites - less prominent, smaller */}
            <section className="card bg-white border-blue-100 md:col-span-1 md:max-w-xs md:self-start shadow-sm opacity-80">
              <h2 className="text-lg font-semibold text-blue-700 mb-3">Configured Sites</h2>
              {siteConfigs.length === 0 ? (
                <p className="text-gray-400 italic">No site configurations found.</p>
              ) : (
                <>
                  <ul className="flex flex-grow space-y-2">
                    {siteConfigs.map((config, index) => (
                      <li key={index} className="flex items-center gap-2 p-2 bg-blue-50 border border-blue-200 rounded-lg">
                        <input
                          type="checkbox"
                          checked={selectedSites.includes(index)}
                          onChange={() => handleSiteSelection(index)}
                          className="form-checkbox h-4 w-4 text-blue-600"
                        />
                        <span className="text-blue-800 text-sm font-medium break-all">{config.url}</span>
                        <span className="text-xs text-gray-500 ml-2">({config.username})</span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </section>

            {/* Blog Form and Site Settings merged */}
            <section className="md:col-span-3 flex flex-col gap-8">
              <div className="card bg-white border-blue-100 shadow-sm p-6">
                <h2 className="text-xl font-bold text-blue-700 mb-4">Site Settings</h2>
                <button
                  onClick={() => setShowSiteConfigModal(true)}
                  className="bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-2 rounded-md font-medium shadow transition mb-4"
                >
                  Edit Site Settings
                </button>
                {/* Blog Form always visible, pass selected sites */}
                <BlogForm selectedSites={selectedSites.map(i => siteConfigs[i] || {})} />
              </div>
            </section>
          </main>

          {showSiteConfigModal && (
            <SiteConfigModal 
              isOpen={showSiteConfigModal}
              onClose={() => setShowSiteConfigModal(false)}
              onSave={fetchSiteConfigs}
              apiBase={API_BASE}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default LandingPage;
