// @ts-nocheck
import API from './api';

/**
 * Get current user's notifications.
 * returns { notifications: [], unreadCount: number }
 */
export const getNotifications = async () => {
  try {
    const res = await API.get('/api/notifications');
    return res.data;
  } catch (error) {
    return { success: false, error: error.message };
  }
};

/**
 * Mark an individual notification as read.
 */
export const markAsRead = async (id) => {
  try {
    const res = await API.patch(`/api/notifications/${id}/read`);
    return res.data;
  } catch (error) {
    return { success: false, error: error.message };
  }
};

/**
 * Mark all notifications as read.
 */
export const markAllRead = async () => {
  try {
    const res = await API.post('/api/notifications/read-all');
    return res.data;
  } catch (error) {
    return { success: false, error: error.message };
  }
};
