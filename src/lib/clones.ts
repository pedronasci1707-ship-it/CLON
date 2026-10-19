import type { CloneId, SpecialistId } from "./types";

export interface CloneDefinition {
  id: CloneId;
  name: string;
  short: string;
  tagline: string;
  mission: string;
  accent: string;
  accentAlt: string;
  /** Tools this clone may call through the shared agent runtime. */
  tools: string[];
  integrations: string[];
  /** Short chip label → the full command it runs (also cycled as the input placeholder). */
  suggestions: { label: string; prompt: string }[];
}

export const CLONES: Record<CloneId, CloneDefinition> = {
  master: {
    id: "master",
    name: "Master Clone",
    short: "Master",
    tagline: "Your digital second self",
    mission:
      "Understands what you want, delegates to the right specialists, resolves conflicts between them and returns one coordinated plan — always within the permissions you set.",
    accent: "#5be7f5",
    accentAlt: "#9879ff",
    tools: ["calendar.getEvents", "calendar.checkAvailability", "agents.delegate", "approvals.request"],
    integrations: ["Google Calendar", "Gmail", "Parallel"],
    suggestions: [
      { label: "Plan tomorrow", prompt: "Help me organize tomorrow" },
      { label: "Event + invite", prompt: "Check my calendar for tonight, find relevant tech events in San Francisco, and prepare an email inviting my friend to one of them" },
      { label: "Workout slot", prompt: "Find a free 45-minute workout slot tomorrow" },
      { label: "Inbox summary", prompt: "Summarize my unread emails" },
    ],
  },
  communication: {
    id: "communication",
    name: "Communication Clone",
    short: "Communication",
    tagline: "Conversations, handled",
    mission:
      "Reads the inbox you authorize, surfaces what matters, detects meeting requests and drafts replies grounded in your real availability. It never sends on its own.",
    accent: "#5aa8ff",
    accentAlt: "#7fd0ff",
    tools: ["gmail.listMessages", "gmail.createDraft", "calendar.getEvents", "calendar.suggestTimeSlots"],
    integrations: ["Gmail", "Google Calendar"],
    suggestions: [
      { label: "Inbox summary", prompt: "Summarize my unread emails" },
      { label: "Reply to Maya", prompt: "Draft a reply to Maya with times I'm free" },
      { label: "Needs a reply", prompt: "Which emails need a reply today?" },
    ],
  },
  work: {
    id: "work",
    name: "Work Clone",
    short: "Work",
    tagline: "Executive focus",
    mission:
      "Turns tasks, meetings and messages into a clear order of operations, protects focus time and prepares you before every meeting.",
    accent: "#8088ff",
    accentAlt: "#a5aaff",
    tools: ["tasks.list", "calendar.getEvents", "calendar.suggestTimeSlots", "gmail.listMessages"],
    integrations: ["Google Calendar", "Gmail", "Notion · planned", "Slack · planned"],
    suggestions: [
      { label: "Top priorities", prompt: "What are my top priorities tomorrow?" },
      { label: "Next meeting brief", prompt: "Brief me for my next meeting" },
      { label: "Focus time", prompt: "Find focus time for the seed deck" },
    ],
  },
  life: {
    id: "life",
    name: "Life Clone",
    short: "Life",
    tagline: "More life, less logistics",
    mission:
      "Discovers events, places and experiences that fit your interests, budget and free time, with sources you can verify.",
    accent: "#3fd8c4",
    accentAlt: "#7af0de",
    tools: ["research.searchEvents", "calendar.getEvents", "calendar.checkAvailability"],
    integrations: ["Parallel", "Google Calendar"],
    suggestions: [
      { label: "AI events tonight", prompt: "Find interesting AI events tonight after 6 PM" },
      { label: "Saturday plan", prompt: "Plan something fun for Saturday evening" },
      { label: "Free this week", prompt: "When am I free this week?" },
    ],
  },
  fitness: {
    id: "fitness",
    name: "Fitness Clone",
    short: "Fitness",
    tagline: "Consistency, engineered",
    mission:
      "Plans training around your real schedule, tracks what you log and keeps you consistent — with safe, sensible suggestions and no medical claims.",
    accent: "#c4f25f",
    accentAlt: "#9879ff",
    tools: ["workouts.list", "calendar.getEvents", "calendar.suggestTimeSlots"],
    integrations: ["Google Calendar", "Manual logging", "Strava · planned", "Health Connect · planned"],
    suggestions: [
      { label: "45-min slot", prompt: "Find a free 45-minute workout slot tomorrow" },
      { label: "3 gym sessions", prompt: "Organize three gym sessions this week without conflicting with my meetings" },
      { label: "My consistency", prompt: "Show my training consistency over the last seven days" },
      { label: "Beginner plan", prompt: "Create a beginner-friendly workout plan for this week" },
    ],
  },
};

export const SPECIALISTS: SpecialistId[] = ["communication", "work", "life", "fitness"];

export const cloneHref = (id: CloneId) => `/clones/${id}`;
