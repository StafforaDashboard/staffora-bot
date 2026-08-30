import { prisma } from '../lib/prisma';

async function ensureSettings(guildId: string) {
  return prisma.dienstnummerSettings.upsert({
    where: { guildId },
    create: { guildId },
    update: {}
  });
}

function pad(n: number, digits: number) {
  return String(n).padStart(digits, '0');
}

export async function getDnSettings(guildId: string) {
  return ensureSettings(guildId);
}

export async function updateDnSettings(guildId: string, data: Record<string, unknown>) {
  await ensureSettings(guildId);
  return prisma.dienstnummerSettings.update({ where: { guildId }, data: data as any });
}

export async function listNumbers(guildId: string, status?: string) {
  return prisma.dienstnummer.findMany({
    where: { guildId, ...(status ? { status } : {}) },
    orderBy: { number: 'asc' }
  });
}

export async function getByDiscord(guildId: string, discordId: string) {
  return prisma.dienstnummer.findFirst({
    where: { guildId, discordId, status: 'assigned' }
  });
}

export async function nextNumber(guildId: string) {
  const s = await ensureSettings(guildId);
  const assigned = await prisma.dienstnummer.findMany({
    where: { guildId },
    select: { number: true }
  });
  const used = new Set(assigned.map((a) => a.number));
  let i = 1;
  while (true) {
    const num = `${s.numberPrefix}${pad(i, s.numberDigits)}`;
    if (!used.has(num)) return num;
    i++;
    if (i > 9999) throw new Error('Keine freie Nummer');
  }
}

export async function assignNumber(
  guildId: string,
  discordId: string,
  opts?: { robloxUsername?: string; preferred?: string }
) {
  const existing = await getByDiscord(guildId, discordId);
  if (existing) return existing;
  let number = opts?.preferred;
  if (number) {
    const taken = await prisma.dienstnummer.findFirst({
      where: { guildId, number, status: 'assigned' }
    });
    if (taken) number = undefined;
  }
  if (!number) number = await nextNumber(guildId);
  const free = await prisma.dienstnummer.findFirst({
    where: { guildId, number, status: 'free' }
  });
  if (free) {
    return prisma.dienstnummer.update({
      where: { id: free.id },
      data: {
        discordId,
        robloxUsername: opts?.robloxUsername || null,
        status: 'assigned',
        assignedAt: new Date()
      }
    });
  }
  return prisma.dienstnummer.create({
    data: {
      guildId,
      number,
      discordId,
      robloxUsername: opts?.robloxUsername || null,
      status: 'assigned',
      assignedAt: new Date()
    }
  });
}

export async function releaseNumber(guildId: string, discordId: string) {
  const row = await getByDiscord(guildId, discordId);
  if (!row) return null;
  return prisma.dienstnummer.update({
    where: { id: row.id },
    data: { discordId: null, robloxUsername: null, status: 'free', assignedAt: null }
  });
}

export async function createApplication(
  guildId: string,
  data: { discordId: string; robloxUsername?: string; info?: string }
) {
  const has = await getByDiscord(guildId, data.discordId);
  if (has) throw new Error('Du hast bereits eine Dienstnummer: ' + has.number);
  const pending = await prisma.dienstnummerApplication.findFirst({
    where: { guildId, discordId: data.discordId, status: 'pending' }
  });
  if (pending) throw new Error('Du hast bereits eine offene Bewerbung.');
  return prisma.dienstnummerApplication.create({
    data: {
      guildId,
      discordId: data.discordId,
      robloxUsername: data.robloxUsername || null,
      info: data.info || null
    }
  });
}

export async function listApplications(guildId: string, status = 'pending') {
  return prisma.dienstnummerApplication.findMany({
    where: { guildId, status },
    orderBy: { createdAt: 'desc' }
  });
}

export async function acceptApplication(guildId: string, appId: number, actorId: string) {
  const app = await prisma.dienstnummerApplication.findFirst({
    where: { id: appId, guildId }
  });
  if (!app || app.status !== 'pending') throw new Error('Bewerbung nicht gefunden');
  const assigned = await assignNumber(guildId, app.discordId, {
    robloxUsername: app.robloxUsername || undefined
  });
  await prisma.dienstnummerApplication.update({
    where: { id: app.id },
    data: { status: 'accepted', reviewedBy: actorId, reviewedAt: new Date() }
  });
  return { app, assigned };
}

export async function rejectApplication(guildId: string, appId: number, actorId: string, note?: string) {
  const app = await prisma.dienstnummerApplication.findFirst({
    where: { id: appId, guildId }
  });
  if (!app || app.status !== 'pending') throw new Error('Bewerbung nicht gefunden');
  return prisma.dienstnummerApplication.update({
    where: { id: app.id },
    data: {
      status: 'rejected',
      reviewedBy: actorId,
      reviewedAt: new Date(),
      note: note || null
    }
  });
}

export async function requestNumberChange(
  guildId: string,
  discordId: string,
  reason?: string,
  requestedNumber?: string
) {
  return prisma.dienstnummerChangeRequest.create({
    data: {
      guildId,
      discordId,
      reason: reason || null,
      requestedNumber: requestedNumber || null
    }
  });
}
