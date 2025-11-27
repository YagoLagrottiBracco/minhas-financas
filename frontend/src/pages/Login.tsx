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

interface LoginForm {
  email: string;
  password: string;
}

const LoginPage = () => {
  const { register, handleSubmit, formState } = useForm<LoginForm>();
  const { login } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const onSubmit = async (data: LoginForm) => {
    try {
      await login(data.email, data.password);
      navigate('/');
    } catch (error: any) {
      toast({
        title: 'Erro ao entrar',
        description: error?.response?.data?.message || 'Verifique seus dados',
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
          Entrar
        </Heading>
        <VStack as="form" spacing={4} align="stretch" onSubmit={handleSubmit(onSubmit)}>
          <FormControl isRequired>
            <FormLabel>E-mail</FormLabel>
            <Input type="email" {...register('email', { required: true })} />
          </FormControl>
          <FormControl isRequired>
            <FormLabel>Senha</FormLabel>
            <Input type="password" {...register('password', { required: true })} />
          </FormControl>
          <Button
            type="submit"
            colorScheme="blue"
            isLoading={formState.isSubmitting}
            w="100%"
          >
            Entrar
          </Button>
        </VStack>
        <Text mt={4} fontSize="sm" textAlign="center">
          Não tem conta?{' '}
          <ChakraLink as={Link} to="/register" color="blue.500">
            Cadastre-se
          </ChakraLink>
        </Text>
      </Box>
    </Box>
  );
};

export default LoginPage;
