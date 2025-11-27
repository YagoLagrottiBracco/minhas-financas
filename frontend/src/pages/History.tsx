import { Box, Heading, Text, VStack } from '@chakra-ui/react';
import { useEffect, useState } from 'react';
import apiClient from '../api/client';
import type { Activity } from '../types';

const HistoryPage = () => {
  const [history, setHistory] = useState<Activity[] | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const fetchHistory = async () => {
      try {
        const response = await apiClient.get<Activity[]>('/dashboard/history');
        if (!isMounted) return;
        setHistory(response.data);
      } catch (err: any) {
        if (!isMounted) return;
        setError(err?.response?.data?.message || err.message || 'Erro ao carregar histórico');
      } finally {
        if (!isMounted) return;
        setIsLoading(false);
      }
    };

    fetchHistory();

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <VStack align="stretch" spacing={4}>
      <Heading size="lg">Histórico</Heading>
      <Box bg="white" borderRadius="md" boxShadow="sm" p={4}>
        {isLoading ? (
          <Text fontSize="sm" color="gray.500">
            Carregando histórico...
          </Text>
        ) : error ? (
          <Text fontSize="sm" color="red.500">
            {error}
          </Text>
        ) : history && history.length > 0 ? (
          <VStack align="stretch" spacing={2}>
            {history.map((item) => (
              <Box key={item.id} borderBottom="1px" borderColor="gray.100" py={2}>
                <Text fontSize="sm">{item.description}</Text>
                <Text fontSize="xs" color="gray.500">
                  {new Date(item.createdAt).toLocaleString('pt-BR')}
                </Text>
              </Box>
            ))}
          </VStack>
        ) : (
          <Text fontSize="sm" color="gray.500">
            Nenhuma atividade registrada.
          </Text>
        )}
      </Box>
    </VStack>
  );
};

export default HistoryPage;
