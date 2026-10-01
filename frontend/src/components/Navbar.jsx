import React, { useEffect, useState } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { 
  ShieldCheck, 
  Activity, 
  History, 
  FileText, 
  CheckCircle2, 
  AlertCircle,
  Menu,
  X,
  Sparkles
} from 'lucide-react';
import { checkHealth } from '../services/api';

export default function Navbar() {
  const [healthStatus, setHealthStatus] = useState({
    loading: true,
    connected: false,
    service: null,
  });
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const verifyBackendStatus = async () => {
    setHealthStatus(prev => ({ ...prev, loading: true }));
    const result = await checkHealth();
    if (result.connected && result.data) {
      setHealthStatus({
        loading: false,
        connected: true,
        service: result.data.service || 'truthlens-backend',
      });
    } else {
      setHealthStatus({
        loading: false,
        connected: false,
        service: null,
      });
    }
  };

  useEffect(() => {
    verifyBackendStatus();
    const interval = setInterval(verifyBackendStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleVerifyClick = (e) => {
    if (location.pathname === '/') {
      e.preventDefault();
      const el = document.getElementById('verify-workspace');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth' });
      }
    } else {
      navigate('/#verify-workspace');
    }
    setMobileMenuOpen(false);
  };

  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-20">
          {/* Brand Logo & Title */}
          <NavLink 
            to="/" 
            onClick={() => setMobileMenuOpen(false)}
            className="flex items-center gap-3 group"
          >
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20 group-hover:bg-blue-700 transition-colors">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl sm:text-2xl font-extrabold tracking-tight text-[#1E3A8A]">
                  TruthLens
                </span>
                <span className="text-[10px] uppercase font-mono font-bold px-2 py-0.5 rounded-full bg-teal-50 text-teal-700 border border-teal-200 hidden sm:inline-block">
                  AI Verification
                </span>
              </div>
              <p className="text-[11px] text-slate-500 font-medium leading-none">
                Evidence-Based News &amp; Claim Verification
              </p>
            </div>
          </NavLink>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center gap-1.5 p-1.5 rounded-xl bg-slate-100/80 border border-slate-200">
            <NavLink
              to="/"
              end
              className={({ isActive }) =>
                `px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                  isActive
                    ? 'bg-white text-blue-700 shadow-sm border border-slate-200'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                }`
              }
            >
              <span>Home</span>
            </NavLink>

            <button
              type="button"
              onClick={handleVerifyClick}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-200/50 transition-all cursor-pointer"
            >
              <FileText className="w-3.5 h-3.5 text-blue-600" />
              <span>Verify Claim</span>
            </button>

            <NavLink
              to="/results"
              className={({ isActive }) =>
                `flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                  isActive
                    ? 'bg-white text-blue-700 shadow-sm border border-slate-200'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                }`
              }
            >
              <Activity className="w-3.5 h-3.5 text-teal-600" />
              <span>Results</span>
            </NavLink>

            <NavLink
              to="/history"
              className={({ isActive }) =>
                `flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                  isActive
                    ? 'bg-white text-blue-700 shadow-sm border border-slate-200'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                }`
              }
            >
              <History className="w-3.5 h-3.5 text-violet-600" />
              <span>History</span>
            </NavLink>
          </nav>

          {/* Right Area: Backend Status Indicator */}
          <div className="flex items-center gap-3">
            <button
              onClick={verifyBackendStatus}
              title="Click to re-check backend status"
              className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-mono border bg-slate-50 border-slate-200 transition-colors hover:bg-slate-100 cursor-pointer"
            >
              {healthStatus.loading ? (
                <span className="flex items-center gap-1.5 text-amber-700">
                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
                  <span className="text-[11px] font-medium">Checking...</span>
                </span>
              ) : healthStatus.connected ? (
                <span className="flex items-center gap-1.5 text-emerald-700 font-semibold">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-600"></span>
                  </span>
                  <span className="text-[11px]">Backend Online</span>
                </span>
              ) : (
                <span className="flex items-center gap-1.5 text-rose-700 font-semibold">
                  <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
                  <span className="text-[11px]">Backend Offline</span>
                </span>
              )}
            </button>

            {/* Mobile Menu Button */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Dropdown Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-slate-200 py-3 space-y-1 bg-white animate-fadeIn">
            <NavLink
              to="/"
              end
              onClick={() => setMobileMenuOpen(false)}
              className="block px-4 py-2.5 rounded-lg text-sm font-semibold text-slate-800 hover:bg-slate-100"
            >
              Home
            </NavLink>
            <button
              type="button"
              onClick={handleVerifyClick}
              className="w-full text-left px-4 py-2.5 rounded-lg text-sm font-semibold text-slate-800 hover:bg-slate-100"
            >
              Verify Claim
            </button>
            <NavLink
              to="/results"
              onClick={() => setMobileMenuOpen(false)}
              className="block px-4 py-2.5 rounded-lg text-sm font-semibold text-slate-800 hover:bg-slate-100"
            >
              Results
            </NavLink>
            <NavLink
              to="/history"
              onClick={() => setMobileMenuOpen(false)}
              className="block px-4 py-2.5 rounded-lg text-sm font-semibold text-slate-800 hover:bg-slate-100"
            >
              History
            </NavLink>
          </div>
        )}
      </div>
    </header>
  );
}
