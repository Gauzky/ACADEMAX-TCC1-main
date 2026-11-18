import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import nodemailer from 'nodemailer';
import crypto from 'crypto';

const app = express();
const prisma = new PrismaClient();

// Armazena tokens de recuperação em memória { token: { email, expiry } }
const resetTokens = new Map();

const corsOptions = { origin: '*', credentials: true };
app.use(cors(corsOptions));
app.use(express.json());

// === TRANSPORTER DE EMAIL ===
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

// === CADASTRO ===
app.post('/api/register', async (req, res) => {
    const { name, email, password, birthdate } = req.body;
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const user = await prisma.user.create({
            data: {
                name, email,
                password: hashedPassword,
                birthdate,
                isAdmin: email === "admin@gympro.com"
            }
        });
        res.json({ id: user.id, name: user.name, email: user.email, isAdmin: user.isAdmin });
    } catch (error) {
        res.status(400).json({ error: "E-mail já cadastrado" });
    }
});

// === LOGIN ===
app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(404).json({ error: "Usuário não encontrado" });
    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) return res.status(401).json({ error: "Senha incorreta" });
    res.json({ id: user.id, name: user.name, email: user.email, picture: user.picture, phone: user.phone, isAdmin: user.isAdmin });
});

// === LOGIN GOOGLE ===
app.post('/api/google-login', async (req, res) => {
    const { name, email, picture } = req.body;
    const user = await prisma.user.upsert({
        where: { email },
        update: { name, picture },
        create: { name, email, picture, password: "google_oauth" }
    });
    res.json({ id: user.id, name: user.name, email: user.email, picture: user.picture, phone: user.phone, isAdmin: user.isAdmin });
});

// === ESQUECI MINHA SENHA — envia email ===
app.post('/api/forgot-password', async (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: "E-mail obrigatório" });

    try {
        const user = await prisma.user.findUnique({ where: { email } });

        // Sempre retorna sucesso (segurança: não revela se email existe)
        if (!user) return res.json({ message: "Se este e-mail estiver cadastrado, você receberá as instruções." });

        // Usuário do Google não tem senha
        if (user.password === 'google_oauth') {
            return res.json({ message: "Esta conta usa login com Google. Acesse pelo botão do Google." });
        }

        // Gera token único de 32 bytes
        const token = crypto.randomBytes(32).toString('hex');
        const expiry = Date.now() + 1000 * 60 * 30; // 30 minutos
        resetTokens.set(token, { email, expiry });

        const resetLink = `https://academaxx.com.br/login.html?reset=${token}`;

        // Email em HTML
        const htmlEmail = `
        <!DOCTYPE html>
        <html>
        <head><meta charset="UTF-8"></head>
        <body style="margin:0;padding:0;background:#0b0c0e;font-family:'Inter',Arial,sans-serif;">
            <div style="max-width:520px;margin:40px auto;background:#15151a;border-radius:16px;overflow:hidden;border:1px solid rgba(255,255,255,0.08);">
                <!-- Header -->
                <div style="background:#15151a;padding:32px 40px 24px;border-bottom:1px solid rgba(255,255,255,0.08);text-align:center;">
                    <div style="font-size:26px;font-weight:800;letter-spacing:-1px;">
                        <span style="color:#f2f5f7;">ACADE</span><span style="color:#b5c7eb;">MAX</span>
                    </div>
                </div>
                <!-- Body -->
                <div style="padding:36px 40px;">
                    <h2 style="color:#f2f5f7;font-size:20px;font-weight:700;margin:0 0 12px;">Redefinir sua senha</h2>
                    <p style="color:#6b6e76;font-size:15px;line-height:1.6;margin:0 0 28px;">
                        Olá, <strong style="color:#f2f5f7;">${user.name}</strong>! Recebemos uma solicitação para redefinir a senha da sua conta AcadeMax.
                    </p>
                    <a href="${resetLink}"
                        style="display:block;background:#b5c7eb;color:#0b0c0e;text-align:center;padding:16px;border-radius:12px;font-size:16px;font-weight:700;text-decoration:none;margin-bottom:28px;">
                        🔑 Redefinir minha senha
                    </a>
                    <p style="color:#6b6e76;font-size:13px;line-height:1.6;margin:0;">
                        Este link expira em <strong style="color:#f2f5f7;">30 minutos</strong>. Se você não solicitou a redefinição, ignore este e-mail — sua senha permanece a mesma.
                    </p>
                </div>
                <!-- Footer -->
                <div style="padding:20px 40px;border-top:1px solid rgba(255,255,255,0.08);text-align:center;">
                    <p style="color:#3a3d44;font-size:12px;margin:0;">© 2026 AcadeMax · academaxx.com.br</p>
                </div>
            </div>
        </body>
        </html>`;

        await transporter.sendMail({
            from: `"AcadeMax" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: '🔑 Redefinir senha — AcadeMax',
            html: htmlEmail
        });

        res.json({ message: "Se este e-mail estiver cadastrado, você receberá as instruções." });
    } catch (error) {
        console.error("Erro ao enviar email:", error);
        res.status(500).json({ error: "Erro ao enviar e-mail. Tente novamente." });
    }
});

// === REDEFINIR SENHA — valida token e salva nova senha ===
app.post('/api/reset-password', async (req, res) => {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) return res.status(400).json({ error: "Dados incompletos" });

    const record = resetTokens.get(token);
    if (!record) return res.status(400).json({ error: "Link inválido ou já utilizado" });
    if (Date.now() > record.expiry) {
        resetTokens.delete(token);
        return res.status(400).json({ error: "Link expirado. Solicite um novo." });
    }
    if (newPassword.length < 6) return res.status(400).json({ error: "A senha deve ter no mínimo 6 caracteres" });

    try {
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        await prisma.user.update({
            where: { email: record.email },
            data: { password: hashedPassword }
        });
        resetTokens.delete(token);
        res.json({ message: "Senha redefinida com sucesso!" });
    } catch (error) {
        res.status(500).json({ error: "Erro ao redefinir senha" });
    }
});

// === LISTAR USUÁRIOS (admin) ===
app.get('/api/users', async (req, res) => {
    const users = await prisma.user.findMany({
        select: { id: true, name: true, email: true, picture: true, phone: true, isAdmin: true, createdAt: true }
    });
    res.json(users);
});

// === ATUALIZAR PERFIL ===
app.put('/api/users/:id', async (req, res) => {
    const { id } = req.params;
    const { name, picture, phone } = req.body;
    try {
        const updatedUser = await prisma.user.update({
            where: { id },
            data: { name, picture, phone }
        });
        res.json({ id: updatedUser.id, name: updatedUser.name, email: updatedUser.email, picture: updatedUser.picture, phone: updatedUser.phone, isAdmin: updatedUser.isAdmin });
    } catch (error) {
        res.status(500).json({ error: "Erro ao atualizar perfil" });
    }
});

// === EXCLUIR CLIENTE (admin) ===
app.delete('/api/users/:id', async (req, res) => {
    const { id } = req.params;
    try {
        await prisma.workout.deleteMany({ where: { userId: id } });
        await prisma.workoutSession.deleteMany({ where: { userId: id } });
        await prisma.user.delete({ where: { id } });
        res.json({ message: "Cliente deletado com sucesso" });
    } catch (error) {
        res.status(500).json({ error: "Erro ao deletar cliente" });
    }
});

// === TREINOS ===
app.post('/api/workouts', async (req, res) => {
    const { name, desc, exercises, userId } = req.body;
    try {
        const workout = await prisma.workout.create({
            data: { name, desc, exercises: JSON.stringify(exercises), userId }
        });
        res.json(workout);
    } catch (error) {
        res.status(500).json({ error: "Erro ao salvar treino" });
    }
});

app.get('/api/workouts/:userId', async (req, res) => {
    const workouts = await prisma.workout.findMany({ where: { userId: req.params.userId } });
    res.json(workouts.map(w => ({ ...w, exercises: JSON.parse(w.exercises) })));
});

app.delete('/api/workouts/:id', async (req, res) => {
    const { id } = req.params;
    try {
        await prisma.workout.delete({ where: { id } });
        res.json({ message: "Treino excluído" });
    } catch (error) {
        res.status(500).json({ error: "Erro ao excluir treino" });
    }
});

// === HISTÓRICO ===
app.post('/api/history', async (req, res) => {
    const { userId, workoutId, volume, sets } = req.body;
    try {
        const session = await prisma.workoutSession.create({
            data: { userId, workoutId, volume, sets: JSON.stringify(sets) }
        });
        res.json(session);
    } catch (error) {
        res.status(500).json({ error: "Erro ao salvar histórico" });
    }
});

app.get('/api/history/:userId', async (req, res) => {
    const sessions = await prisma.workoutSession.findMany({
        where: { userId: req.params.userId },
        include: { workout: true }
    });
    res.json(sessions.map(s => ({
        ...s,
        sets: JSON.parse(s.sets),
        workoutName: s.workout ? s.workout.name : "Treino Removido"
    })));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Backend do AcadeMax rodando na porta ${PORT}`);
});
