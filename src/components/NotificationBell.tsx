import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useAppContext } from "../context/useAppContext";

const SOUND_KEY = "pheref-notification-sound-muted";

function playNotificationSound(muted: boolean) {
  if (muted) return;
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    const context = new AudioContextClass();
    const gain = context.createGain();
    const oscillator = context.createOscillator();
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(660, context.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(880, context.currentTime + 0.09);
    gain.gain.setValueAtTime(0.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.08, context.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.22);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.24);
    window.setTimeout(() => void context.close().catch(() => undefined), 320);
  } catch {
    // Browsers may block audio until the user interacts with the page.
  }
}

declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext;
  }
}

export function NotificationBell() {
  const {
    scopedNotifications,
    unreadNotificationCount,
    markNotificationRead
  } = useAppContext();
  const [open, setOpen] = useState(false);
  const [muted, setMuted] = useState(
    () => localStorage.getItem(SOUND_KEY) === "true"
  );
  const initialized = useRef(false);
  const previousUnreadIds = useRef<Set<string>>(new Set());
  const unreadNotifications = useMemo(
    () => scopedNotifications.filter((notification) => !notification.read),
    [scopedNotifications]
  );

  useEffect(() => {
    localStorage.setItem(SOUND_KEY, String(muted));
  }, [muted]);

  useEffect(() => {
    const currentUnreadIds = new Set(unreadNotifications.map((item) => item.id));
    if (!initialized.current) {
      previousUnreadIds.current = currentUnreadIds;
      initialized.current = true;
      return;
    }
    const hasNewUnread = [...currentUnreadIds].some(
      (id) => !previousUnreadIds.current.has(id)
    );
    if (hasNewUnread) playNotificationSound(muted);
    previousUnreadIds.current = currentUnreadIds;
  }, [muted, unreadNotifications]);

  return (
    <div className="notification-bell">
      <button
        type="button"
        className="notification-trigger secondary compact"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-label={`Notifications, ${unreadNotificationCount} unread`}
      >
        <span aria-hidden="true">!</span>
        <span>Notifications</span>
        {unreadNotificationCount ? (
          <strong>{unreadNotificationCount}</strong>
        ) : null}
      </button>
      {open ? (
        <div className="notification-popover" role="dialog" aria-label="Notifications">
          <div className="popover-heading">
            <div>
              <strong>Notifications</strong>
              <small>{unreadNotificationCount} unread update(s)</small>
            </div>
            <button
              type="button"
              className="secondary compact"
              onClick={() => setMuted((value) => !value)}
            >
              Sound {muted ? "off" : "on"}
            </button>
          </div>
          <div className="notification-list compact-list">
            {scopedNotifications.length ? (
              scopedNotifications.slice(0, 6).map((notification) => (
                <article
                  className={`notification ${notification.read ? "" : "unread"}`}
                  key={notification.id}
                >
                  <div>
                    <strong>{notification.title}</strong>
                    <p>{notification.message}</p>
                    <small>{new Date(notification.createdAt).toLocaleString()}</small>
                  </div>
                  <div className="notification-actions">
                    <Link
                      className="button secondary compact"
                      to={`/referrals/${notification.referralId}`}
                      onClick={() => {
                        markNotificationRead(notification.id);
                        setOpen(false);
                      }}
                    >
                      Open
                    </Link>
                    {!notification.read ? (
                      <button
                        type="button"
                        className="secondary compact"
                        onClick={() => markNotificationRead(notification.id)}
                      >
                        Mark read
                      </button>
                    ) : null}
                  </div>
                </article>
              ))
            ) : (
              <p className="empty-state compact-empty">No new notifications.</p>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
