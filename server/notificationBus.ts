// In-memory event bus for Server-Sent Events (SSE)
// This allows real-time notifications to be pushed to connected clients

class NotificationBus {
  private listeners: Map<string, Set<Function>> = new Map();

  /**
   * Subscribe to notifications for a specific user
   */
  subscribe(userId: string, callback: Function) {
    if (!this.listeners.has(userId)) {
      this.listeners.set(userId, new Set());
    }
    this.listeners.get(userId)!.add(callback);
    console.log(`📡 User ${userId} subscribed to notification stream`);
  }

  /**
   * Unsubscribe from notifications
   */
  unsubscribe(userId: string, callback: Function) {
    const userListeners = this.listeners.get(userId);
    if (userListeners) {
      userListeners.delete(callback);
      if (userListeners.size === 0) {
        this.listeners.delete(userId);
      }
      console.log(`📡 User ${userId} unsubscribed from notification stream`);
    }
  }

  /**
   * Emit a notification to a specific user
   */
  emit(userId: string, notification: any) {
    const userListeners = this.listeners.get(userId);
    if (userListeners && userListeners.size > 0) {
      console.log(`📡 Broadcasting notification to ${userListeners.size} client(s) for user ${userId}`);
      userListeners.forEach(cb => {
        try {
          cb(notification);
        } catch (error) {
          console.error(`Error broadcasting to client:`, error);
        }
      });
    }
  }

  /**
   * Get count of active connections for a user
   */
  getConnectionCount(userId: string): number {
    return this.listeners.get(userId)?.size || 0;
  }

  /**
   * Get total active connections
   */
  getTotalConnections(): number {
    let total = 0;
    this.listeners.forEach(listeners => {
      total += listeners.size;
    });
    return total;
  }
}

export const notificationBus = new NotificationBus();
