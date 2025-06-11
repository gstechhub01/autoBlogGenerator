import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import LandingPage from './components/LandingPage';
import PostsPage from './components/PostsPage';
import ScheduledPage from './components/ScheduledPage';

const App = () => {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/posts" element={<PostsPage />} />
        <Route path="/scheduled" element={<ScheduledPage />} />
      </Routes>
    </Router>
  );
};

export default App;