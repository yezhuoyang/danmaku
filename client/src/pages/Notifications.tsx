import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
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
  ArrowLeft,
  Loader2,
  CheckCheck,
} from "lucide-react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import * as api from "@/lib/api";
import type { Notification, NotificationType } from "../../../shared/types";
import { formatDistanceToNow } from "date-fns";

// Map notification type to icon and color
function getNotificationIcon(type: NotificationType) {
  switch (type) {
    case "follow":
      return { icon: UserPlus, color: "text-blue-500", bg: "bg-blue-50 dark:bg-blue-900/20" };
    case "reply":
      return { icon: MessageCircle, color: "text-green-500", bg: "bg-green-50 dark:bg-green-900/20" };
    case "like":
      return { icon: ThumbsUp, color: "text-pink-500", bg: "bg-pink-50 dark:bg-pink-900/20" };
    case "annotation":
      return { icon: FileText, color: "text-indigo-500", bg: "bg-indigo-50 dark:bg-indigo-900/20" };
    case "comment":
      return { icon: MessageCircle, color: "text-amber-500", bg: "bg-amber-50 dark:bg-amber-900/20" };
    case "ai_review":
      return { icon: Bot, color: "text-purple-500", bg: "bg-purple-50 dark:bg-purple-900/20" };
    case "user_review":
      return { icon: Star, color: "text-yellow-500", bg: "bg-yellow-50 dark:bg-yellow-900/20" };
    default:
      return { icon: Bell, color: "text-slate-500", bg: "bg-slate-50 dark:bg-slate-800" };
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
  const { icon: Icon, color, bg } = getNotificationIcon(notification.type);
  const message = getNotificationMessage(notification);
  const link = getNotificationLink(notification);
  const timeAgo = formatDistanceToNow(new Date(notification.createdAt * 1000), { addSuffix: true });

  return (
    <div
      className={`flex items-start gap-4 p-4 rounded-lg transition-colors ${
        !notification.isRead
          ? "bg-indigo-50/70 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800"
          : "bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
      }`}
    >
      <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${bg}`}>
        <Icon className={`w-5 h-5 ${color}`} />
      </div>

      <div className="flex-1 min-w-0">
        <Link href={link}>
          <div className="cursor-pointer group">
            <div className="flex items-center gap-2 mb-1">
              <Avatar className="w-6 h-6">
                <AvatarImage src={notification.actorAvatar} />
                <AvatarFallback className="text-xs">
                  {notification.actorName?.charAt(0).toUpperCase() || "?"}
                </AvatarFallback>
              </Avatar>
              <span className="text-sm font-medium text-slate-900 dark:text-slate-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400">
                {notification.actorName}
              </span>
            </div>
            <p className="text-sm text-slate-700 dark:text-slate-200 mb-1 group-hover:text-indigo-600 dark:group-hover:text-indigo-400">
              {message}
            </p>
            {notification.paperTitle && (
              <p className="text-sm text-slate-500 dark:text-slate-400 truncate mb-1">
                Paper: {notification.paperTitle}
              </p>
            )}
            {notification.targetTitle && notification.type !== "follow" && (
              <p className="text-xs text-slate-400 dark:text-slate-500 truncate italic">
                "{notification.targetTitle}"
              </p>
            )}
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-2">
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
            className="h-8 w-8 text-slate-400 hover:text-indigo-600"
            onClick={() => onMarkRead(notification.id)}
            title="Mark as read"
          >
            <Check className="w-4 h-4" />
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-slate-400 hover:text-red-600"
          onClick={() => onDelete(notification.id)}
          title="Delete"
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}

export default function Notifications() {
  const { user, isLoading: authLoading } = useAuth();
  const [, navigate] = useLocation();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const [total, setTotal] = useState(0);

  // Redirect if not logged in
  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/login");
    }
  }, [authLoading, user, navigate]);

  // Fetch notifications
  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const { notifications: notifs, unreadCount: count, total: totalCount } = await api.getNotifications({ limit: 100 });
      setNotifications(notifs);
      setUnreadCount(count);
      setTotal(totalCount);
    } catch (error) {
      console.error("Failed to fetch notifications:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) {
      fetchNotifications();
    }
  }, [user, fetchNotifications]);

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
      setTotal((prev) => prev - 1);
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
      setTotal(0);
    } catch (error) {
      console.error("Failed to clear notifications:", error);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-100 via-purple-100 to-pink-100 dark:from-slate-950 dark:via-indigo-950/40 dark:to-purple-950/40">
      <div className="container max-w-3xl py-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/">
              <ArrowLeft className="w-5 h-5" />
            </Link>
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Bell className="w-6 h-6 text-indigo-500" />
              Notifications
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {total} total • {unreadCount} unread
            </p>
          </div>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <Button variant="outline" size="sm" onClick={handleMarkAllRead}>
                <CheckCheck className="w-4 h-4 mr-2" />
                Mark all read
              </Button>
            )}
            {notifications.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                onClick={handleClearAll}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Clear all
              </Button>
            )}
          </div>
        </div>

        {/* Notifications List */}
        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-6 space-y-4">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="flex items-start gap-4">
                    <Skeleton className="w-10 h-10 rounded-full" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-1/3" />
                      <Skeleton className="h-4 w-2/3" />
                      <Skeleton className="h-3 w-1/4" />
                    </div>
                  </div>
                ))}
              </div>
            ) : notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-20 h-20 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4">
                  <Bell className="w-10 h-10 text-slate-300 dark:text-slate-600" />
                </div>
                <h3 className="text-lg font-medium text-slate-700 dark:text-slate-300 mb-2">
                  No notifications yet
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm">
                  When someone follows you, likes your content, or interacts with your papers, you'll see notifications here.
                </p>
              </div>
            ) : (
              <div className="p-4 space-y-3">
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
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
