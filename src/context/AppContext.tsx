import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Profile, ClassGroup, NotificationItem } from '../types';
import { appStore } from '../services/store';
import { supabaseService } from '../services/supabaseService';
import { isSupabaseConfigured } from '../lib/supabase';

export type AppMode = 'production' | 'demo';

interface AppContextType {
  currentUser: Profile | null;
  activeClass: ClassGroup | null;
  classes: ClassGroup[];
  notifications: NotificationItem[];
  unreadNotificationCount: number;
  isConfigured: boolean;
  activeMode: AppMode;
  productionError: string | null;
  isLoading: boolean;
  setActiveMode: (mode: AppMode) => void;
  clearProductionError: () => void;
  setActiveClassId: (id: string | null) => void;
  switchUser: (userId: string) => void;
  login: (email: string, password?: string) => Promise<boolean>;
  logout: () => Promise<void>;
  refreshData: () => Promise<void>;
  markNotificationRead: (id: string) => Promise<void>;
  markAllNotificationsRead: () => Promise<void>;
  resetDemoData: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Stored active mode preference: if configured, default to production, otherwise demo
  const initialMode: AppMode = (() => {
    const saved = localStorage.getItem('mentorpulse_mode_v1');
    if (saved === 'production' && isSupabaseConfigured) return 'production';
    if (saved === 'demo') return 'demo';
    return isSupabaseConfigured ? 'production' : 'demo';
  })();

  const [activeMode, setActiveModeState] = useState<AppMode>(initialMode);
  const [productionError, setProductionError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const [currentUser, setCurrentUser] = useState<Profile | null>(() => {
    if (initialMode === 'demo') {
      return appStore.getCurrentUser();
    }
    return null;
  });

  const [classes, setClasses] = useState<ClassGroup[]>([]);
  const [activeClass, setActiveClass] = useState<ClassGroup | null>(null);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  const setActiveMode = (newMode: AppMode) => {
    if (newMode === 'production' && !isSupabaseConfigured) {
      setProductionError(
        'Cannot switch to Production Mode: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are not configured in your .env file.'
      );
      return;
    }
    setActiveModeState(newMode);
    localStorage.setItem('mentorpulse_mode_v1', newMode);
    setProductionError(null);
  };

  const clearProductionError = () => {
    setProductionError(null);
  };

  // --- Core Refresh Logic ---
  const refreshData = async () => {
    setIsLoading(true);

    if (activeMode === 'demo') {
      // Demo Mode: Synchronous Local Storage store
      try {
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
      } catch (err: any) {
        console.error('Demo store refresh error:', err);
      } finally {
        setIsLoading(false);
      }
      return;
    }

    // Production Mode: Remote Supabase Backend
    try {
      setProductionError(null);
      const user = await supabaseService.getCurrentSessionUser();
      setCurrentUser(user);

      if (user) {
        if (user.role === 'mentor') {
          const mentorClasses = await supabaseService.getClassesForMentor(user.id);
          setClasses(mentorClasses);

          const currentActiveId = appStore.getSelectedClassId();
          const active = mentorClasses.find(c => c.id === currentActiveId) || mentorClasses[0] || null;
          setActiveClass(active);
          if (active && active.id !== currentActiveId) {
            appStore.setSelectedClassId(active.id);
          }
        } else {
          const studentClasses = await supabaseService.getClassesForStudent(user.id);
          setClasses(studentClasses);

          const currentActiveId = appStore.getSelectedClassId();
          const active = studentClasses.find(c => c.id === currentActiveId) || studentClasses[0] || null;
          setActiveClass(active);
        }

        const notifs = await supabaseService.getNotifications(user.id);
        setNotifications(notifs);
      } else {
        setClasses([]);
        setActiveClass(null);
        setNotifications([]);
      }
    } catch (err: any) {
      // DO NOT silently fall back to mock data! Report genuine production error.
      console.error('Production Supabase query failed:', err);
      setProductionError(`Supabase Database Error: ${err.message || 'Failed to sync with remote PostgreSQL.'}`);
      setClasses([]);
      setActiveClass(null);
      setNotifications([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refreshData();
  }, [activeMode]);

  const setActiveClassId = (id: string | null) => {
    appStore.setSelectedClassId(id);
    if (!id) {
      setActiveClass(null);
    } else {
      const found = classes.find(c => c.id === id) || (activeMode === 'demo' ? appStore.getClassById(id) : null);
      setActiveClass(found);
    }
  };

  const switchUser = (userId: string) => {
    if (activeMode === 'production') {
      alert('1-Click Persona switching is only available in Demo Mode. To test live users in Production, sign in with their Supabase account credentials.');
      return;
    }
    const user = appStore.setCurrentUser(userId);
    if (user) {
      refreshData();
    }
  };

  const login = async (email: string, password?: string): Promise<boolean> => {
    if (activeMode === 'production') {
      try {
        if (!password) {
          throw new Error('Password is required in Production Mode.');
        }
        await supabaseService.signIn(email, password);
        await refreshData();
        return true;
      } catch (err: any) {
        setProductionError(`Sign In Failed: ${err.message}`);
        return false;
      }
    }

    // Demo Mode: Mock Login by institutional email
    const user = appStore.loginUser(email);
    if (user) {
      refreshData();
      return true;
    }
    return false;
  };

  const logout = async () => {
    if (activeMode === 'production') {
      try {
        await supabaseService.signOut();
      } catch (err: any) {
        console.warn('Sign out warning:', err);
      }
    } else {
      appStore.setCurrentUser('');
    }
    setCurrentUser(null);
    setActiveClass(null);
    setClasses([]);
    setNotifications([]);
  };

  const markNotificationRead = async (id: string) => {
    if (activeMode === 'production') {
      try {
        await supabaseService.markNotificationRead(id);
        if (currentUser) {
          const updated = await supabaseService.getNotifications(currentUser.id);
          setNotifications(updated);
        }
      } catch (err: any) {
        setProductionError(err.message);
      }
    } else {
      appStore.markNotificationAsRead(id);
      if (currentUser) {
        setNotifications(appStore.getNotificationsForUser(currentUser.id));
      }
    }
  };

  const markAllNotificationsRead = async () => {
    if (currentUser) {
      if (activeMode === 'production') {
        try {
          await supabaseService.markAllNotificationsRead(currentUser.id);
          setNotifications(prev => prev.map(n => ({ ...n, read: true })));
        } catch (err: any) {
          setProductionError(err.message);
        }
      } else {
        appStore.markAllNotificationsAsRead(currentUser.id);
        setNotifications(appStore.getNotificationsForUser(currentUser.id));
      }
    }
  };

  const resetDemoData = () => {
    if (activeMode === 'production') {
      alert('Reset Seed Data is only available in Demo Mode. Production PostgreSQL data must be managed via SQL migrations or the Supabase dashboard.');
      return;
    }
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
        isConfigured: isSupabaseConfigured,
        activeMode,
        productionError,
        isLoading,
        setActiveMode,
        clearProductionError,
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
