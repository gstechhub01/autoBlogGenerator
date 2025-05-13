import React, { useState } from 'react';

const App = () => {
  const [sites, setSites] = useState([{ url: '', username: '', password: '' }]);
  const [keywords, setKeywords] = useState('');
  const [links, setLinks] = useState('');
  const [tags, setTags] = useState('');
  const [topics, setTopics] = useState('');
  const [autoTitle, setAutoTitle] = useState(true);
  const [articleCount, setArticleCount] = useState(1);
  const [scheduleTime, setScheduleTime] = useState('');

  const handleSiteChange = (index, field, value) => {
    const updatedSites = [...sites];
    updatedSites[index][field] = value;
    setSites(updatedSites);
  };

  const addSite = () => {
    setSites([...sites, { url: '', username: '', password: '' }]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
  
    const payload = {
      sites,
      keywords: keywords.split(',').map(k => k.trim()),
      links: links.split(',').map(l => l.trim()),
      tags: tags.split(',').map(t => t.trim()),
      topics: topics.split(',').map(t => t.trim()),
      autoTitle,
      articleCount,
      scheduleTime,
    };
  
    console.log('Sending config:', payload);
  
    try {
      const response = await fetch('http://localhost:5000/api/save-config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
  
      const data = await response.json();
  
      if (response.ok) {
        alert('✅ Config saved successfully!');
      } else {
        alert('❌ Failed to save config: ' + data.error);
      }
    } catch (err) {
      console.error('Error sending config:', err);
      alert('❌ Error sending config: ' + err.message);
    }
  };
  

  return (
    <div className="container mx-auto p-8">
      <h2 className="text-3xl font-semibold text-center mb-6">Blog Generator Configuration</h2>
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <h4 className="text-xl font-medium">WordPress Sites</h4>
          {sites.map((site, idx) => (
            <div key={idx} className="bg-gray-100 p-4 rounded-lg border border-gray-200 mb-4">
              <input
                type="text"
                placeholder="Site URL"
                className="form-input w-full mb-3 p-3 border border-gray-300 rounded-lg"
                value={site.url}
                onChange={e => handleSiteChange(idx, 'url', e.target.value)}
                required
              />
              <input
                type="text"
                placeholder="Username"
                className="form-input w-full mb-3 p-3 border border-gray-300 rounded-lg"
                value={site.username}
                onChange={e => handleSiteChange(idx, 'username', e.target.value)}
                required
              />
              <input
                type="password"
                placeholder="App Password"
                className="form-input w-full p-3 border border-gray-300 rounded-lg"
                value={site.password}
                onChange={e => handleSiteChange(idx, 'password', e.target.value)}
                required
              />
            </div>
          ))}
          <button
            type="button"
            onClick={addSite}
            className="bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600"
          >
            Add Another Site
          </button>
        </div>

        <div>
          <label className="block text-gray-700 font-medium">Keywords (comma separated)</label>
          <input
            type="text"
            className="form-input w-full p-3 border border-gray-300 rounded-lg"
            value={keywords}
            onChange={e => setKeywords(e.target.value)}
            required
          />
        </div>

        <div>
          <label className="block text-gray-700 font-medium">Target Links (comma separated)</label>
          <input
            type="text"
            className="form-input w-full p-3 border border-gray-300 rounded-lg"
            value={links}
            onChange={e => setLinks(e.target.value)}
          />
        </div>

        <div>
          <label className="block text-gray-700 font-medium">Tags (comma separated)</label>
          <input
            type="text"
            className="form-input w-full p-3 border border-gray-300 rounded-lg"
            value={tags}
            onChange={e => setTags(e.target.value)}
          />
        </div>

        <div>
          <label className="block text-gray-700 font-medium">Topics or Titles (comma separated)</label>
          <input
            type="text"
            className="form-input w-full p-3 border border-gray-300 rounded-lg"
            value={topics}
            onChange={e => setTopics(e.target.value)}
            disabled={autoTitle}
          />
          <div className="mt-3">
            <label className="inline-flex items-center">
              <input
                type="checkbox"
                checked={autoTitle}
                onChange={e => setAutoTitle(e.target.checked)}
                className="form-checkbox"
              />
              <span className="ml-2">Auto-generate titles from keywords</span>
            </label>
          </div>
        </div>

        <div>
          <label className="block text-gray-700 font-medium">Number of Articles</label>
          <input
            type="number"
            className="form-input w-full p-3 border border-gray-300 rounded-lg"
            value={articleCount}
            onChange={e => setArticleCount(Number(e.target.value))}
            min="1"
            required
          />
        </div>

        <div>
          <label className="block text-gray-700 font-medium">Schedule Time (leave empty to publish immediately)</label>
          <input
            type="datetime-local"
            className="form-input w-full p-3 border border-gray-300 rounded-lg"
            value={scheduleTime}
            onChange={e => setScheduleTime(e.target.value)}
          />
        </div>

        <button
          type="submit"
          className="bg-blue-500 text-white px-6 py-3 rounded-lg hover:bg-blue-600 w-full"
        >
          Generate and Publish
        </button>
      </form>
    </div>
  );
};

export default App;
