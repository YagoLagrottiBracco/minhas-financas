import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../prisma';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();

const generateToken = (userId: string) => {
  const secret = process.env.JWT_SECRET || 'secret';
  return jwt.sign({ userId }, secret, { expiresIn: '7d' });
};

router.post('/register', async (req: Request, res: Response) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Nome, e-mail e senha são obrigatórios' });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(400).json({ message: 'E-mail já cadastrado' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash,
      },
    });

    const token = generateToken(user.id);

    const { passwordHash: _, ...userSafe } = user;

    return res.status(201).json({ token, user: userSafe });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Erro ao registrar usuário' });
  }
});

router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'E-mail e senha são obrigatórios' });
    }

    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      return res.status(400).json({ message: 'Credenciais inválidas' });
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      return res.status(400).json({ message: 'Credenciais inválidas' });
    }

    const token = generateToken(user.id);
    const { passwordHash: _, ...userSafe } = user;

    return res.json({ token, user: userSafe });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Erro ao fazer login' });
  }
});

router.get('/me', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Não autenticado' });
    }

    const user = await prisma.user.findUnique({ where: { id: req.user.id } });

    if (!user) {
      return res.status(404).json({ message: 'Usuário não encontrado' });
    }

    const { passwordHash: _, ...userSafe } = user;
    return res.json(userSafe);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Erro ao buscar usuário' });
  }
});

export default router;
