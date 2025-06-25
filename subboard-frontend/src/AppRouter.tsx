import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import App from './App';
import ResetPassword from './pages/ResetPassword';
import GoogleCallback from './pages/GoogleCallback';

const AppRouter: React.FC = () => {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/reset-password/:token" element={<ResetPassword />} />
        <Route path="/auth/google/callback" element={<GoogleCallback />} />
      </Routes>
    </Router>
  );
};

export default AppRouter; 