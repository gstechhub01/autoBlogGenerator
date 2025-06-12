import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import BlogForm from './BlogForm';
import SiteConfigModal from './SiteConfigModal';
import Navigation from './Navigation';

const API_BASE = import.meta.env.VITE_API_BASE_URL;

const LandingPage = () => {
  const [siteConfigs, setSiteConfigs] = useState([]);
  const [showSiteConfigModal, setShowSiteConfigModal] = useState(false);
  const [selectedSites, setSelectedSites] = useState([]);

  const fetchSiteConfigs = async () => {
    try {
      const response = await fetch(`${API_BASE}/site-configs`);
      const data = await response.json();
      let sitesArray = [];
      if (Array.isArray(data.siteConfigs)) {
        sitesArray = data.siteConfigs.filter(site => site && typeof site === 'object' && site.url && site.username);
      } else if (Array.isArray(data.sites)) {
        sitesArray = data.sites.filter(site => site && typeof site === 'object' && site.url && site.username);
      } else if (Array.isArray(data)) {
        sitesArray = data.filter(site => site && typeof site === 'object' && site.url && site.username);
      }
      setSiteConfigs(sitesArray);
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
    <div className="container landing-container" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <h1 className="text-4xl md:text-5xl font-extrabold text-gray-800 drop-shadow-sm mb-2 mt-6 text-center w-full">
        Blog Generator Dashboard
      </h1>
      <Navigation />
      <main className="flex flex-col md:flex-row gap-8 w-full justify-center items-start mt-2">
        <section className="hidden md:block md:w-1/4 lg:w-1/5 card bg-white border-blue-100 shadow-sm opacity-90 self-stretch">
          <h2 className="text-lg font-semibold text-blue-700 mb-3">Configured Sites</h2>
          {siteConfigs.length === 0 ? (
            <p className="text-gray-400 italic">No site configurations found.</p>
          ) : (
            <ul className="space-y-2">
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
          )}
          <button
            onClick={() => setShowSiteConfigModal(true)}
            className="bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-2 rounded-md font-medium shadow transition mt-4 w-full"
          >
            Manage Sites
          </button>
        </section>
        <section className="flex-1 max-w-2xl mx-auto w-full">
          <div className="card bg-white border-blue-100 shadow-md p-6">
            <h2 className="text-xl font-bold text-blue-700 mb-4 text-center">Create New Blog Post</h2>
            <BlogForm selectedSites={selectedSites.map(i => siteConfigs[i] || {})} />
          </div>
          {/* <div className="block md:hidden mt-8 card bg-white border-blue-100 shadow-sm opacity-90">
            <h2 className="text-lg font-semibold text-blue-700 mb-3">Configured Sites</h2>
            {siteConfigs.length === 0 ? (
              <p className="text-gray-400 italic">No site configurations found.</p>
            ) : (
              <ul className="space-y-2">
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
            )}
            <button
              onClick={() => setShowSiteConfigModal(true)}
              className="bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-2 rounded-md font-medium shadow transition mt-4 w-full"
            >
              Manage Sites
            </button>
          </div> */}
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
  );
};

export default LandingPage;
