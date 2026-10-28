import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Profile, ClassGroup, NotificationItem } from '../types';
import { appStore } from '../services/store';
import { supabaseService } from '../services/supabaseService';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

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
  isAuthLoading: boolean;
  enrollmentVersion: number;
  triggerEnrollmentUpdate: () => void;
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
  setSessionUser: (profile: Profile) => void;
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
  const [isAuthLoading, setIsAuthLoading] = useState<boolean>(true);
  const [enrollmentVersion, setEnrollmentVersion] = useState<number>(0);

  const [currentUser, setCurrentUser] = useState<Profile | null>(() => {
    if (initialMode === 'demo') {
      return appStore.getCurrentUser();
    }
    const saved = localStorage.getItem('mentorpulse_auth_profile');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return null;
      }
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
        localStorage.setItem('mentorpulse_auth_profile', JSON.stringify(user));
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
      setIsAuthLoading(false);
    }
  };

  const triggerEnrollmentUpdate = () => {
    setEnrollmentVersion((v) => v + 1);
    refreshData();
    try {
      localStorage.setItem('mentorpulse_cross_tab_enrollment', Date.now().toString());
      if (typeof BroadcastChannel !== 'undefined') {
        const bc = new BroadcastChannel('mentorpulse_enrollment_bus');
        bc.postMessage({ type: 'ENROLLMENT_UPDATE', time: Date.now() });
        bc.close();
      }
    } catch {}
  };

  useEffect(() => {
    refreshData();

    // 1. Listen for local / Demo Mode enrollment updates
    const handleEnrollmentEvent = () => {
      setEnrollmentVersion((v) => v + 1);
      refreshData();
    };
    window.addEventListener('mentorpulse:enrollment_update', handleEnrollmentEvent);

    // Cross-tab and cross-window sync
    let bc: BroadcastChannel | null = null;
    if (typeof BroadcastChannel !== 'undefined') {
      try {
        bc = new BroadcastChannel('mentorpulse_enrollment_bus');
        bc.onmessage = () => {
          setEnrollmentVersion((v) => v + 1);
          refreshData();
        };
      } catch {}
    }

    const handleStorageEvent = (e: StorageEvent) => {
      if (e.key === 'mentorpulse_cross_tab_enrollment') {
        setEnrollmentVersion((v) => v + 1);
        refreshData();
      }
    };
    window.addEventListener('storage', handleStorageEvent);

    // 2. Realtime Subscriptions in Production Mode
    let authSubscription: any = null;
    let enrollmentChannel: any = null;
    let notifChannel: any = null;

    if (activeMode === 'production' && supabase && isSupabaseConfigured) {
      // Auth state changes
      const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event: any, session: any) => {
        if (event === 'SIGNED_IN' || event === 'USER_UPDATED') {
          if (session?.user) {
            const profile = await supabaseService.getCurrentSessionUser();
            if (profile) {
              setCurrentUser(profile);
              localStorage.setItem('mentorpulse_auth_profile', JSON.stringify(profile));
            }
          }
        } else if (event === 'SIGNED_OUT') {
          setCurrentUser(null);
          localStorage.removeItem('mentorpulse_auth_profile');
        }
      });
      authSubscription = subscription;

      // Realtime enrollment table changes (updates both student & faculty screens instantly)
      const channelId = `realtime_enrollments_${Date.now()}`;
      enrollmentChannel = supabase
        .channel(channelId)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'class_enrollments' },
          () => {
            setEnrollmentVersion((v) => v + 1);
            refreshData();
          }
        )
        .subscribe();

      // Realtime notifications for logged-in user
      if (currentUser?.id) {
        const notifChannelId = `realtime_notifs_${currentUser.id}_${Date.now()}`;
        notifChannel = supabase
          .channel(notifChannelId)
          .on(
            'postgres_changes',
            {
              event: 'INSERT',
              schema: 'public',
              table: 'notifications',
              filter: `user_id=eq.${currentUser.id}`,
            },
            (payload) => {
              if (payload.new) {
                const newNotif = payload.new as NotificationItem;
                setNotifications((prev) => [newNotif, ...prev.filter((n) => n.id !== newNotif.id)]);
              }
            }
          )
          .subscribe();
      }
    }

    return () => {
      window.removeEventListener('mentorpulse:enrollment_update', handleEnrollmentEvent);
      window.removeEventListener('storage', handleStorageEvent);
      if (bc) bc.close();
      if (authSubscription) authSubscription.unsubscribe();
      if (enrollmentChannel && supabase) supabase.removeChannel(enrollmentChannel);
      if (notifChannel && supabase) supabase.removeChannel(notifChannel);
    };
  }, [activeMode, currentUser?.id]);

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

  const login = async (emailOrReg: string, password?: string): Promise<boolean> => {
    const clean = emailOrReg.trim();
    if (activeMode === 'production') {
      if (!password) {
        // Attempt student passwordless sign-in by Register Number or Email
        const student = await supabaseService.signInStudentFast(clean);
        localStorage.setItem('mentorpulse_auth_profile', JSON.stringify(student));
        setCurrentUser(student);
        await refreshData();
        return true;
      }

      // Faculty or password-based sign-in
      await supabaseService.signIn(clean, password);
      await refreshData();
      return true;
    }

    // Demo Mode: Mock Login by institutional email or reg no
    const cleanLower = clean.toLowerCase();
    const demoProfiles = appStore.getProfiles();
    const found = demoProfiles.find(
      p => p.email.toLowerCase() === cleanLower || p.student_reg_no?.toLowerCase() === cleanLower
    );
    if (found) {
      appStore.setCurrentUser(found.id);
      refreshData();
      return true;
    }

    const user = appStore.loginUser(clean);
    if (user) {
      refreshData();
      return true;
    }
    throw new Error(`No user record found for "${clean}". Please verify your credentials or register.`);
  };

  const logout = async () => {
    localStorage.removeItem('mentorpulse_auth_profile');
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

  const setSessionUser = (profile: Profile) => {
    setCurrentUser(profile);
    localStorage.setItem('mentorpulse_auth_profile', JSON.stringify(profile));
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
        isAuthLoading,
        enrollmentVersion,
        triggerEnrollmentUpdate,
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
        setSessionUser,
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
