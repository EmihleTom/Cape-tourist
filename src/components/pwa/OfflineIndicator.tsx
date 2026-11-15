import React from 'react';
import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from '@/src/hooks/useOnlineStatus';
import type { OfflineTravelBundle } from '@/src/types/app';

interface OfflineIndicatorProps {
  offlineBundle?: OfflineTravelBundle | null;
  onOpenOfflineSettings?: () => void;
}

export const OfflineIndicator: React.FC<OfflineIndicatorProps> = ({
  offlineBundle,
  onOpenOfflineSettings,
}) => {
  const isOnline = useOnlineStatus();

  if (isOnline) {
    return null;
  }

  return (
    <div
      role="status"
      className="fixed bottom-20 left-4 z-50 flex flex-wrap items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-900 shadow-md md:bottom-4 max-w-md"
    >
      <WifiOff className="h-3.5 w-3.5 text-amber-700 shrink-0" aria-hidden="true" />
      <span>
        <strong>Offline Mode:</strong> Showing <strong>Saved Information (Not Live Data)</strong>
        {offlineBundle ? ` · Cached ${offlineBundle.savedAtLabel}` : ' · Pass & ICE active'}.
      </span>
      {onOpenOfflineSettings && (
        <button
          type="button"
          onClick={onOpenOfflineSettings}
          className="font-semibold underline text-amber-950 hover:text-amber-800"
        >
          View Saved Packet
        </button>
      )}
    </div>
  );
};
