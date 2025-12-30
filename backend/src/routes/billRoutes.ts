import { Router, Response } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../prisma';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();

// ... (rest of the code remains the same)

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
