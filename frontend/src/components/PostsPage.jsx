import React, { useEffect, useState } from 'react';

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
