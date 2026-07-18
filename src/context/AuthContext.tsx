import React, { createContext, useContext, useEffect, useState } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '../supabase';
import { useNotification } from './NotificationContext';

export type UserRole = 'administrador' | 'tecnico';

export interface UserData {
  uid: string;
  email: string;
  nombre: string;
  rol: UserRole;
  telefono?: string;
  pais?: string;
  direccion?: string;
  jefe_inmediato?: string;
  area_trabajo?: string;
}

interface AuthContextType {
  user: User | null;
  userData: UserData | null;
  role: UserRole | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  refreshUserData: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { showAlert } = useNotification();
  const [user, setUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check active session on mount
    const fetchSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        await handleSession(session?.user || null);
      } catch (error) {
        console.error("Error getting session:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchSession();

    // Listen for auth changes
    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'TOKEN_REFRESHED') {
          await handleSession(session?.user || null);
        }
      }
    );

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  const handleSession = async (currentUser: User | null) => {
    setUser(currentUser);
    if (currentUser) {
      try {
        const { data, error } = await supabase
          .from('users')
          .select('*')
          .eq('id', currentUser.id)
          .single();

        if (error) {
          console.error("Error fetching user document from Supabase:", error);
          if (error.code === 'PGRST116') {
               const isDefaultAdmin = currentUser.email === 'jhan.rocker@gmail.com';
               const initialRole: UserRole = isDefaultAdmin ? 'administrador' : 'tecnico';
               const { data: newData, error: insertError } = await supabase
                .from('users')
                .upsert({
                   id: currentUser.id,
                   email: currentUser.email || '',
                   nombre: currentUser.user_metadata?.full_name || '',
                   rol: initialRole
                })
                .select()
                .single();
                
               if (!insertError && newData) {
                 setUserData({ uid: newData.id, ...newData });
                 setRole(newData.rol);
                 return;
               }
          }
          setRole(null);
          setUserData(null);
          return;
        }

        if (data) {
          let currentRole = data.rol as UserRole;
          
          // Si el usuario no tiene rol asignado por defecto
          if (!currentRole) {
            currentRole = currentUser.email === 'jhan.rocker@gmail.com' ? 'administrador' : 'tecnico';
            const { error: updateError } = await supabase
              .from('users')
              .update({ rol: currentRole })
              .eq('id', currentUser.id);
              
            if (!updateError) {
              data.rol = currentRole;
            }
          } else if (currentUser.email === 'jhan.rocker@gmail.com' && currentRole !== 'administrador') {
            // Auto-upgrade default admin if needed
            const { error: updateError } = await supabase
              .from('users')
              .update({ rol: 'administrador' })
              .eq('id', currentUser.id);
              
            if (!updateError) {
              currentRole = 'administrador';
              data.rol = 'administrador';
            }
          }
          
          setUserData({ uid: data.id, ...data });
          setRole(currentRole);
        }
      } catch (error) {
        console.error("Error handling user session:", error);
        setRole(null);
        setUserData(null);
      }
    } else {
      setRole(null);
      setUserData(null);
    }
  };

  const refreshUserData = async () => {
    if (user) {
      await handleSession(user);
    }
  };

  const signInWithGoogle = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
           redirectTo: window.location.origin + '/',
           queryParams: {
             prompt: 'select_account'
           }
        }
      });
      if (error) throw error;
    } catch (error: any) {
      console.error("Error signing in with Google", error);
      showAlert('Error al iniciar sesión: ' + (error.message || 'Error desconocido'), 'error');
    }
  };

  const logout = async () => {
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.error("Error signing out", error);
    }
  };

  return (
    <AuthContext.Provider value={{ user, userData, role, loading, signInWithGoogle, logout, refreshUserData }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
