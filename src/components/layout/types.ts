import type { DemoScenario, IntegrationState } from "@/types/transit";

/** Shape of GET /api/system/status `data` (see docs/architecture.md). */
export type SystemStatusView = {
  mode: "LIVE" | "DEMO";
  scenario: DemoScenario | null;
  integrations: {
    key: string;
    label: string;
    configured: boolean;
    state: IntegrationState;
    lastQueryAt: string | null;
    lastFailureAt: string | null;
  }[];
};
