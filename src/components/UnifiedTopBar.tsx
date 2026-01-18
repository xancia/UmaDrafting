
import { useState } from 'react';
import './unified-topbar.css'; // Copy the CSS file too

interface AppLink {
  id: string;
  name: string;
  url: string;
  iconType: 'guide' | 'tools' | 'tracker';
  description: string;
}

interface UnifiedTopBarProps {
  currentApp?: string;
}

// SVG Icons
const BookIcon = ({ size = 18 }: { size?: number }) => (
  <svg className="nav-icon" xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
  </svg>
);

const LayoutIcon = ({ size = 18 }: { size?: number }) => (
  <svg className="nav-icon" xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/>
  </svg>
);

const UsersIcon = ({ size = 18 }: { size?: number }) => (
  <svg className="nav-icon" xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
  </svg>
);



const getIcon = (iconType: string, size = 18) => {
  switch (iconType) {
    case 'guide': return <BookIcon size={size} />;
    case 'tools': return <LayoutIcon size={size} />;
    case 'tracker': return <UsersIcon size={size} />;
    default: return null;
  }
};

// Configure your apps here - update URLs as needed
const apps: AppLink[] = [
  { id: 'guide', name: 'Guide', url: 'https://uma.guide', iconType: 'guide', description: 'Guides & References' },
  { id: 'drafter', name: 'Drafter', url: '/', iconType: 'tools', description: 'Uma Drafter' },
  { id: 'sparks', name: 'Roster Viewer', url: 'https://roster.uma.guide', iconType: 'tracker', description: 'Uma Sparks Viewer' },
];

export function UnifiedTopBar({ currentApp = 'tools' }: UnifiedTopBarProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <div className="unified-topbar">
      <div className="topbar-inner">
        {/* Brand */}
        <a href="https://uma.guide" className="topbar-brand">
          
          <span className="brand-text">uma.guide</span>
        </a>

        {/* Desktop Navigation */}
        <nav className="topbar-nav desktop-only">
          {apps.map((app) => (
            <a
              key={app.id}
              href={app.url}
              className={`nav-item ${currentApp === app.id ? 'active' : ''}`}
            >
              {getIcon(app.iconType)}
              <span className="nav-text">{app.name}</span>
            </a>
          ))}
        </nav>

        {/* Right Section */}
        <div className="topbar-right">
          {/* Mobile Menu Toggle */}
          <button
            className="mobile-menu-btn mobile-only"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            aria-label="Toggle menu"
          >
            {!isMobileMenuOpen ? (
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="3" y1="12" x2="21" y2="12"></line>
                <line x1="3" y1="6" x2="21" y2="6"></line>
                <line x1="3" y1="18" x2="21" y2="18"></line>
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {isMobileMenuOpen && (
        <div className="mobile-menu">
          {apps.map((app) => (
            <a
              key={app.id}
              href={app.url}
              className={`mobile-nav-item ${currentApp === app.id ? 'active' : ''}`}
              onClick={() => setIsMobileMenuOpen(false)}
            >
              {getIcon(app.iconType, 24)}
              <div className="mobile-nav-content">
                <span className="nav-text">{app.name}</span>
                <span className="nav-description">{app.description}</span>
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

export default UnifiedTopBar;
