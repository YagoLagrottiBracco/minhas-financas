import {
  Box,
  Button,
  FormControl,
  FormLabel,
  Heading,
  Input,
  Link as ChakraLink,
  Text,
  VStack,
  useToast,
} from '@chakra-ui/react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { useAuth } from '../contexts/AuthContext';

interface RegisterForm {
  name: string;
  email: string;
  password: string;
}

const RegisterPage = () => {
  const { register, handleSubmit, formState } = useForm<RegisterForm>();
  const { register: registerUser } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const onSubmit = async (data: RegisterForm) => {
    try {
      await registerUser(data.name, data.email, data.password);
      navigate('/');
    } catch (error: any) {
      toast({
        title: 'Erro ao cadastrar',
        description: error?.response?.data?.message || 'Tente novamente',
        status: 'error',
        duration: 4000,
        isClosable: true,
      });
    }
  };

  return (
    <Box minH="100vh" bg="gray.50" display="flex" alignItems="center" justifyContent="center">
      <Box bg="white" p={8} borderRadius="lg" boxShadow="md" maxW="400px" w="100%">
        <Heading size="md" mb={6} textAlign="center">
          Criar conta
        </Heading>
        <VStack as="form" spacing={4} align="stretch" onSubmit={handleSubmit(onSubmit)}>
          <FormControl isRequired>
            <FormLabel>Nome</FormLabel>
            <Input {...register('name', { required: true })} />
          </FormControl>
          <FormControl isRequired>
            <FormLabel>E-mail</FormLabel>
            <Input type="email" {...register('email', { required: true })} />
          </FormControl>
          <FormControl isRequired>
            <FormLabel>Senha</FormLabel>
            <Input type="password" {...register('password', { required: true, minLength: 6 })} />
          </FormControl>
          <Button
            type="submit"
            colorScheme="blue"
            isLoading={formState.isSubmitting}
            w="100%"
          >
            Cadastrar
          </Button>
        </VStack>
        <Text mt={4} fontSize="sm" textAlign="center">
          Já tem conta?{' '}
          <ChakraLink as={Link} to="/login" color="blue.500">
            Entrar
          </ChakraLink>
        </Text>
      </Box>
    </Box>
  );
};

export default RegisterPage;
