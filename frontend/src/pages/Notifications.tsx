import {
  Box,
  Button,
  Heading,
  Text,
  VStack,
  HStack,
  Badge,
} from '@chakra-ui/react';
import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '../api/client';
import type { Notification } from '../types';

const NotificationsPage = () => {
  const queryClient = useQueryClient();
  const [notifications, setNotifications] = useState<Notification[] | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const fetchNotifications = async () => {
      try {
        const response = await apiClient.get<Notification[]>('/notifications');
        if (!isMounted) return;
        setNotifications(response.data);
      } catch (err: any) {
        if (!isMounted) return;
        setError(
          err?.response?.data?.message || err.message || 'Erro ao carregar notificações',
        );
      } finally {
        if (!isMounted) return;
        setIsLoading(false);
      }
    };

    fetchNotifications();

    return () => {
      isMounted = false;
    };
  }, []);

  const markOne = useMutation({
    mutationFn: async (id: string) => {
      await apiClient.patch(`/notifications/${id}/read`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const markAll = useMutation({
    mutationFn: async () => {
      await apiClient.patch('/notifications/read-all');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  return (
    <VStack align="stretch" spacing={4}>
      <HStack justify="space-between" align="center">
        <Heading size="lg">Notificações</Heading>
        {!isLoading && !error && notifications && notifications.some((n) => !n.read) && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => markAll.mutate()}
            isLoading={markAll.isPending}
          >
            Marcar todas como lidas
          </Button>
        )}
      </HStack>

      <Box bg="white" borderRadius="md" boxShadow="sm" p={4}>
        {isLoading ? (
          <Text fontSize="sm" color="gray.500">
            Carregando notificações...
          </Text>
        ) : error ? (
          <Text fontSize="sm" color="red.500">
            {error}
          </Text>
        ) : notifications && notifications.length > 0 ? (
          <VStack align="stretch" spacing={3}>
            {notifications.map((n) => (
              <Box
                key={n.id}
                borderRadius="md"
                borderWidth="1px"
                borderColor={n.read ? 'gray.100' : 'blue.200'}
                p={3}
                bg={n.read ? 'white' : 'blue.50'}
              >
                <HStack justify="space-between" mb={1}>
                  <Text fontWeight="semibold" fontSize="sm">
                    {n.title}
                  </Text>
                  {!n.read && <Badge colorScheme="blue">Nova</Badge>}
                </HStack>
                <Text fontSize="sm" mb={1}>
                  {n.message}
                </Text>
                <HStack justify="space-between" fontSize="xs" color="gray.500">
                  <Text>{new Date(n.createdAt).toLocaleString('pt-BR')}</Text>
                  {!n.read && (
                    <Button
                      size="xs"
                      variant="link"
                      colorScheme="blue"
                      onClick={() => markOne.mutate(n.id)}
                      isLoading={markOne.isPending}
                    >
                      Marcar como lida
                    </Button>
                  )}
                </HStack>
              </Box>
            ))}
          </VStack>
        ) : (
          <Text fontSize="sm" color="gray.500">
            Nenhuma notificação.
          </Text>
        )}
      </Box>
    </VStack>
  );
};

export default NotificationsPage;
