import React, { useState } from 'react';

const API_BASE = import.meta.env.VITE_API_BASE_URL;

export function LoginForm({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        localStorage.setItem('token', data.token);
        if (onLogin) onLogin(data.user);
      } else {
        setError(data.error || 'Login failed');
      }
    } catch (err) {
      setError('Login error: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="card max-w-md mx-auto mt-12 p-6">
      <h2 className="text-2xl font-bold mb-4">Login</h2>
      <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Email" required className="w-full mb-3 p-2 border rounded" />
      <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Password" required className="w-full mb-3 p-2 border rounded" />
      {error && <div className="text-red-600 mb-2">{error}</div>}
      <button type="submit" className="btn-primary w-full" disabled={loading}>{loading ? 'Logging in...' : 'Login'}</button>
    </form>
  );
}

export function RegisterForm({ onRegister }) {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch(`${API_BASE}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, name })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSuccess('Registration successful! You can now log in.');
        if (onRegister) onRegister(data.user);
      } else {
        setError(data.error || 'Registration failed');
      }
    } catch (err) {
      setError('Registration error: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="card max-w-md mx-auto mt-12 p-6">
      <h2 className="text-2xl font-bold mb-4">Register</h2>
      <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Email" required className="w-full mb-3 p-2 border rounded" />
      <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Name (optional)" className="w-full mb-3 p-2 border rounded" />
      <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Password" required className="w-full mb-3 p-2 border rounded" />
      {error && <div className="text-red-600 mb-2">{error}</div>}
      {success && <div className="text-green-600 mb-2">{success}</div>}
      <button type="submit" className="btn-primary w-full" disabled={loading}>{loading ? 'Registering...' : 'Register'}</button>
    </form>
  );
}
