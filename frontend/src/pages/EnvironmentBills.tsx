import {
  Box,
  Button,
  FormControl,
  FormLabel,
  Heading,
  Input,
  NumberInput,
  NumberInputField,
  Select,
  Table,
  Tbody,
  Td,
  Th,
  Thead,
  Tr,
  VStack,
  Text,
  useToast,
  SimpleGrid,
  Badge,
  Checkbox,
  HStack,
  Tabs,
  TabList,
  TabPanels,
  Tab,
  TabPanel,
} from '@chakra-ui/react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import apiClient from '../api/client';
import type {
  Bill,
  Environment,
  Group,
  GroupMember,
  GroupMembersSummaryResponse,
  MemberBalanceSummary,
  RecurringBill,
  RecurringFrequency,
  Category,
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

interface BillForm {
  title: string;
  dueDate: string;
  totalAmount: number;
  installments: number;
  pixKey?: string;
  paymentLink?: string;
  attachmentUrl?: string;
  paymentMethod?: 'PIX' | 'CARTAO' | 'BOLETO' | 'DINHEIRO';
  ownerId: string;
  receiverId?: string;
  receiverName: string;
  isRecurring?: boolean;
  frequency?: RecurringFrequency;
  category?: string;
}

interface SharePayload {
  userId: string;
  percentage: number;
}

interface UpdateBillPayload {
  title?: string;
  dueDate?: string;
  totalAmount?: number;
  installments?: number;
  pixKey?: string;
  paymentLink?: string;
  attachmentUrl?: string;
  paymentMethod?: 'PIX' | 'CARTAO' | 'BOLETO' | 'DINHEIRO';
  ownerId?: string;
  receiverId?: string;
  receiverName?: string;
  isRecurring?: boolean;
  frequency?: RecurringFrequency;
  category?: string;
  shares?: SharePayload[];
}

const EnvironmentBillsPage = () => {
  const { groupId, environmentId } = useParams<{ groupId: string; environmentId: string }>();
  const toast = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const now = new Date();
  const [month, setMonth] = useState<string>(String(now.getMonth() + 1));
  const [year, setYear] = useState<string>(String(now.getFullYear()));
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [showAllPending, setShowAllPending] = useState<boolean>(true);
  const currentYear = now.getFullYear();

  const { data: groups } = useQuery<Group[]>({
    queryKey: ['groups'],
    queryFn: async () => {
      const response = await apiClient.get<Group[]>('/groups');
      return response.data;
    },
  });

  const { data: categories } = useQuery<Category[]>({
    queryKey: ['categories', groupId],
    queryFn: async () => {
      const response = await apiClient.get<Category[]>(`/groups/${groupId}/categories`);
      return response.data;
    },
    enabled: !!groupId,
  });
  const group = groups?.find((g) => g.id === groupId);

  const { data: environments } = useQuery<Environment[]>({
    queryKey: ['environments', groupId],
    queryFn: async () => {
      const response = await apiClient.get<Environment[]>(`/groups/${groupId}/environments`);
      return response.data;
    },
    enabled: !!groupId,
  });

  const createRecurring = useMutation({
    mutationFn: async (data: BillForm) => {
      if (!groupId || !environmentId) throw new Error('Grupo ou ambiente inválidos');

      const sharesArray = Object.entries(shares).map(([userId, percentage]) => ({
        userId,
        percentage: Number(percentage),
      }));

      const totalPercent = sharesArray.reduce((acc, s) => acc + s.percentage, 0);
      if (totalPercent !== 100) {
        throw new Error('A soma das porcentagens deve ser 100%');
      }

      const payload = {
        groupId,
        title: data.title,
        totalAmount: Number(data.totalAmount),
        frequency: (data.frequency || 'MONTHLY') as RecurringFrequency,
        dueDate: data.dueDate,
        pixKey: data.pixKey || undefined,
        paymentLink: data.paymentLink || undefined,
        attachmentUrl: data.attachmentUrl || undefined,
        ownerId: data.ownerId,
        receiverId: data.receiverId,
        receiverName: data.receiverName || undefined,
        category: data.category || undefined,
        shares: sharesArray,
        createFirstBill: true,
      };

      const response = await apiClient.post(
        `/recurring-bills/environments/${environmentId}`,
        payload,
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recurring-bills', environmentId] });
      queryClient.invalidateQueries({ queryKey: ['bills', environmentId] });
      reset({ installments: 1, isRecurring: false, frequency: 'MONTHLY' } as any);
      toast({
        title: 'Conta recorrente criada',
        status: 'success',
        isClosable: true,
        duration: 3000,
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Erro ao criar conta recorrente',
        description: error?.response?.data?.message || error.message,
        status: 'error',
        isClosable: true,
        duration: 4000,
      });
    },
  });

  const archiveBill = useMutation({
    mutationFn: async (billId: string) => {
      const response = await apiClient.patch(`/bills/${billId}/archive`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bills', environmentId] });
      toast({
        title: 'Conta arquivada',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Erro ao arquivar conta',
        description: error?.response?.data?.message || error.message,
        status: 'error',
        isClosable: true,
        duration: 4000,
      });
    },
  });

  const toggleRecurring = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const response = await apiClient.patch<RecurringBill>(`/recurring-bills/${id}`, {
        active,
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recurring-bills', environmentId] });
      toast({
        title: 'Recorrência atualizada',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Erro ao atualizar recorrência',
        description: error?.response?.data?.message || error.message,
        status: 'error',
        isClosable: true,
        duration: 4000,
      });
    },
  });

  const updateBill = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateBillPayload }) => {
      const response = await apiClient.patch<Bill>(`/bills/${id}`, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bills', environmentId] });
      setEditingBill(null);
      reset({ installments: 1, isRecurring: false, frequency: 'MONTHLY' } as any);
      toast({ title: 'Conta atualizada', status: 'success', duration: 3000, isClosable: true });
    },
    onError: (error: any) => {
      toast({
        title: 'Erro ao atualizar conta',
        description: error?.response?.data?.message || error.message,
        status: 'error',
        isClosable: true,
        duration: 4000,
      });
    },
  });

  const { data: envSummary } = useQuery<GroupMembersSummaryResponse>({
    queryKey: ['environment-summary', groupId, environmentId, month, year],
    queryFn: async () => {
      const response = await apiClient.get<GroupMembersSummaryResponse>(
        `/groups/${groupId}/environments/${environmentId}/summary`,
        {
          params: { month, year },
        },
      );
      return response.data;
    },
    enabled: !!groupId && !!environmentId,
  });

  const environment = environments?.find((e) => e.id === environmentId);

  const { data: recurringBills } = useQuery<RecurringBill[]>({
    queryKey: ['recurring-bills', environmentId],
    queryFn: async () => {
      const response = await apiClient.get<RecurringBill[]>(
        `/recurring-bills/environments/${environmentId}`,
      );
      return response.data;
    },
    enabled: !!environmentId,
  });

  const { data: bills } = useQuery<Bill[]>({
    queryKey: ['bills', environmentId, month, year, statusFilter, showAllPending],
    queryFn: async () => {
      const params: any = showAllPending
        ? { showAllPending: 'true' }
        : {
          month,
          year,
          status: statusFilter || undefined,
        };
      const response = await apiClient.get<Bill[]>(`/bills/environments/${environmentId}`, {
        params,
      });
      return response.data;
    },
    enabled: !!environmentId,
  });

  const { register, handleSubmit, reset, watch, setValue } = useForm<BillForm>({
    defaultValues: {
      installments: 1,
      isRecurring: false,
      frequency: 'MONTHLY',
      paymentMethod: 'PIX',
      receiverName: '',
    },
  });

  const [editingBill, setEditingBill] = useState<Bill | null>(null);
  const [editingRecurring, setEditingRecurring] = useState<RecurringBill | null>(null);
  const [shares, setShares] = useState<Record<string, number>>({});

  const distributeEqually = () => {
    if (!group?.members?.length) return;
    const members = group.members;
    const base = Math.floor(100 / members.length);
    let remaining = 100;
    const initial: Record<string, number> = {};
    members.forEach((m, index) => {
      const value = index === members.length - 1 ? remaining : base;
      initial[m.user.id] = value;
      remaining -= value;
    });
    setShares(initial);
  };

  // Inicializa porcentagens iguais entre membros
  useEffect(() => {
    distributeEqually();
  }, [group]);

  const totalShares = Object.values(shares).reduce(
    (acc: number, v: number) => acc + (Number.isNaN(v) ? 0 : v),
    0,
  );

  const createCategory = useMutation({
    mutationFn: async (name: string) => {
      if (!groupId) throw new Error('Grupo inválido');
      const response = await apiClient.post<Category>(`/groups/${groupId}/categories`, {
        name,
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories', groupId] });
      toast({ title: 'Categoria salva', status: 'success', duration: 3000, isClosable: true });
    },
    onError: (error: any) => {
      toast({
        title: 'Erro ao salvar categoria',
        description: error?.response?.data?.message || error.message,
        status: 'error',
        duration: 4000,
        isClosable: true,
      });
    },
  });

  const updateRecurring = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const response = await apiClient.patch<RecurringBill>(`/recurring-bills/${id}`, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recurring-bills', environmentId] });
      queryClient.invalidateQueries({ queryKey: ['bills', environmentId] });
      setEditingRecurring(null);
      reset({
        installments: 1,
        isRecurring: false,
        frequency: 'MONTHLY',
      } as any);
      distributeEqually();
      toast({
        title: 'Conta recorrente atualizada',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Erro ao atualizar recorrência',
        description: error?.response?.data?.message || error.message,
        status: 'error',
        duration: 4000,
        isClosable: true,
      });
    },
  });

  const createBill = useMutation({
    mutationFn: async (data: BillForm) => {
      if (!groupId || !environmentId) throw new Error('Grupo ou ambiente inválidos');

      const sharesArray = Object.entries(shares).map(([userId, percentage]) => ({
        userId,
        percentage: Number(percentage),
      }));

      const totalPercent = sharesArray.reduce((acc, s) => acc + s.percentage, 0);
      if (totalPercent !== 100) {
        throw new Error('A soma das porcentagens deve ser 100%');
      }

      const payload = {
        groupId,
        title: data.title,
        dueDate: data.dueDate,
        totalAmount: Number(data.totalAmount),
        installments: Number(data.installments || 1),
        pixKey: data.pixKey || undefined,
        paymentLink: data.paymentLink || undefined,
        attachmentUrl: data.attachmentUrl || undefined,
        ownerId: data.ownerId,
        receiverId: data.receiverId,
        receiverName: data.receiverName || undefined,
        category: data.category || undefined,
        shares: sharesArray,
      };

      const response = await apiClient.post<Bill>(
        `/bills/environments/${environmentId}`,
        payload,
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bills', environmentId] });
      reset({ installments: 1 } as any);
      toast({ title: 'Conta criada', status: 'success', isClosable: true, duration: 3000 });
    },
    onError: (error: any) => {
      toast({
        title: 'Erro ao criar conta',
        description: error?.response?.data?.message || error.message,
        status: 'error',
        isClosable: true,
        duration: 4000,
      });
    },
  });

  const payMyShare = useMutation({
    mutationFn: async (bill: Bill) => {
      if (!user) throw new Error('Usuário não autenticado');
      const myShare = bill.shares.find((s) => s.userId === user.id);
      if (!myShare) throw new Error('Você não faz parte desta conta');

      const response = await apiClient.post(`/bills/${bill.id}/payments`, {
        fromUserId: user.id,
        amount: myShare.amount,
        method: 'manual',
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bills', environmentId] });
      toast({ title: 'Pagamento registrado', status: 'success', duration: 3000, isClosable: true });
    },
    onError: (error: any) => {
      toast({
        title: 'Erro ao registrar pagamento',
        description: error?.response?.data?.message || error.message,
        status: 'error',
        isClosable: true,
        duration: 4000,
      });
    },
  });

  const onSubmit = (data: BillForm) => {
    const sharesArray = Object.entries(shares).map(([userId, percentage]) => ({
      userId,
      percentage: Number(percentage),
    }));

    const totalPercent = sharesArray.reduce((acc, s) => acc + s.percentage, 0);
    if (totalPercent !== 100) {
      toast({
        title: 'A soma das porcentagens deve ser 100%',
        status: 'error',
        isClosable: true,
        duration: 3000,
      });
      return;
    }

    if (editingRecurring) {
      updateRecurring.mutate({
        id: editingRecurring.id,
        data: {
          title: data.title,
          totalAmount: data.totalAmount,
          frequency: data.frequency || 'MONTHLY',
          dueDate: data.dueDate,
          pixKey: data.pixKey || undefined,
          paymentLink: data.paymentLink || undefined,
          attachmentUrl: data.attachmentUrl || undefined,
          ownerId: data.ownerId,
          receiverId: data.receiverId,
          receiverName: data.receiverName,
          shares: sharesArray,
        },
      });
      return;
    }

    if (editingBill) {
      updateBill.mutate({
        id: editingBill.id,
        data: {
          ...data,
          shares: sharesArray,
        },
      });
      return;
    }
    if (data.isRecurring) {
      createRecurring.mutate(data);
    } else {
      createBill.mutate(data);
    }
  };

  const isEditingBill = !!editingBill;
  const isEditingRecurring = !!editingRecurring;
  const formTitle = isEditingRecurring
    ? 'Editar conta recorrente'
    : isEditingBill
      ? 'Editar conta'
      : 'Criar conta';

  const paymentMethod =
    (watch('paymentMethod') as 'PIX' | 'CARTAO' | 'BOLETO' | 'DINHEIRO') || 'PIX';
  const paymentTabIndex =
    paymentMethod === 'CARTAO'
      ? 1
      : paymentMethod === 'BOLETO'
        ? 2
        : paymentMethod === 'DINHEIRO'
          ? 3
          : 0;

  return (
    <VStack align="stretch" spacing={6}>
      <Heading size="lg">
        {group?.name} / {environment?.name || 'Ambiente'}
      </Heading>

      <HStack spacing={3} align="center" flexWrap="wrap">
        <Checkbox
          isChecked={showAllPending}
          onChange={(e) => setShowAllPending(e.target.checked)}
          colorScheme="blue"
        >
          Todas pendentes
        </Checkbox>
        <Select
          maxW="150px"
          size="sm"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          isDisabled={showAllPending}
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
          isDisabled={showAllPending}
        >
          <option value={String(currentYear - 1)}>{currentYear - 1}</option>
          <option value={String(currentYear)}>{currentYear}</option>
          <option value={String(currentYear + 1)}>{currentYear + 1}</option>
        </Select>
        <Select
          maxW="180px"
          size="sm"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          isDisabled={showAllPending}
        >
          <option value="">Todos status</option>
          <option value="OPEN">Em aberto</option>
          <option value="PARTIALLY_PAID">Parcialmente paga</option>
          <option value="PAID">Paga</option>
        </Select>
      </HStack>

      {envSummary && (
        <Box bg="white" p={4} borderRadius="md" boxShadow="sm">
          <Heading size="sm" mb={3}>
            Resumo por membro neste ambiente
          </Heading>
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
              {envSummary.members.map((m: MemberBalanceSummary) => (
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

      {recurringBills && recurringBills.length > 0 && (
        <Box bg="white" p={4} borderRadius="md" boxShadow="sm">
          <Heading size="sm" mb={3}>
            Contas recorrentes do ambiente
          </Heading>
          <Table size="sm">
            <Thead>
              <Tr>
                <Th>Nome</Th>
                <Th>Frequência</Th>
                <Th>Próximo vencimento</Th>
                <Th isNumeric>Valor (R$)</Th>
                <Th>Ações</Th>
              </Tr>
            </Thead>
            <Tbody>
              {recurringBills.map((r) => (
                <Tr key={r.id}>
                  <Td>{r.title}</Td>
                  <Td>
                    {r.frequency === 'MONTHLY'
                      ? 'Mensal'
                      : r.frequency === 'WEEKLY'
                        ? 'Semanal'
                        : 'Anual'}
                  </Td>
                  <Td>{new Date(r.nextDueDate).toLocaleDateString('pt-BR')}</Td>
                  <Td isNumeric>{formatCurrencyBRL(r.totalAmount)}</Td>
                  <Td>
                    {user && r.ownerId === user.id && (
                      <HStack spacing={2}>
                        <Button
                          size="xs"
                          colorScheme={r.active ? 'red' : 'green'}
                          variant="outline"
                          onClick={() => {
                            const action = r.active ? 'desativar' : 'ativar';
                            if (
                              !window.confirm(
                                `Tem certeza que deseja ${action} esta recorrência?`,
                              )
                            ) {
                              return;
                            }
                            toggleRecurring.mutate({ id: r.id, active: !r.active });
                          }}
                          isLoading={toggleRecurring.isPending}
                        >
                          {r.active ? 'Desativar' : 'Ativar'}
                        </Button>
                        <Button
                          size="xs"
                          colorScheme="blue"
                          variant="ghost"
                          onClick={() => {
                            setEditingRecurring(r);
                            setEditingBill(null);
                            reset({
                              title: r.title,
                              dueDate: r.nextDueDate
                                ? new Date(r.nextDueDate).toISOString().slice(0, 10)
                                : '',
                              totalAmount: r.totalAmount,
                              installments: 1,
                              pixKey: r.pixKey || undefined,
                              paymentLink: r.paymentLink || undefined,
                              attachmentUrl: r.attachmentUrl || undefined,
                              ownerId: r.ownerId,
                              receiverId: r.receiverId || undefined,
                              receiverName: r.receiverName || r.receiver?.name || '',
                              isRecurring: true,
                              frequency: r.frequency,
                              category: undefined,
                            } as any);
                            const nextShares: Record<string, number> = {};
                            r.shares.forEach((s) => {
                              nextShares[s.userId] = s.percentage;
                            });
                            setShares(nextShares);
                          }}
                        >
                          Editar
                        </Button>
                      </HStack>
                    )}
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        </Box>
      )}

      <SimpleGrid columns={{ base: 1, lg: 2 }} spacing={6} alignItems="flex-start">
        <Box bg="white" p={4} borderRadius="md" boxShadow="sm">
          <Heading size="sm" mb={3}>
            {formTitle}
          </Heading>
          <VStack
            as="form"
            align="stretch"
            spacing={3}
            onSubmit={handleSubmit(onSubmit)}
          >
            <FormControl isRequired>
              <FormLabel>Nome da conta</FormLabel>
              <Input placeholder="Luz, Internet..." {...register('title', { required: true })} />
            </FormControl>
            <FormControl isRequired>
              <FormLabel>Data de vencimento (1ª parcela)</FormLabel>
              <Input type="date" {...register('dueDate', { required: true })} />
              <Text fontSize="xs" color="gray.500" mt={1}>
                As demais parcelas (quando houver) seguem mensalmente a partir desta data.
              </Text>
            </FormControl>
            <FormControl isRequired>
              <FormLabel>Valor total (R$)</FormLabel>
              <NumberInput min={0} precision={2}>
                <NumberInputField {...register('totalAmount', { valueAsNumber: true })} />
              </NumberInput>
            </FormControl>
            <FormControl>
              <FormLabel>Parcelas</FormLabel>
              <NumberInput min={1}>
                <NumberInputField {...register('installments', { valueAsNumber: true })} />
              </NumberInput>
              <Text fontSize="xs" color="gray.500" mt={1}>
                Se preencher, consideramos parcelas mensais a partir da data de vencimento.
              </Text>
            </FormControl>
            <Box>
              <FormLabel>Forma de pagamento</FormLabel>
              <Tabs
                index={paymentTabIndex}
                onChange={(index) => {
                  const method: 'PIX' | 'CARTAO' | 'BOLETO' | 'DINHEIRO' =
                    index === 1 ? 'CARTAO' : index === 2 ? 'BOLETO' : index === 3 ? 'DINHEIRO' : 'PIX';
                  setValue('paymentMethod', method);
                }}
                variant="enclosed"
                size="sm"
              >
                <TabList>
                  <Tab>Pix</Tab>
                  <Tab>Cartão</Tab>
                  <Tab>Boleto</Tab>
                  <Tab>Dinheiro</Tab>
                </TabList>
                <TabPanels mt={2}>
                  <TabPanel px={0}>
                    <VStack align="stretch" spacing={2}>
                      <FormControl>
                        <FormLabel>PIX / Chave</FormLabel>
                        <Input {...register('pixKey')} />
                      </FormControl>
                      <FormControl>
                        <FormLabel>Comprovante / link</FormLabel>
                        <Input {...register('attachmentUrl')} />
                      </FormControl>
                    </VStack>
                  </TabPanel>
                  <TabPanel px={0}>
                    <VStack align="stretch" spacing={2}>
                      <FormControl>
                        <FormLabel>Link de cobrança (cartão)</FormLabel>
                        <Input {...register('paymentLink')} />
                      </FormControl>
                      <FormControl>
                        <FormLabel>Comprovante / anotações</FormLabel>
                        <Input {...register('attachmentUrl')} />
                      </FormControl>
                    </VStack>
                  </TabPanel>
                  <TabPanel px={0}>
                    <VStack align="stretch" spacing={2}>
                      <FormControl>
                        <FormLabel>Linha digitável ou link do boleto</FormLabel>
                        <Input {...register('paymentLink')} />
                      </FormControl>
                      <FormControl>
                        <FormLabel>Comprovante</FormLabel>
                        <Input {...register('attachmentUrl')} />
                      </FormControl>
                    </VStack>
                  </TabPanel>
                  <TabPanel px={0}>
                    <VStack align="stretch" spacing={2}>
                      <FormControl>
                        <FormLabel>Observações (pagamento em dinheiro)</FormLabel>
                        <Input {...register('attachmentUrl')} />
                      </FormControl>
                    </VStack>
                  </TabPanel>
                </TabPanels>
              </Tabs>
            </Box>

            <FormControl>
              <FormLabel>Categoria</FormLabel>
              <VStack align="stretch" spacing={1}>
                <Input
                  placeholder="Luz, Mercado, Transporte..."
                  {...register('category')}
                />
                {categories && categories.length > 0 && (
                  <Box>
                    <Text fontSize="xs" color="gray.500">
                      Sugestões
                    </Text>
                    <HStack spacing={1} mt={1} flexWrap="wrap">
                      {categories
                        .filter((c) => {
                          const term = (watch('category') || '').toLowerCase();
                          if (!term) return true;
                          return c.name.toLowerCase().includes(term);
                        })
                        .slice(0, 8)
                        .map((c) => (
                          <Button
                            key={c.id}
                            size="xs"
                            variant="ghost"
                            onClick={() => setValue('category', c.name)}
                          >
                            {c.name}
                          </Button>
                        ))}
                    </HStack>
                  </Box>
                )}
                <Button
                  size="xs"
                  alignSelf="flex-start"
                  variant="outline"
                  mt={1}
                  onClick={() => {
                    const name = (watch('category') || '').trim();
                    if (!name) return;
                    createCategory.mutate(name);
                  }}
                  isDisabled={!(watch('category') || '').trim()}
                  isLoading={createCategory.isPending}
                >
                  Salvar categoria
                </Button>
              </VStack>
            </FormControl>

            {!isEditingBill && !isEditingRecurring && (
              <Box mt={2}>
                <HStack align="center" mb={2}>
                  <Checkbox {...register('isRecurring')}>
                    Tornar esta conta recorrente
                  </Checkbox>
                  {(watch('isRecurring') || isEditingRecurring) && (
                    <Select
                      maxW="160px"
                      size="sm"
                      {...register('frequency')}
                      defaultValue="MONTHLY"
                    >
                      <option value="MONTHLY">Mensal</option>
                      <option value="WEEKLY">Semanal</option>
                      <option value="YEARLY">Anual</option>
                    </Select>
                  )}
                </HStack>
                <Text fontSize="xs" color="gray.500">
                  Recorrentes geram automaticamente novas contas com o mesmo valor e divisão.
                </Text>
              </Box>
            )}

            <FormControl isRequired>
              <FormLabel>Conta pertence a</FormLabel>
              <Select placeholder="Selecione" {...register('ownerId', { required: true })}>
                {group?.members.map((m: GroupMember) => (
                  <option key={m.id} value={m.user.id}>
                    {m.user.name}
                  </option>
                ))}
              </Select>
              <Text fontSize="xs" color="gray.500" mt={1}>
                O dono controla a edição. A divisão real está nas porcentagens abaixo.
              </Text>
            </FormControl>

            <FormControl isRequired>
              <FormLabel>Quem recebe (destinatário)</FormLabel>
              <HStack align="flex-end">
                <Input
                  placeholder="Nome do destinatário"
                  {...register('receiverName', { required: true })}
                />
                {user && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setValue('receiverName', user.name);
                      setValue('receiverId', user.id);
                    }}
                  >
                    Sou eu
                  </Button>
                )}
              </HStack>
              <Text fontSize="xs" color="gray.500" mt={1}>
                Você pode digitar qualquer nome. Se existir um usuário com esse nome, ele será
                vinculado como destinatário.
              </Text>
            </FormControl>

            <Box mt={2}>
              <HStack justify="space-between" align="center" mb={1}>
                <Heading size="xs">Porcentagem por pessoa</Heading>
                <Button size="xs" variant="ghost" onClick={distributeEqually}>
                  Dividir igualmente
                </Button>
              </HStack>
              <Text fontSize="xs" color="gray.500" mb={1}>
                A soma deve ser exatamente 100%. Atual: {totalShares}%
              </Text>
              <VStack align="stretch" spacing={1}>
                {group?.members.map((m: GroupMember) => (
                  <Box key={m.id} display="flex" alignItems="center" gap={2}>
                    <Box flex="1" fontSize="sm">
                      {m.user.name}
                    </Box>
                    <NumberInput
                      size="sm"
                      maxW="100px"
                      min={0}
                      max={100}
                      value={shares[m.user.id] ?? 0}
                      onChange={(_, valueAsNumber) => {
                        setShares((prev) => ({
                          ...prev,
                          [m.user.id]: Number.isNaN(valueAsNumber) ? 0 : valueAsNumber,
                        }));
                      }}
                    >
                      <NumberInputField />
                    </NumberInput>
                    <Text fontSize="xs">%</Text>
                  </Box>
                ))}
              </VStack>
            </Box>

            {totalShares !== 100 && (
              <Text fontSize="xs" color="red.500">
                A soma das porcentagens precisa ser 100%.
              </Text>
            )}

            <HStack spacing={3} mt={2}>
              <Button
                type="submit"
                colorScheme="blue"
                isLoading={
                  isEditingBill
                    ? updateBill.isPending
                    : isEditingRecurring
                      ? updateRecurring.isPending
                      : createBill.isPending || createRecurring.isPending
                }
                isDisabled={totalShares !== 100}
              >
                {isEditingBill || isEditingRecurring ? 'Salvar alterações' : 'Criar conta'}
              </Button>
              {(isEditingBill || isEditingRecurring) && (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setEditingBill(null);
                    setEditingRecurring(null);
                    reset({
                      installments: 1,
                      isRecurring: false,
                      frequency: 'MONTHLY',
                    } as any);
                    distributeEqually();
                  }}
                >
                  Cancelar
                </Button>
              )}
            </HStack>
          </VStack>
        </Box>

        <Box bg="white" p={4} borderRadius="md" boxShadow="sm">
          <Heading size="sm" mb={3}>
            Contas do ambiente
          </Heading>
          {bills && bills.length > 0 ? (
            <Box maxH={{ base: '320px', md: '420px' }} overflowY="auto">
              <Table size="sm">
                <Thead>
                  <Tr>
                    <Th>Conta</Th>
                    <Th>Categoria</Th>
                    <Th>Vencimento</Th>
                    <Th isNumeric>Valor</Th>
                    <Th>Status</Th>
                    <Th>Ações</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {bills.map((bill) => {
                    const myShare = user
                      ? bill.shares.find((s) => s.userId === user.id)
                      : undefined;
                    const canPayMyShare =
                      !!myShare && myShare.status === 'PENDING' && bill.status !== 'PAID';

                    return (
                      <Tr key={bill.id}>
                        <Td>
                          <Text fontSize="sm">{bill.title}</Text>
                          {myShare && (
                            <Text fontSize="xs" color="gray.600">
                              Sua parte: {formatCurrencyBRL(myShare.amount)} ({myShare.percentage}%)
                            </Text>
                          )}
                        </Td>
                        <Td>{bill.category || '—'}</Td>
                        <Td>{new Date(bill.dueDate).toLocaleDateString('pt-BR')}</Td>
                        <Td isNumeric>{formatCurrencyBRL(bill.totalAmount)}</Td>
                        <Td>
                          <Badge
                            colorScheme={
                              bill.status === 'PAID'
                                ? 'green'
                                : bill.status === 'PARTIALLY_PAID'
                                  ? 'yellow'
                                  : 'gray'
                            }
                          >
                            {bill.status === 'PAID'
                              ? 'Paga'
                              : bill.status === 'PARTIALLY_PAID'
                                ? 'Parcialmente paga'
                                : 'Em aberto'}
                          </Badge>
                        </Td>
                        <Td>
                          <HStack spacing={2}>
                            <Button
                              size="xs"
                              colorScheme="green"
                              variant="outline"
                              onClick={() => payMyShare.mutate(bill)}
                              isDisabled={!canPayMyShare || payMyShare.isPending}
                            >
                              Pagar minha parte
                            </Button>
                            {user && bill.ownerId === user.id && bill.status === 'OPEN' && (
                              <Button
                                size="xs"
                                colorScheme="blue"
                                variant="outline"
                                onClick={() => {
                                  setEditingBill(bill);
                                  reset({
                                    title: bill.title,
                                    dueDate: bill.dueDate
                                      ? new Date(bill.dueDate).toISOString().slice(0, 10)
                                      : '',
                                    totalAmount: bill.totalAmount,
                                    installments: bill.installments,
                                    pixKey: bill.pixKey || undefined,
                                    paymentLink: bill.paymentLink || undefined,
                                    attachmentUrl: bill.attachmentUrl || undefined,
                                    ownerId: bill.ownerId,
                                    receiverId: bill.receiverId || undefined,
                                    receiverName:
                                      bill.receiverName || bill.receiver?.name || '',
                                    category: bill.category || undefined,
                                    isRecurring: false,
                                    frequency: 'MONTHLY',
                                  } as any);
                                  const nextShares: Record<string, number> = {};
                                  bill.shares.forEach((s) => {
                                    nextShares[s.userId] = s.percentage;
                                  });
                                  setShares(nextShares);
                                }}
                              >
                                Editar
                              </Button>
                            )}
                            {user && bill.ownerId === user.id && (
                              <Button
                                size="xs"
                                colorScheme="red"
                                variant="ghost"
                                onClick={() => {
                                  if (
                                    !window.confirm(
                                      'Tem certeza que deseja arquivar esta conta?',
                                    )
                                  ) {
                                    return;
                                  }
                                  archiveBill.mutate(bill.id);
                                }}
                                isLoading={archiveBill.isPending}
                              >
                                Arquivar
                              </Button>
                            )}
                          </HStack>
                        </Td>
                      </Tr>
                    );
                  })}
                </Tbody>
              </Table>
            </Box>
          ) : (
            <Text fontSize="sm" color="gray.500">
              Nenhuma conta cadastrada neste ambiente.
            </Text>
          )}
        </Box>
      </SimpleGrid>
    </VStack>
  );
};

export default EnvironmentBillsPage;
