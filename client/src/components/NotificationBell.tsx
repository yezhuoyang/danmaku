import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Bell,
  Check,
  Trash2,
  UserPlus,
  MessageCircle,
  ThumbsUp,
  FileText,
  Bot,
  Star,
  Loader2,
} from "lucide-react";
import { Link } from "wouter";
import * as api from "@/lib/api";
import type { Notification, NotificationType } from "../../../shared/types";
import { formatDistanceToNow } from "date-fns";

// Map notification type to icon and color
function getNotificationIcon(type: NotificationType) {
  switch (type) {
    case "follow":
      return { icon: UserPlus, color: "text-blue-500" };
    case "reply":
      return { icon: MessageCircle, color: "text-green-500" };
    case "like":
      return { icon: ThumbsUp, color: "text-pink-500" };
    case "annotation":
      return { icon: FileText, color: "text-indigo-500" };
    case "comment":
      return { icon: MessageCircle, color: "text-amber-500" };
    case "ai_review":
      return { icon: Bot, color: "text-purple-500" };
    case "user_review":
      return { icon: Star, color: "text-yellow-500" };
    default:
      return { icon: Bell, color: "text-slate-500" };
  }
}

// Generate notification message based on type
function getNotificationMessage(notification: Notification): string {
  const actorName = notification.actorName || "Someone";

  switch (notification.type) {
    case "follow":
      return `${actorName} started following you`;
    case "reply":
      return `${actorName} replied to your comment`;
    case "like":
      return `${actorName} liked your ${notification.targetType || "content"}`;
    case "annotation":
      return `${actorName} annotated on your paper`;
    case "comment":
      return `${actorName} commented on your paper`;
    case "ai_review":
      return `${actorName} added an AI review to your paper`;
    case "user_review":
      return `${actorName} reviewed your paper`;
    default:
      return `${actorName} interacted with your content`;
  }
}

// Get link destination based on notification
function getNotificationLink(notification: Notification): string {
  if (notification.type === "follow") {
    return `/profile/${notification.actorId}`;
  }
  if (notification.paperId) {
    return `/paper/${notification.paperId}`;
  }
  return "#";
}

interface NotificationItemProps {
  notification: Notification;
  onMarkRead: (id: string) => void;
  onDelete: (id: string) => void;
}

function NotificationItem({ notification, onMarkRead, onDelete }: NotificationItemProps) {
  const { icon: Icon, color } = getNotificationIcon(notification.type);
  const message = getNotificationMessage(notification);
  const link = getNotificationLink(notification);
  const timeAgo = formatDistanceToNow(new Date(notification.createdAt * 1000), { addSuffix: true });

  return (
    <div
      className={`flex items-start gap-3 p-3 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors rounded-lg ${
        !notification.isRead ? "bg-indigo-50/50 dark:bg-indigo-900/10" : ""
      }`}
    >
      <Avatar className="w-8 h-8 flex-shrink-0">
        <AvatarImage src={notification.actorAvatar} />
        <AvatarFallback className="text-xs bg-slate-100 dark:bg-slate-700">
          {notification.actorName?.charAt(0).toUpperCase() || "?"}
        </AvatarFallback>
      </Avatar>

      <div className="flex-1 min-w-0">
        <Link href={link}>
          <div className="cursor-pointer">
            <div className="flex items-center gap-1.5 mb-0.5">
              <Icon className={`w-3.5 h-3.5 ${color}`} />
              <span className="text-sm text-slate-700 dark:text-slate-200 line-clamp-2">
                {message}
              </span>
            </div>
            {notification.paperTitle && (
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                {notification.paperTitle}
              </p>
            )}
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
              {timeAgo}
            </p>
          </div>
        </Link>
      </div>

      <div className="flex items-center gap-1 flex-shrink-0">
        {!notification.isRead && (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-slate-400 hover:text-indigo-600"
            onClick={(e) => {
              e.stopPropagation();
              onMarkRead(notification.id);
            }}
            title="Mark as read"
          >
            <Check className="w-4 h-4" />
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-slate-400 hover:text-red-600"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(notification.id);
          }}
          title="Delete"
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}

export function NotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  // Fetch unread count on mount and periodically
  const fetchUnreadCount = useCallback(async () => {
    try {
      const { count } = await api.getUnreadNotificationCount();
      setUnreadCount(count);
    } catch (error) {
      // Silently fail - user might not be logged in
    }
  }, []);

  // Fetch full notifications when popover opens
  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const { notifications: notifs, unreadCount: count } = await api.getNotifications({ limit: 20 });
      setNotifications(notifs);
      setUnreadCount(count);
    } catch (error) {
      console.error("Failed to fetch notifications:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUnreadCount();
    // Poll for new notifications every 30 seconds
    const interval = setInterval(fetchUnreadCount, 30000);
    return () => clearInterval(interval);
  }, [fetchUnreadCount]);

  // Fetch notifications when popover opens
  useEffect(() => {
    if (isOpen) {
      fetchNotifications();
    }
  }, [isOpen, fetchNotifications]);

  const handleMarkRead = async (notificationId: string) => {
    try {
      await api.markNotificationsRead([notificationId]);
      setNotifications((prev) =>
        prev.map((n) => (n.id === notificationId ? { ...n, isRead: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (error) {
      console.error("Failed to mark notification as read:", error);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await api.markNotificationsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error("Failed to mark all as read:", error);
    }
  };

  const handleDelete = async (notificationId: string) => {
    try {
      await api.deleteNotification(notificationId);
      const deletedNotif = notifications.find((n) => n.id === notificationId);
      setNotifications((prev) => prev.filter((n) => n.id !== notificationId));
      if (deletedNotif && !deletedNotif.isRead) {
        setUnreadCount((prev) => Math.max(0, prev - 1));
      }
    } catch (error) {
      console.error("Failed to delete notification:", error);
    }
  };

  const handleClearAll = async () => {
    try {
      await api.clearAllNotifications();
      setNotifications([]);
      setUnreadCount(0);
    } catch (error) {
      console.error("Failed to clear notifications:", error);
    }
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-9 w-9">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-medium text-white">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96 p-0" align="end">
        <div className="flex items-center justify-between p-3 border-b border-slate-200 dark:border-slate-700">
          <h3 className="font-semibold text-slate-800 dark:text-slate-100">
            Notifications
          </h3>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={handleMarkAllRead}
              >
                <Check className="w-3 h-3 mr-1" />
                Mark all read
              </Button>
            )}
            {notifications.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
                onClick={handleClearAll}
              >
                <Trash2 className="w-3 h-3 mr-1" />
                Clear all
              </Button>
            )}
          </div>
        </div>

        <ScrollArea className="max-h-[400px]">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Bell className="w-12 h-12 text-slate-300 dark:text-slate-600 mb-2" />
              <p className="text-sm text-slate-500 dark:text-slate-400">
                No notifications yet
              </p>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                We'll notify you when something happens
              </p>
            </div>
          ) : (
            <div className="p-1">
              {notifications.map((notification) => (
                <NotificationItem
                  key={notification.id}
                  notification={notification}
                  onMarkRead={handleMarkRead}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          )}
        </ScrollArea>

        {notifications.length > 0 && (
          <div className="p-2 border-t border-slate-200 dark:border-slate-700">
            <Link href="/notifications">
              <Button variant="ghost" size="sm" className="w-full text-sm">
                View all notifications
              </Button>
            </Link>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
