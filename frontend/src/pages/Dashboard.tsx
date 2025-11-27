import {
  Box,
  Heading,
  SimpleGrid,
  Stat,
  StatLabel,
  StatNumber,
  Text,
  VStack,
  HStack,
  Select,
  Progress,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
} from '@chakra-ui/react';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import apiClient from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import type { Activity, DashboardSummary, CategorySummary, DashboardDebt, Group } from '../types';

const formatCurrencyBRL = (value: number): string => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value || 0);
};

const DashboardPage = () => {
  const now = new Date();
  const [month, setMonth] = useState<string>(String(now.getMonth() + 1));
  const [year, setYear] = useState<string>(String(now.getFullYear()));
  const currentYear = now.getFullYear();
  const [groupId, setGroupId] = useState<string | 'all'>('all');
  const [person, setPerson] = useState<'me' | string>('me');
  const [category, setCategory] = useState<string | 'all'>('all');

  const { user } = useAuth();

  const { data: groups } = useQuery<Group[]>({
    queryKey: ['groups'],
    queryFn: async () => {
      const response = await apiClient.get<Group[]>('/groups');
      return response.data;
    },
  });

  const { data: summary } = useQuery<DashboardSummary>({
    queryKey: ['dashboard-summary', month, year, groupId, person],
    queryFn: async () => {
      const params: any = { month, year };
      if (groupId !== 'all') params.groupId = groupId;
      if (person !== 'me') params.personId = person;
      const response = await apiClient.get<DashboardSummary>('/dashboard/summary', {
        params,
      });
      return response.data;
    },
  });

  const { data: debts } = useQuery<DashboardDebt[]>({
    queryKey: ['dashboard-debts', month, year, groupId, person, category],
    queryFn: async () => {
      const params: any = { month, year };
      if (groupId !== 'all') params.groupId = groupId;
      if (category !== 'all') params.category = category;
      // person === 'me' usa o default do backend (usuário logado)
      if (person !== 'me') {
        params.personId = person;
      }
      const response = await apiClient.get<DashboardDebt[]>('/dashboard/debts', {
        params,
      });
      return response.data;
    },
  });

  const { data: categories } = useQuery<CategorySummary[]>({
    queryKey: ['dashboard-categories', month, year, groupId, person],
    queryFn: async () => {
      const params: any = { month, year };
      if (groupId !== 'all') params.groupId = groupId;
      if (person !== 'me') params.personId = person;
      const response = await apiClient.get<CategorySummary[]>('/dashboard/categories', {
        params,
      });
      return response.data;
    },
  });

  const { data: history } = useQuery<Activity[]>({
    queryKey: ['dashboard-history', month, year],
    queryFn: async () => {
      const response = await apiClient.get<Activity[]>('/dashboard/history', {
        params: { month, year },
      });
      return response.data;
    },
  });

  const personOptions: { id: string; name: string }[] = [];
  if (groups) {
    const map = new Map<string, { id: string; name: string }>();
    groups.forEach((g) => {
      g.members.forEach((m) => {
        map.set(m.user.id, { id: m.user.id, name: m.user.name });
      });
    });
    map.forEach((value) => {
      personOptions.push(value);
    });
    personOptions.sort((a, b) => a.name.localeCompare(b.name));
  }

  const categoryOptions: string[] = [];
  if (debts) {
    const set = new Set<string>();
    debts.forEach((d) => {
      const cat = (d.category || '').trim();
      if (cat) {
        set.add(cat);
      }
    });
    categoryOptions.push(...Array.from(set.values()).sort());
  }

  return (
    <VStack align="stretch" spacing={6}>
      <Heading size="lg">Resumo geral</Heading>
      <HStack spacing={3} align="center" flexWrap="wrap">
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
      <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} spacing={4}>
        <Stat p={4} bg="white" borderRadius="md" boxShadow="sm">
          <StatLabel>Você deve</StatLabel>
          <StatNumber color="red.500">
            {formatCurrencyBRL(summary ? summary.totalToPay : 0)}
          </StatNumber>
        </Stat>
        <Stat p={4} bg="white" borderRadius="md" boxShadow="sm">
          <StatLabel>Você tem a receber</StatLabel>
          <StatNumber color="green.500">
            {formatCurrencyBRL(summary ? summary.totalToReceive : 0)}
          </StatNumber>
        </Stat>
        <Stat p={4} bg="white" borderRadius="md" boxShadow="sm">
          <StatLabel>Saldo líquido</StatLabel>
          <StatNumber color={summary && summary.netBalance >= 0 ? 'green.500' : 'red.500'}>
            {formatCurrencyBRL(summary ? summary.netBalance : 0)}
          </StatNumber>
        </Stat>
      </SimpleGrid>

      <Box>
        <Heading size="md" mb={3}>
          Suas dívidas no período
        </Heading>
        <Box bg="white" borderRadius="md" boxShadow="sm" p={4}>
          <HStack
            spacing={3}
            mb={3}
            align="stretch"
            flexWrap="wrap"
            flexDirection={{ base: 'column', md: 'row' }}
          >
            <Select
              maxW="220px"
              size="sm"
              value={groupId}
              onChange={(e) => setGroupId(e.target.value as 'all' | string)}
            >
              <option value="all">Todos os grupos</option>
              {groups?.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </Select>
            <Select
              maxW="220px"
              size="sm"
              value={person}
              onChange={(e) => setPerson(e.target.value as 'me' | string)}
            >
              <option value="me">{user ? `Você (${user.name})` : 'Você'}</option>
              {personOptions
                .filter((p) => !user || p.id !== user.id)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
            </Select>
            <Select
              maxW="220px"
              size="sm"
              value={category}
              onChange={(e) => setCategory(e.target.value as 'all' | string)}
            >
              <option value="all">Todas as categorias</option>
              {categoryOptions.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </HStack>

          {debts && debts.length > 0 ? (
            <Box overflowX="auto">
              <Table size="sm">
                <Thead>
                  <Tr>
                    <Th display={{ base: 'none', md: 'table-cell' }}>Grupo</Th>
                    <Th display={{ base: 'none', md: 'table-cell' }}>Ambiente</Th>
                    <Th>Título</Th>
                    <Th>Vencimento</Th>
                    <Th display={{ base: 'none', md: 'table-cell' }}>Categoria</Th>
                    <Th isNumeric>Sua parte</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {debts.map((d: DashboardDebt) => (
                    <Tr key={d.shareId}>
                      <Td display={{ base: 'none', md: 'table-cell' }}>{d.groupName}</Td>
                      <Td display={{ base: 'none', md: 'table-cell' }}>{d.environmentName}</Td>
                      <Td>{d.title}</Td>
                      <Td>{new Date(d.dueDate).toLocaleDateString('pt-BR')}</Td>
                      <Td display={{ base: 'none', md: 'table-cell' }}>{d.category || 'Sem categoria'}</Td>
                      <Td isNumeric>{formatCurrencyBRL(d.shareAmount)}</Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
            </Box>
          ) : (
            <Text fontSize="sm" color="gray.500">
              Nenhuma dívida pendente neste período.
            </Text>
          )}
        </Box>
      </Box>

      <Box>
        <Heading size="md" mb={3}>
          Últimas atividades
        </Heading>
        <Box bg="white" borderRadius="md" boxShadow="sm" p={4}>
          {history && history.length > 0 ? (
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
              Nenhuma atividade recente.
            </Text>
          )}
        </Box>
      </Box>

      <Box>
        <Heading size="md" mb={3}>
          O que você deve por categoria
        </Heading>
        <Box bg="white" borderRadius="md" boxShadow="sm" p={4}>
          {categories && categories.length > 0 ? (
            <VStack align="stretch" spacing={3}>
              {(() => {
                const max = Math.max(...categories.map((c) => c.amount));
                return categories.map((c) => (
                  <Box key={c.category}>
                    <HStack justify="space-between" mb={1}>
                      <Text fontSize="sm">{c.category}</Text>
                      <Text fontSize="xs" color="gray.600">
                        {formatCurrencyBRL(c.amount)}
                      </Text>
                    </HStack>
                    <Progress
                      size="xs"
                      borderRadius="full"
                      value={max > 0 ? (c.amount / max) * 100 : 0}
                      colorScheme="blue"
                    />
                  </Box>
                ));
              })()}
            </VStack>
          ) : (
            <Text fontSize="sm" color="gray.500">
              Nenhuma pendência por categoria neste período.
            </Text>
          )}
        </Box>
      </Box>
    </VStack>
  );
};

export default DashboardPage;
