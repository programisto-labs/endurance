type NotificationHandler = (options: unknown) => void;

class EnduranceNotificationManager {
  private notificationTypes: Set<string> = new Set();
  private registeredNotifications: Map<string, NotificationHandler> = new Map();

  public sendNotification(type: string, options: unknown): void {
    const normalizedType = type.toLowerCase();
    if (!this.notificationTypes.has(normalizedType)) {
      throw new Error(`Notification type "${type}" is not registered.`);
    }
    const notificationHandler = this.registeredNotifications.get(normalizedType);
    if (notificationHandler) {
      notificationHandler(options);
    } else {
      throw new Error(`No handler found for notification type "${type}".`);
    }
  }

  public registerNotification(type: string, handler: NotificationHandler): void {
    const normalizedType = type.toLowerCase();
    if (this.notificationTypes.has(normalizedType)) {
      throw new Error(`Notification type "${type}" is already registered.`);
    } else {
      this.notificationTypes.add(normalizedType);
      this.registeredNotifications.set(normalizedType, handler);
    }
  }
}

export const enduranceNotificationManager = new EnduranceNotificationManager();
