import "server-only";

import type { CloneId } from "@/lib/types";
import { classifyWithModel, type AgentIntent } from "../llm";

interface RuleMatch {
  intent: AgentIntent;
  confidence: number;
}

const TITLES: Record<AgentIntent, string> = {
  event_invite: "Finding an event and preparing your invitation",
  discover_events: "Finding experiences that fit your schedule",
  calendar_view: "Reading your calendar",
  organize_day: "Coordinating your day",
  inbox_summary: "Triaging your inbox",
  email_reply: "Preparing a grounded reply",
  draft_email: "Preparing an email draft",
  priorities: "Ranking your priorities",
  meeting_brief: "Preparing your meeting brief",
  workout_slot: "Finding a workout window",
  workout_plan: "Building your training plan",
  fitness_stats: "Reviewing your consistency",
  unknown: "Working on your request",
};

const CLONES: Record<AgentIntent, CloneId[]> = {
  event_invite: ["master", "life", "communication"],
  discover_events: ["master", "life"],
  calendar_view: ["master", "work"],
  organize_day: ["master", "work", "fitness", "life"],
  inbox_summary: ["master", "communication"],
  email_reply: ["master", "communication"],
  draft_email: ["master", "communication"],
  priorities: ["master", "work"],
  meeting_brief: ["master", "work", "communication"],
  workout_slot: ["master", "fitness"],
  workout_plan: ["master", "fitness"],
  fitness_stats: ["master", "fitness"],
  unknown: ["master"],
};

function normalized(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function rules(command: string, clone: CloneId): RuleMatch {
  const text = normalized(command);
  const has = (...patterns: RegExp[]) => patterns.some((pattern) => pattern.test(text));

  if (
    has(/event|evento|show|meetup|experience|programa/) &&
    has(/email|e-mail|invite|invitation|convid|cham/) &&
    has(/find|search|look|procur|encontr|descobr/)
  ) return { intent: "event_invite", confidence: 0.99 };
  if (has(/reply|respond|responder|resposta/) && has(/email|e-mail|inbox|caixa/)) return { intent: "email_reply", confidence: 0.98 };
  if (has(/draft|escrev|redig|prepare|preparar/) && has(/email|e-mail|mensagem/)) return { intent: "draft_email", confidence: 0.95 };
  if (has(/unread|inbox|email|e-mail|caixa de entrada/) && has(/summar|triage|need a reply|resum|prioriz/)) {
    return { intent: "inbox_summary", confidence: 0.97 };
  }
  if (has(/brief|prepare me|prep me|prepar/) && has(/meeting|reuniao|call|chamada/)) return { intent: "meeting_brief", confidence: 0.97 };
  if (has(/priorit|top task|what.*do first|o que.*primeiro|tarefas?/)) return { intent: "priorities", confidence: 0.91 };
  if (has(/workout|gym|training|treino|academia|exercicio/) && has(/slot|free|window|schedule|horario|encaix|agenda/)) {
    return { intent: "workout_slot", confidence: 0.98 };
  }
  if (has(/workout plan|training plan|plan.*workout|plano.*treino|treinos.*semana/)) return { intent: "workout_plan", confidence: 0.96 };
  if (has(/consistency|streak|training stats|fitness stats|consistencia|estatistica|historico.*treino/)) {
    return { intent: "fitness_stats", confidence: 0.96 };
  }
  if (has(/organize|plan my|arrange|organizar|planejar/) && has(/day|tomorrow|today|dia|amanha|hoje/)) {
    return { intent: "organize_day", confidence: 0.94 };
  }
  if (has(/calendar|schedule|agenda|compromiss|when am i free|quando.*livre/)) return { intent: "calendar_view", confidence: 0.86 };
  if (has(/find|search|discover|procur|encontr|descobr/) && has(/event|evento|show|meetup|music|concert|programa/)) {
    return { intent: "discover_events", confidence: 0.94 };
  }

  const defaults: Record<CloneId, AgentIntent> = {
    master: "unknown",
    communication: "inbox_summary",
    work: "priorities",
    life: "discover_events",
    fitness: "fitness_stats",
  };
  return { intent: defaults[clone], confidence: clone === "master" ? 0.1 : 0.55 };
}

export async function planCommand(command: string, clone: CloneId, signal?: AbortSignal) {
  const rule = rules(command, clone);
  let intent = rule.intent;
  let planner: "rules" | "llm" = "rules";

  if (rule.confidence < 0.8) {
    const model = await classifyWithModel(command, clone, signal);
    if (model) {
      intent = model.intent;
      planner = "llm";
    }
  }

  if (intent === "unknown") {
    const fallback: Record<CloneId, AgentIntent> = {
      master: "organize_day",
      communication: "inbox_summary",
      work: "priorities",
      life: "discover_events",
      fitness: "fitness_stats",
    };
    intent = fallback[clone];
  }

  const involved = CLONES[intent];
  return {
    intent,
    planner,
    title: TITLES[intent],
    clones: clone === "master" ? involved : Array.from(new Set<CloneId>(["master", clone, ...involved.filter((c) => c === clone)])),
  };
}

