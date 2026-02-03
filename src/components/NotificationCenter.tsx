import React, { useState, useEffect } from 'react';
import { Bell, X, AlertTriangle, Info, CheckCircle, Package, Wallet } from 'lucide-react';
import { Product, UserProfile } from '../types';

export interface AppNotification {
    id: string;
    type: 'warning' | 'info' | 'success' | 'alert';
    title: string;
    message: string;
    read: boolean;
    date: Date;
    link?: string;
}

interface NotificationCenterProps {
    notifications: AppNotification[];
    onMarkAsRead: (id: string) => void;
    onClearAll: () => void;
}

const NotificationCenter: React.FC<NotificationCenterProps> = ({ notifications, onMarkAsRead, onClearAll }) => {
    const [isOpen, setIsOpen] = useState(false);

    // Sort: Unread first, then newest
    const sortedNotifications = [...notifications].sort((a, b) => {
        if (a.read === b.read) return b.date.getTime() - a.date.getTime();
        return a.read ? 1 : -1;
    });

    const unreadCount = notifications.filter(n => !n.read).length;

    return (
        <div className="relative z-50">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="relative p-2 rounded-full hover:bg-gray-100 transition-colors"
                aria-label="Notifications"
            >
                <Bell size={24} className={unreadCount > 0 ? "text-blue-600" : "text-gray-500"} />
                {unreadCount > 0 && (
                    <span className="absolute top-1 right-1 h-5 w-5 bg-red-500 text-white text-[10px] font-bold flex items-center justify-center rounded-full border-2 border-white shadow-sm">
                        {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                )}
            </button>

            {isOpen && (
                <>
                    <div
                        className="fixed inset-0 bg-transparent z-40"
                        onClick={() => setIsOpen(false)}
                    />
                    <div className="fixed top-[68px] left-2 right-2 sm:absolute sm:top-full sm:right-0 sm:left-auto sm:w-96 sm:mt-2 bg-white rounded-2xl shadow-xl border border-gray-100 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                        <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                            <h3 className="font-bold text-gray-800 flex items-center gap-2">
                                <Bell size={16} className="text-blue-600" /> Notifications
                            </h3>
                            {notifications.length > 0 && (
                                <button
                                    onClick={onClearAll}
                                    className="text-xs text-gray-400 hover:text-red-500 font-medium transition-colors"
                                >
                                    Tout effacer
                                </button>
                            )}
                        </div>

                        <div className="max-h-[60vh] overflow-y-auto">
                            {sortedNotifications.length === 0 ? (
                                <div className="p-8 text-center text-gray-400 flex flex-col items-center gap-2">
                                    <Bell size={32} className="opacity-20" />
                                    <p className="text-sm">Aucune notification pour le moment.</p>
                                </div>
                            ) : (
                                <div className="divide-y divide-gray-50">
                                    {sortedNotifications.map(notif => (
                                        <div
                                            key={notif.id}
                                            className={`p-4 hover:bg-gray-50 transition-colors flex gap-3 ${notif.read ? 'opacity-60 bg-gray-50/30' : 'bg-white'}`}
                                            onClick={() => onMarkAsRead(notif.id)}
                                        >
                                            <div className={`mt-1 h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0 ${notif.type === 'warning' ? 'bg-amber-100 text-amber-600' :
                                                notif.type === 'alert' ? 'bg-red-100 text-red-600' :
                                                    notif.type === 'success' ? 'bg-green-100 text-green-600' :
                                                        'bg-blue-100 text-blue-600'
                                                }`}>
                                                {notif.type === 'warning' && <AlertTriangle size={14} />}
                                                {notif.type === 'alert' && <Wallet size={14} />}
                                                {notif.type === 'success' && <CheckCircle size={14} />}
                                                {notif.title.includes('Stock') && <Package size={14} />}
                                                {(notif.type === 'info' && !notif.title.includes('Stock')) && <Info size={14} />}
                                            </div>

                                            <div className="flex-1 min-w-0">
                                                <div className="flex justify-between items-start mb-0.5">
                                                    <h4 className={`text-sm font-bold truncate pr-2 ${notif.read ? 'text-gray-600' : 'text-gray-900'}`}>
                                                        {notif.title}
                                                    </h4>
                                                    {!notif.read && (
                                                        <span className="h-2 w-2 rounded-full bg-blue-500 shrink-0 mt-1.5" />
                                                    )}
                                                </div>
                                                <p className="text-xs text-gray-500 leading-relaxed line-clamp-2">
                                                    {notif.message}
                                                </p>
                                                <p className="text-[10px] text-gray-400 mt-1.5 font-medium">
                                                    {new Intl.DateTimeFormat('fr-FR', {
                                                        day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
                                                    }).format(notif.date)}
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

export default NotificationCenter;
