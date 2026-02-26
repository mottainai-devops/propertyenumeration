import { useEffect, useState } from 'react';
import { sessionApi, type Session } from '../api/client';

interface SessionBannerProps {
  onEndSession: () => void;
}

export default function SessionBanner({ onEndSession }: SessionBannerProps) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSession();
    // Refresh session data every 10 seconds to update building count
    const interval = setInterval(loadSession, 10000);
    return () => clearInterval(interval);
  }, []);

  const loadSession = async () => {
    try {
      const sessions = await sessionApi.list();
      const activeSession = sessions.find(s => s.isActive === true);
      setSession(activeSession || null);
    } catch (error) {
      console.error('Failed to load session:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading || !session) {
    return null;
  }

  const formatDuration = (startTime: string) => {
    const start = new Date(startTime);
    const now = new Date();
    const diff = now.getTime() - start.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  };

  return (
    <div className="bg-gradient-to-r from-green-600 to-emerald-600 text-white shadow-lg sticky top-0 z-50">
      {/* Safe area spacer for status bar */}
      <div className="h-safe-top bg-gradient-to-r from-green-700 to-emerald-700"></div>
      <div className="container mx-auto px-4 py-3">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-white rounded-full animate-pulse"></div>
              <span className="font-bold">Active Session</span>
            </div>
            <div className="hidden sm:flex items-center gap-4 text-sm">
              <div>
                <span className="opacity-80">Lot:</span> <span className="font-semibold">{session.lotCode}</span>
              </div>
              <div>
                <span className="opacity-80">Duration:</span> <span className="font-semibold">{formatDuration(session.startTime)}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="bg-white/20 backdrop-blur-sm rounded-full px-4 py-2">
              <span className="text-sm opacity-80 mr-2">Buildings:</span>
              <span className="text-2xl font-bold">{session.buildingsEnumerated}</span>
            </div>
            <button
              onClick={onEndSession}
              className="px-4 py-2 bg-white/20 hover:bg-white/30 backdrop-blur-sm rounded-lg font-semibold transition text-sm"
            >
              End Session
            </button>
          </div>
        </div>

        {/* Mobile view - show lot and duration below */}
        <div className="sm:hidden flex gap-4 mt-2 text-xs opacity-90">
          <div>
            <span className="opacity-70">Lot:</span> <span className="font-semibold">{session.lotCode}</span>
          </div>
          <div>
            <span className="opacity-70">Duration:</span> <span className="font-semibold">{formatDuration(session.startTime)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
