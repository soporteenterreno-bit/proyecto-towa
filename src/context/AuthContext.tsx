import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { auth, db, googleProvider, handleFirestoreError, OperationType } from '../firebase';

export type UserRole = 'administrador' | 'coordinador' | 'tecnico';

interface UserData {
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
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        try {
          const userDocRef = doc(db, 'users', currentUser.uid);
          const userDoc = await getDoc(userDocRef);
          
          if (userDoc.exists()) {
            let data = userDoc.data() as Omit<UserData, 'uid'>;
            let currentRole = data.rol;
            
            // Auto-upgrade default admin if they were created as 'tecnico'
            if (currentUser.email === 'jhan.rocker@gmail.com' && currentRole !== 'administrador') {
              try {
                await updateDoc(userDocRef, { rol: 'administrador' });
                currentRole = 'administrador';
                data.rol = 'administrador';
              } catch (e) {
                console.error("Failed to auto-upgrade admin role", e);
              }
            }
            setUserData({ uid: currentUser.uid, ...data });
            setRole(currentRole);
          } else {
            // Create user document with default role "tecnico" (or "administrador" for default admin)
            const isDefaultAdmin = currentUser.email === 'jhan.rocker@gmail.com';
            const initialRole: UserRole = isDefaultAdmin ? 'administrador' : 'tecnico';
            
            const newUser: Omit<UserData, 'uid'> = {
              email: currentUser.email || '',
              nombre: currentUser.displayName || '',
              rol: initialRole,
            };
            await setDoc(userDocRef, { ...newUser, createdAt: new Date().toISOString() });
            setUserData({ uid: currentUser.uid, ...newUser });
            setRole(initialRole);
          }
        } catch (error) {
          console.error("Error fetching or creating user document:", error);
          alert("Hubo un problema al cargar tu perfil. Verifica tu conexión o contacta al administrador.");
          setRole(null);
          setUserData(null);
        } finally {
          setLoading(false);
        }
      } else {
        setRole(null);
        setUserData(null);
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const signInWithGoogle = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error: any) {
      if (error.code === 'auth/popup-closed-by-user' || error.code === 'auth/cancelled-popup-request') {
        console.log("El usuario cerró la ventana de inicio de sesión.");
        return;
      }
      
      console.error("Error signing in with Google", error);
      if (error.code === 'auth/unauthorized-domain') {
        alert('Error: Dominio no autorizado. Para que otros usuarios puedan iniciar sesión en la app compartida, debes agregar este dominio (' + window.location.hostname + ') a la lista de "Dominios autorizados" en la consola de Firebase (Authentication -> Settings -> Authorized domains).');
      } else {
        alert('Error al iniciar sesión: ' + (error.message || 'Error desconocido'));
      }
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Error signing out", error);
    }
  };

  return (
    <AuthContext.Provider value={{ user, userData, role, loading, signInWithGoogle, logout }}>
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
