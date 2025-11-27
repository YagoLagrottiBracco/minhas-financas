import React, { createContext, useContext, useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from './AuthContext';

const SocketContext = createContext<Socket | null>(null);

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const { isAuthenticated, user } = useAuth();

  useEffect(() => {
    if (!isAuthenticated || !user) {
      if (socket) {
        socket.disconnect();
        setSocket(null);
      }
      return;
    }

    const s = io(import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:4000');
    setSocket(s);

    s.on('connect', () => {
      // Sala específica do usuário para notificações
      s.emit('joinUser', user.id);
    });

    return () => {
      s.disconnect();
    };
  }, [isAuthenticated, user]);

  return <SocketContext.Provider value={socket}>{children}</SocketContext.Provider>;
};

export const useSocket = () => {
  const ctx = useContext(SocketContext);
  return ctx;
};
