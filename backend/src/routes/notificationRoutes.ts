import { Router, Response } from 'express';
import { prisma } from '../prisma';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();

// Listar notificações do usuário logado
router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const notifications = await prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    res.json(notifications);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Erro ao listar notificações' });
  }
});

// Marcar uma notificação como lida
router.patch('/:id/read', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;

    const notification = await prisma.notification.updateMany({
      where: {
        id,
        userId,
      },
      data: {
        read: true,
        readAt: new Date(),
      },
    });

    res.json(notification);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Erro ao marcar notificação como lida' });
  }
});

// Marcar todas como lidas
router.patch('/read-all', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;

    const result = await prisma.notification.updateMany({
      where: {
        userId,
        read: false,
      },
      data: {
        read: true,
        readAt: new Date(),
      },
    });

    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Erro ao marcar todas como lidas' });
  }
});

export default router;
