/**
 * Catálogo de IAs que o usuário pode conectar com a PRÓPRIA conta.
 *
 *  kind "api":    chave de API do usuário (criptografada no banco). A plataforma chama a IA
 *                 pelo servidor com contexto mínimo e cache — nunca pelo navegador.
 *  kind "handoff": ferramentas sem API pública para isso (Lovable, Bolt, v0, Flow, Claude Code…):
 *                 levamos o briefing pronto até elas (link com o pedido + texto copiado).
 *
 * Arquivo sem segredos: pode ser importado no cliente (tela de Integrações).
 */
export type TextProtocol = "anthropic" | "openai";

export type AiProviderDef = {
  id: string;
  name: string;
  vendor: string;
  description: string;
  protocol: TextProtocol;
  baseUrl: string;
  defaultModel: string;
  models: string[];
  /** Onde o usuário cria a chave. */
  keyUrl: string;
  keyPlaceholder: string;
  /** Parâmetro de limite de saída (modelos de raciocínio da OpenAI usam max_completion_tokens). */
  tokenParam?: "max_tokens" | "max_completion_tokens";
  /** Suporte a response_format json_object. */
  jsonMode?: boolean;
  image?: { protocol: "gemini" | "openai"; label: string; defaultModel: string; models: string[] };
  /** Só em instalação própria (servidor acessa localhost). */
  selfHostedOnly?: boolean;
  needsKey?: boolean;
};

export const AI_PROVIDERS: AiProviderDef[] = [
  {
    id: "anthropic",
    name: "Claude",
    vendor: "Anthropic",
    description: "Textos de site e mensagens com o tom mais natural. Saída estruturada validada.",
    protocol: "anthropic",
    baseUrl: "https://api.anthropic.com",
    defaultModel: "claude-opus-5",
    models: ["claude-opus-5", "claude-sonnet-5", "claude-haiku-4-5"],
    keyUrl: "https://console.anthropic.com/settings/keys",
    keyPlaceholder: "sk-ant-...",
  },
  {
    id: "openai",
    name: "ChatGPT",
    vendor: "OpenAI",
    description: "Textos com GPT e imagens de capa com gpt-image-1.",
    protocol: "openai",
    baseUrl: "https://api.openai.com/v1",
    defaultModel: "gpt-5-mini",
    models: ["gpt-5-mini", "gpt-5", "gpt-5-nano", "gpt-4.1-mini"],
    keyUrl: "https://platform.openai.com/api-keys",
    keyPlaceholder: "sk-...",
    tokenParam: "max_completion_tokens",
    jsonMode: true,
    image: { protocol: "openai", label: "GPT Image", defaultModel: "gpt-image-1", models: ["gpt-image-1", "gpt-image-1-mini"] },
  },
  {
    id: "gemini",
    name: "Gemini + Nano Banana",
    vendor: "Google",
    description: "Textos com Gemini e fotos de capa com Nano Banana (Gemini Image). Mesma chave do Google AI Studio.",
    protocol: "openai",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    defaultModel: "gemini-2.5-flash",
    models: ["gemini-2.5-flash", "gemini-2.5-pro", "gemini-2.5-flash-lite"],
    keyUrl: "https://aistudio.google.com/apikey",
    keyPlaceholder: "AIza...",
    jsonMode: true,
    image: {
      protocol: "gemini",
      label: "Nano Banana",
      defaultModel: "gemini-2.5-flash-image",
      models: ["gemini-2.5-flash-image", "gemini-3-pro-image-preview"],
    },
  },
  {
    id: "openrouter",
    name: "OpenRouter",
    vendor: "OpenRouter",
    description: "Uma chave para centenas de modelos (Llama, Qwen, Claude, GPT, Gemini…).",
    protocol: "openai",
    baseUrl: "https://openrouter.ai/api/v1",
    defaultModel: "openrouter/auto",
    models: ["openrouter/auto", "meta-llama/llama-3.3-70b-instruct", "qwen/qwen-2.5-72b-instruct"],
    keyUrl: "https://openrouter.ai/keys",
    keyPlaceholder: "sk-or-...",
    jsonMode: true,
  },
  {
    id: "groq",
    name: "Groq",
    vendor: "Groq",
    description: "Modelos abertos com resposta muito rápida.",
    protocol: "openai",
    baseUrl: "https://api.groq.com/openai/v1",
    defaultModel: "llama-3.3-70b-versatile",
    models: ["llama-3.3-70b-versatile", "llama-3.1-8b-instant"],
    keyUrl: "https://console.groq.com/keys",
    keyPlaceholder: "gsk_...",
    jsonMode: true,
  },
  {
    id: "deepseek",
    name: "DeepSeek",
    vendor: "DeepSeek",
    description: "Custo baixo por texto gerado.",
    protocol: "openai",
    baseUrl: "https://api.deepseek.com/v1",
    defaultModel: "deepseek-chat",
    models: ["deepseek-chat"],
    keyUrl: "https://platform.deepseek.com/api_keys",
    keyPlaceholder: "sk-...",
    jsonMode: true,
  },
  {
    id: "mistral",
    name: "Mistral",
    vendor: "Mistral AI",
    description: "Modelos europeus, bons em português.",
    protocol: "openai",
    baseUrl: "https://api.mistral.ai/v1",
    defaultModel: "mistral-small-latest",
    models: ["mistral-small-latest", "mistral-large-latest"],
    keyUrl: "https://console.mistral.ai/api-keys",
    keyPlaceholder: "...",
    jsonMode: true,
  },
  {
    id: "xai",
    name: "Grok",
    vendor: "xAI",
    description: "Modelos Grok da xAI.",
    protocol: "openai",
    baseUrl: "https://api.x.ai/v1",
    defaultModel: "grok-4",
    models: ["grok-4", "grok-3-mini"],
    keyUrl: "https://console.x.ai",
    keyPlaceholder: "xai-...",
    jsonMode: true,
  },
  {
    id: "perplexity",
    name: "Perplexity",
    vendor: "Perplexity",
    description: "Modelos Sonar. Útil para pesquisar o mercado do cliente antes da abordagem.",
    protocol: "openai",
    baseUrl: "https://api.perplexity.ai",
    defaultModel: "sonar",
    models: ["sonar", "sonar-pro"],
    keyUrl: "https://www.perplexity.ai/settings/api",
    keyPlaceholder: "pplx-...",
    jsonMode: false,
  },
  {
    id: "ollama",
    name: "Ollama (local)",
    vendor: "Ollama",
    description: "Modelos rodando no seu computador, sem custo por uso. Só em instalação própria.",
    protocol: "openai",
    baseUrl: "http://localhost:11434/v1",
    defaultModel: "llama3.1",
    models: ["llama3.1", "qwen2.5", "gemma2"],
    keyUrl: "https://ollama.com/download",
    keyPlaceholder: "(não precisa)",
    jsonMode: true,
    selfHostedOnly: true,
    needsKey: false,
  },
];

export function getAiProvider(id: string) {
  return AI_PROVIDERS.find((p) => p.id === id) ?? null;
}

export type HandoffTool = {
  id: string;
  name: string;
  vendor: string;
  description: string;
  /** Monta a URL; quando a ferramenta não aceita pedido por link, abre a página e o texto vai copiado. */
  url: (prompt: string) => string;
  prefill: boolean;
  kind: "site" | "chat" | "video" | "code";
};

/** Limite prudente para pedidos em URL (navegadores e servidores cortam URLs longas). */
const MAX_URL_PROMPT = 6000;
const q = (s: string) => encodeURIComponent(s.slice(0, MAX_URL_PROMPT));

export const HANDOFF_TOOLS: HandoffTool[] = [
  { id: "lovable", name: "Lovable", vendor: "Lovable", description: "Cria o site completo a partir do briefing.", url: (p) => `https://lovable.dev/?autosubmit=true#prompt=${q(p)}`, prefill: true, kind: "site" },
  { id: "bolt", name: "Bolt.new", vendor: "StackBlitz", description: "Gera e publica o projeto no navegador.", url: (p) => `https://bolt.new/?prompt=${q(p)}`, prefill: true, kind: "site" },
  { id: "v0", name: "v0", vendor: "Vercel", description: "Interface em React/Next com deploy na Vercel.", url: (p) => `https://v0.app/chat?q=${q(p)}`, prefill: true, kind: "site" },
  { id: "claude-ai", name: "Claude.ai", vendor: "Anthropic", description: "Conversa com o briefing já colado (artifacts).", url: (p) => `https://claude.ai/new?q=${q(p)}`, prefill: true, kind: "chat" },
  { id: "chatgpt", name: "ChatGPT", vendor: "OpenAI", description: "Abre o ChatGPT com o briefing no campo.", url: (p) => `https://chatgpt.com/?q=${q(p)}`, prefill: true, kind: "chat" },
  { id: "gemini-app", name: "Gemini", vendor: "Google", description: "Abre o Gemini; o briefing vai copiado para colar.", url: () => "https://gemini.google.com/app", prefill: false, kind: "chat" },
  { id: "ai-studio", name: "Google AI Studio (Build)", vendor: "Google", description: "Monta um app/site com Gemini; cole o briefing.", url: () => "https://aistudio.google.com/apps", prefill: false, kind: "site" },
  { id: "flow", name: "Google Flow", vendor: "Google", description: "Vídeo curto para o topo do site (Veo). Leva um roteiro de cena pronto.", url: () => "https://labs.google/fx/tools/flow", prefill: false, kind: "video" },
  { id: "cursor", name: "Cursor", vendor: "Anysphere", description: "Abre o pedido no Cursor para criar o projeto localmente.", url: (p) => `https://cursor.com/link/prompt?text=${q(p)}`, prefill: true, kind: "code" },
];
