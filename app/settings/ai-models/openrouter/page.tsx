import { KeyVault } from "../components/KeyVault";
import { ModelRegistry } from "../components/ModelRegistry";

export default function OpenRouterSettingsPage() {
  return (
    <div className="flex flex-col gap-4">
      <KeyVault providerCode="openrouter" providerLabel="OpenRouter" />
      <ModelRegistry providerCode="openrouter" providerLabel="OpenRouter" placeholder="anthropic/claude-sonnet-5" />
    </div>
  );
}
