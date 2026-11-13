import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Documento JSON em .data/<nome>.json (fora do git): guarda plano, atividade e família sem banco de dados.
 * Lê do disco a cada acesso (arquivos pequenos), para todas as rotas enxergarem o mesmo estado.
 * Se o disco não aceitar gravação (hospedagem só-leitura), o estado fica na memória do servidor.
 */
const g = globalThis as unknown as { __gomobStore?: Map<string, unknown> };
const memory = (g.__gomobStore ??= new Map<string, unknown>());
const DIR = join(process.cwd(), ".data");

export function jsonStore<T>(name: string, initial: () => T) {
  const file = join(DIR, `${name}.json`);
  const read = (): T => {
    try {
      const doc = JSON.parse(readFileSync(/*turbopackIgnore: true*/ file, "utf8")) as T;
      memory.set(name, doc);
      return doc;
    } catch {
      if (!memory.has(name)) memory.set(name, initial());
      return memory.get(name) as T;
    }
  };
  const write = (doc: T) => {
    memory.set(name, doc);
    try {
      mkdirSync(/*turbopackIgnore: true*/ DIR, { recursive: true });
      writeFileSync(/*turbopackIgnore: true*/ file, JSON.stringify(doc, null, 1));
    } catch {
      // disco só-leitura: segue na memória
    }
  };
  return {
    read,
    /** Lê, aplica a mudança e grava. Devolve o que a função devolver. */
    update<R>(fn: (doc: T) => R): R {
      const doc = read();
      const out = fn(doc);
      write(doc);
      return out;
    },
  };
}
