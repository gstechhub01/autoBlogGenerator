import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Navigation from './Navigation';

const PostsPage = () => {
  const [publishedPosts, setPublishedPosts] = useState([]);
  const API_BASE = import.meta.env.VITE_API_BASE_URL;

  useEffect(() => {
    const fetchPublishedPosts = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await fetch(`${API_BASE}/published-posts`, {
          headers: token ? { 'Authorization': `Bearer ${token}` } : {}
        });
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
      <Navigation />
      <h2>Published Blog Posts</h2>
      <div className="card">
        {publishedPosts && publishedPosts.length === 0 ? (
          <p>No published posts found.</p>
        ) : publishedPosts && publishedPosts.length > 0 ? (
          <ul>
            {publishedPosts.map((post, idx) => (
              <li key={idx}>
                <strong>{post.title}</strong> - <a href={post.postUrl} target="_blank" rel="noopener noreferrer">View</a> (Site: {post.siteUrl})
                <br />Published at: {post.publishedAt}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-gray-400 italic">No data available.</p>
        )}
      </div>
    </div>
  );
};

export default PostsPage;
