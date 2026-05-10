import { Bell, Settings, HelpCircle } from "lucide-react";
import AppLogo from "@/components/AppLogo.jsx";
import { useTranslation } from "@/hooks/useTranslation.js";

/**
 * @param {{ businessName: string; onOpenSettings: () => void; onOpenNotifications?: () => void; notificationCount?: number; showNotificationDot?: boolean; onReplayTutorial?: () => void }} props
 */
export default function AppHeader({ businessName, onOpenSettings, onOpenNotifications, notificationCount, showNotificationDot, onReplayTutorial }) {
  const { t } = useTranslation();
  const count = notificationCount || 0;

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between gap-3 px-4 py-3 border-b border-border bg-background/95 backdrop-blur-md">
      <div className="flex items-center min-w-0">
        <img src="/warkahbiz-logo.png" alt="WarkahBiz" className="h-8 w-auto" />
      </div>
      <div className="flex items-center gap-1 shrink-0">
        {onReplayTutorial ? (
          <button
            type="button"
            onClick={onReplayTutorial}
            title="Ulang Tutorial"
            aria-label="Ulang Tutorial"
            className="tap w-10 h-10 rounded-full grid place-items-center text-muted-foreground hover:bg-muted"
          >
            <HelpCircle className="w-5 h-5" />
          </button>
        ) : null}
        <button type="button" onClick={onOpenNotifications} className="tap relative w-10 h-10 rounded-full grid place-items-center text-muted-foreground hover:bg-muted" aria-label={t("notifications")}>
          <Bell className="w-5 h-5" />
          {count > 0 ? (
            <span className="absolute top-1 right-1 min-w-[18px] h-[18px] px-1 grid place-items-center text-[10px] font-bold bg-cost text-cost-foreground rounded-full animate-pop-in">
              {count > 99 ? "99+" : count}
            </span>
          ) : showNotificationDot ? (
            <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-cost" />
          ) : null}
        </button>
        <button type="button" onClick={onOpenSettings} className="tap w-10 h-10 rounded-full grid place-items-center text-muted-foreground hover:bg-muted" aria-label={t("settings")}>
          <Settings className="w-5 h-5" />
        </button>
      </div>
    </header>
  );
}
