import { EmbedBuilder } from 'discord.js';
import { prisma } from '../lib/prisma';

const DEFAULT_TYPES = [
  {
    key: 'personalausweis',
    name: 'Personalausweis',
    fields: [
      { key: 'name', label: 'Name', required: true },
      { key: 'geburtsdatum', label: 'Geburtsdatum', required: true },
      { key: 'roblox', label: 'Roblox Username', required: true }
    ]
  },
  {
    key: 'waffenschein',
    name: 'Waffenschein',
    fields: [
      { key: 'name', label: 'Name', required: true },
      { key: 'roblox', label: 'Roblox Username', required: true },
      { key: 'art', label: 'Art (groß/klein)', required: false }
    ]
  },
  {
    key: 'fuehrerschein',
    name: 'Führerschein',
    fields: [
      { key: 'name', label: 'Name', required: true },
      { key: 'klassen', label: 'Klassen (z.B. PKW, LKW)', required: true },
      { key: 'roblox', label: 'Roblox Username', required: true }
    ]
  }
];

export async function ensureAusweisSettings(guildId: string) {
  return prisma.ausweisSettings.upsert({
    where: { guildId },
    create: { guildId },
    update: {}
  });
}

export async function ensureDefaultTypes(guildId: string) {
  const count = await prisma.ausweisType.count({ where: { guildId } });
  if (count > 0) return listTypes(guildId);
  for (const t of DEFAULT_TYPES) {
    await prisma.ausweisType.create({
      data: {
        guildId,
        key: t.key,
        name: t.name,
        fieldsJson: JSON.stringify(t.fields)
      }
    });
  }
  return listTypes(guildId);
}

export async function listTypes(guildId: string) {
  await ensureDefaultTypes(guildId);
  const rows = await prisma.ausweisType.findMany({
    where: { guildId, enabled: true }
  });
  return rows.map((r) => ({
    id: r.key,
    key: r.key,
    name: r.name,
    fields: JSON.parse(r.fieldsJson || '[]') as { key: string; label: string; required?: boolean }[]
  }));
}

export async function createRequest(
  guildId: string,
  data: { discordId: string; typeKey: string; typeName: string; answers: Record<string, string> }
) {
  return prisma.ausweisRequest.create({
    data: {
      guildId,
      discordId: data.discordId,
      typeKey: data.typeKey,
      typeName: data.typeName,
      dataJson: JSON.stringify(data.answers || {})
    }
  });
}

export async function listRequests(guildId: string, status = 'pending') {
  return prisma.ausweisRequest.findMany({
    where: { guildId, status },
    orderBy: { createdAt: 'desc' }
  });
}

export async function approveRequest(guildId: string, requestId: number, actorId: string) {
  const req = await prisma.ausweisRequest.findFirst({ where: { id: requestId, guildId } });
  if (!req || req.status !== 'pending') throw new Error('Antrag nicht gefunden');
  await prisma.ausweisRequest.update({
    where: { id: req.id },
    data: { status: 'approved', reviewedBy: actorId }
  });
  const card = await prisma.ausweisCard.create({
    data: {
      guildId,
      discordId: req.discordId,
      typeKey: req.typeKey,
      typeName: req.typeName,
      dataJson: req.dataJson,
      issuedBy: actorId
    }
  });
  return { request: req, card };
}

export async function rejectRequest(guildId: string, requestId: number, actorId: string) {
  const req = await prisma.ausweisRequest.findFirst({ where: { id: requestId, guildId } });
  if (!req || req.status !== 'pending') throw new Error('Antrag nicht gefunden');
  return prisma.ausweisRequest.update({
    where: { id: req.id },
    data: { status: 'rejected', reviewedBy: actorId }
  });
}

export async function getCard(guildId: string, discordId: string, typeKey?: string) {
  return prisma.ausweisCard.findFirst({
    where: { guildId, discordId, ...(typeKey ? { typeKey } : {}) },
    orderBy: { createdAt: 'desc' }
  });
}

export function buildAusweisEmbed(
  card: { typeName: string; dataJson: string; discordId: string; createdAt: Date },
  systemName = 'Staffora'
) {
  const data = JSON.parse(card.dataJson || '{}') as Record<string, string>;
  const lines = Object.entries(data)
    .map(([k, v]) => `**${k}:** ${v}`)
    .join('\n');
  return new EmbedBuilder()
    .setColor(0x8b5cf6)
    .setAuthor({ name: systemName })
    .setTitle(`🧾 ${card.typeName}`)
    .setDescription(lines || '_keine Daten_')
    .setFooter({ text: 'Staffora \u00b7 Ausweis' })
    .setTimestamp(card.createdAt);
}
