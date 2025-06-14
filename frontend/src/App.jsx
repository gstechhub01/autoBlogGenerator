import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import LandingPage from './components/LandingPage';
import PostsPage from './components/PostsPage';
import ScheduledPage from './components/ScheduledPage';
import KeywordsPage from './components/KeywordsPage';
import { LoginForm, RegisterForm } from './components/AuthForms.jsx';

const App = () => {
  const [user, setUser] = useState(null);
  const [showRegister, setShowRegister] = useState(false);

  // Check for token on mount and set user if token is valid
  React.useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      setUser(null);
      return;
    }
    // Optionally: verify token with backend or decode
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      setUser({ id: payload.userId, email: payload.email });
    } catch {
      setUser(null);
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    setUser(null);
  };

  if (!user) {
    return showRegister ? (
      <>
        <RegisterForm onRegister={() => setShowRegister(false)} />
        <div className="text-center mt-4">
          <button onClick={() => setShowRegister(false)} className="text-blue-600 underline">Already have an account? Login</button>
        </div>
      </>
    ) : (
      <>
        <LoginForm onLogin={setUser} />
        <div className="text-center mt-4">
          <button onClick={() => setShowRegister(true)} className="text-blue-600 underline">No account? Register</button>
        </div>
      </>
    );
  }

  return (
    <Router>
      <div className="flex justify-end p-2">
        <span className="mr-4">{user.email}</span>
        <button onClick={handleLogout} className="btn">Logout</button>
      </div>
      <Routes>
        <Route path="/" element={<LandingPage user={user} />} />
        <Route path="/posts" element={<PostsPage user={user} />} />
        <Route path="/scheduled" element={<ScheduledPage user={user} />} />
        <Route path="/keywords" element={<KeywordsPage user={user} />} />
      </Routes>
    </Router>
  );
};

export default App;