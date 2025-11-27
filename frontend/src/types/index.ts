export interface User {
  id: string;
  name: string;
  email: string;
  createdAt: string;
  updatedAt: string;
}

export interface GroupMember {
  id: string;
  role: 'ADMIN' | 'MEMBER';
  createdAt: string;
  updatedAt: string;
  active: boolean;
  user: User;
}

export interface Environment {
  id: string;
  name: string;
  description?: string | null;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
  groupId: string;
}

export interface Group {
  id: string;
  name: string;
  description?: string | null;
  createdAt: string;
  updatedAt: string;
  archived: boolean;
  ownerId: string;
  members: GroupMember[];
  environments: Environment[];
}

export interface Category {
  id: string;
  name: string;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
  groupId: string;
}

export interface BillShare {
  id: string;
  billId: string;
  userId: string;
  percentage: number;
  amount: number;
  status: 'PENDING' | 'PAID';
  createdAt: string;
  updatedAt: string;
  user?: User;
}

export interface Bill {
  id: string;
  title: string;
  dueDate: string;
  totalAmount: number;
  installments: number;
  pixKey?: string | null;
  paymentLink?: string | null;
  attachmentUrl?: string | null;
  status: 'OPEN' | 'PARTIALLY_PAID' | 'PAID';
  createdAt: string;
  updatedAt: string;
  archived: boolean;
  groupId: string;
  environmentId: string;
  ownerId: string;
  receiverId?: string | null;
  receiverName?: string | null;
  category?: string | null;
  shares: BillShare[];
  owner?: User;
  receiver?: User;
}

export interface Payment {
  id: string;
  billId?: string | null;
  fromUserId: string;
  toUserId: string;
  amount: number;
  method?: string | null;
  status: 'PENDING' | 'COMPLETED' | 'CANCELLED';
  paidAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface DashboardSummary {
  totalToPay: number;
  totalToReceive: number;
  netBalance: number;
}

export interface DashboardDebt {
  shareId: string;
  billId: string;
  groupId: string;
  groupName: string;
  environmentId: string;
  environmentName: string;
  title: string;
  category?: string | null;
  dueDate: string;
  totalAmount: number;
  shareAmount: number;
  sharePercentage: number;
  payer: {
    userId: string;
    name: string;
  };
  receiverUserId?: string | null;
  receiverUserName?: string | null;
  receiverName?: string | null;
  ownerUserId: string;
  ownerUserName?: string | null;
}

export interface Activity {
  id: string;
  groupId: string;
  userId?: string | null;
  type: string;
  description: string;
  createdAt: string;
  group?: Group;
  user?: User;
}

export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: string;
  read: boolean;
  createdAt: string;
  readAt?: string | null;
}

export interface MemberBalanceSummary {
  userId: string;
  user: User;
  totalToPay: number;
  totalToReceive: number;
  netBalance: number;
}

export interface GroupMembersSummaryResponse {
  members: MemberBalanceSummary[];
}

export type RecurringFrequency = 'MONTHLY' | 'WEEKLY' | 'YEARLY';

export interface RecurringBillShare {
  id: string;
  recurringBillId: string;
  userId: string;
  percentage: number;
  user: User;
}

export interface RecurringBill {
  id: string;
  title: string;
  totalAmount: number;
  frequency: RecurringFrequency;
  dayOfMonth?: number | null;
  weekday?: number | null;
  nextDueDate: string;
  pixKey?: string | null;
  paymentLink?: string | null;
  attachmentUrl?: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  groupId: string;
  environmentId: string;
  ownerId: string;
  receiverId?: string | null;
  receiverName?: string | null;
  shares: RecurringBillShare[];
}

export interface CategorySummary {
  category: string;
  amount: number;
}
