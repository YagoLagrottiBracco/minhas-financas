import {
  Box,
  Button,
  Flex,
  Heading,
  Input,
  Text,
  VStack,
  SimpleGrid,
  FormControl,
  FormLabel,
  useToast,
} from '@chakra-ui/react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import apiClient from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import type { Group } from '../types';
import { useForm } from 'react-hook-form';

interface GroupForm {
  name: string;
  description?: string;
}

const GroupsPage = () => {
  const toast = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { data: groups } = useQuery<Group[]>({
    queryKey: ['groups'],
    queryFn: async () => {
      const response = await apiClient.get<Group[]>('/groups');
      return response.data;
    },
  });

  const { register, handleSubmit, reset } = useForm<GroupForm>();

  const createGroup = useMutation({
    mutationFn: async (data: GroupForm) => {
      const response = await apiClient.post<Group>('/groups', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['groups'] });
      reset();
      toast({ title: 'Grupo criado', status: 'success', duration: 3000, isClosable: true });
    },
  });

  const archiveGroup = useMutation({
    mutationFn: async (groupId: string) => {
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
    mutationFn: async (groupId: string) => {
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

  const onSubmit = (data: GroupForm) => {
    createGroup.mutate(data);
  };

  return (
    <VStack align="stretch" spacing={6}>
      <Heading size="lg">Grupos</Heading>

      <Box bg="white" p={4} borderRadius="md" boxShadow="sm">
        <Heading size="sm" mb={3}>
          Criar novo grupo
        </Heading>
        <Flex as="form" gap={3} onSubmit={handleSubmit(onSubmit)} flexWrap="wrap">
          <FormControl maxW="260px" isRequired>
            <FormLabel>Nome</FormLabel>
            <Input {...register('name', { required: true })} placeholder="Casa, Viagem..." />
          </FormControl>
          <FormControl flex="1 1 200px">
            <FormLabel>Descrição</FormLabel>
            <Input {...register('description')} />
          </FormControl>
          <Box alignSelf="flex-end">
            <Button
              type="submit"
              colorScheme="blue"
              isLoading={createGroup.isPending}
            >
              Criar
            </Button>
          </Box>
        </Flex>
      </Box>

      <Box>
        <Heading size="sm" mb={3}>
          Seus grupos
        </Heading>
        <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
          {groups && groups.length > 0 ? (
            groups.map((group) => {
              const isOwner = user && group.ownerId === user.id;

              return (
                <Box
                  key={group.id}
                  as={Link}
                  to={`/groups/${group.id}`}
                  bg="white"
                  p={4}
                  borderRadius="md"
                  boxShadow="sm"
                  _hover={{ boxShadow: 'md' }}
                >
                  <Heading size="sm" mb={1}>
                    {group.name}
                  </Heading>
                  {group.description && (
                    <Text fontSize="sm" color="gray.600">
                      {group.description}
                    </Text>
                  )}
                  <Text fontSize="xs" color="gray.500" mt={2}>
                    {group.members.length} membros, {group.environments.length} ambientes
                  </Text>
                  {user && (
                    <Button
                      size="xs"
                      mt={3}
                      colorScheme={isOwner ? 'red' : 'orange'}
                      variant="outline"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (
                          !window.confirm(
                            isOwner
                              ? 'Tem certeza que deseja arquivar este grupo?'
                              : 'Tem certeza que deseja sair deste grupo?',
                          )
                        ) {
                          return;
                        }
                        if (isOwner) {
                          archiveGroup.mutate(group.id);
                        } else {
                          leaveGroup.mutate(group.id);
                        }
                      }}
                      isLoading={isOwner ? archiveGroup.isPending : leaveGroup.isPending}
                    >
                      {isOwner ? 'Arquivar grupo' : 'Sair do grupo'}
                    </Button>
                  )}
                </Box>
              );
            })
          ) : (
            <Text fontSize="sm" color="gray.500">
              Você ainda não tem grupos.
            </Text>
          )}
        </SimpleGrid>
      </Box>
    </VStack>
  );
};

export default GroupsPage;
