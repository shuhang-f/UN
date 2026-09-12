import { resolveModel } from "agent-core";
import { UNWorkbench } from "@/components/un-workbench";
import { DEMO_TODAY, defaultPreferences, demoUnits } from "@/lib/un-demo";
import { evaluateUnScenario } from "@/lib/server/un-workbench";
import "./workbench.css";

export default function AgentPage() {
  let modelConfigured = false;
  try { resolveModel(); modelConfigured = true; } catch { /* Guided controls remain available. */ }
  return <UNWorkbench modelConfigured={modelConfigured}
    units={demoUnits.map(({ id, unitNumber }) => ({ id, unitNumber }))}
    initial={evaluateUnScenario({ unitId: demoUnits[0].id, asOf: DEMO_TODAY, preferences: defaultPreferences })}/>;
}
