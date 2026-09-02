import { readFile } from "node:fs/promises";
import {
  ConfiguredLLMCourseDesignProvider,
  ConfiguredLLMKnowledgeProvider,
  COURSE_DESIGN_PROMPT_VERSION,
  DeterministicBlockKnowledgeProvider,
  DeterministicCourseDesignProvider,
  KNOWLEDGE_UNDERSTANDING_PROMPT_VERSION,
  type CourseDesignCapability,
  type KnowledgeUnderstandingCapability
} from "@livingcourse/generation";
import {
  OpenAICompatibleStructuredGenerationTransport,
  type SemanticEndpointClassification
} from "@livingcourse/providers";

export type SemanticConfigurationStatus = "CONFIGURED" | "NOT_CONFIGURED";

export interface SemanticProviderDisclosure {
  status: SemanticConfigurationStatus;
  mode: "semantic_ai" | "literal_deterministic";
  provider: "openai-compatible" | "literal";
  model: string | null;
  processingMode: SemanticEndpointClassification | "local_deterministic";
  fallback: string | null;
  reachability: "NOT_APPLICABLE" | "NOT_VERIFIED";
}

export interface ResolvedSemanticCapabilities {
  knowledgeUnderstanding: KnowledgeUnderstandingCapability;
  courseDesign: CourseDesignCapability;
  disclosure: SemanticProviderDisclosure;
}

export class SemanticConfigurationError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(`${code}: ${message}`);
    this.name = "SemanticConfigurationError";
    this.code = code;
  }
}

const promptUrl = (name: string): URL => new URL(`../../../prompts/${name}`, import.meta.url);

export const loadSemanticPromptTemplates = async (): Promise<{
  knowledge: string;
  courseDesign: string;
}> => ({
  knowledge: await readFile(promptUrl(`${KNOWLEDGE_UNDERSTANDING_PROMPT_VERSION}.md`), "utf8"),
  courseDesign: await readFile(promptUrl(`${COURSE_DESIGN_PROMPT_VERSION}.md`), "utf8")
});

const literalCapabilities = (): ResolvedSemanticCapabilities => ({
  knowledgeUnderstanding: new DeterministicBlockKnowledgeProvider(),
  courseDesign: new DeterministicCourseDesignProvider(),
  disclosure: {
    status: "NOT_CONFIGURED",
    mode: "literal_deterministic",
    provider: "literal",
    model: null,
    processingMode: "local_deterministic",
    fallback: "Literal deterministic extraction; no semantic model call will be made.",
    reachability: "NOT_APPLICABLE"
  }
});

const configuredValue = (name: string): string | null => {
  const value = process.env[name]?.trim();
  return value ? value : null;
};

export const resolveSemanticCapabilitiesFromEnv = async (): Promise<ResolvedSemanticCapabilities> => {
  const selected = configuredValue("LIVINGCOURSE_SEMANTIC_PROVIDER");
  if (selected === null || selected === "literal") return literalCapabilities();
  if (selected !== "openai-compatible") {
    throw new SemanticConfigurationError("LC-SEMANTIC-CONFIG-001", `unsupported semantic provider '${selected}'.`);
  }

  const required = ["LIVINGCOURSE_SEMANTIC_BASE_URL", "LIVINGCOURSE_SEMANTIC_MODEL", "LIVINGCOURSE_SEMANTIC_API_KEY"] as const;
  const missing = required.filter((name) => configuredValue(name) === null);
  if (missing.length > 0) {
    throw new SemanticConfigurationError("LC-SEMANTIC-CONFIG-002", `openai-compatible configuration is incomplete; missing ${missing.join(", ")}.`);
  }
  const baseUrl = configuredValue("LIVINGCOURSE_SEMANTIC_BASE_URL")!;
  const model = configuredValue("LIVINGCOURSE_SEMANTIC_MODEL")!;
  const timeoutValue = configuredValue("LIVINGCOURSE_SEMANTIC_TIMEOUT_MS");
  const requestTimeoutMs = timeoutValue === null ? 30_000 : Number(timeoutValue);
  if (!Number.isInteger(requestTimeoutMs) || requestTimeoutMs <= 0) {
    throw new SemanticConfigurationError("LC-SEMANTIC-CONFIG-003", "LIVINGCOURSE_SEMANTIC_TIMEOUT_MS must be a positive integer.");
  }
  const transport = new OpenAICompatibleStructuredGenerationTransport({ baseUrl, model, requestTimeoutMs });
  const prompts = await loadSemanticPromptTemplates();
  const common = {
    provider: "openai-compatible",
    model,
    profileVersion: "livingcourse-semantic-v1",
    transport
  };
  return {
    knowledgeUnderstanding: new ConfiguredLLMKnowledgeProvider({
      ...common,
      promptTemplate: prompts.knowledge,
      promptTemplateVersion: KNOWLEDGE_UNDERSTANDING_PROMPT_VERSION
    }),
    courseDesign: new ConfiguredLLMCourseDesignProvider({
      ...common,
      promptTemplate: prompts.courseDesign,
      promptTemplateVersion: COURSE_DESIGN_PROMPT_VERSION
    }),
    disclosure: {
      status: "CONFIGURED",
      mode: "semantic_ai",
      provider: "openai-compatible",
      model,
      processingMode: transport.endpointClassification,
      fallback: null,
      reachability: "NOT_VERIFIED"
    }
  };
};
