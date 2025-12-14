// src/App.tsx
//import React from 'react';
import { Routes, Route } from 'react-router-dom';
import LoginFaculty from './components/F_Login.tsx';
import LoginAdmin from './components/A_Login.tsx';
import DashboardFaculty from './components/F_Dashboard.tsx';
import DashboardAdmin from './components/A_Dashboard.tsx';
import ResetPassword from './components/F_ResetPassword.tsx';

function App() {
  return (
    <Routes>
      <Route path="/" element={<LoginFaculty />} />
      <Route path="/admin-login" element={<LoginAdmin />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/faculty-dashboard" element={<DashboardFaculty />} />
      <Route path="/admin-dashboard" element={<DashboardAdmin />} />
    </Routes>
  );
}

export default App;
