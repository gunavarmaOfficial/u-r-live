import { CameraVideoIcon, WebProtectionIcon, AlertCircleIcon } from 'hugeicons-react';
import { Logo } from './Logo';

interface FooterProps {
  onNavigate: (view: 'landing' | 'video' | 'safety' | 'admin') => void;
}

export const Footer: React.FC<FooterProps> = ({ onNavigate }) => {
  return (
    <footer className="border-t border-neutral-800/80 bg-[#0E0E10] py-12 text-neutral-400">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-10">
          <div className="space-y-3 md:col-span-1">
            <Logo
              size="sm"
              onClick={() => onNavigate('landing')}
            />
            <p className="text-xs text-neutral-400 leading-relaxed">
              Adult-only (18+) random video chat platform powered by peer-to-peer WebRTC and server-authoritative matchmaking.
            </p>
            <div className="flex items-center gap-1.5 text-xs text-[#FF385C] pt-1 font-semibold">
              <AlertCircleIcon className="w-3.5 h-3.5" />
              <span>Strictly 18+ Only Platform</span>
            </div>
          </div>

          <div>
            <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-3">Platform</h4>
            <ul className="space-y-2 text-xs">
              <li>
                <button onClick={() => onNavigate('video')} className="hover:text-white transition-colors">
                  Random Video Chat
                </button>
              </li>
              <li>
                <button
                  onClick={() => {
                    onNavigate('landing');
                    setTimeout(() => {
                      document.getElementById('pricing-section')?.scrollIntoView({ behavior: 'smooth' });
                    }, 100);
                  }}
                  className="hover:text-white transition-colors"
                >
                  Pro Membership (₹299/mo)
                </button>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-3">Safety & Trust</h4>
            <ul className="space-y-2 text-xs">
              <li>
                <button onClick={() => onNavigate('safety')} className="hover:text-white transition-colors">
                  Community Standards
                </button>
              </li>
              <li>
                <button onClick={() => onNavigate('safety')} className="hover:text-white transition-colors">
                  Age Assurance Policy (18+)
                </button>
              </li>
              <li>
                <button onClick={() => onNavigate('safety')} className="hover:text-white transition-colors">
                  Prohibited Conduct
                </button>
              </li>
              <li>
                <button onClick={() => onNavigate('safety')} className="hover:text-white transition-colors">
                  Report & Block Mechanics
                </button>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-3">Legal & Grievances</h4>
            <ul className="space-y-2 text-xs text-neutral-400">
              <li>
                <button onClick={() => onNavigate('safety')} className="hover:text-white transition-colors">
                  Privacy Policy (Zero Storage)
                </button>
              </li>
              <li>
                <button onClick={() => onNavigate('safety')} className="hover:text-white transition-colors">
                  Terms of Service
                </button>
              </li>
              <li>
                <span className="text-neutral-500">Grievance Officer:</span> grievance@u-r-live.local
              </li>
              <li>
                <span className="text-neutral-500">Support SLA:</span> Response within 24h
              </li>
            </ul>
          </div>
        </div>

        <div className="pt-8 border-t border-neutral-900 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-neutral-500">
          <div className="flex items-center gap-2">
            <span>© {new Date().getFullYear()} U-R-LIVE Platform. All rights reserved.</span>
            <span aria-hidden="true">·</span>
            <span>Zero-Video-Retention Guarantee</span>
          </div>
          <div className="flex items-center gap-3">
            <span>Cashfree Payments India Recurring Compliance</span>
            <span aria-hidden="true">·</span>
            <button
              onClick={() => onNavigate('admin')}
              className="text-neutral-600 hover:text-neutral-400 transition-colors"
            >
              Staff Portal
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
};
