import { Router, Response } from 'express';
import { prisma } from '../prisma';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();

const parseDateOnly = (value: string) => {
  // Evita deslocamento de fuso convertendo "YYYY-MM-DD" para UTC meio-dia
  const parts = value.split('-').map((p) => Number(p));
  if (parts.length === 3) {
    const [year, month, day] = parts;
    return new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  }
  return new Date(value);
};

// Criar conta em um ambiente
router.post('/environments/:environmentId', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { environmentId } = req.params;
    const userId = req.user!.id;
    const {
      groupId,
      title,
      dueDate,
      totalAmount,
      installments = 1,
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
      return res.status(400).json({ message: 'Dados obrigatórios faltando para criar conta' });
    }

    if (!receiverId && !receiverName) {
      return res.status(400).json({ message: 'Destinatário é obrigatório' });
    }

    const environment = await prisma.environment.findUnique({ where: { id: environmentId } });
    if (!environment || environment.groupId !== groupId) {
      return res.status(404).json({ message: 'Ambiente não encontrado' });
    }

    const group = await prisma.group.findFirst({
      where: {
        id: groupId,
        archived: false,
        members: { some: { userId, active: true } },
      },
    });
    if (!group) {
      return res.status(403).json({ message: 'Acesso negado ao grupo' });
    }

    let effectiveReceiverId = receiverId || null;
    let effectiveReceiverName = receiverName || null;
    if (!effectiveReceiverId && effectiveReceiverName) {
      const matchedUser = await prisma.user.findFirst({ where: { name: effectiveReceiverName } });
      if (matchedUser) effectiveReceiverId = matchedUser.id;
    }

    const sumPercent = shares.reduce(
      (acc: number, s: { userId: string; percentage: number }) => acc + s.percentage,
      0,
    );
    if (Math.round(sumPercent) !== 100) {
      return res.status(400).json({ message: 'Soma das porcentagens deve ser 100%' });
    }

    const parsedDueDate = parseDateOnly(dueDate);

    const bill = await prisma.bill.create({
      data: {
        title,
        dueDate: parsedDueDate,
        totalAmount,
        installments,
        pixKey,
        paymentLink,
        attachmentUrl,
        groupId,
        environmentId,
        ownerId,
        receiverId: effectiveReceiverId || undefined,
        receiverName: effectiveReceiverName || undefined,
        category: category || undefined,
        shares: {
          create: shares.map((s) => ({
            userId: s.userId,
            percentage: s.percentage,
            amount: (totalAmount * s.percentage) / 100,
          })),
        },
      },
      include: { shares: true, owner: true, receiver: true },
    });

    return res.status(201).json(bill);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Erro ao criar conta' });
  }
});

// Listar contas de um ambiente com filtros de mês/ano/status
router.get('/environments/:environmentId', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { environmentId } = req.params;
    const userId = req.user!.id;
    const { month, year, status } = req.query as {
      month?: string;
      year?: string;
      status?: string;
    };

    const environment = await prisma.environment.findUnique({
      where: { id: environmentId },
      include: { group: { include: { members: true } } },
    });
    if (!environment) {
      return res.status(404).json({ message: 'Ambiente não encontrado' });
    }
    const isMember = environment.group.members.some((m) => m.userId === userId && m.active);
    if (!isMember) {
      return res.status(403).json({ message: 'Acesso negado ao ambiente' });
    }

    const filters: any = {
      environmentId,
      archived: false,
    };

    if (month && year) {
      const m = Number(month);
      const y = Number(year);
      if (!Number.isNaN(m) && !Number.isNaN(y)) {
        const start = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0));
        const end = new Date(Date.UTC(y, m, 1, 0, 0, 0));
        filters.dueDate = { gte: start, lt: end };
      }
    }

    if (status) {
      filters.status = status as any;
    }

    const bills = await prisma.bill.findMany({
      where: filters,
      include: {
        shares: { include: { user: true } },
        owner: true,
        receiver: true,
      },
      orderBy: { dueDate: 'asc' },
    });

    return res.json(bills);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Erro ao listar contas do ambiente' });
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
      receiverName,
      category,
      shares,
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
      receiverName?: string;
      category?: string;
      shares?: { userId: string; percentage: number }[];
    };

    const bill = await prisma.bill.findUnique({
      where: { id: billId },
      include: { shares: true },
    });

    if (!bill || bill.archived) {
      return res.status(404).json({ message: 'Conta não encontrada' });
    }

    // Permite edição pelo dono OU admin do grupo
    if (bill.ownerId !== userId) {
      const membership = await prisma.groupMember.findFirst({
        where: { groupId: bill.groupId, userId, active: true, role: 'ADMIN' },
      });
      if (!membership) {
        return res
          .status(403)
          .json({ message: 'Apenas quem criou a conta pode editá-la' });
      }
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
    if (receiverName !== undefined) {
      data.receiverName = receiverName;
    }

    const updatedBill = await prisma.$transaction(async (tx) => {
      // Atualiza dados principais
      const billUpdated = await tx.bill.update({
        where: { id: billId },
        data,
        include: {
          shares: true,
          owner: true,
          receiver: true,
        },
      });

      // Atualiza shares se fornecido
      if (shares && shares.length > 0) {
        const sumPercent = shares.reduce(
          (acc: number, s: { userId: string; percentage: number }) => acc + s.percentage,
          0,
        );
        if (Math.round(sumPercent) !== 100) {
          throw new Error('INVALID_PERCENT');
        }

        // apagar shares antigos e recriar para simplificar manutenção
        await tx.billShare.deleteMany({ where: { billId } });
        await tx.billShare.createMany({
          data: shares.map((s) => ({
            billId,
            userId: s.userId,
            percentage: s.percentage,
            amount:
              totalAmount !== undefined
                ? (totalAmount * s.percentage) / 100
                : billUpdated.totalAmount * s.percentage / 100,
          })),
        });
      } else if (totalAmount !== undefined) {
        // reaplica montantes se apenas valor total mudou
        const promises = billUpdated.shares.map((share: { id: string; percentage: number }) =>
          tx.billShare.update({
            where: { id: share.id },
            data: {
              amount: (totalAmount * share.percentage) / 100,
            },
          }),
        );
        await Promise.all(promises);
      }
      return billUpdated;
    });

    if (!updatedBill) {
      return res.status(500).json({ message: 'Erro ao atualizar conta' });
    }

    return res.json(updatedBill);
  } catch (error) {
    console.error(error);
    if ((error as Error).message === 'INVALID_PERCENT') {
      return res.status(400).json({ message: 'Soma das porcentagens deve ser 100%' });
    }
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
