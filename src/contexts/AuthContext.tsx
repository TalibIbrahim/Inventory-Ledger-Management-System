import React, { createContext, useContext, useState, useEffect } from 'react';
import bcrypt from 'bcryptjs';

interface AuthContextType {
  isAuthenticated: boolean;
  hasInitializedAuth: boolean;
  login: (password: string) => boolean;
  logout: () => void;
  setupInitialAuth: (password: string) => void;
  verifyPassword: (password: string) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const AUTH_HASH_KEY = 'axiom_erp_auth_hash_v1';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [hasInitializedAuth, setHasInitializedAuth] = useState(true);
  const [authHash, setAuthHash] = useState<string | null>(null);

  useEffect(() => {
    // Load hash on startup
    const storedHash = localStorage.getItem(AUTH_HASH_KEY);
    if (storedHash) {
      setAuthHash(storedHash);
      setHasInitializedAuth(true);
    } else {
      setHasInitializedAuth(false);
    }
  }, []);

  const login = (password: string) => {
    if (!authHash) return false;
    const isValid = bcrypt.compareSync(password, authHash);
    if (isValid) {
      setIsAuthenticated(true);
    }
    return isValid;
  };

  const logout = () => {
    setIsAuthenticated(false);
  };

  const setupInitialAuth = (password: string) => {
    const salt = bcrypt.genSaltSync(10);
    const hash = bcrypt.hashSync(password, salt);
    localStorage.setItem(AUTH_HASH_KEY, hash);
    setAuthHash(hash);
    setHasInitializedAuth(true);
    setIsAuthenticated(true);
  };

  const verifyPassword = (password: string) => {
    if (!authHash) return false;
    return bcrypt.compareSync(password, authHash);
  };

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        hasInitializedAuth,
        login,
        logout,
        setupInitialAuth,
        verifyPassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
