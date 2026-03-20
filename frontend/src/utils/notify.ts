/** Show a desktop notification if the user has granted permission. */
export async function notify(title: string, body: string) {
  if (localStorage.getItem("pref_notifications") === "false") return;

  if (Notification.permission === "default") {
    await Notification.requestPermission();
  }

  if (Notification.permission === "granted") {
    new Notification(title, { body, silent: false });
  }
}

/** Request notification permission proactively (call on first app load or Settings open). */
export async function requestNotifyPermission(): Promise<NotificationPermission> {
  if (Notification.permission !== "default") return Notification.permission;
  return Notification.requestPermission();
}
