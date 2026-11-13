import { randomBytes, randomUUID } from "node:crypto";
import { jsonStore } from "@/server/store/local";

/**
 * Família sem senha (apresentação): o dono é o usuário aberto do app. Cada convite é um código;
 * quem abre o link informa só o nome e passa a ser um familiar neste aparelho (cookie).
 * O mesmo link serve de "login" do familiar em outro aparelho. Não é um controle de acesso real.
 */
export const MAX_MEMBERS = 2;
export const MEMBER_COOKIE = "gomob_member";
export const OWNER_ID = "open-guest";

export type Member = { id: string; name: string; token: string; code: string; joinedAt: string };
export type Invite = { code: string; createdAt: string };
export type LiveShare = {
  userId: string;
  name: string;
  startedAt: string;
  updatedAt: string;
  origin: string;
  destination: string;
  lines: string[];
  title: string;
  detail: string;
  minutes: number;
  arrived: boolean;
  pos: [number, number] | null; // [lat, lon]
  dest: [number, number]; // [lat, lon]
  path: [number, number][]; // [lon, lat]
};
type Doc = { members: Member[]; invites: Invite[]; shares: Record<string, LiveShare> };

const store = jsonStore<Doc>("family", () => ({ members: [], invites: [], shares: {} }));
const SHARE_TTL_MS = 10 * 60_000;
const code = () => randomBytes(4).toString("hex").toUpperCase().slice(0, 6);
export const memberUserId = (id: string) => `member-${id}`;

export class FamilyError extends Error {
  constructor(public reason: "FULL" | "INVALID_CODE" | "NOT_FOUND") {
    super(reason);
  }
}

export function getFamily() {
  const d = store.read();
  return { members: d.members, invites: d.invites };
}

export function memberByToken(token: string | undefined): Member | null {
  if (!token || token.length < 16) return null;
  return store.read().members.find((m) => m.token === token) ?? null;
}

export function createInvite(): Invite {
  return store.update((d) => {
    if (d.members.length >= MAX_MEMBERS) throw new FamilyError("FULL");
    // no máximo um convite pendente por vaga livre
    const free = MAX_MEMBERS - d.members.length;
    const inv: Invite = { code: code(), createdAt: new Date().toISOString() };
    d.invites = [...d.invites, inv].slice(-free);
    return inv;
  });
}

export function revokeInvite(c: string) {
  store.update((d) => {
    d.invites = d.invites.filter((i) => i.code !== c);
  });
}

/** Situação de um código: convite novo, acesso de um familiar que já entrou, ou inválido. */
export function inviteStatus(c: string): { kind: "NEW" } | { kind: "MEMBER"; name: string } | { kind: "INVALID" } | { kind: "FULL" } {
  const d = store.read();
  const member = d.members.find((m) => m.code === c);
  if (member) return { kind: "MEMBER", name: member.name };
  if (!d.invites.some((i) => i.code === c)) return { kind: "INVALID" };
  return d.members.length >= MAX_MEMBERS ? { kind: "FULL" } : { kind: "NEW" };
}

/** Entra na família com o código. Código já usado = volta a entrar como aquele familiar. */
export function joinFamily(c: string, name: string): Member {
  return store.update((d) => {
    const existing = d.members.find((m) => m.code === c);
    if (existing) return existing;
    if (!d.invites.some((i) => i.code === c)) throw new FamilyError("INVALID_CODE");
    if (d.members.length >= MAX_MEMBERS) throw new FamilyError("FULL");
    const m: Member = { id: randomUUID().slice(0, 8), name, token: randomBytes(24).toString("hex"), code: c, joinedAt: new Date().toISOString() };
    d.members.push(m);
    d.invites = d.invites.filter((i) => i.code !== c);
    return m;
  });
}

export function removeMember(id: string) {
  store.update((d) => {
    if (!d.members.some((m) => m.id === id)) throw new FamilyError("NOT_FOUND");
    d.members = d.members.filter((m) => m.id !== id);
    delete d.shares[memberUserId(id)];
  });
}

export function setShare(share: LiveShare) {
  store.update((d) => {
    d.shares[share.userId] = { ...share, startedAt: d.shares[share.userId]?.startedAt ?? share.startedAt };
  });
}

export function clearShare(userId: string) {
  store.update((d) => {
    delete d.shares[userId];
  });
}

/** Trajetos compartilhados ainda ativos (sem atualização há 10 min = encerrado). */
export function listShares(now = Date.now()): LiveShare[] {
  return Object.values(store.read().shares).filter((s) => now - Date.parse(s.updatedAt) < SHARE_TTL_MS);
}
