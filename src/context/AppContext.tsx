import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Profile, ClassGroup, NotificationItem } from '../types';
import { appStore } from '../services/store';
import { isSupabaseConfigured } from '../lib/supabase';

interface AppContextType {
  currentUser: Profile | null;
  activeClass: ClassGroup | null;
  classes: ClassGroup[];
  notifications: NotificationItem[];
  unreadNotificationCount: number;
  isSupabaseMode: boolean;
  setActiveClassId: (id: string | null) => void;
  switchUser: (userId: string) => void;
  login: (email: string) => boolean;
  logout: () => void;
  refreshData: () => void;
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;
  resetDemoData: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<Profile | null>(appStore.getCurrentUser());
  const [classes, setClasses] = useState<ClassGroup[]>([]);
  const [activeClass, setActiveClass] = useState<ClassGroup | null>(null);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  const refreshData = () => {
    const user = appStore.getCurrentUser();
    setCurrentUser(user);

    if (user) {
      if (user.role === 'mentor') {
        const mentorClasses = appStore.getClassesForMentor(user.id);
        setClasses(mentorClasses);

        const currentActiveId = appStore.getSelectedClassId();
        const active = mentorClasses.find(c => c.id === currentActiveId) || mentorClasses[0] || null;
        setActiveClass(active);
        if (active && active.id !== currentActiveId) {
          appStore.setSelectedClassId(active.id);
        }
      } else {
        const studentEnrollments = appStore.getEnrollmentsForStudent(user.id);
        const studentClasses = studentEnrollments.map(e => e.class).filter(Boolean);
        setClasses(studentClasses);

        const currentActiveId = appStore.getSelectedClassId();
        const active = studentClasses.find(c => c.id === currentActiveId) || studentClasses[0] || null;
        setActiveClass(active);
      }

      setNotifications(appStore.getNotificationsForUser(user.id));
    } else {
      setClasses([]);
      setActiveClass(null);
      setNotifications([]);
    }
  };

  useEffect(() => {
    refreshData();
  }, []);

  const setActiveClassId = (id: string | null) => {
    appStore.setSelectedClassId(id);
    if (!id) {
      setActiveClass(null);
    } else {
      const found = classes.find(c => c.id === id) || appStore.getClassById(id);
      setActiveClass(found);
    }
  };

  const switchUser = (userId: string) => {
    const user = appStore.setCurrentUser(userId);
    if (user) {
      refreshData();
    }
  };

  const login = (email: string): boolean => {
    const user = appStore.loginUser(email);
    if (user) {
      refreshData();
      return true;
    }
    return false;
  };

  const logout = () => {
    // For demo/session, switch to empty or default
    appStore.setCurrentUser('');
    setCurrentUser(null);
    setActiveClass(null);
    setClasses([]);
    setNotifications([]);
  };

  const markNotificationRead = (id: string) => {
    appStore.markNotificationAsRead(id);
    if (currentUser) {
      setNotifications(appStore.getNotificationsForUser(currentUser.id));
    }
  };

  const markAllNotificationsRead = () => {
    if (currentUser) {
      appStore.markAllNotificationsAsRead(currentUser.id);
      setNotifications(appStore.getNotificationsForUser(currentUser.id));
    }
  };

  const resetDemoData = () => {
    appStore.resetToSeedData();
    refreshData();
  };

  const unreadNotificationCount = notifications.filter(n => !n.read).length;

  return (
    <AppContext.Provider
      value={{
        currentUser,
        activeClass,
        classes,
        notifications,
        unreadNotificationCount,
        isSupabaseMode: isSupabaseConfigured,
        setActiveClassId,
        switchUser,
        login,
        logout,
        refreshData,
        markNotificationRead,
        markAllNotificationsRead,
        resetDemoData,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = (): AppContextType => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
