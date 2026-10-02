import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, ShoppingCart, ShieldAlert, History, LineChart, Bell } from 'lucide-react';
import './AdminSidebar.css';

const AdminSidebar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState(false);
  const [userName, setUserName] = useState('');

  // Re-check authentication strictly on mount and path change
  useEffect(() => {
    const userStr = localStorage.getItem('currentUser');
    if (userStr) {
      const user = JSON.parse(userStr);
      setIsAdmin(user.role === 'admin');
      if (user.role === 'admin') setUserName(user.name);
    } else {
      setIsAdmin(false);
    }
  }, [location.pathname]);

  const [activeAlarmCount, setActiveAlarmCount] = useState(0);

  // Poll for active alarms count to display badge on Alarms button
  useEffect(() => {
    if (!isAdmin) return;
    const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';
    const checkActiveAlarms = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/alarms?status=active`);
        if (res.ok) {
          const data = await res.json();
          const active = data.filter(a => a.state === 'FIRING' || a.state === 'AWAITING_APPROVAL').length;
          setActiveAlarmCount(active);
        }
      } catch (err) {
        // Silently ignore if backend is loading
      }
    };
    checkActiveAlarms();
    const timer = setInterval(checkActiveAlarms, 3000);
    return () => clearInterval(timer);
  }, [isAdmin]);

  // Manage body class for layout shifting
  useEffect(() => {
    if (isAdmin) {
      document.body.classList.add('has-admin-sidebar');
    } else {
      document.body.classList.remove('has-admin-sidebar');
    }
    return () => document.body.classList.remove('has-admin-sidebar');
  }, [isAdmin]);

  if (!isAdmin) return null;

  return (
    <div className="admin-sidebar-root animate-fade-in">
      <div className="admin-sidebar-brand" title="AutoSRE Admin Mode">
        <ShieldAlert size={24} color="#22C55E" />
        <span className="brand-title">Admin Console</span>
      </div>
      
      <div className="admin-sidebar-menu">
        <button 
          className={`sidebar-btn ${location.pathname === '/' ? 'active' : ''}`}
          onClick={() => navigate('/')}
        >
          <ShoppingCart size={18} />
          <span>Website</span>
        </button>
        
        <button 
          className={`sidebar-btn ${location.pathname.startsWith('/dashboard') ? 'active' : ''}`}
          onClick={() => navigate('/dashboard')}
        >
          <LayoutDashboard size={18} />
          <span>Dashboard</span>
        </button>

        <button 
          className={`sidebar-btn ${location.pathname.startsWith('/history') ? 'active' : ''}`}
          onClick={() => navigate('/history')}
        >
          <History size={18} />
          <span>History</span>
        </button>

        <button 
          className={`sidebar-btn ${location.pathname.startsWith('/graphs') ? 'active' : ''}`}
          onClick={() => navigate('/graphs')}
        >
          <LineChart size={18} />
          <span>Graphs</span>
        </button>

        <button 
          className={`sidebar-btn ${location.pathname.startsWith('/alarms') ? 'active' : ''}`}
          onClick={() => navigate('/alarms')}
        >
          <Bell size={18} />
          <span>Alarms</span>
          {activeAlarmCount > 0 && (
            <span className="sidebar-badge">{activeAlarmCount}</span>
          )}
        </button>
      </div>

      <div className="admin-sidebar-footer">
        <div className="admin-profile-mini">
           <div className="avatar">{userName ? userName[0].toUpperCase() : 'A'}</div>
           <span>Hii {userName}</span>
        </div>
      </div>
    </div>
  );
};

export default AdminSidebar;
