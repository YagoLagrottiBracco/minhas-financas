import { Router, Response } from 'express';
import { prisma } from '../prisma';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();

const addMonths = (date: Date, months: number) => {
  const d = new Date(date.getTime());
  d.setMonth(d.getMonth() + months);
  return d;
};

const addWeeks = (date: Date, weeks: number) => {
  const d = new Date(date.getTime());
  d.setDate(d.getDate() + weeks * 7);
  return d;
};

const addYears = (date: Date, years: number) => {
  const d = new Date(date.getTime());
  d.setFullYear(d.getFullYear() + years);
  return d;
};

const getNextDueDate = (current: Date, frequency: string) => {
  if (frequency === 'WEEKLY') return addWeeks(current, 1);
  if (frequency === 'YEARLY') return addYears(current, 1);
  // Padrão: mensal
  return addMonths(current, 1);
};

// Criar configuração de conta recorrente em um ambiente (e opcionalmente gerar a primeira conta)
router.post(
  '/environments/:environmentId',
  authMiddleware,
  async (req: AuthRequest, res: Response) => {
    try {
      const { environmentId } = req.params;
      const {
        groupId,
        title,
        totalAmount,
        frequency,
        dueDate,
        pixKey,
        paymentLink,
        attachmentUrl,
        ownerId,
        receiverId,
        receiverName,
        shares,
        createFirstBill = true,
      } = req.body as {
        groupId: string;
        title: string;
        totalAmount: number;
        frequency: 'MONTHLY' | 'WEEKLY' | 'YEARLY';
        dueDate: string; // primeira data de vencimento
        pixKey?: string;
        paymentLink?: string;
        attachmentUrl?: string;
        ownerId: string;
        receiverId?: string;
        receiverName?: string;
        shares: { userId: string; percentage: number }[];
        createFirstBill?: boolean;
      };

      if (!groupId || !title || !totalAmount || !frequency || !ownerId || !shares?.length) {
        return res.status(400).json({ message: 'Dados obrigatórios faltando para criar recorrência' });
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

      const firstDueDate = new Date(dueDate);
      const nextDueDate = getNextDueDate(firstDueDate, frequency);

      const recurring = await prisma.recurringBill.create({
        data: {
          title,
          totalAmount,
          frequency,
          dayOfMonth: firstDueDate.getDate(),
          nextDueDate,
          pixKey,
          paymentLink,
          attachmentUrl,
          groupId,
          environmentId,
          ownerId,
          receiverId: effectiveReceiverId || undefined,
          receiverName: effectiveReceiverName || undefined,
          shares: {
            create: shares.map((s) => ({
              userId: s.userId,
              percentage: s.percentage,
            })),
          },
        },
        include: {
          shares: true,
        },
      });

      let createdBill = null;

      if (createFirstBill) {
        createdBill = await prisma.bill.create({
          data: {
            title,
            dueDate: firstDueDate,
            totalAmount,
            installments: 1,
            pixKey,
            paymentLink,
            attachmentUrl,
            groupId,
            environmentId,
            ownerId,
            receiverId: recurring.receiverId || undefined,
            receiverName: recurring.receiverName || undefined,
            recurringBillId: recurring.id,
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
      }

      return res.status(201).json({ recurring, firstBill: createdBill });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: 'Erro ao criar conta recorrente' });
    }
  },
);

// Listar configurações recorrentes de um ambiente
router.get(
  '/environments/:environmentId',
  authMiddleware,
  async (req: AuthRequest, res: Response) => {
    try {
      const { environmentId } = req.params;

      const recurring = await prisma.recurringBill.findMany({
        where: { environmentId },
        include: {
          shares: {
            include: { user: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      return res.json(recurring);
    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: 'Erro ao listar contas recorrentes' });
    }
  },
);

// Ativar/desativar uma configuração recorrente
router.patch('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { active } = req.body as { active: boolean };

    const updated = await prisma.recurringBill.update({
      where: { id },
      data: { active },
    });

    return res.json(updated);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Erro ao atualizar conta recorrente' });
  }
});

// Gerar contas para recorrências vencidas (pode ser chamado via cron ou botão na UI)
router.post('/generate-due', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { groupId, environmentId } = (req.body || {}) as {
      groupId?: string;
      environmentId?: string;
    };

    const now = new Date();

    const where: any = {
      active: true,
      nextDueDate: {
        lte: now,
      },
    };

    if (groupId) where.groupId = groupId;
    if (environmentId) where.environmentId = environmentId;

    const templates = await prisma.recurringBill.findMany({
      where,
      include: {
        shares: true,
      },
    });

    const createdBills = [] as any[];

    for (const tmpl of templates) {
      const due = tmpl.nextDueDate;

      const bill = await prisma.bill.create({
        data: {
          title: tmpl.title,
          dueDate: due,
          totalAmount: tmpl.totalAmount,
          installments: 1,
          pixKey: tmpl.pixKey,
          paymentLink: tmpl.paymentLink,
          attachmentUrl: tmpl.attachmentUrl,
          groupId: tmpl.groupId,
          environmentId: tmpl.environmentId,
          ownerId: tmpl.ownerId,
          receiverId: tmpl.receiverId,
          recurringBillId: tmpl.id,
          shares: {
            create: tmpl.shares.map((s: { userId: string; percentage: number }) => ({
              userId: s.userId,
              percentage: s.percentage,
              amount: (tmpl.totalAmount * s.percentage) / 100,
            })),
          },
        },
        include: {
          shares: true,
        },
      });

      createdBills.push(bill);

      const next = getNextDueDate(tmpl.nextDueDate, tmpl.frequency);

      await prisma.recurringBill.update({
        where: { id: tmpl.id },
        data: {
          nextDueDate: next,
        },
      });
    }

    return res.json({ count: createdBills.length, bills: createdBills });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Erro ao gerar contas recorrentes' });
  }
});

export default router;
