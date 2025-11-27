import React from 'react';
import {
  Box,
  Flex,
  Heading,
  HStack,
  Spacer,
  Button,
  Link as ChakraLink,
  IconButton,
  useToast,
  Badge,
} from '@chakra-ui/react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { BellIcon } from '@chakra-ui/icons';
import { useAuth } from '../../contexts/AuthContext';
import { useSocket } from '../../contexts/SocketContext';
import type { Notification } from '../../types';
import { useEffect, useState } from 'react';

const MainLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const socket = useSocket();
  const toast = useToast();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!socket) return;

    const handler = (notification: Notification) => {
      setUnreadCount((c) => c + 1);
      toast({
        title: notification.title,
        description: notification.message,
        status: 'info',
        duration: 5000,
        isClosable: true,
      });
    };

    socket.on('notification:new', handler);

    return () => {
      socket.off('notification:new', handler);
    };
  }, [socket, toast]);

  const clearNotifications = () => {
    setUnreadCount(0);
    navigate('/notifications');
  };

  return (
    <Box minH="100vh" bg="gray.50">
      <Flex
        as="header"
        bg="white"
        px={6}
        py={4}
        align="center"
        boxShadow="sm"
        position="sticky"
        top={0}
        zIndex={10}
      >
        <Heading size="md">Contas Compartilhadas</Heading>
        <HStack spacing={4} ml={8} as="nav">
          <ChakraLink
            as={Link}
            to="/"
            fontWeight={location.pathname === '/' ? 'bold' : 'normal'}
          >
            Dashboard
          </ChakraLink>
          <ChakraLink
            as={Link}
            to="/groups"
            fontWeight={location.pathname.startsWith('/groups') ? 'bold' : 'normal'}
          >
            Grupos
          </ChakraLink>
          <ChakraLink
            as={Link}
            to="/history"
            fontWeight={location.pathname === '/history' ? 'bold' : 'normal'}
          >
            Histórico
          </ChakraLink>
        </HStack>
        <Spacer />
        <HStack spacing={3} align="center">
          <IconButton
            aria-label="Notificações"
            icon={
              <Box position="relative">
                <BellIcon />
                {unreadCount > 0 && (
                  <Badge
                    position="absolute"
                    top="-1"
                    right="-1"
                    colorScheme="red"
                    borderRadius="full"
                  >
                    {unreadCount}
                  </Badge>
                )}
              </Box>
            }
            variant="ghost"
            onClick={clearNotifications}
          />
          <Box fontSize="sm" color="gray.600">
            {user?.name}
          </Box>
          <Button size="sm" variant="outline" onClick={logout}>
            Sair
          </Button>
        </HStack>
      </Flex>

      <Box maxW="1200px" mx="auto" p={6}>
        {children}
      </Box>
    </Box>
  );
};

export default MainLayout;
