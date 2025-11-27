import {
  Box,
  Button,
  FormControl,
  FormLabel,
  Heading,
  Input,
  Table,
  Tbody,
  Td,
  Th,
  Thead,
  Tr,
  VStack,
  Text,
  SimpleGrid,
  useToast,
  HStack,
  Select,
  Flex,
} from '@chakra-ui/react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import apiClient from '../api/client';
import type {
  Environment,
  Group,
  GroupMember,
  GroupMembersSummaryResponse,
  MemberBalanceSummary,
} from '../types';
import { useForm } from 'react-hook-form';
import { useAuth } from '../contexts/AuthContext';

const formatCurrencyBRL = (value: number): string => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value || 0);
};

interface MemberForm {
  email: string;
}

interface EnvironmentForm {
  name: string;
  description?: string;
}

const GroupDetailPage = () => {
  const { groupId } = useParams<{ groupId: string }>();
  const toast = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { user } = useAuth();

  const now = new Date();
  const [month, setMonth] = useState<string>(String(now.getMonth() + 1));
  const [year, setYear] = useState<string>(String(now.getFullYear()));
  const currentYear = now.getFullYear();

  const { data: groups } = useQuery<Group[]>({
    queryKey: ['groups'],
    queryFn: async () => {
      const response = await apiClient.get<Group[]>('/groups');
      return response.data;
    },
  });

  const group = groups?.find((g) => g.id === groupId);

  const { data: groupSummary } = useQuery<GroupMembersSummaryResponse>({
    queryKey: ['group-summary', groupId, month, year],
    queryFn: async () => {
      const response = await apiClient.get<GroupMembersSummaryResponse>(
        `/groups/${groupId}/summary`,
        {
          params: { month, year },
        },
      );
      return response.data;
    },
    enabled: !!groupId,
  });

  const { data: environments } = useQuery<Environment[]>({
    queryKey: ['environments', groupId],
    queryFn: async () => {
      const response = await apiClient.get<Environment[]>(`/groups/${groupId}/environments`);
      return response.data;
    },
    enabled: !!groupId,
  });

  const memberForm = useForm<MemberForm>();
  const envForm = useForm<EnvironmentForm>();

  const addMember = useMutation({
    mutationFn: async (data: MemberForm) => {
      const response = await apiClient.post<Group>(`/groups/${groupId}/members`, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['groups'] });
      memberForm.reset();
      toast({ title: 'Membro adicionado', status: 'success', duration: 3000, isClosable: true });
    },
  });

  const createEnvironment = useMutation({
    mutationFn: async (data: EnvironmentForm) => {
      const response = await apiClient.post<Environment>(
        `/groups/${groupId}/environments`,
        data,
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['environments', groupId] });
      envForm.reset();
      toast({ title: 'Ambiente criado', status: 'success', duration: 3000, isClosable: true });
    },
  });

  const archiveGroup = useMutation({
    mutationFn: async () => {
      const response = await apiClient.patch(`/groups/${groupId}/archive`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['groups'] });
      toast({
        title: 'Grupo arquivado',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
      navigate('/groups');
    },
    onError: (error: any) => {
      toast({
        title: 'Erro ao arquivar grupo',
        description: error?.response?.data?.message || error.message,
        status: 'error',
        duration: 4000,
        isClosable: true,
      });
    },
  });

  const leaveGroup = useMutation({
    mutationFn: async () => {
      const response = await apiClient.post(`/groups/${groupId}/leave`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['groups'] });
      toast({
        title: 'Você saiu do grupo',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
      navigate('/groups');
    },
    onError: (error: any) => {
      toast({
        title: 'Erro ao sair do grupo',
        description: error?.response?.data?.message || error.message,
        status: 'error',
        duration: 4000,
        isClosable: true,
      });
    },
  });

  const archiveEnvironment = useMutation({
    mutationFn: async (environmentId: string) => {
      const response = await apiClient.patch(
        `/groups/${groupId}/environments/${environmentId}/archive`,
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['environments', groupId] });
      toast({
        title: 'Ambiente arquivado',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Erro ao arquivar ambiente',
        description: error?.response?.data?.message || error.message,
        status: 'error',
        duration: 4000,
        isClosable: true,
      });
    },
  });

  if (!group) {
    return <Text>Carregando grupo...</Text>;
  }

  return (
    <VStack align="stretch" spacing={6}>
      <Flex justify="space-between" align="center">
        <Box>
          <Heading size="lg">{group.name}</Heading>
          {group.description && (
            <Text fontSize="sm" color="gray.600">
              {group.description}
            </Text>
          )}
        </Box>
        {user && (
          group.ownerId === user.id ? (
            <Button
              size="sm"
              colorScheme="red"
              variant="outline"
              onClick={() => {
                if (!window.confirm('Tem certeza que deseja arquivar este grupo?')) {
                  return;
                }
                archiveGroup.mutate();
              }}
              isLoading={archiveGroup.isPending}
            >
              Arquivar grupo
            </Button>
          ) : (
            <Button
              size="sm"
              colorScheme="orange"
              variant="outline"
              onClick={() => {
                if (!window.confirm('Tem certeza que deseja sair deste grupo?')) {
                  return;
                }
                leaveGroup.mutate();
              }}
              isLoading={leaveGroup.isPending}
            >
              Sair do grupo
            </Button>
          )
        )}
      </Flex>

      {groupSummary && (
        <Box bg="white" p={4} borderRadius="md" boxShadow="sm">
          <Heading size="sm" mb={3}>
            Resumo por membro no grupo
          </Heading>
          <HStack spacing={3} mb={3} align="center">
            <Select
              maxW="150px"
              size="sm"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
            >
              <option value="1">Janeiro</option>
              <option value="2">Fevereiro</option>
              <option value="3">Março</option>
              <option value="4">Abril</option>
              <option value="5">Maio</option>
              <option value="6">Junho</option>
              <option value="7">Julho</option>
              <option value="8">Agosto</option>
              <option value="9">Setembro</option>
              <option value="10">Outubro</option>
              <option value="11">Novembro</option>
              <option value="12">Dezembro</option>
            </Select>
            <Select
              maxW="120px"
              size="sm"
              value={year}
              onChange={(e) => setYear(e.target.value)}
            >
              <option value={String(currentYear - 1)}>{currentYear - 1}</option>
              <option value={String(currentYear)}>{currentYear}</option>
              <option value={String(currentYear + 1)}>{currentYear + 1}</option>
            </Select>
          </HStack>
          <Table size="sm">
            <Thead>
              <Tr>
                <Th>Membro</Th>
                <Th isNumeric>Deve (R$)</Th>
                <Th isNumeric>Tem a receber (R$)</Th>
                <Th isNumeric>Saldo (R$)</Th>
              </Tr>
            </Thead>
            <Tbody>
              {groupSummary.members.map((m: MemberBalanceSummary) => (
                <Tr key={m.userId}>
                  <Td>{m.user.name}</Td>
                  <Td isNumeric>{formatCurrencyBRL(m.totalToPay)}</Td>
                  <Td isNumeric>{formatCurrencyBRL(m.totalToReceive)}</Td>
                  <Td isNumeric color={m.netBalance >= 0 ? 'green.500' : 'red.500'}>
                    {formatCurrencyBRL(m.netBalance)}
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        </Box>
      )}

      <SimpleGrid columns={{ base: 1, md: 2 }} spacing={6} alignItems="flex-start">
        <Box bg="white" p={4} borderRadius="md" boxShadow="sm">
          <Heading size="sm" mb={3}>
            Membros
          </Heading>
          <Table size="sm">
            <Thead>
              <Tr>
                <Th>Nome</Th>
                <Th>E-mail</Th>
                <Th>Função</Th>
              </Tr>
            </Thead>
            <Tbody>
              {group.members.map((m: GroupMember) => (
                <Tr key={m.id}>
                  <Td>{m.user.name}</Td>
                  <Td>{m.user.email}</Td>
                  <Td>{m.role}</Td>
                </Tr>
              ))}
            </Tbody>
          </Table>

          <Box
            as="form"
            mt={4}
            onSubmit={memberForm.handleSubmit((data) => addMember.mutate(data))}
          >
            <FormControl isRequired>
              <FormLabel>Adicionar membro por e-mail</FormLabel>
              <Input
                type="email"
                placeholder="email@exemplo.com"
                {...memberForm.register('email', { required: true })}
              />
            </FormControl>
            <Button
              type="submit"
              size="sm"
              mt={2}
              colorScheme="blue"
              isLoading={addMember.isPending}
            >
              Adicionar
            </Button>
          </Box>
        </Box>

        <Box bg="white" p={4} borderRadius="md" boxShadow="sm">
          <Heading size="sm" mb={3}>
            Ambientes
          </Heading>

          <VStack align="stretch" spacing={2} mb={4}>
            {environments && environments.length > 0 ? (
              environments.map((env) => (
                <Box
                  as={Link}
                  to={`/groups/${group.id}/environments/${env.id}`}
                  key={env.id}
                  p={3}
                  borderRadius="md"
                  borderWidth="1px"
                  _hover={{ bg: 'gray.50' }}
                >
                  <Flex justify="space-between" align="center">
                    <Box>
                      <Heading size="xs">{env.name}</Heading>
                      {env.description && (
                        <Text fontSize="xs" color="gray.600">
                          {env.description}
                        </Text>
                      )}
                    </Box>
                    {user && group.ownerId === user.id && (
                      <Button
                        size="xs"
                        colorScheme="red"
                        variant="ghost"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          if (
                            !window.confirm('Tem certeza que deseja arquivar este ambiente?')
                          ) {
                            return;
                          }
                          archiveEnvironment.mutate(env.id);
                        }}
                        isLoading={archiveEnvironment.isPending}
                      >
                        Arquivar
                      </Button>
                    )}
                  </Flex>
                </Box>
              ))
            ) : (
              <Text fontSize="sm" color="gray.500">
                Nenhum ambiente ainda.
              </Text>
            )}
          </VStack>

          <Box
            as="form"
            onSubmit={envForm.handleSubmit((data) => createEnvironment.mutate(data))}
          >
            <FormControl isRequired>
              <FormLabel>Novo ambiente</FormLabel>
              <Input placeholder="Casa, Contas extras..." {...envForm.register('name')} />
            </FormControl>
            <FormControl mt={2}>
              <FormLabel>Descrição</FormLabel>
              <Input {...envForm.register('description')} />
            </FormControl>
            <Button
              type="submit"
              size="sm"
              mt={2}
              colorScheme="blue"
              isLoading={createEnvironment.isPending}
            >
              Criar ambiente
            </Button>
          </Box>
        </Box>
      </SimpleGrid>
    </VStack>
  );
};

export default GroupDetailPage;
