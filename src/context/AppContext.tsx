import React, { createContext, useContext, useState, useEffect, ReactNode, useRef } from 'react';
import { Profile, ClassGroup, NotificationItem, DirectMessage } from '../types';
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
  unreadMessageCount: number;
  incomingToastMessage: DirectMessage | null;
  dismissIncomingToast: () => void;
  refreshUnreadMessageCount: () => Promise<void>;
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
  refreshData: (isBackground?: boolean) => Promise<void>;
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
  const [isAuthLoading, setIsAuthLoading] = useState<boolean>(() => {
    if (initialMode === 'demo') return false;
    const saved = localStorage.getItem('mentorpulse_auth_profile');
    return !saved;
  });
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

  const [classes, setClasses] = useState<ClassGroup[]>(() => {
    if (initialMode === 'demo') {
      const user = appStore.getCurrentUser();
      if (user) {
        return user.role === 'mentor'
          ? appStore.getClassesForMentor(user.id)
          : appStore.getEnrollmentsForStudent(user.id).filter(e => e.status === 'approved').map(e => e.class).filter(Boolean);
      }
      return [];
    }
    try {
      const saved = localStorage.getItem('mentorpulse_cached_classes');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [activeClass, setActiveClass] = useState<ClassGroup | null>(() => {
    if (initialMode === 'demo') {
      const user = appStore.getCurrentUser();
      if (user) {
        const cls = user.role === 'mentor'
          ? appStore.getClassesForMentor(user.id)
          : appStore.getEnrollmentsForStudent(user.id).filter(e => e.status === 'approved').map(e => e.class).filter(Boolean);
        const selId = appStore.getSelectedClassId();
        return cls.find(c => c.id === selId) || cls[0] || null;
      }
      return null;
    }
    try {
      const saved = localStorage.getItem('mentorpulse_cached_active_class');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadMessageCount, setUnreadMessageCount] = useState<number>(0);
  const [incomingToastMessage, setIncomingToastMessage] = useState<DirectMessage | null>(null);
  const toastTimeoutRef = useRef<any>(null);

  const dismissIncomingToast = () => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setIncomingToastMessage(null);
  };

  const triggerToast = (msg: DirectMessage) => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setIncomingToastMessage(msg);
    toastTimeoutRef.current = setTimeout(() => {
      setIncomingToastMessage(null);
    }, 7000);
  };

  const refreshUnreadMessageCount = async () => {
    if (!currentUser?.id) {
      setUnreadMessageCount(0);
      return;
    }
    try {
      if (activeMode === 'production') {
        const count = await supabaseService.getUnreadMessagesCount(currentUser.id);
        setUnreadMessageCount(count);
      } else {
        const count = appStore.getUnreadMessagesCount(currentUser.id);
        setUnreadMessageCount(count);
      }
    } catch (e) {
      console.warn('Failed refreshing unread message count:', e);
    }
  };

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
  const refreshData = async (isBackground = false) => {
    // Only show full loader if there is no current user data already rendered
    if (!isBackground && !currentUser) {
      setIsLoading(true);
    }

    if (activeMode === 'demo') {
      // Demo Mode: Synchronous Local Storage store
      try {
        const user = appStore.getCurrentUser();
        setCurrentUser(user);

        if (user) {
          if (user.role === 'mentor') {
            const mentorClasses = appStore.getClassesForMentor(user.id);
            setClasses(mentorClasses);
            try {
              localStorage.setItem('mentorpulse_cached_classes', JSON.stringify(mentorClasses));
            } catch {}

            const currentActiveId = appStore.getSelectedClassId();
            const active = mentorClasses.find(c => c.id === currentActiveId) || mentorClasses[0] || null;
            setActiveClass(active);
            if (active) {
              try {
                localStorage.setItem('mentorpulse_cached_active_class', JSON.stringify(active));
              } catch {}
              if (active.id !== currentActiveId) {
                appStore.setSelectedClassId(active.id);
              }
            }
          } else {
            const studentEnrollments = appStore.getEnrollmentsForStudent(user.id);
            const studentClasses = studentEnrollments
              .filter(e => e.status === 'approved')
              .map(e => e.class)
              .filter(Boolean);
            setClasses(studentClasses);
            try {
              localStorage.setItem('mentorpulse_cached_classes', JSON.stringify(studentClasses));
            } catch {}

            const currentActiveId = appStore.getSelectedClassId();
            const active = studentClasses.find(c => c.id === currentActiveId) || studentClasses[0] || null;
            setActiveClass(active);
            if (active) {
              try {
                localStorage.setItem('mentorpulse_cached_active_class', JSON.stringify(active));
              } catch {}
            }
          }

          setNotifications(appStore.getNotificationsForUser(user.id));
          setUnreadMessageCount(appStore.getUnreadMessagesCount(user.id));
        } else {
          setClasses([]);
          setActiveClass(null);
          setNotifications([]);
          setUnreadMessageCount(0);
        }
      } catch (err: any) {
        console.error('Demo store refresh error:', err);
      } finally {
        if (!isBackground) setIsLoading(false);
        setIsAuthLoading(false);
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
          try {
            localStorage.setItem('mentorpulse_cached_classes', JSON.stringify(mentorClasses));
          } catch {}

          const currentActiveId = appStore.getSelectedClassId();
          const active = mentorClasses.find(c => c.id === currentActiveId) || mentorClasses[0] || null;
          setActiveClass(active);
          if (active) {
            try {
              localStorage.setItem('mentorpulse_cached_active_class', JSON.stringify(active));
            } catch {}
            if (active.id !== currentActiveId) {
              appStore.setSelectedClassId(active.id);
            }
          }
        } else {
          const studentClasses = await supabaseService.getClassesForStudent(user.id);
          setClasses(studentClasses);
          try {
            localStorage.setItem('mentorpulse_cached_classes', JSON.stringify(studentClasses));
          } catch {}

          const currentActiveId = appStore.getSelectedClassId();
          const active = studentClasses.find(c => c.id === currentActiveId) || studentClasses[0] || null;
          setActiveClass(active);
          if (active) {
            try {
              localStorage.setItem('mentorpulse_cached_active_class', JSON.stringify(active));
            } catch {}
          }
        }

        const [notifs, unreadCount] = await Promise.all([
          supabaseService.getNotifications(user.id),
          supabaseService.getUnreadMessagesCount(user.id),
        ]);
        setNotifications(notifs);
        setUnreadMessageCount(unreadCount);
      } else {
        setClasses([]);
        setActiveClass(null);
        setNotifications([]);
        setUnreadMessageCount(0);
      }
    } catch (err: any) {
      // DO NOT silently fall back to mock data! Report genuine production error.
      console.error('Production Supabase query failed:', err);
      setProductionError(`Supabase Database Error: ${err.message || 'Failed to sync with remote PostgreSQL.'}`);
      setClasses([]);
      setActiveClass(null);
      setNotifications([]);
      setUnreadMessageCount(0);
    } finally {
      if (!isBackground) setIsLoading(false);
      setIsAuthLoading(false);
    }
  };

  const triggerEnrollmentUpdate = () => {
    setEnrollmentVersion((v) => v + 1);
    refreshData(true);
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
      refreshData(true);
    };
    window.addEventListener('mentorpulse:enrollment_update', handleEnrollmentEvent);

    // Cross-tab and cross-window sync
    let bc: BroadcastChannel | null = null;
    if (typeof BroadcastChannel !== 'undefined') {
      try {
        bc = new BroadcastChannel('mentorpulse_enrollment_bus');
        bc.onmessage = () => {
          setEnrollmentVersion((v) => v + 1);
          refreshData(true);
        };
      } catch {}
    }

    const handleStorageEvent = (e: StorageEvent) => {
      if (e.key === 'mentorpulse_cross_tab_enrollment') {
        setEnrollmentVersion((v) => v + 1);
        refreshData(true);
      }
    };
    window.addEventListener('storage', handleStorageEvent);

    // Message events in Demo Mode / Cross-tab
    const handleNewMessage = (e: any) => {
      const msg = e.detail as DirectMessage;
      if (currentUser?.id && msg && msg.recipient_id === currentUser.id) {
        setUnreadMessageCount((prev) => prev + 1);
        triggerToast(msg);
      }
    };
    window.addEventListener('mentorpulse:new_message', handleNewMessage);

    const handleMessagesRead = () => {
      refreshUnreadMessageCount();
    };
    window.addEventListener('mentorpulse:messages_read', handleMessagesRead);

    let msgBc: BroadcastChannel | null = null;
    if (typeof BroadcastChannel !== 'undefined') {
      try {
        msgBc = new BroadcastChannel('mentorpulse_messages_bus');
        msgBc.onmessage = (ev) => {
          if (ev.data?.type === 'NEW_MESSAGE' && ev.data.message?.recipient_id === currentUser?.id) {
            setUnreadMessageCount((prev) => prev + 1);
            triggerToast(ev.data.message);
          } else if (ev.data?.type === 'MESSAGES_READ') {
            refreshUnreadMessageCount();
          }
        };
      } catch {}
    }

    // 2. Realtime Subscriptions in Production Mode
    let authSubscription: any = null;
    let enrollmentChannel: any = null;
    let notifChannel: any = null;
    let unsubscribeUserMessages: (() => void) | null = null;

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

      // Realtime enrollment table changes (updates both student & faculty screens instantly without full reload)
      const channelId = `realtime_enrollments_${Date.now()}`;
      enrollmentChannel = supabase
        .channel(channelId)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'class_enrollments' },
          () => {
            setEnrollmentVersion((v) => v + 1);
            refreshData(true);
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

        // Realtime user messages subscription
        unsubscribeUserMessages = supabaseService.subscribeToUserMessages(
          currentUser.id,
          (newMsg) => {
            setUnreadMessageCount((prev) => prev + 1);
            triggerToast(newMsg);
          },
          () => {
            refreshUnreadMessageCount();
          }
        );
      }
    }

    return () => {
      window.removeEventListener('mentorpulse:enrollment_update', handleEnrollmentEvent);
      window.removeEventListener('storage', handleStorageEvent);
      window.removeEventListener('mentorpulse:new_message', handleNewMessage);
      window.removeEventListener('mentorpulse:messages_read', handleMessagesRead);
      if (bc) bc.close();
      if (msgBc) msgBc.close();
      if (authSubscription) authSubscription.unsubscribe();
      if (enrollmentChannel && supabase) supabase.removeChannel(enrollmentChannel);
      if (notifChannel && supabase) supabase.removeChannel(notifChannel);
      if (unsubscribeUserMessages) unsubscribeUserMessages();
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
    localStorage.removeItem('mentorpulse_cached_classes');
    localStorage.removeItem('mentorpulse_cached_active_class');
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
        unreadMessageCount,
        incomingToastMessage,
        dismissIncomingToast,
        refreshUnreadMessageCount,
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
