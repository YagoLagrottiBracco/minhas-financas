import { Router, Response } from 'express';
import { prisma } from '../prisma';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();

// Criar conta (bill) em um ambiente
router.post('/environments/:environmentId', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { environmentId } = req.params;
    const {
      groupId,
      title,
      dueDate,
      totalAmount,
      installments,
      pixKey,
      paymentLink,
      attachmentUrl,
      ownerId,
      receiverId,
      receiverName,
      category,
      shares,
    } = req.body as {
      groupId: string;
      title: string;
      dueDate: string;
      totalAmount: number;
      installments?: number;
      pixKey?: string;
      paymentLink?: string;
      attachmentUrl?: string;
      ownerId: string;
      receiverId?: string;
      receiverName?: string;
      category?: string;
      shares: { userId: string; percentage: number }[];
    };

    if (!groupId || !title || !dueDate || !totalAmount || !ownerId || !shares?.length) {
      return res.status(400).json({ message: 'Dados obrigatórios faltando para criar a conta' });
    }

    if (!receiverId && !receiverName) {
      return res.status(400).json({ message: 'Destinatário é obrigatório' });
    }

    const environment = await prisma.environment.findUnique({ where: { id: environmentId } });
    if (!environment || environment.groupId !== groupId) {
      return res.status(404).json({ message: 'Ambiente não encontrado' });
    }

    let effectiveReceiverId = receiverId || null;
    let effectiveReceiverName = receiverName || null;

    if (!effectiveReceiverId && effectiveReceiverName) {
      const matchedUser = await prisma.user.findFirst({ where: { name: effectiveReceiverName } });
      if (matchedUser) {
        effectiveReceiverId = matchedUser.id;
      }
    }

    const sumPercent = shares.reduce(
      (acc: number, s: { userId: string; percentage: number }) => acc + s.percentage,
      0,
    );
    if (Math.round(sumPercent) !== 100) {
      return res.status(400).json({ message: 'Soma das porcentagens deve ser 100%' });
    }

    const bill = await prisma.bill.create({
      data: {
        title,
        dueDate: new Date(dueDate),
        totalAmount,
        installments: installments || 1,
        pixKey,
        paymentLink,
        attachmentUrl,
        category,
        groupId,
        environmentId,
        ownerId,
        receiverId: effectiveReceiverId || undefined,
        receiverName: effectiveReceiverName || undefined,
        shares: {
          create: shares.map((s) => ({
            userId: s.userId,
            percentage: s.percentage,
            amount: (totalAmount * s.percentage) / 100,
          })),
        },
      },
      include: {
        shares: true,
      },
    });

    // Registrar atividade simples
    await prisma.activity.create({
      data: {
        groupId,
        userId: req.user?.id,
        type: 'BILL_CREATED',
        description: `Conta "${title}" criada`,
      },
    });

    // Notificações para membros
    const memberIds = shares.map((s: { userId: string; percentage: number }) => s.userId);
    const notifications = await Promise.all(
      memberIds.map((userId) =>
        prisma.notification.create({
          data: {
            userId,
            title: 'Nova conta criada',
            message: `Você foi incluído na conta "${title}"`,
            type: 'BILL',
          },
        }),
      ),
    );

    // Emitir atualização em tempo real para o grupo e para usuários
    const io = (req as any).app.get('io');
    if (io) {
      io.to(groupId).emit('bill:created', bill);
      notifications.forEach((notification) => {
        io.to(`user:${notification.userId}`).emit('notification:new', notification);
      });
    }

    res.status(201).json(bill);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Erro ao criar conta' });
  }
});

// Listar contas de um ambiente
router.get('/environments/:environmentId', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { environmentId } = req.params;
    const { month, year, status } = req.query as {
      month?: string;
      year?: string;
      status?: string;
    };

    let dateFilter: { gte: Date; lt: Date } | undefined;
    const monthNum = month ? parseInt(month, 10) : NaN;
    const yearNum = year ? parseInt(year, 10) : NaN;
    if (!Number.isNaN(monthNum) && !Number.isNaN(yearNum)) {
      const from = new Date(yearNum, monthNum - 1, 1);
      const to = new Date(yearNum, monthNum, 1);
      dateFilter = { gte: from, lt: to };
    }

    const where: any = {
      environmentId,
      archived: false,
    };

    if (dateFilter) {
      where.dueDate = dateFilter;
    }

    const validStatuses = ['OPEN', 'PARTIALLY_PAID', 'PAID'];
    if (status && validStatuses.includes(status)) {
      where.status = status;
    }

    const bills = await prisma.bill.findMany({
      where,
      include: {
        shares: { include: { user: true } },
        owner: true,
        receiver: true,
      },
      orderBy: { dueDate: 'asc' },
    });

    res.json(bills);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Erro ao listar contas' });
  }
});

// Arquivar conta (somente quem criou a conta)
router.patch('/:billId/archive', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { billId } = req.params;
    const userId = req.user!.id;

    const bill = await prisma.bill.findUnique({ where: { id: billId } });

    if (!bill || bill.archived) {
      return res.status(404).json({ message: 'Conta não encontrada' });
    }

    if (bill.ownerId !== userId) {
      return res
        .status(403)
        .json({ message: 'Apenas quem criou a conta pode arquivá-la' });
    }

    await prisma.bill.update({
      where: { id: billId },
      data: { archived: true },
    });

    return res.status(200).json({ message: 'Conta arquivada com sucesso' });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Erro ao arquivar conta' });
  }
});

// Atualizar conta (somente quem criou a conta e enquanto estiver em aberto)
router.patch('/:billId', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { billId } = req.params;
    const userId = req.user!.id;

    const {
      title,
      dueDate,
      totalAmount,
      installments,
      pixKey,
      paymentLink,
      attachmentUrl,
      ownerId,
      receiverId,
      category,
    } = req.body as {
      title?: string;
      dueDate?: string;
      totalAmount?: number;
      installments?: number;
      pixKey?: string;
      paymentLink?: string;
      attachmentUrl?: string;
      ownerId?: string;
      receiverId?: string;
      category?: string;
    };

    const bill = await prisma.bill.findUnique({
      where: { id: billId },
      include: { shares: true },
    });

    if (!bill || bill.archived) {
      return res.status(404).json({ message: 'Conta não encontrada' });
    }

    if (bill.ownerId !== userId) {
      return res
        .status(403)
        .json({ message: 'Apenas quem criou a conta pode editá-la' });
    }

    if (bill.status !== 'OPEN') {
      return res
        .status(400)
        .json({ message: 'Apenas contas em aberto podem ser editadas' });
    }

    const data: any = {};

    if (title !== undefined) {
      data.title = title;
    }
    if (dueDate !== undefined) {
      data.dueDate = new Date(dueDate);
    }
    if (totalAmount !== undefined) {
      data.totalAmount = totalAmount;
    }
    if (installments !== undefined) {
      data.installments = installments;
    }
    if (pixKey !== undefined) {
      data.pixKey = pixKey;
    }
    if (paymentLink !== undefined) {
      data.paymentLink = paymentLink;
    }
    if (attachmentUrl !== undefined) {
      data.attachmentUrl = attachmentUrl;
    }
    if (ownerId !== undefined) {
      data.ownerId = ownerId;
    }
    if (receiverId !== undefined) {
      data.receiverId = receiverId;
    }
    if (category !== undefined) {
      data.category = category;
    }

    const updatedBill = await prisma.bill.update({
      where: { id: billId },
      data,
      include: {
        shares: true,
        owner: true,
        receiver: true,
      },
    });

    if (totalAmount !== undefined) {
      const promises = bill.shares.map(
        (share: { id: string; percentage: number }) =>
          prisma.billShare.update({
            where: { id: share.id },
            data: {
              amount: (totalAmount * share.percentage) / 100,
            },
          }),
      );

      await Promise.all(promises);
    }

    return res.json(updatedBill);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Erro ao atualizar conta' });
  }
});

// Registrar pagamento de uma parte da conta
router.post('/:billId/payments', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { billId } = req.params;
    const { fromUserId, amount, method } = req.body as {
      fromUserId: string;
      amount: number;
      method?: string;
    };

    const bill = await prisma.bill.findUnique({
      where: { id: billId },
      include: { shares: true },
    });

    if (!bill) {
      return res.status(404).json({ message: 'Conta não encontrada' });
    }

    if (!bill.receiverId) {
      return res.status(400).json({ message: 'Conta não possui destinatário vinculado' });
    }

    const receiverId = bill.receiverId;

    const payment = await prisma.payment.create({
      data: {
        billId,
        fromUserId,
        toUserId: receiverId,
        amount,
        method,
        status: 'COMPLETED',
      },
    });

    // Atualizar share do usuário se quitou o valor
    const share = bill.shares.find(
      (s: { id: string; userId: string; amount: number }) => s.userId === fromUserId,
    );
    if (share && amount >= share.amount) {
      await prisma.billShare.update({
        where: { id: share.id },
        data: { status: 'PAID' },
      });
    }

    // Verificar se todas as partes foram pagas
    const remaining = await prisma.billShare.count({
      where: {
        billId,
        status: 'PENDING',
      },
    });

    await prisma.bill.update({
      where: { id: billId },
      data: {
        status: remaining === 0 ? 'PAID' : 'PARTIALLY_PAID',
      },
    });

    await prisma.activity.create({
      data: {
        groupId: bill.groupId,
        userId: req.user?.id,
        type: 'PAYMENT_REGISTERED',
        description: `Pagamento registrado na conta "${bill.title}"`,
      },
    });

    const io = req.app.get('io');
    if (io) {
      io.to(bill.groupId).emit('payment:created', payment);
    }

    res.status(201).json(payment);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Erro ao registrar pagamento' });
  }
});

export default router;
