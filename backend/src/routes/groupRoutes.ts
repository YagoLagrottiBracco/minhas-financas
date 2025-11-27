import { Router, Response } from 'express';
import { prisma } from '../prisma';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();

// Listar grupos do usuário
router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;

    const groups = await prisma.group.findMany({
      where: {
        archived: false,
        members: {
          some: { userId, active: true },
        },
      },
      include: {
        members: { where: { active: true }, include: { user: true } },
        environments: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(groups);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Erro ao listar grupos' });
  }
});

// Listar categorias do grupo
router.get('/:groupId/categories', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { groupId } = req.params;

    const group = await prisma.group.findFirst({
      where: {
        id: groupId,
        archived: false,
        members: {
          some: {
            userId,
            active: true,
          },
        },
      },
    });

    if (!group) {
      return res.status(404).json({ message: 'Grupo não encontrado' });
    }

    const categories = await prisma.category.findMany({
      where: {
        groupId,
        archived: false,
      },
      orderBy: {
        name: 'asc',
      },
    });

    return res.json(categories);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Erro ao listar categorias do grupo' });
  }
});

// Criar ou reativar categoria no grupo
router.post('/:groupId/categories', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { groupId } = req.params;
    const { name } = req.body as { name?: string };

    const trimmedName = (name || '').trim();
    if (!trimmedName) {
      return res.status(400).json({ message: 'Nome da categoria é obrigatório' });
    }

    const group = await prisma.group.findFirst({
      where: {
        id: groupId,
        archived: false,
        members: {
          some: {
            userId,
            active: true,
          },
        },
      },
    });

    if (!group) {
      return res.status(404).json({ message: 'Grupo não encontrado' });
    }

    const category = await prisma.category.upsert({
      where: {
        groupId_name: {
          groupId,
          name: trimmedName,
        },
      },
      create: {
        groupId,
        name: trimmedName,
      },
      update: {
        archived: false,
        name: trimmedName,
      },
    });

    return res.status(201).json(category);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Erro ao salvar categoria' });
  }
});

// Criar grupo
router.post('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { name, description } = req.body;

    if (!name) {
      return res.status(400).json({ message: 'Nome do grupo é obrigatório' });
    }

    const group = await prisma.group.create({
      data: {
        name,
        description,
        ownerId: userId,
        members: {
          create: {
            userId,
            role: 'ADMIN',
          },
        },
      },
      include: {
        members: { include: { user: true } },
        environments: true,
      },
    });

    // Ambiente padrão "Casa"
    await prisma.environment.create({
      data: {
        name: 'Casa',
        description: 'Ambiente padrão',
        groupId: group.id,
      },
    });

    res.status(201).json(group);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Erro ao criar grupo' });
  }
});

// Adicionar membro por e-mail
router.post('/:groupId/members', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { groupId } = req.params;
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: 'E-mail é obrigatório' });
    }

    const group = await prisma.group.findUnique({ where: { id: groupId } });
    if (!group) {
      return res.status(404).json({ message: 'Grupo não encontrado' });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(404).json({ message: 'Usuário não encontrado' });
    }

    await prisma.groupMember.upsert({
      where: {
        groupId_userId: {
          groupId,
          userId: user.id,
        },
      },
      create: {
        groupId,
        userId: user.id,
        role: 'MEMBER',
      },
      update: {},
    });

    const updated = await prisma.group.findUnique({
      where: { id: groupId },
      include: {
        members: { include: { user: true } },
        environments: true,
      },
    });

    res.json(updated);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Erro ao adicionar membro' });
  }
});

// Criar ambiente dentro do grupo
router.post('/:groupId/environments', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { groupId } = req.params;
    const { name, description } = req.body;

    if (!name) {
      return res.status(400).json({ message: 'Nome do ambiente é obrigatório' });
    }

    const group = await prisma.group.findUnique({ where: { id: groupId } });
    if (!group) {
      return res.status(404).json({ message: 'Grupo não encontrado' });
    }

    const environment = await prisma.environment.create({
      data: {
        name,
        description,
        groupId,
      },
    });

    res.status(201).json(environment);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Erro ao criar ambiente' });
  }
});

// Listar ambientes do grupo
router.get('/:groupId/environments', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { groupId } = req.params;

    const environments = await prisma.environment.findMany({
      where: { groupId, archived: false },
      orderBy: { createdAt: 'desc' },
    });

    res.json(environments);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Erro ao listar ambientes' });
  }
});

// Arquivar ambiente (apenas dono do grupo)
router.patch(
  '/:groupId/environments/:environmentId/archive',
  authMiddleware,
  async (req: AuthRequest, res: Response) => {
    try {
      const { groupId, environmentId } = req.params;
      const userId = req.user!.id;

      const group = await prisma.group.findUnique({ where: { id: groupId } });
      if (!group || group.archived) {
        return res.status(404).json({ message: 'Grupo não encontrado' });
      }

      if (group.ownerId !== userId) {
        return res
          .status(403)
          .json({ message: 'Apenas o dono do grupo pode arquivar ambientes' });
      }

      const environment = await prisma.environment.findFirst({
        where: { id: environmentId, groupId },
      });

      if (!environment || environment.archived) {
        return res.status(404).json({ message: 'Ambiente não encontrado' });
      }

      await prisma.environment.update({
        where: { id: environmentId },
        data: { archived: true },
      });

      return res.status(200).json({ message: 'Ambiente arquivado com sucesso' });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: 'Erro ao arquivar ambiente' });
    }
  },
);

// Arquivar grupo (apenas dono do grupo)
router.patch('/:groupId/archive', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { groupId } = req.params;
    const userId = req.user!.id;

    const group = await prisma.group.findUnique({ where: { id: groupId } });
    if (!group || group.archived) {
      return res.status(404).json({ message: 'Grupo não encontrado' });
    }

    if (group.ownerId !== userId) {
      return res
        .status(403)
        .json({ message: 'Apenas o dono do grupo pode arquivar o grupo' });
    }

    await prisma.group.update({
      where: { id: groupId },
      data: { archived: true },
    });

    return res.status(200).json({ message: 'Grupo arquivado com sucesso' });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Erro ao arquivar grupo' });
  }
});

// Sair do grupo (membro comum)
router.post('/:groupId/leave', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { groupId } = req.params;
    const userId = req.user!.id;

    const group = await prisma.group.findUnique({ where: { id: groupId } });
    if (!group || group.archived) {
      return res.status(404).json({ message: 'Grupo não encontrado' });
    }

    if (group.ownerId === userId) {
      return res.status(400).json({
        message: 'O dono do grupo não pode sair do grupo. Arquive o grupo em vez disso.',
      });
    }

    const membership = await prisma.groupMember.findUnique({
      where: {
        groupId_userId: {
          groupId,
          userId,
        },
      },
    });

    if (!membership || !membership.active) {
      return res.status(404).json({ message: 'Membro não encontrado no grupo' });
    }

    await prisma.groupMember.update({
      where: { id: membership.id },
      data: { active: false },
    });

    return res.status(200).json({ message: 'Você saiu do grupo com sucesso' });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Erro ao sair do grupo' });
  }
});

// Resumo por membro dentro de um grupo (totais de deve / tem a receber / saldo)
router.get('/:groupId/summary', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { groupId } = req.params;
    const { month, year } = req.query as { month?: string; year?: string };

    let dateFilter: { gte: Date; lt: Date } | undefined;
    const monthNum = month ? parseInt(month, 10) : NaN;
    const yearNum = year ? parseInt(year, 10) : NaN;
    if (!Number.isNaN(monthNum) && !Number.isNaN(yearNum)) {
      const from = new Date(yearNum, monthNum - 1, 1);
      const to = new Date(yearNum, monthNum, 1);
      dateFilter = { gte: from, lt: to };
    }

    const group = await prisma.group.findUnique({
      where: { id: groupId },
      include: {
        members: {
          include: {
            user: true,
          },
        },
      },
    });

    if (!group) {
      return res.status(404).json({ message: 'Grupo não encontrado' });
    }

    const memberSummaries = await Promise.all(
      group.members.map(async (member: any) => {
        const userId = member.userId;

        const billWhere: any = {
          groupId,
        };
        if (dateFilter) {
          billWhere.dueDate = dateFilter;
        }

        const shareWhere: any = {
          userId,
          status: 'PENDING',
          bill: billWhere,
        };

        const sharesToPay = await prisma.billShare.findMany({
          where: shareWhere,
          select: {
            amount: true,
          },
        });

        const totalToPay = sharesToPay.reduce(
          (acc: number, s: { amount: number }) => acc + s.amount,
          0,
        );

        const billsWhere: any = {
          receiverId: userId,
          groupId,
        };
        if (dateFilter) {
          billsWhere.dueDate = dateFilter;
        }

        const billsToReceive = await prisma.bill.findMany({
          where: billsWhere,
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
                s.userId !== userId && s.status === 'PENDING',
            );
            const sum = othersShares.reduce(
              (sAcc: number, s: { amount: number }) => sAcc + s.amount,
              0,
            );
            return acc + sum;
          },
          0,
        );

        const netBalance = totalToReceive - totalToPay;

        return {
          userId,
          user: member.user,
          totalToPay,
          totalToReceive,
          netBalance,
        };
      }),
    );

    return res.json({ members: memberSummaries });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Erro ao carregar resumo do grupo' });
  }
});

// Resumo por membro dentro de um ambiente específico
router.get(
  '/:groupId/environments/:environmentId/summary',
  authMiddleware,
  async (req: AuthRequest, res: Response) => {
    try {
      const { groupId, environmentId } = req.params;
      const { month, year } = req.query as { month?: string; year?: string };

      let dateFilter: { gte: Date; lt: Date } | undefined;
      const monthNum = month ? parseInt(month, 10) : NaN;
      const yearNum = year ? parseInt(year, 10) : NaN;
      if (!Number.isNaN(monthNum) && !Number.isNaN(yearNum)) {
        const from = new Date(yearNum, monthNum - 1, 1);
        const to = new Date(yearNum, monthNum, 1);
        dateFilter = { gte: from, lt: to };
      }

      const group = await prisma.group.findUnique({
        where: { id: groupId },
        include: {
          members: {
            include: {
              user: true,
            },
          },
        },
      });

      if (!group) {
        return res.status(404).json({ message: 'Grupo não encontrado' });
      }

      const environment = await prisma.environment.findFirst({
        where: {
          id: environmentId,
          groupId,
        },
      });

      if (!environment) {
        return res.status(404).json({ message: 'Ambiente não encontrado' });
      }

      const memberSummaries = await Promise.all(
        group.members.map(async (member: any) => {
          const userId = member.userId;

          const billWhere: any = {
            environmentId,
          };
          if (dateFilter) {
            billWhere.dueDate = dateFilter;
          }

          const sharesWhere: any = {
            userId,
            status: 'PENDING',
            bill: billWhere,
          };

          const sharesToPay = await prisma.billShare.findMany({
            where: sharesWhere,
            select: {
              amount: true,
            },
          });

          const totalToPay = sharesToPay.reduce(
            (acc: number, s: { amount: number }) => acc + s.amount,
            0,
          );

          const billsWhere: any = {
            receiverId: userId,
            environmentId,
          };
          if (dateFilter) {
            billsWhere.dueDate = dateFilter;
          }

          const billsToReceive = await prisma.bill.findMany({
            where: billsWhere,
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
                  s.userId !== userId && s.status === 'PENDING',
              );
              const sum = othersShares.reduce(
                (sAcc: number, s: { amount: number }) => sAcc + s.amount,
                0,
              );
              return acc + sum;
            },
            0,
          );

          const netBalance = totalToReceive - totalToPay;

          return {
            userId,
            user: member.user,
            totalToPay,
            totalToReceive,
            netBalance,
          };
        }),
      );

      return res.json({ members: memberSummaries });
    } catch (error) {
      console.error(error);
      return res
        .status(500)
        .json({ message: 'Erro ao carregar resumo do ambiente' });
    }
  },
);

export default router;
