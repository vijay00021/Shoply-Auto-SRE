import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import './App.css';
import Dashboard from './components/Dashboard';
import Storefront from './components/Storefront';
import Login from './components/Login';
import AdminSidebar from './components/AdminSidebar';
import HistoryPage from './components/HistoryPage';
import GraphsPage from './components/GraphsPage';
import AlarmsPage from './components/AlarmsPage';

function App() {
  return (
    <Router>
      <div className="app-container">
        <AdminSidebar />
        <Routes>
          {/* Authentication */}
          <Route path="/login" element={<Login />} />
          
          {/* Public Organization Website */}
          <Route path="/" element={<Storefront />} />
          
          {/* Internal SRE / Admin Dashboard */}
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/admin" element={<Navigate to="/dashboard" replace />} />

          {/* SRE Capabilities: History, Analytics Graphs, Alarms */}
          <Route path="/history" element={<HistoryPage />} />
          <Route path="/graphs" element={<GraphsPage />} />
          <Route path="/alarms" element={<AlarmsPage />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
