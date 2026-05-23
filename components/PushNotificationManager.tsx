"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import * as Popover from "@radix-ui/react-popover";

type PushTopic = "news" | "events" | "projects" | "attendance";

type PushPreferences = Record<PushTopic, boolean>;

type PushKeyResponse = {
  configured: boolean;
  publicKey: string | null;
};

type SubscriptionRouteResponse = {
  success: boolean;
  preferences: PushPreferences;
};

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

const DEFAULT_PREFERENCES: PushPreferences = {
  news: true,
  events: true,
  projects: true,
  attendance: true,
};

const TOPIC_LABELS: Record<PushTopic, string> = {
  news: "News posts",
  events: "Events",
  projects: "Projects",
  attendance: "Attendance",
};

const PUSH_STATUS_CHANGED_EVENT = "flh:push-status-changed";

function notifyPushStatusChanged() {
  window.dispatchEvent(new Event(PUSH_STATUS_CHANGED_EVENT));
}

function base64UrlToUint8Array(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padding = normalized.length % 4 === 0 ? "" : "=".repeat(4 - (normalized.length % 4));
  const decoded = window.atob(`${normalized}${padding}`);
  return Uint8Array.from(decoded, (char) => char.charCodeAt(0));
}

function isIOSDevice() {
  const userAgent = window.navigator.userAgent.toLowerCase();
  return /iphone|ipad|ipod/.test(userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

function isStandaloneMode() {
  return window.matchMedia("(display-mode: standalone)").matches || (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
}

export default function PushNotificationManager({
  canSendTest = false,
  collapsed = false,
  variant = "card",
}: {
  canSendTest?: boolean;
  collapsed?: boolean;
  variant?: "card" | "dashboard" | "sidebar";
}) {
  const [hasCheckedStatus, setHasCheckedStatus] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const [isConfigured, setIsConfigured] = useState(false);
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [preferences, setPreferences] = useState<PushPreferences>(DEFAULT_PREFERENCES);
  const [isBusy, setIsBusy] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);

  const syncExistingSubscription = useCallback(async (subscription: PushSubscription) => {
    const response = await fetch("/api/push/subscription", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        subscription: subscription.toJSON(),
      }),
    });

    if (!response.ok) {
      throw new Error("Failed to sync notification subscription");
    }

    const data = (await response.json()) as SubscriptionRouteResponse;
    setPreferences(data.preferences ?? DEFAULT_PREFERENCES);
    setIsSubscribed(true);
  }, []);

  const refreshStatus = useCallback(async () => {
    const supported =
      typeof window !== "undefined" &&
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      "Notification" in window;

    setIsSupported(supported);
    setPermission(typeof Notification === "undefined" ? "default" : Notification.permission);
    setIsIOS(isIOSDevice());
    setIsStandalone(isStandaloneMode());

    if (!supported) {
      setHasCheckedStatus(true);
      return;
    }

    try {
      const keyResponse = await fetch("/api/push/public-key", { cache: "no-store" });
      const keyData = (await keyResponse.json()) as PushKeyResponse;

      setIsConfigured(Boolean(keyData.configured && keyData.publicKey));
      setPublicKey(keyData.publicKey);

      const registration = await navigator.serviceWorker.ready;
      const existingSubscription = await registration.pushManager.getSubscription();

      if (existingSubscription) {
        await syncExistingSubscription(existingSubscription);
      } else {
        setIsSubscribed(false);
        setPreferences(DEFAULT_PREFERENCES);
      }
    } catch (error) {
      console.error("Failed to load push status:", error);
      setStatusMessage("Could not check notification status on this device.");
    } finally {
      setHasCheckedStatus(true);
    }
  }, [syncExistingSubscription]);

  useEffect(() => {
    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setInstallPrompt(null);
      setIsStandalone(true);
      setStatusMessage("App installed. You can now turn on alerts for this device.");
    };

    void refreshStatus();

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt as EventListener);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt as EventListener);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, [refreshStatus]);

  useEffect(() => {
    const handlePushStatusChanged = () => {
      void refreshStatus();
    };

    window.addEventListener(PUSH_STATUS_CHANGED_EVENT, handlePushStatusChanged);

    return () => {
      window.removeEventListener(PUSH_STATUS_CHANGED_EVENT, handlePushStatusChanged);
    };
  }, [refreshStatus]);

  const canEnableNotifications = useMemo(() => {
    if (!isSupported || !isConfigured || !publicKey) {
      return false;
    }
    if (isIOS && !isStandalone) {
      return false;
    }
    return true;
  }, [isConfigured, isIOS, isStandalone, isSupported, publicKey]);

  const installApp = async () => {
    if (!installPrompt) {
      return;
    }

    setIsBusy(true);
    setStatusMessage("");

    try {
      await installPrompt.prompt();
      const result = await installPrompt.userChoice;
      if (result.outcome === "accepted") {
        setStatusMessage("Install accepted. Open the app from your home screen or app list.");
      }
      setInstallPrompt(null);
    } finally {
      setIsBusy(false);
    }
  };

  const enableNotifications = async () => {
    if (!canEnableNotifications || !publicKey) {
      return;
    }

    setIsBusy(true);
    setStatusMessage("");

    try {
      const permissionResult = await Notification.requestPermission();
      setPermission(permissionResult);

      if (permissionResult !== "granted") {
        setStatusMessage("Notifications were not allowed on this device.");
        return;
      }

      const registration = await navigator.serviceWorker.ready;
      let subscription = await registration.pushManager.getSubscription();

      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: base64UrlToUint8Array(publicKey),
        });
      }

      await syncExistingSubscription(subscription);
      setStatusMessage("Alerts are on for this device.");
      notifyPushStatusChanged();
    } catch (error) {
      console.error("Failed to enable notifications:", error);
      setStatusMessage("Could not enable notifications on this device.");
    } finally {
      setIsBusy(false);
    }
  };

  const disableNotifications = async () => {
    if (!isSupported) {
      return;
    }

    setIsBusy(true);
    setStatusMessage("");

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (!subscription) {
        setIsSubscribed(false);
        notifyPushStatusChanged();
        return;
      }

      const endpoint = subscription.endpoint;
      await subscription.unsubscribe();

      await fetch("/api/push/subscription", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ endpoint }),
      });

      setIsSubscribed(false);
      setPreferences(DEFAULT_PREFERENCES);
      setStatusMessage("Alerts are off for this device.");
      notifyPushStatusChanged();
    } catch (error) {
      console.error("Failed to disable notifications:", error);
      setStatusMessage("Could not turn off notifications right now.");
    } finally {
      setIsBusy(false);
    }
  };

  const sendTestNotification = async () => {
    if (!isSupported) {
      return;
    }

    setIsBusy(true);
    setStatusMessage("");

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (!subscription) {
        setStatusMessage("Turn on alerts first so this device has an active subscription.");
        return;
      }

      const response = await fetch("/api/push/test", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          subscription: subscription.toJSON(),
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to send test notification");
      }

      const data = (await response.json()) as {
        broadcast?: boolean;
        sent?: number;
        failed?: number;
        failures?: Array<{
          endpointHost: string;
          status: number;
          reason: string;
          userName: string | null;
          userEmail: string | null;
          deleted: boolean;
        }>;
      };

      if (data.broadcast) {
        const sent = data.sent ?? 0;
        const failed = data.failed ?? 0;
        const failures = data.failures ?? [];

        if (failures.length > 0) {
          console.group(`[push test] ${failed} failure${failed === 1 ? "" : "s"}`);
          failures.forEach((failure) => {
            const who = failure.userName ?? failure.userEmail ?? "unknown user";
            console.warn(
              `${who} @ ${failure.endpointHost} — ${failure.status} ${failure.reason}${failure.deleted ? " [removed stale subscription]" : ""}`
            );
          });
          console.groupEnd();
        }

        const failedSummary =
          failures.length > 0
            ? failures
                .slice(0, 3)
                .map((failure) => failure.userName ?? failure.userEmail ?? failure.endpointHost)
                .join(", ") + (failures.length > 3 ? `, +${failures.length - 3} more` : "")
            : "";

        setStatusMessage(
          failed > 0
            ? `Test sent to ${sent}, failed for ${failed} (${failedSummary}). See console.`
            : `Test sent to ${sent} device${sent === 1 ? "" : "s"}.`
        );
      } else {
        setStatusMessage("Test notification sent.");
      }
    } catch (error) {
      console.error("Failed to send test notification:", error);
      setStatusMessage("Could not send a test notification right now.");
    } finally {
      setIsBusy(false);
    }
  };

  const toggleTopic = async (topic: PushTopic) => {
    if (!isSupported || !isSubscribed) {
      return;
    }

    setIsBusy(true);
    setStatusMessage("");

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (!subscription) {
        setIsSubscribed(false);
        setStatusMessage("This device no longer has an active subscription.");
        return;
      }

      const nextPreferences = {
        ...preferences,
        [topic]: !preferences[topic],
      };

      setPreferences(nextPreferences);

      const response = await fetch("/api/push/subscription", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          endpoint: subscription.endpoint,
          preferences: nextPreferences,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to update notification preferences");
      }

      const data = (await response.json()) as SubscriptionRouteResponse;
      setPreferences(data.preferences ?? nextPreferences);
    } catch (error) {
      console.error("Failed to update notification preferences:", error);
      setStatusMessage("Could not update alert preferences.");
      setPreferences((current) => ({
        ...current,
        [topic]: !current[topic],
      }));
    } finally {
      setIsBusy(false);
    }
  };

  const helperText = useMemo(() => {
    if (!isSupported) {
      return "This browser does not support service-worker push notifications.";
    }
    if (!isConfigured) {
      return "Push is not configured on the server yet. Add VAPID keys to finish setup.";
    }
    if (isIOS && !isStandalone) {
      return "On iPhone and iPad, install this app to the Home Screen first, then open it from there to enable alerts.";
    }
    if (permission === "denied") {
      return "Notifications are blocked in browser settings for this device.";
    }
    if (isSubscribed) {
      return "This device is ready for dashboard alerts.";
    }
    return "Install the app, then turn on alerts for news, events, projects, and attendance.";
  }, [isConfigured, isIOS, isStandalone, isSubscribed, isSupported, permission]);

  const alertLabel = useMemo(() => {
    if (!isSupported) return "Alerts unavailable";
    if (permission === "denied") return "Alerts blocked";
    if (isSubscribed) return "Alerts on";
    return "Alerts off";
  }, [isSubscribed, isSupported, permission]);

  const alertButtonClass = isSubscribed
    ? "border-purple-100 bg-purple-50 text-purple-700 hover:bg-purple-100"
    : "border-slate-200 bg-white text-slate-600 hover:border-purple-100 hover:bg-purple-50 hover:text-purple-700";

  const shouldShowDashboardInstallPrompt = !isStandalone && (Boolean(installPrompt) || isIOS);
  const shouldShowDashboardAlertPrompt = isStandalone;
  const shouldShowDashboardSetup =
    hasCheckedStatus &&
    isSupported &&
    isConfigured &&
    !isSubscribed &&
    (shouldShowDashboardInstallPrompt || shouldShowDashboardAlertPrompt);

  const actions = (
    <div className="flex flex-wrap gap-2">
      {!isStandalone && installPrompt && (
        <button
          type="button"
          onClick={installApp}
          disabled={isBusy}
          className="rounded-lg border border-purple-200 px-3 py-1.5 text-xs font-semibold text-purple-700 transition hover:bg-purple-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Install app
        </button>
      )}

      {!isSubscribed ? (
        <button
          type="button"
          onClick={enableNotifications}
          disabled={!canEnableNotifications || isBusy}
          className="rounded-lg bg-purple-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Turn on alerts
        </button>
      ) : (
        <>
          {canSendTest && (
            <button
              type="button"
              onClick={sendTestNotification}
              disabled={isBusy}
              className="rounded-lg border border-purple-200 px-3 py-1.5 text-xs font-semibold text-purple-700 transition hover:bg-purple-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Send test
            </button>
          )}
          <button
            type="button"
            onClick={disableNotifications}
          disabled={isBusy}
            className="rounded-lg border border-purple-100 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-purple-50 hover:text-purple-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Turn off alerts
          </button>
        </>
      )}
    </div>
  );

  const topicButtons = isSubscribed ? (
    <div className="flex flex-wrap gap-2">
      {(Object.keys(TOPIC_LABELS) as PushTopic[]).map((topic) => (
        <button
          key={topic}
          type="button"
          onClick={() => toggleTopic(topic)}
          disabled={isBusy}
          className={`rounded-md border px-2.5 py-1.5 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${
            preferences[topic]
              ? "border-purple-200 bg-purple-50 text-purple-700"
              : "border-slate-200 bg-white text-slate-600 hover:bg-purple-50 hover:text-purple-700"
          }`}
        >
          {TOPIC_LABELS[topic]}
        </button>
      ))}
    </div>
  ) : null;

  if (variant === "sidebar") {
    return (
      <Popover.Root open={panelOpen} onOpenChange={setPanelOpen}>
        <Popover.Trigger asChild>
          <button
            type="button"
            title={collapsed ? alertLabel : undefined}
            className={`flex w-full items-center gap-2.5 rounded-lg border px-2.5 py-2 text-xs font-semibold transition ${alertButtonClass} ${
              collapsed ? "justify-center" : ""
            }`}
          >
            <span className="relative shrink-0">
              <svg className="h-[18px] w-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 17h5l-1.4-1.4A2 2 0 0118 14.2V11a6 6 0 10-12 0v3.2a2 2 0 01-.6 1.4L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              <span
                className={`absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full ${
                  isSubscribed ? "bg-purple-500" : "bg-slate-300"
                }`}
              />
            </span>
            {!collapsed && <span className="truncate">{alertLabel}</span>}
          </button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content
            side={collapsed ? "right" : "top"}
            align="start"
            sideOffset={8}
            className="z-[80] w-[min(17rem,calc(100vw-2rem))] rounded-lg border border-purple-200 bg-white p-3 shadow-xl shadow-purple-950/15 focus:outline-none"
          >
            <p className="text-[10px] font-semibold uppercase tracking-wide text-purple-700">
              App and alerts
            </p>
            <h3 className="mt-1 text-sm font-bold text-slate-900">
              Dashboard alerts
            </h3>
            <p className="mt-1 text-xs leading-5 text-slate-600">{helperText}</p>

            {statusMessage && (
              <div className="mt-2 rounded-md border border-purple-100 bg-purple-50 px-2.5 py-1.5 text-xs text-purple-800">
                {statusMessage}
              </div>
            )}

            <div className="mt-3 space-y-2.5">
              {actions}
              {topicButtons}
            </div>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    );
  }

  if (variant === "dashboard") {
    if (!shouldShowDashboardSetup) {
      return null;
    }

    const isInstallMode = shouldShowDashboardInstallPrompt && !isStandalone;
    const isBlocked = permission === "denied";

    return (
      <section className="rounded-lg border border-purple-200 bg-white/90 p-3 shadow-sm sm:p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-purple-600">
              App setup
            </p>
            <h2 className="mt-1 text-base font-bold text-slate-900">
              {isInstallMode
                ? "Install the dashboard app"
                : isBlocked
                  ? "Alerts are blocked"
                  : "Turn on dashboard alerts"}
            </h2>
            <p className="mt-1 max-w-2xl text-sm leading-5 text-slate-600">
              {isInstallMode
                ? isIOS
                  ? "On iPhone or iPad, install from the Share menu with Add to Home Screen, then open the app to turn on alerts."
                  : "Install the app first, then turn on alerts for news, events, projects, and attendance."
                : isBlocked
                  ? "Notifications are blocked in this app. Allow them from browser settings to receive dashboard updates."
                  : "Turn on alerts so this device receives news, events, projects, and attendance updates."}
            </p>
          </div>

          <div className="flex shrink-0 flex-wrap gap-2">
            {isInstallMode && installPrompt && (
              <button
                type="button"
                onClick={installApp}
                disabled={isBusy}
                className="inline-flex items-center justify-center rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Install app
              </button>
            )}

            {!isInstallMode && !isBlocked && (
              <button
                type="button"
                onClick={enableNotifications}
                disabled={!canEnableNotifications || isBusy}
                className="inline-flex items-center justify-center rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Turn on alerts
              </button>
            )}
          </div>
        </div>

        {statusMessage && (
          <div className="mt-3 rounded-lg border border-purple-100 bg-purple-50 px-3 py-2 text-sm text-purple-800">
            {statusMessage}
          </div>
        )}
      </section>
    );
  }

  return (
    <div className="rounded-lg border border-purple-200 bg-white/85 p-4 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-purple-700">
            App and alerts
          </p>
          <h3 className="mt-1 text-lg font-bold text-slate-900">
            Install the dashboard and stay updated
          </h3>
          <p className="mt-1 text-sm text-slate-600">{helperText}</p>
        </div>

        {actions}
      </div>

      {statusMessage && (
        <div className="mt-4 rounded-lg border border-purple-100 bg-purple-50 px-3 py-2 text-sm text-purple-800">
          {statusMessage}
        </div>
      )}

      {topicButtons && <div className="mt-4">{topicButtons}</div>}
    </div>
  );
}
