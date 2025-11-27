import express from 'express';
import http from 'http';
import cors from 'cors';
import { Server } from 'socket.io';
import dotenv from 'dotenv';
import authRoutes from './routes/authRoutes';
import groupRoutes from './routes/groupRoutes';
import billRoutes from './routes/billRoutes';
import dashboardRoutes from './routes/dashboardRoutes';
import recurringBillRoutes from './routes/recurringBillRoutes';
import notificationRoutes from './routes/notificationRoutes';

dotenv.config();

const app = express();
const server = http.createServer(app);

const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:5173')
  .split(',')
  .map((o: string) => o.trim());

const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    credentials: true,
  },
});

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  }),
);
app.use(express.json());

// disponibiliza o io para os handlers
app.set('io', io);

app.use('/api/auth', authRoutes);
app.use('/api/groups', groupRoutes);
app.use('/api/bills', billRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/recurring-bills', recurringBillRoutes);
app.use('/api/notifications', notificationRoutes);

io.on('connection', (socket: any) => {
  console.log('Cliente conectado', socket.id);

  socket.on('joinGroup', (groupId: string) => {
    socket.join(groupId);
  });

  socket.on('joinUser', (userId: string) => {
    socket.join(`user:${userId}`);
  });

  socket.on('disconnect', () => {
    console.log('Cliente desconectado', socket.id);
  });
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`API rodando na porta ${PORT}`);
});
