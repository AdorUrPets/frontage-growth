import { KeyVault } from "../components/KeyVault";
import { ModelRegistry } from "../components/ModelRegistry";

export default function GeminiSettingsPage() {
  return (
    <div className="flex flex-col gap-4">
      <KeyVault providerCode="gemini" providerLabel="Gemini" />
      <ModelRegistry providerCode="gemini" providerLabel="Gemini" placeholder="gemini-3.5-flash" />
    </div>
  );
}
