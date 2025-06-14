import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

const BlogForm = ({ selectedSites = [], contentSource: initialContentSource = 'openai', engine: initialEngine = 'google' }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [links, setLinks] = useState('');
  const [tags, setTags] = useState('');
  const [topics, setTopics] = useState('');
  const [autoTitle, setAutoTitle] = useState(true);
  const [articleCount, setArticleCount] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [markdownContent, setMarkdownContent] = useState('');
  const [publishResults, setPublishResults] = useState(null);
  const [contentSource, setContentSource] = useState(initialContentSource);
  const [engine, setEngine] = useState(initialEngine);
  const [unpublishedCount, setUnpublishedCount] = useState(0);
  const [keywordsPerArticle, setKeywordsPerArticle] = useState(1);

  const API_BASE = import.meta.env.API_BASE_URL;

  // Fetch number of unpublished keywords for the first selected site
  useEffect(() => {
    const fetchUnpublishedCount = async () => {
      if (selectedSites.length > 0) {
        try {
          const res = await fetch(`${VITE_API_BASE_URL}/unpublished-keywords-count?site=${encodeURIComponent(selectedSites[0].url)}`);
          const data = await res.json();
          if (data.success) setUnpublishedCount(data.count);
        } catch {}
      } else {
        setUnpublishedCount(0);
      }
    };
    fetchUnpublishedCount();
  }, [selectedSites, API_BASE]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);
    setPublishResults(null);
    try {
      const payload = {
        sites: selectedSites.map(site => ({ url: site.url, username: site.username })),
        links: links.split(',').map(l => l.trim()).filter(Boolean),
        tags: tags.split(',').map(t => t.trim()).filter(Boolean),
        topics: topics.split(',').map(t => t.trim()).filter(Boolean),
        autoTitle,
        articleCount: Number(articleCount) || 1,
        contentSource,
        engine: contentSource === 'scrapper' ? engine : undefined,
      };

      // Save config only, do not trigger publish directly
      const response = await fetch(`${API_BASE}/save-config`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (response.ok && data.success) {
        setSuccess('Blog config saved successfully!');
        setMarkdownContent('');
      } else {
        setError(data.error || 'Failed to save blog job');
      }
    } catch (err) {
      setError('Error saving blog job: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="card">
      <div className="flex justify-between items-center mb-8">
        <h2 className="text-3xl font-bold text-gray-800">Publish Blog Post</h2>
      </div>

      {/* Show selected sites info */}
      {selectedSites.length > 0 && (
        <div className="space-y-2">
          <label className="block font-medium text-sm">Publishing to:</label>
          <ul className="list-disc ml-6">
            {selectedSites.map((site, i) => (
              <li key={i} className="text-blue-800 text-sm">{site.url} ({site.username})</li>
            ))}
          </ul>
          <div className="mt-2 text-green-700 text-sm">
            Unpublished keywords available: <b>{unpublishedCount}</b>
          </div>
        </div>
      )}

      <div className="space-y-4">
        <div>
          <label>Target Links (comma separated)</label>
          <input
            type="text"
            value={links}
            onChange={e => setLinks(e.target.value)}
            placeholder="Enter target links separated by commas"
          />
        </div>

        <div>
          <label>Tags (comma separated)</label>
          <input
            type="text"
            value={tags}
            onChange={e => setTags(e.target.value)}
            placeholder="Enter tags separated by commas"
          />
        </div>

        <div>
          <label>Topics or Titles (comma separated)</label>
          <input
            type="text"
            value={topics}
            onChange={e => setTopics(e.target.value)}
            disabled={autoTitle}
            placeholder="Enter topics separated by commas"
          />
          <div className="mt-2">
            <label className="inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={autoTitle}
                onChange={e => setAutoTitle(e.target.checked)}
                className="form-checkbox h-4 w-4 text-blue-600"
              />
              <span className="ml-2 text-gray-700">Auto-generate titles from keywords</span>
            </label>
          </div>
        </div>

        <div>
          <label>Number of Articles</label>
          <input
            type="number"
            value={articleCount}
            onChange={e => setArticleCount(Number(e.target.value))}
            min="1"
            required
            className="w-32"
          />
        </div>

        <div>
          <label>Keywords Per Article</label>
          <input
            type="number"
            value={keywordsPerArticle || 1}
            onChange={e => setKeywordsPerArticle(Number(e.target.value))}
            min="1"
            max={unpublishedCount || 1}
            required
            className="w-32"
          />
          <p className="text-xs text-gray-500 mt-1">Number of keywords to use per article (max: {unpublishedCount || 1})</p>
        </div>

        <div className="mb-4">
          <label className="block font-medium mb-1">Content Source</label>
          <select
            value={contentSource}
            onChange={e => setContentSource(e.target.value)}
            className="form-select border rounded px-3 py-2"
          >
            <option value="openai">AI (OpenAI)</option>
            <option value="scrapper">Scrapper</option>
          </select>
        </div>
        {contentSource === 'scrapper' && (
          <div className="mb-4">
            <label className="block font-medium mb-1">Scrapper Engine</label>
            <select
              value={engine}
              onChange={e => setEngine(e.target.value)}
              className="form-select border rounded px-3 py-2"
            >
              <option value="google">Google</option>
              <option value="bing">Bing</option>
              <option value="duckduckgo">DuckDuckGo</option>
              <option value="yahoo">Yahoo</option>
            </select>
          </div>
        )}

        {/* {contentSource === 'scrapper' && (
          <div>
            <label>Scraped Content Preview (Markdown)</label>
            <MarkdownEditor value={markdownContent} onChange={setMarkdownContent} />
          </div>
        )} */}
      </div>

      {error && <div className="error-message">{error}</div>}
      {success && <div className="success-message">{success}</div>}
      {publishResults && (
        <div className="mt-4">
          <h3 className="font-semibold mb-2">Publishing Results:</h3>
          <ul className="text-sm space-y-1">
            {Array.isArray(publishResults) ? publishResults.map((res, idx) => (
              <li key={idx} className={res.status === 'success' ? 'text-green-700' : 'text-red-700'}>
                {res.siteUrl || res.site}: {res.status === 'success' ? `Success${res.postUrl ? ` - ${res.postUrl}` : ''}` : `Error: ${res.error || 'Unknown error'}`}
              </li>
            )) : <li>{JSON.stringify(publishResults)}</li>}
          </ul>
          {contentSource === 'scrapper' && (
            <div className="mt-2 text-xs text-gray-600">Scrapper Engine Used: <span className="font-mono">{engine}</span></div>
          )}
        </div>
      )}

      <button
        type="submit"
        className="btn-primary w-full py-3 text-lg"
        disabled={loading || selectedSites.length === 0 || unpublishedCount === 0}
      >
        {loading ? (
          <span className="flex items-center justify-center">
            <div className="spinner mr-2"></div>
            Publishing...
          </span>
        ) : (
          'Generate and Publish'
        )}
      </button>

      {markdownContent && <div className="success-message">{markdownContent}</div>}
    </form>
  );
};

export default BlogForm;