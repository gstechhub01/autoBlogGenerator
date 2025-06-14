import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import LandingPage from './components/LandingPage';
import PostsPage from './components/PostsPage';
import ScheduledPage from './components/ScheduledPage';
import KeywordsPage from './components/KeywordsPage';

const App = () => {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/posts" element={<PostsPage />} />
        <Route path="/scheduled" element={<ScheduledPage />} />
        <Route path="/keywords" element={<KeywordsPage />} />
      </Routes>
    </Router>
  );
};

export default App;