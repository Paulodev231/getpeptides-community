"use client";

// Live unread counts for the bottom navigation, plus optional device
// notifications when a new DM or announcement arrives while the app is
// in the background.
//
// NOTE (free tier): these fire while the app is open or backgrounded in the
// browser. Notifications delivered when the app is fully closed need a paid
// server to push them, so they are intentionally not promised here.
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { collection, limit, onSnapshot, orderBy, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { getSeen, seenKeys } from "@/lib/seen";
import type { BroadcastPost, DmThread, MemberAlert } from "@/lib/types";

interface NotificationState {
  dmUnread: number;
  broadcastUnread: number;
  alertUnread: number;
  notificationsOn: boolean;
  enableNotifications: () => Promise<boolean>;
}

const NotificationContext = createContext<NotificationState>({
  dmUnread: 0,
  broadcastUnread: 0,
  alertUnread: 0,
  notificationsOn: false,
  enableNotifications: async () => false,
});

function notify(title: string, body: string, tag: string) {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission !== "granted") return;
  // Only interrupt when the app is not the active screen.
  if (document.visibilityState === "visible") return;
  try {
    new Notification(title, { body, tag, icon: "/icons/icon-192.png" });
  } catch {}
}

export function NotificationProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [threads, setThreads] = useState<DmThread[]>([]);
  const [posts, setPosts] = useState<BroadcastPost[]>([]);
  const [alerts, setAlerts] = useState<MemberAlert[]>([]);
  const [seenTick, setSeenTick] = useState(0);
  const [notificationsOn, setNotificationsOn] = useState(
    () =>
      typeof window !== "undefined" &&
      "Notification" in window &&
      Notification.permission === "granted",
  );
  // Skip notifying for the data that was already there when the app opened.
  const primed = useRef({ dms: false, broadcast: false, alerts: false });

  // Re-evaluate badges when something is marked read.
  useEffect(() => {
    const onChange = () => setSeenTick((n) => n + 1);
    window.addEventListener("kite:seen-changed", onChange);
    return () => window.removeEventListener("kite:seen-changed", onChange);
  }, []);

  useEffect(() => {
    // Signed out: nothing to listen to. The counts below are gated on `user`,
    // so any leftover data stops being counted immediately.
    if (!user) {
      primed.current = { dms: false, broadcast: false, alerts: false };
      return;
    }
    const unsubDms = onSnapshot(
      // Filter only — adding a sort would require a composite index.
      query(collection(db(), "dms"), where("participants", "array-contains", user.uid)),
      (snap) => {
        const next = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as DmThread);
        if (primed.current.dms) {
          for (const change of snap.docChanges()) {
            if (change.type === "removed") continue;
            const t = { id: change.doc.id, ...change.doc.data() } as DmThread;
            if (t.lastSenderUid && t.lastSenderUid !== user.uid) {
              const peer = t.participants.find((p) => p !== user.uid) ?? "";
              notify(t.handles?.[peer] ?? "New message", t.lastText ?? "", `dm-${t.id}`);
            }
          }
        }
        primed.current.dms = true;
        setThreads(next);
      },
      () => {},
    );

    const unsubBroadcast = onSnapshot(
      query(collection(db(), "broadcast"), orderBy("createdAt", "desc"), limit(30)),
      (snap) => {
        const next = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as BroadcastPost);
        if (primed.current.broadcast) {
          for (const change of snap.docChanges()) {
            if (change.type !== "added") continue;
            const p = { id: change.doc.id, ...change.doc.data() } as BroadcastPost;
            if (p.authorUid !== user.uid) {
              notify("📣 New announcement", p.text?.slice(0, 120) || "Tap to read", "broadcast");
            }
          }
        }
        primed.current.broadcast = true;
        setPosts(next);
      },
      () => {},
    );

    // Timing alerts an Admin addressed to this member.
    const unsubAlerts = onSnapshot(
      query(collection(db(), "alerts"), where("targetUid", "==", user.uid)),
      (snap) => {
        if (primed.current.alerts) {
          for (const change of snap.docChanges()) {
            if (change.type !== "added") continue;
            const a = { id: change.doc.id, ...change.doc.data() } as MemberAlert;
            notify("🔔 Alert from your administrator", a.message.slice(0, 140), `alert-${a.id}`);
          }
        }
        primed.current.alerts = true;
        setAlerts(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as MemberAlert));
      },
      () => {},
    );

    return () => {
      unsubDms();
      unsubBroadcast();
      unsubAlerts();
    };
  }, [user]);

  const enableNotifications = useCallback(async () => {
    if (typeof window === "undefined" || !("Notification" in window)) return false;
    const result = await Notification.requestPermission();
    const granted = result === "granted";
    setNotificationsOn(granted);
    return granted;
  }, []);

  // Badge maths (seenTick forces a recount after "mark as read").
  void seenTick;
  const dmUnread = user
    ? threads.filter((t) => {
        if (!t.lastSenderUid || t.lastSenderUid === user.uid) return false;
        return (t.updatedAt?.toMillis() ?? 0) > getSeen(seenKeys.dmThread(t.id));
      }).length
    : 0;
  const broadcastSeen = getSeen(seenKeys.broadcast);
  const broadcastUnread = user
    ? posts.filter(
        (p) => p.authorUid !== user.uid && (p.createdAt?.toMillis() ?? 0) > broadcastSeen,
      ).length
    : 0;

  // Alerts carry their own read flag in Firestore so the Admin can see it.
  const alertUnread = user ? alerts.filter((a) => !a.read).length : 0;

  // Show the unread total in the browser tab, e.g. "(3) GetPeptides Community",
  // so people notice waiting messages even on another tab.
  useEffect(() => {
    if (typeof document === "undefined") return;
    const total = dmUnread + broadcastUnread + alertUnread;
    const base = document.title.replace(/^\(\d+\)\s*/, "");
    document.title = total > 0 ? `(${total}) ${base}` : base;
  }, [dmUnread, broadcastUnread, alertUnread]);

  return (
    <NotificationContext.Provider
      value={{ dmUnread, broadcastUnread, alertUnread, notificationsOn, enableNotifications }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  return useContext(NotificationContext);
}
