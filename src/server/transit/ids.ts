import { z } from "zod";

/** Ids públicos de linha: "demo-<n>" (DEMO) ou "sp-<codigoLinha>" (SPTrans). */
export const LineIdSchema = z.string().regex(/^(demo-[1-9]\d?|sp-\d{1,9})$/, "Identificador de linha inválido.");
/** Ids públicos de veículo: "dmv-<linha>-<n>" (DEMO) ou "spv-<prefixo>" (SPTrans). */
export const VehicleIdSchema = z.string().regex(/^(dmv-[1-9]\d?-\d{1,2}|spv-\d{1,9})$/, "Identificador de veículo inválido.");
