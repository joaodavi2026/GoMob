import { getGtfsLineRisk } from "@/features/intelligence/service";
import { levelLabel } from "@/features/intelligence/engine";
import { haversineMeters } from "@/features/intelligence/signals";
import { getStopArrivals } from "@/features/network/arrivals";
import { railInfo, titleCase } from "@/features/network/rail";
import { findLine, gtfs, headwayNow, nearestStops, nextDepartures, norm, resolvePlace, runsNow, type Place, type SLine } from "@/features/network/server";
import { formatPointParam } from "@/features/routes/points";
import { searchBusRoutes } from "@/features/routes/service";
import { getFleetSnapshot } from "@/server/sptrans/fleet";

/**
 * Gobi, o assistente do GoMob. Não é um modelo de linguagem: entende a intenção da pergunta por regras
 * (em português) e responde SOMENTE com dados reais do app: rede GTFS da SPTrans, posição dos ônibus e
 * previsão de chegada do Olho Vivo, busca de rotas e estimativa de lotação. Por isso não inventa respostas.
 */
export type Action = { label: string; href: string };
export type Reply = {
  text: string;
  /** itens em lista (etapas, chegadas, linhas) */
  items?: string[];
  note?: string;
  actions?: Action[];
  suggestions?: string[];
  /** a resposta melhora com a localização da pessoa */
  needsLocation?: boolean;
  /** Gobi fez uma pergunta e espera a origem do trajeto na próxima mensagem */
  expect?: { kind: "origin"; destination: Place };
};
export type Ask = {
  message: string;
  lat?: number;
  lon?: number;
  /** linha da tela em que a pessoa está (página da linha) */
  line?: string;
  expect?: Reply["expect"];
};

export const SUGGESTIONS = ["Como vou do Paraíso para a Sé?", "Quando passa o próximo ônibus perto de mim?", "Horário da linha 875A-10", "A linha 8000-10 está cheia?", "Quanto custa a passagem?"];

const money = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const lineLabel = (l: SLine) => {
  const r = railInfo(l.code);
  return r ? `Linha ${r.number}-${r.name} (${r.operator})` : `linha ${l.code}`;
};
const lineHref = (l: SLine) => `/lines/${encodeURIComponent(l.code)}`;
const routesHref = (o: Place, d: Place) =>
  `/routes?o=${encodeURIComponent(formatPointParam({ latitude: o.latitude, longitude: o.longitude, label: o.label }))}&d=${encodeURIComponent(formatPointParam({ latitude: d.latitude, longitude: d.longitude, label: d.label }))}`;
const mins = (n: number) => (n <= 0 ? "chegando" : n === 1 ? "1 min" : `${n} min`);

const has = (n: string, re: RegExp) => re.test(n);

function help(): Reply {
  return {
    text: "Oi! Eu sou o Gobi, seu guia de ônibus em São Paulo. Posso responder usando os dados ao vivo da SPTrans:",
    items: [
      "Como ir de um lugar a outro de ônibus",
      "Quando passa o próximo ônibus no ponto perto de você",
      "Horários, intervalo e trajeto de uma linha",
      "Onde estão os ônibus de uma linha agora",
      "Se uma linha tende a estar cheia",
      "Tarifas",
    ],
    suggestions: SUGGESTIONS,
  };
}

async function route(origin: Place, destination: Place): Promise<Reply> {
  const apart = haversineMeters(origin, destination);
  if (apart < 300) return { text: `Você já está pertinho de ${destination.label}: cerca de ${Math.max(10, Math.round(apart / 10) * 10)} m. Dá para ir a pé.` };
  const res = await searchBusRoutes({
    origin: { latitude: origin.latitude, longitude: origin.longitude, label: origin.label },
    destination: { latitude: destination.latitude, longitude: destination.longitude, label: destination.label },
    sort: "fastest",
  });
  const actions = [{ label: "Ver rotas e iniciar trajeto", href: routesHref(origin, destination) }];
  const best = res.routes[0];
  if (!best) {
    return {
      text: `Não encontrei uma viagem de ônibus com até uma baldeação de ${origin.label} para ${destination.label}.`,
      note: "Tente um ponto de partida ou de chegada perto de uma avenida ou de um terminal.",
      actions,
    };
  }
  const items = best.steps.map((s) =>
    s.kind === "WALK" ? `Caminhe ${s.minutes} min até ${s.to}` : `Pegue a linha ${s.lineCode} (${titleCase(s.lineName)}) em ${s.boardStop} e desça em ${s.alightStop}: cerca de ${s.minutes} min`,
  );
  const risk = best.risk && best.risk.level !== "INSUFFICIENT_DATA" ? ` Lotação estimada: ${levelLabel(best.risk.level).toLowerCase()}.` : "";
  const others = res.routes.length - 1;
  const firstBus = best.steps.find((s) => s.kind === "BUS");
  return {
    text: `De ${origin.label} para ${destination.label}, a opção mais rápida leva cerca de ${best.durationMinutes ?? "?"} min${best.transfers ? `, com ${best.transfers} baldeação` : ", sem baldeação"}.${risk}`,
    items,
    note: `${others > 0 ? `Há mais ${others} ${others === 1 ? "opção" : "opções"}. ` : ""}Os tempos são estimados pelo horário programado.`,
    actions,
    suggestions: firstBus?.kind === "BUS" ? [`Onde estão os ônibus da ${firstBus.lineCode}?`, `A linha ${firstBus.lineCode} está cheia?`] : undefined,
  };
}

function schedule(l: SLine): Reply {
  const now = new Date();
  const items = l.dirs.map((d) => {
    const every = headwayNow(d, now);
    const next = nextDepartures(d, now, 3);
    const running = runsNow(d, now);
    return `Sentido ${titleCase(d.headsign)}: ${d.first ?? "?"} às ${d.last ?? "?"}${running ? (every ? `, a cada ~${every} min agora` : "") : ", fora do horário agora"}${next.length ? `. Próximas partidas: ${next.join(", ")}` : ""}`;
  });
  return {
    text: `Horários programados da ${lineLabel(l)} · ${titleCase(l.name)}:`,
    items,
    note: "Partidas aproximadas, calculadas pelos intervalos do GTFS da SPTrans.",
    actions: [{ label: "Abrir a linha", href: lineHref(l) }],
    suggestions: l.type === 3 ? [`Onde estão os ônibus da ${l.code}?`, `A linha ${l.code} está cheia?`] : undefined,
  };
}

async function live(l: SLine, at?: { lat: number; lon: number }): Promise<Reply> {
  if (l.type !== 3) return { text: `A ${lineLabel(l)} é de trilhos: só os ônibus da SPTrans informam a posição ao vivo.`, actions: [{ label: "Abrir a linha", href: lineHref(l) }] };
  const fleet = await getFleetSnapshot();
  if (fleet.state !== "LIVE") return { text: "A posição dos ônibus está indisponível agora. Tente de novo em instantes.", actions: [{ label: "Abrir a linha", href: lineHref(l) }] };
  const mine = fleet.vehicles.filter((v) => v[0] === l.code);
  if (!mine.length) {
    return { text: `Não há ônibus da linha ${l.code} circulando agora.`, note: `Horário programado: ${l.dirs.map((d) => `${d.first ?? "?"} às ${d.last ?? "?"}`).join(" · ")}.`, actions: [{ label: "Abrir a linha", href: lineHref(l) }] };
  }
  const items = l.dirs.map((d) => {
    const n = mine.filter((v) => (v[1] === 2 ? 1 : 0) === d.d);
    const acc = n.filter((v) => v[5] === 1).length;
    return `Sentido ${titleCase(d.headsign)}: ${n.length} ônibus${n.length ? `, ${acc} com acessibilidade` : ""}`;
  });
  let note: string | undefined;
  if (at) {
    const here = { latitude: at.lat, longitude: at.lon };
    const near = Math.min(...mine.map((v) => haversineMeters(here, { latitude: v[2], longitude: v[3] })));
    note = `O mais próximo de você está a ${near < 1000 ? `${Math.round(near / 10) * 10} m` : `${(near / 1000).toFixed(1).replace(".", ",")} km`}.`;
  }
  return { text: `Agora há ${mine.length} ônibus da linha ${l.code} nas ruas:`, items, note, actions: [{ label: "Ver no mapa", href: lineHref(l) }] };
}

async function crowd(l: SLine): Promise<Reply> {
  if (l.type !== 3) return { text: `Ainda não estimo a lotação de trilhos, só das linhas de ônibus da SPTrans.` };
  const items: string[] = [];
  let explanation = "";
  for (const d of l.dirs) {
    const r = await getGtfsLineRisk(l.code, d.d).catch(() => null);
    if (!r) continue;
    items.push(`Sentido ${titleCase(d.headsign)}: ${levelLabel(r.level)}${r.score !== null ? ` (${r.score} de 100)` : ""}`);
    explanation ||= r.explanation;
  }
  if (!items.length) return { text: `Não consegui estimar a lotação da linha ${l.code} agora.` };
  return { text: `Estimativa de lotação da linha ${l.code} agora:`, items, note: explanation, actions: [{ label: "Abrir a linha", href: lineHref(l) }] };
}

async function arrivals(at: { lat: number; lon: number }, l: SLine | null): Promise<Reply> {
  const { net } = gtfs();
  const near = nearestStops(at.lat, at.lon, 6, 1000, true);
  if (!near.length) return { text: "Não encontrei pontos de ônibus a menos de 1 km de você." };
  const boards = (await Promise.all(near.map((n) => getStopArrivals(net.stops[n.index][0]).then((b) => (b ? { b, meters: n.meters } : null)).catch(() => null)))).filter((x) => x !== null);
  const items: string[] = [];
  for (const { b, meters } of boards) {
    const list = b.arrivals.filter((a) => !l || a.code === l.code).slice(0, 3);
    if (!list.length) continue;
    items.push(`${b.stop.name} (${Math.round(meters / 10) * 10} m): ${list.map((a) => `${a.code} para ${a.headsign} em ${mins(a.minutes)}`).join("; ")}`);
    if (items.length >= 3) break;
  }
  if (!items.length) {
    return {
      text: l ? `Nenhum ônibus da linha ${l.code} com previsão nos pontos perto de você agora.` : "Nenhum ônibus com previsão nos pontos perto de você agora.",
      note: l ? `Pelo horário programado, a ${l.code} passa a cada ~${headwayNow(l.dirs[0]) ?? "?"} min neste horário.` : undefined,
      actions: l ? [{ label: "Abrir a linha", href: lineHref(l) }] : [{ label: "Ver linhas", href: "/lines" }],
    };
  }
  return { text: l ? `Próximas chegadas da linha ${l.code} perto de você:` : "Próximos ônibus nos pontos perto de você:", items, note: "Previsão em tempo real do Olho Vivo (SPTrans).", actions: l ? [{ label: "Abrir a linha", href: lineHref(l) }] : undefined };
}

function fare(l: SLine | null): Reply {
  const { net } = gtfs();
  const bus = (l?.type === 3 ? l.fare : null) ?? net.lines.find((x) => x.type === 3 && x.fare)?.fare ?? null;
  const rail = net.lines.find((x) => x.type !== 3 && x.fare)?.fare ?? null;
  const items = [bus ? `Ônibus municipal (SPTrans): ${money(bus)}` : null, rail ? `Metrô e trem (CPTM): ${money(rail)}` : null].filter((x): x is string => !!x);
  return { text: "Tarifas informadas no GTFS da SPTrans:", items, note: "Com o Bilhete Único, uma tarifa de ônibus vale para até 4 embarques em 3 horas." };
}

function overview(l: SLine): Reply {
  const r = railInfo(l.code);
  const now = new Date();
  const d = l.dirs[0];
  const every = d ? headwayNow(d, now) : null;
  const running = l.dirs.some((x) => runsNow(x, now));
  return {
    text: `${r ? `Linha ${r.number}-${r.name} do ${r.operator}` : `Linha ${l.code}`}: ${titleCase(l.name)}.`,
    items: [
      running ? `Operando agora${every ? `, a cada ~${every} min` : ""}` : "Fora do horário de operação agora",
      d ? `Funciona das ${d.first ?? "?"} às ${d.last ?? "?"}` : null,
      d ? `${d.stops.length} ${r ? "estações" : "paradas"} no sentido ${titleCase(d.headsign)}` : null,
      l.fare ? `Tarifa: ${money(l.fare)}` : null,
    ].filter((x): x is string => !!x),
    actions: [{ label: "Abrir a linha", href: lineHref(l) }],
    suggestions: l.type === 3 ? [`Onde estão os ônibus da ${l.code}?`, `A linha ${l.code} está cheia?`, `Horário da linha ${l.code}`] : [`Horário da linha ${r?.number ?? ""} ${r?.name ?? ""}`.trim()],
  };
}

const TOPICS: { re: RegExp; reply: Reply }[] = [
  { re: /\bpremium\b|\banuncio|\bassin(ar|atura)|\bplano\b/, reply: { text: "O GoMob Premium tira os anúncios e mantém o trajeto em segundo plano (tela ligada e avisos por notificação). Vale também para a sua família.", actions: [{ label: "Conhecer o Premium", href: "/premium" }] } },
  { re: /\bfamilia|\bcompartilh|\bconvi(te|dar)/, reply: { text: "Na aba Família você convida até 2 pessoas por link, sem senha. Quem inicia um trajeto compartilha a viagem e os outros acompanham ao vivo no mapa.", actions: [{ label: "Abrir Família", href: "/family" }] } },
  { re: /\bacessib|\bcadeir|\bcego|\bsurdo|\bpcd\b|\bvoz\b|\bleitor/, reply: { text: "Em Acessibilidade você liga a leitura por voz, o alto contraste, letras maiores, alertas visuais e o modo simples. As linhas mostram quantos ônibus acessíveis estão circulando.", actions: [{ label: "Abrir Acessibilidade", href: "/accessibility" }] } },
  { re: /\batividade|\bhistorico|\bviagens? (que fiz|anteriores)/, reply: { text: "A aba Atividade guarda os trajetos que você fez no modo em trajeto: data, duração, linhas e tarifa.", actions: [{ label: "Abrir Atividade", href: "/activity" }] } },
  { re: /\bsalv(ar|os)|\bfavorit/, reply: { text: "Você pode salvar um trajeto na tela de rotas e favoritar linhas na tela da linha. Tudo fica em Salvos e na estrela da tela Linhas.", actions: [{ label: "Abrir Salvos", href: "/favorites" }] } },
];

/** Separa "de X para Y" / "para Y" de uma pergunta de trajeto. */
export function parseRoute(text: string): { from?: string; to?: string } | null {
  // sem acentos: o \b do JavaScript não reconhece letras acentuadas
  const t = text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[?!.]+$/g, "")
    .trim();
  const both = t.match(/\b(?:de|do|da|dos|das|saindo d[eoa]s?|partindo d[eoa]s?)\s+(.+?)\s+(?:para|pra|pro|ate|a|ao)\s+(?:o |a |os |as )?(.+)$/i);
  if (both) return { from: both[1], to: both[2] };
  const only = t.match(/\b(?:como (?:eu )?(?:vou|chego|faco|faco para (?:ir|chegar))|quero ir|preciso ir|ir|chegar|rota|caminho|trajeto|onibus|linha)\s+(?:para|pra|pro|ate|a|ao|em|no|na)\s+(?:o |a |os |as )?(.+)$/i);
  if (only) return { to: only[1] };
  return null;
}

export async function answer(ask: Ask): Promise<Reply> {
  const message = ask.message.trim().slice(0, 300);
  const n = norm(message);
  const at = typeof ask.lat === "number" && typeof ask.lon === "number" ? { lat: ask.lat, lon: ask.lon } : undefined;
  const here: Place | null = at ? { label: "Sua localização", latitude: at.lat, longitude: at.lon } : null;
  if (!n) return help();

  // Gobi tinha perguntado "de onde você sai?"
  if (ask.expect?.kind === "origin") {
    const origin = has(n, /\b(aqui|minha localizacao|onde estou|meu local)\b/) ? here : resolvePlace(message);
    if (origin) return route(origin, ask.expect.destination);
    if (has(n, /\b(aqui|minha localizacao|onde estou)\b/)) return { text: "Para sair de onde você está, preciso da sua localização.", needsLocation: true, expect: ask.expect };
  }

  const mentioned = findLine(message);
  const line = mentioned ?? (ask.line ? (gtfs().byCode.get(ask.line.toUpperCase()) ?? null) : null);

  // trajeto de um lugar a outro
  const r = !mentioned ? parseRoute(message) : null;
  if (r?.to) {
    const destination = resolvePlace(r.to);
    if (!destination) return { text: `Não achei "${r.to}" entre as paradas, estações e lugares que conheço.`, note: "Tente o nome de uma estação, de um terminal ou de uma avenida.", suggestions: SUGGESTIONS.slice(0, 1) };
    const fromHere = !r.from || has(norm(r.from), /^(aqui|minha localizacao|onde estou|casa)$/);
    const origin = fromHere ? here : resolvePlace(r.from!);
    if (origin) return route(origin, destination);
    if (r.from && !fromHere) return { text: `Não achei "${r.from}" entre as paradas, estações e lugares que conheço. De onde você sai?`, expect: { kind: "origin", destination } };
    return { text: `Certo, para ${destination.label}. De onde você sai?`, note: "Digite o lugar ou use a sua localização.", needsLocation: true, expect: { kind: "origin", destination } };
  }

  if (has(n, /^(oi|ola|ola gobi|oi gobi|bom dia|boa tarde|boa noite|e ai|opa|hey|hello)\b/) && n.split(" ").length <= 4) return help();
  if (!line) for (const t of TOPICS) if (t.re.test(n)) return t.reply;
  if (has(n, /\b(ajuda|o que voce (faz|sabe)|como funciona|quem e voce|o que posso perguntar)\b/)) return help();

  // quando passa / próximo ônibus
  if (has(n, /\bquando (passa|chega|vem|sai)|\bque horas (passa|chega|vem)|\bproxim[oa]s? (onibus|chegada)|\bprevisao|\bchegando|\bfalta quanto|\bdemora\b/)) {
    if (at) return arrivals(at, line);
    if (line) {
      const s = schedule(line);
      return { ...s, note: "Com a sua localização eu mostro a previsão em tempo real no ponto mais perto de você.", needsLocation: true };
    }
    return { text: "Para ver os próximos ônibus no ponto perto de você, preciso da sua localização.", needsLocation: true };
  }
  if (has(n, /\b(perto|pert[oa] de mim|ao redor|aqui perto|pontos? proxim|paradas? proxim)\b/)) {
    if (at) return arrivals(at, line);
    return { text: "Para mostrar os pontos e ônibus perto de você, preciso da sua localização.", needsLocation: true };
  }

  if (has(n, /\b(tarifa|passagem|quanto custa|preco|valor|bilhete)\b/)) return fare(line);

  if (line) {
    if (has(n, /\b(lotad|chei[oa]|vazi[oa]|lotacao|risco|apertad)/)) return crowd(line);
    if (has(n, /\bonde (esta|estao|ta|tao)\b|\bquantos onibus|\btem onibus|\bcirculando|\bao vivo|\btempo real|\blocaliza/)) return live(line, at);
    if (has(n, /\b(horario|horarios|que horas|primeir[oa]|ultim[oa]|ate que horas|funciona|roda|intervalo|frequencia|grade|madrugada)\b/)) return schedule(line);
    return overview(line);
  }

  if (has(n, /\b(lotad|chei[oa]|lotacao|horario|onde esta|quantos onibus)/)) return { text: "De qual linha? Diga o número, por exemplo 875A-10, ou o nome da linha de metrô.", suggestions: ["Horário da linha 875A-10", "A linha 8000-10 está cheia?"] };
  if (has(n, /\b(obrigad|valeu|vlw|brigad)/)) return { text: "De nada! Boa viagem. Se precisar, é só chamar." };

  return {
    text: "Essa eu ainda não sei responder. Eu respondo sobre trajetos, linhas, horários, chegadas e lotação dos ônibus de São Paulo.",
    suggestions: SUGGESTIONS,
  };
}
