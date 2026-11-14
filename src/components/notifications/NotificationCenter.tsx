import React, { useState, useEffect, useRef } from 'react';
import {
  Bell,
  Check,
  CheckCheck,
  Calendar,
  Heart,
  ShieldCheck,
  MessageSquare,
  Award,
  Info,
  Clock,
  X,
} from 'lucide-react';
import { notificationService } from '../../services/notificationService';
import type { NotificationCategory, NotificationItem } from '@aashvo/contracts';
import { useApp } from '../../context/AppContext';

export const NotificationCenter: React.FC = () => {
  const { currentUser, openConnectModal, setIsRentalTrustOpen } = useApp();
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const fetchUnreadCount = async () => {
    if (!currentUser) {
      setUnreadCount(0);
      return;
    }
    try {
      const res = await notificationService.getUnreadCount();
      setUnreadCount(res.unreadCount || 0);
    } catch {
      // In demo or offline mode, preserve local count
    }
  };

  const fetchNotifications = async () => {
    if (!currentUser) return;
    setLoading(true);
    try {
      const cat = selectedCategory === 'all' ? undefined : (selectedCategory as NotificationCategory);
      const res = await notificationService.getNotifications(cat, false, 25);
      setNotifications(res.items || []);
      setUnreadCount(res.unreadCount || 0);
    } catch {
      // Fallback notifications if offline/unreachable
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 30000); // 30s polling
    return () => clearInterval(interval);
  }, [currentUser]);

  useEffect(() => {
    if (isOpen) {
      fetchNotifications();
    }
  }, [isOpen, selectedCategory]);

  // Click outside listener to dismiss
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const handleMarkAsRead = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await notificationService.markAsRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n)),
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch {
      // Optimistic update
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n)),
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await notificationService.markAllAsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch {
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
    }
  };

  const handleNotificationClick = (item: NotificationItem) => {
    if (!item.read) {
      handleMarkAsRead(item.id, { stopPropagation: () => {} } as React.MouseEvent);
    }
    setIsOpen(false);

    // Deep-link based on category
    if (item.category === 'connect_match' || item.category === 'connect_message') {
      openConnectModal();
    } else if (
      item.category === 'agreement_update' ||
      item.category === 'inspection_update' ||
      item.category === 'property_verification'
    ) {
      setIsRentalTrustOpen(true);
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'visit_request':
      case 'visit_update':
        return <Calendar className="w-4 h-4 text-emerald-600" />;
      case 'connect_match':
      case 'connect_message':
        return <Heart className="w-4 h-4 text-rose-500" />;
      case 'agreement_update':
      case 'inspection_update':
        return <ShieldCheck className="w-4 h-4 text-forest-700" />;
      case 'property_verification':
        return <Award className="w-4 h-4 text-amber-600" />;
      case 'property_inquiry':
        return <MessageSquare className="w-4 h-4 text-blue-600" />;
      default:
        return <Info className="w-4 h-4 text-charcoal-500" />;
    }
  };

  const categories = [
    { id: 'all', label: 'All' },
    { id: 'visits', label: 'Visits' },
    { id: 'matches', label: 'Matches' },
    { id: 'inquiries', label: 'Inquiries' },
    { id: 'trust', label: 'Trust' },
  ];

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-full text-charcoal-600 hover:text-forest-800 hover:bg-ivory-300/70 transition-all focus:outline-none"
        title="Notifications"
        aria-label="Open notifications"
      >
        <Bell className="w-5 h-5 text-forest-800" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold text-white bg-rose-600 rounded-full border-2 border-[#F5F3ED] shadow-sm animate-pulse">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Popover Dropdown */}
      {isOpen && (
        <div className="absolute right-0 mt-3 w-80 sm:w-96 bg-white rounded-2xl shadow-xl border border-charcoal-200/80 z-50 overflow-hidden animate-in fade-in slide-in-from-top-3 duration-200">
          {/* Header */}
          <div className="p-4 bg-[#F5F3ED]/80 border-b border-charcoal-200/60 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <h3 className="font-serif font-bold text-base text-forest-900">Notifications</h3>
              {unreadCount > 0 && (
                <span className="text-[11px] font-semibold bg-forest-800 text-white px-2 py-0.5 rounded-full">
                  {unreadCount} unread
                </span>
              )}
            </div>
            <div className="flex items-center space-x-2">
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  className="text-xs font-semibold text-forest-700 hover:text-forest-900 flex items-center space-x-1 px-2 py-1 rounded-md hover:bg-forest-50 transition-colors"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  <span>Mark all read</span>
                </button>
              )}
              <button
                onClick={() => setIsOpen(false)}
                className="text-charcoal-400 hover:text-charcoal-600 p-1 rounded-md"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Category Filter Chips */}
          <div className="flex items-center space-x-1.5 px-3 py-2 bg-charcoal-50/50 border-b border-charcoal-100 overflow-x-auto text-xs">
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-2.5 py-1 rounded-full whitespace-nowrap transition-all font-medium ${
                  selectedCategory === cat.id
                    ? 'bg-forest-800 text-white shadow-xs'
                    : 'bg-white text-charcoal-600 hover:bg-charcoal-100 border border-charcoal-200/60'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Notification List */}
          <div className="max-h-96 overflow-y-auto divide-y divide-charcoal-100">
            {loading ? (
              <div className="py-12 text-center text-xs text-charcoal-400">Loading notifications...</div>
            ) : notifications.length === 0 ? (
              <div className="py-12 px-6 text-center">
                <div className="w-10 h-10 rounded-full bg-forest-50 text-forest-600 mx-auto flex items-center justify-center mb-2">
                  <Bell className="w-5 h-5 opacity-60" />
                </div>
                <p className="text-sm font-semibold text-charcoal-700">All caught up!</p>
                <p className="text-xs text-charcoal-400 mt-1">
                  You have no notifications in this category.
                </p>
              </div>
            ) : (
              notifications.map((item) => (
                <div
                  key={item.id}
                  onClick={() => handleNotificationClick(item)}
                  className={`p-3.5 transition-colors cursor-pointer flex items-start space-x-3 text-left ${
                    item.read ? 'bg-white hover:bg-ivory-50/70' : 'bg-forest-50/30 hover:bg-forest-50/60'
                  }`}
                >
                  {/* Category Icon */}
                  <div className="mt-0.5 p-1.5 rounded-lg bg-white border border-charcoal-200/70 shadow-xs flex-shrink-0">
                    {getCategoryIcon(item.category)}
                  </div>

                  {/* Body */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className={`text-xs font-semibold truncate ${item.read ? 'text-charcoal-800' : 'text-forest-900 font-bold'}`}>
                        {item.title}
                      </p>
                      {!item.read && (
                        <span className="w-2 h-2 rounded-full bg-forest-600 ml-2 flex-shrink-0" />
                      )}
                    </div>
                    <p className="text-xs text-charcoal-600 mt-0.5 line-clamp-2 leading-relaxed">
                      {item.body}
                    </p>
                    <div className="flex items-center justify-between mt-2 pt-1 text-[11px] text-charcoal-400">
                      <span className="flex items-center space-x-1">
                        <Clock className="w-3 h-3" />
                        <span>{new Date(item.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
                      </span>
                      {!item.read && (
                        <button
                          onClick={(e) => handleMarkAsRead(item.id, e)}
                          className="text-forest-700 hover:text-forest-900 font-medium flex items-center space-x-0.5"
                          title="Mark as read"
                        >
                          <Check className="w-3 h-3" />
                          <span>Done</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
