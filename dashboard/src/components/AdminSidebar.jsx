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
          onClick={() => console.log('Navigate to History')}
        >
          <History size={18} />
          <span>History</span>
        </button>

        <button 
          className={`sidebar-btn ${location.pathname.startsWith('/graphs') ? 'active' : ''}`}
          onClick={() => console.log('Navigate to Graphs')}
        >
          <LineChart size={18} />
          <span>Graphs</span>
        </button>

        <button 
          className={`sidebar-btn ${location.pathname.startsWith('/alarms') ? 'active' : ''}`}
          onClick={() => console.log('Navigate to Alarms')}
        >
          <Bell size={18} />
          <span>Alarms</span>
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
