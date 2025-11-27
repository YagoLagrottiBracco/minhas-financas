import { Router, Response } from 'express';
import { prisma } from '../prisma';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();

// Resumo geral (quanto deve, quanto tem a receber) com filtros por grupo e pessoa
router.get('/summary', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const loggedUserId = req.user!.id;
    const { month, year, groupId, personId } = req.query as {
      month?: string;
      year?: string;
      groupId?: string;
      personId?: string;
    };

    let dateFilter: { gte: Date; lt: Date } | undefined;
    const monthNum = month ? parseInt(month, 10) : NaN;
    const yearNum = year ? parseInt(year, 10) : NaN;
    if (!Number.isNaN(monthNum) && !Number.isNaN(yearNum)) {
      const from = new Date(yearNum, monthNum - 1, 1);
      const to = new Date(yearNum, monthNum, 1);
      dateFilter = { gte: from, lt: to };
    }

    // Grupos aos quais o usuário logado pertence
    const memberships = await prisma.groupMember.findMany({
      where: { userId: loggedUserId, active: true },
      select: { groupId: true },
    });

    const allowedGroupIds = memberships.map((m: { groupId: string }) => m.groupId);

    if (!allowedGroupIds.length) {
      return res.json({ totalToPay: 0, totalToReceive: 0, netBalance: 0 });
    }

    const billWhereBase: any = {
      archived: false,
      groupId: { in: allowedGroupIds },
    };

    if (dateFilter) {
      billWhereBase.dueDate = dateFilter;
    }

    if (groupId) {
      if (!allowedGroupIds.includes(groupId)) {
        return res.status(403).json({ message: 'Você não tem acesso a este grupo' });
      }
      billWhereBase.groupId = groupId;
    }

    const targetUserId = personId || loggedUserId;

    // Quanto a pessoa deve (shares pendentes onde ela é o devedor)
    const whereShare: any = {
      userId: targetUserId,
      status: 'PENDING',
      bill: billWhereBase,
    };

    const sharesToPay = await prisma.billShare.findMany({
      where: whereShare,
      select: {
        amount: true,
      },
    });

    const totalToPay = sharesToPay.reduce(
      (acc: number, s: { amount: number }) => acc + s.amount,
      0,
    );

    // Quanto a pessoa tem a receber (somatório das partes de outros usuários em contas onde ela é o recebedor)
    const whereBills: any = {
      ...billWhereBase,
      receiverId: targetUserId,
    };

    const billsToReceive = await prisma.bill.findMany({
      where: whereBills,
      include: {
        shares: true,
      },
    });

    const totalToReceive = billsToReceive.reduce(
      (
        acc: number,
        bill: { shares: { userId: string; status: string; amount: number }[] },
      ) => {
      const othersShares = bill.shares.filter(
        (s: { userId: string; status: string; amount: number }) =>
          s.userId !== targetUserId && s.status === 'PENDING',
      );
      const sum = othersShares.reduce((sAcc: number, s: { amount: number }) => sAcc + s.amount, 0);
      return acc + sum;
    }, 0);

    const netBalance = totalToReceive - totalToPay;

    res.json({
      totalToPay,
      totalToReceive,
      netBalance,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Erro ao carregar resumo' });
  }
});

// Histórico simples (últimas atividades do usuário)
router.get('/history', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { month, year } = req.query as { month?: string; year?: string };

    let dateFilter: { gte: Date; lt: Date } | undefined;
    const monthNum = month ? parseInt(month, 10) : NaN;
    const yearNum = year ? parseInt(year, 10) : NaN;
    if (!Number.isNaN(monthNum) && !Number.isNaN(yearNum)) {
      const from = new Date(yearNum, monthNum - 1, 1);
      const to = new Date(yearNum, monthNum, 1);
      dateFilter = { gte: from, lt: to };
    }

    const whereActivity: any = {
      OR: [
        { userId },
        {
          group: {
            members: {
              some: { userId },
            },
          },
        },
      ],
    };

    if (dateFilter) {
      whereActivity.createdAt = dateFilter;
    }

    const activities = await prisma.activity.findMany({
      where: whereActivity,
      include: {
        group: true,
        user: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    res.json(activities);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Erro ao carregar histórico' });
  }
});

// Resumo por categoria (quanto a pessoa deve por categoria no período), com filtros de grupo/pessoa
router.get('/categories', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const loggedUserId = req.user!.id;
    const { month, year, groupId, personId } = req.query as {
      month?: string;
      year?: string;
      groupId?: string;
      personId?: string;
    };

    let dateFilter: { gte: Date; lt: Date } | undefined;
    const monthNum = month ? parseInt(month, 10) : NaN;
    const yearNum = year ? parseInt(year, 10) : NaN;
    if (!Number.isNaN(monthNum) && !Number.isNaN(yearNum)) {
      const from = new Date(yearNum, monthNum - 1, 1);
      const to = new Date(yearNum, monthNum, 1);
      dateFilter = { gte: from, lt: to };
    }

    // Grupos aos quais o usuário logado pertence
    const memberships = await prisma.groupMember.findMany({
      where: { userId: loggedUserId, active: true },
      select: { groupId: true },
    });

    const allowedGroupIds = memberships.map((m: { groupId: string }) => m.groupId);

    if (!allowedGroupIds.length) {
      return res.json([]);
    }

    const billWhereBase: any = {
      archived: false,
      groupId: { in: allowedGroupIds },
    };

    if (dateFilter) {
      billWhereBase.dueDate = dateFilter;
    }

    if (groupId) {
      if (!allowedGroupIds.includes(groupId)) {
        return res.status(403).json({ message: 'Você não tem acesso a este grupo' });
      }
      billWhereBase.groupId = groupId;
    }

    const targetUserId = personId || loggedUserId;

    const whereShare: any = {
      userId: targetUserId,
      status: 'PENDING',
      bill: billWhereBase,
    };

    const shares = await prisma.billShare.findMany({
      where: whereShare,
      select: {
        amount: true,
        bill: {
          select: {
            category: true,
          },
        },
      },
    });

    const byCategory: Record<string, number> = {};

    shares.forEach((s: { amount: number; bill?: { category?: string | null } | null }) => {
      const cat = s.bill?.category || 'Sem categoria';
      const key = cat.trim() || 'Sem categoria';
      byCategory[key] = (byCategory[key] || 0) + s.amount;
    });

    const result = Object.entries(byCategory).map(([category, amount]) => ({
      category,
      amount,
    }));

    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Erro ao carregar resumo por categoria' });
  }
});

// Lista de dívidas (shares pendentes) com filtros por grupo, categoria, mês/ano e pessoa
router.get('/debts', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { month, year, groupId, category, personId } = req.query as {
      month?: string;
      year?: string;
      groupId?: string;
      category?: string;
      personId?: string;
    };

    let dateFilter: { gte: Date; lt: Date } | undefined;
    const monthNum = month ? parseInt(month, 10) : NaN;
    const yearNum = year ? parseInt(year, 10) : NaN;
    if (!Number.isNaN(monthNum) && !Number.isNaN(yearNum)) {
      const from = new Date(yearNum, monthNum - 1, 1);
      const to = new Date(yearNum, monthNum, 1);
      dateFilter = { gte: from, lt: to };
    }

    // Grupos aos quais o usuário logado pertence
    const memberships = await prisma.groupMember.findMany({
      where: { userId, active: true },
      select: { groupId: true },
    });

    const allowedGroupIds = memberships.map((m: { groupId: string }) => m.groupId);

    if (!allowedGroupIds.length) {
      return res.json([]);
    }

    const billWhere: any = {
      archived: false,
      groupId: { in: allowedGroupIds },
    };

    if (dateFilter) {
      billWhere.dueDate = dateFilter;
    }

    if (groupId) {
      if (!allowedGroupIds.includes(groupId)) {
        return res.status(403).json({ message: 'Você não tem acesso a este grupo' });
      }
      billWhere.groupId = groupId;
    }

    if (category) {
      billWhere.category = category;
    }

    const targetPersonId = personId || userId;

    const shares = await prisma.billShare.findMany({
      where: {
        userId: targetPersonId,
        status: 'PENDING',
        bill: billWhere,
      },
      include: {
        bill: {
          include: {
            group: true,
            environment: true,
            owner: {
              select: {
                id: true,
                name: true,
              },
            },
            receiver: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        user: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: [
        { bill: { dueDate: 'asc' } },
        { createdAt: 'asc' },
      ],
    });

    const result = shares.map((share: {
      id: string;
      billId: string;
      amount: number;
      percentage: number;
      bill: {
        id: string;
        title: string;
        dueDate: Date;
        totalAmount: number;
        category: string | null;
        groupId: string;
        environmentId: string;
        group: { id: string; name: string };
        environment: { id: string; name: string };
        ownerId: string;
        owner: { id: string; name: string } | null;
        receiverId: string | null;
        receiverName: string | null;
        receiver: { id: string; name: string } | null;
      };
      user: { id: string; name: string };
    }) => ({
      shareId: share.id,
      billId: share.billId,
      groupId: share.bill.groupId,
      groupName: share.bill.group.name,
      environmentId: share.bill.environmentId,
      environmentName: share.bill.environment.name,
      title: share.bill.title,
      category: share.bill.category,
      dueDate: share.bill.dueDate,
      totalAmount: share.bill.totalAmount,
      shareAmount: share.amount,
      sharePercentage: share.percentage,
      payer: {
        userId: share.user.id,
        name: share.user.name,
      },
      receiverUserId: share.bill.receiverId ?? null,
      receiverUserName: share.bill.receiver?.name ?? null,
      receiverName: share.bill.receiverName ?? null,
      ownerUserId: share.bill.ownerId,
      ownerUserName: share.bill.owner?.name ?? null,
    }));

    return res.json(result);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Erro ao carregar dívidas' });
  }
});

export default router;
