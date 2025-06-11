import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

const PostsPage = () => {
  const [publishedPosts, setPublishedPosts] = useState([]);
  const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

  useEffect(() => {
    const fetchPublishedPosts = async () => {
      try {
        const res = await fetch(`${API_BASE}/published-posts`);
        const data = await res.json();
        if (data.success) setPublishedPosts(data.posts);
      } catch (err) {
        // handle error
      }
    };
    fetchPublishedPosts();
  }, [API_BASE]);

  return (
    <div className="container">
      <nav style={{ marginBottom: '1rem' }}>
        <Link to="/" className="btn-secondary" style={{ marginRight: 8 }}>Home</Link>
        <Link to="/posts" className="btn-secondary" style={{ marginRight: 8 }}>Published Posts</Link>
        <Link to="/scheduled" className="btn-secondary">Scheduled Posts</Link>
      </nav>
      <h2>Published Blog Posts</h2>
      <div className="card">
        {publishedPosts.length === 0 ? (
          <p>No published posts found.</p>
        ) : (
          <ul>
            {publishedPosts.map((post, idx) => (
              <li key={idx}>
                <strong>{post.title}</strong> - <a href={post.postUrl} target="_blank" rel="noopener noreferrer">View</a> (Site: {post.siteUrl})
                <br />Published at: {post.publishedAt}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default PostsPage;
