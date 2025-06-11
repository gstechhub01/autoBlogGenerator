import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import SiteConfigModal from './SiteConfigModal';
import MarkdownEditor from './MarkdownEditor';

// Use import.meta.env for Vite projects
const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

const LandingPage = () => {
  const [siteConfigs, setSiteConfigs] = useState([]);
  const [publishedPosts, setPublishedPosts] = useState([]);
  const [showSiteConfigModal, setShowSiteConfigModal] = useState(false);
  const [selectedSites, setSelectedSites] = useState([]);
  const [scheduledConfigs, setScheduledConfigs] = useState([]);
  const [allJobs, setAllJobs] = useState([]); // New state for all jobs

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

  const fetchScheduledConfigs = async () => {
    try {
      const response = await fetch(`${API_BASE}/configs`);
      const data = await response.json();
      if (response.ok && Array.isArray(data.configs)) {
        setScheduledConfigs(data.configs.filter(cfg => !cfg.hasRun));
      }
    } catch (error) {
      console.error('Error fetching scheduled configs:', error);
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

  const fetchPublishedPosts = async () => {
    try {
      const response = await fetch(`${API_BASE}/published-posts`);
      const data = await response.json();
      if (response.ok) setPublishedPosts(data.posts);
    } catch (error) {
      console.error('Error fetching published posts:', error);
    }
  };

  const fetchAllJobs = async () => {
    try {
      const response = await fetch(`${API_BASE}/configs`);
      const data = await response.json();
      if (response.ok && Array.isArray(data.configs)) {
        setAllJobs(data.configs);
      }
    } catch (error) {
      console.error('Error fetching all jobs:', error);
    }
  };

  useEffect(() => {
    fetchSiteConfigs();
    fetchPublishedPosts();
    fetchScheduledConfigs();
    fetchAllJobs();
  }, []);

  const handleSiteConfigSave = async () => {
    await fetchSiteConfigs();
    setShowSiteConfigModal(false);
  };

  // Delete all published posts
  const handleDeleteAllPublished = async () => {
    if (!window.confirm('Are you sure you want to delete all published blog jobs? This cannot be undone.')) return;
    try {
      const response = await fetch(`${API_BASE}/delete-all-published`, { method: 'DELETE' });
      if (response.ok) {
        fetchPublishedPosts();
        fetchAllJobs();
        fetchScheduledConfigs();
      }
    } catch (err) {
      alert('Failed to delete all published jobs.');
    }
  };

  // Delete a single published job by id
  const handleDeletePublished = async (id) => {
    if (!window.confirm('Delete this published blog job?')) return;
    try {
      const response = await fetch(`${API_BASE}/delete-published/${id}`, { method: 'DELETE' });
      if (response.ok) {
        fetchPublishedPosts();
        fetchAllJobs();
        fetchScheduledConfigs();
      }
    } catch (err) {
      alert('Failed to delete published job.');
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Markdown Editor at the top of the dashboard */}
      {/* <div className="mb-8">
        <h2 className="text-2xl font-bold mb-2">Content Preview / Editor</h2>
        <MarkdownEditor value={markdownContent} onChange={setMarkdownContent} />
      </div> */}

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

          <main className="landing-content grid grid-cols-1 md:grid-cols-4 gap-8">
            {/* Configured Sites - less prominent, smaller */}
            <section className="card bg-white border-blue-100 md:col-span-3 md:max-w-xs md:self-start shadow-sm opacity-80">
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
                  <div className="mt-4 flex justify-center">
                    <Link
                      to="/create"
                      state={{ selectedSites: selectedSites.map(i => siteConfigs[i]) }}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-3 rounded-lg font-medium shadow transition w-full text-center"
                    >
                      Create New Post
                    </Link>
                  </div>
                </>
              )}
            </section>

              {/* Scheduled Publications */}
              <section className="card bg-white border-yellow-100 shadow-lg">
                <h2 className="text-2xl font-semibold text-yellow-700 mb-4">Scheduled Publications</h2>
                {scheduledConfigs.length === 0 ? (
                  <p className="text-gray-400 italic">No scheduled publications.</p>
                ) : (
                  <div className="space-y-4">
                    {scheduledConfigs.map((cfg, idx) => (
                      <div key={cfg.id || idx} className="p-4 bg-yellow-50 border border-yellow-200 rounded-xl">
                        <h3 className="text-yellow-800 font-semibold text-lg">{cfg.keywords?.join(', ') || 'Untitled'}</h3>
                        <p className="text-sm text-gray-700">Scheduled Time: <span className="text-yellow-600">{cfg.scheduleTime ? new Date(cfg.scheduleTime).toLocaleString() : 'Immediate'}</span></p>
                        <p className="text-sm text-gray-700">Sites: <span className="text-yellow-800">{cfg.sites?.map(s => s.url).join(', ')}</span></p>
                        <p className="text-sm text-gray-700">Articles: <span className="text-yellow-800">{cfg.articleCount || 1}</span></p>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {/* Published Posts */}
              <section className="card bg-white border-green-100 shadow-lg">
                <h2 className="text-2xl font-semibold text-green-700 mb-4 flex items-center justify-between">
                  Published Posts
                  <button
                    onClick={handleDeleteAllPublished}
                    className="ml-4 bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded text-sm"
                  >
                    Delete All
                  </button>
                </h2>
                {publishedPosts.length === 0 ? (
                  <p className="text-gray-400 italic">No posts published yet.</p>
                ) : (
                  <div className="space-y-4">
                    {publishedPosts.map((post, index) => (
                      <div key={index} className="p-4 bg-green-50 border border-green-200 rounded-xl flex justify-between items-center">
                        <div>
                          <h3 className="text-green-800 font-semibold text-lg">{post.title}</h3>
                          <p className="text-sm text-gray-700">Site: <span className="text-green-600">{post.siteUrl}</span></p>
                          <p className="text-sm text-gray-700"> <span className="text-green-600">{post.postUrl}</span></p>
                        </div>
                        <div className='flex justify-between gap-10'>
                          <a
                            href={post.postUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-800 text-sm underline"
                          >
                            View Post →
                          </a>
                        <button
                          onClick={() => handleDeletePublished(post.id)}
                          className="bg-red-500 hover:bg-red-600 text-white p-5 py-1 rounded text-xs ml-4"
                        >
                          Delete
                        </button>
                        </div> 
                      </div>
                    ))}
                  </div>
                )}
              </section>

            {/* All Blog Jobs - new section */}
            <section className="card bg-white border-gray-200 shadow-lg mt-8">
              <h2 className="text-2xl font-semibold text-gray-700 mb-4 flex items-center justify-between">
                All Blog Posts
                <button
                  onClick={handleDeleteAllPublished}
                  className="ml-4 bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded text-sm"
                >
                  Delete All
                </button>
              </h2>
              {allJobs.length === 0 ? (
                <p className="text-gray-400 italic">No blog jobs found.</p>
              ) : (
                <div className="space-y-4">
                  {allJobs.map((job, idx) => (
                    <div key={job.id || idx} className="p-4 border rounded-xl bg-gray-50 flex justify-between items-center">
                      <div>
                        <h3 className="font-semibold text-lg text-gray-800">{job.keywords?.join(', ') || 'Untitled'}</h3>
                        {job.published && job.publishedUrl ? (
                          <div>
                            <span className="text-green-700 font-medium">Published</span> &mdash; 
                            <a href={job.publishedUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline ml-2">View Article</a>
                          </div>
                        ) : job.scheduleTime ? (
                          <div>
                            <span className="text-yellow-700 font-medium">Scheduled</span> for <span className="text-yellow-800">{new Date(job.scheduleTime).toLocaleString()}</span>
                          </div>
                        ) : job.lastError ? (
                          <div>
                            <span className="text-red-700 font-medium">Error:</span> <span className="text-red-800">{job.lastError}</span>
                          </div>
                        ) : (
                          <span className="text-gray-500">Unpublished</span>
                        )}
                      </div>
                      <button
                        onClick={() => handleDeletePublished(job.id)}
                        className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded text-xs ml-4"
                      >
                        Delete
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </main>

          {showSiteConfigModal && (
            <SiteConfigModal 
              isOpen={showSiteConfigModal}
              onClose={() => setShowSiteConfigModal(false)}
              onSave={handleSiteConfigSave}
              apiBase={API_BASE}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default LandingPage;
