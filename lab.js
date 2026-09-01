// ================================================================
// lab.js – StudyMate AI Virtual Lab Experiment Simulator
// Builds a staged, multi-section AIRich simulation from a
// student's free-text prompt: setup → reaction → observation →
// result, each stage rendered with its own visual and a short
// "sound cue" description (WhatsApp has no native audio-emoji
// playback in AIRich, so cues are rendered as labelled tags).
// ================================================================

import { AIRich } from './nixcode.js';
import { askAI, generateImage, BOT_NAME, formatWhatsAppText } from './bot.js';

// ─── Apparatus catalogue ─────────────────────────────────────────
// Used to ground the AI's equipment list and to pick sensible
// stage icons when the AI doesn't specify its own.
const APPARATUS_HINTS = [
  'beaker', 'flask', 'test tube', 'burette', 'pipette', 'Bunsen burner',
  'tripod stand', 'wire gauze', 'thermometer', 'stirring rod', 'funnel',
  'measuring cylinder', 'retort stand', 'clamp', 'petri dish', 'microscope',
  'goggles', 'gloves', 'litmus paper', 'crucible', 'condenser'
];

const STAGE_ICONS = {
  setup: '🧫',
  reaction: '⚗️',
  observation: '🔍',
  result: '📊',
  safety: '⚠️'
};

// A short library of descriptive "sound cue" tags per reaction type,
// used since WhatsApp AIRich can't embed real audio inline — this
// gives the simulation an audible feel through text.
const SOUND_LIBRARY = {
  fizz: '🔊 *Sound:* soft fizzing / effervescence',
  bubble: '🔊 *Sound:* steady bubbling',
  sizzle: '🔊 *Sound:* sharp sizzle on contact',
  flame: '🔊 *Sound:* gentle roar of the burner flame',
  clink: '🔊 *Sound:* glass clinking as apparatus is set up',
  pour: '🔊 *Sound:* liquid pouring, gentle splash',
  silence: '🔊 *Sound:* quiet — reaction is visual only',
  explosion: '🔊 *Sound:* sharp pop (contained, small-scale)'
};

function pickSound(text = '') {
  const t = text.toLowerCase();
  if (t.includes('acid') || t.includes('carbonate') || t.includes('co2') || t.includes('fizz')) return SOUND_LIBRARY.fizz;
  if (t.includes('boil') || t.includes('heat') || t.includes('bubbl')) return SOUND_LIBRARY.bubble;
  if (t.includes('metal') && t.includes('water')) return SOUND_LIBRARY.sizzle;
  if (t.includes('burner') || t.includes('flame') || t.includes('combustion')) return SOUND_LIBRARY.flame;
  if (t.includes('pour') || t.includes('titrat') || t.includes('mix')) return SOUND_LIBRARY.pour;
  if (t.includes('explo') || t.includes('spark') || t.includes('ignite')) return SOUND_LIBRARY.explosion;
  return SOUND_LIBRARY.silence;
}

// ─── AI: expand a short prompt into a structured stage plan ──────
async function planExperiment(prompt, lang = 'en') {
  const planPrompt = `You are a virtual science lab designer for Zimbabwean high school students (${BOT_NAME}).
A student wants to simulate this experiment: "${prompt}"

Design a realistic, safe, curriculum-appropriate simulation. Respond ONLY with strict JSON (no markdown fences) matching this shape:

{
  "title": "short experiment title",
  "subject": "chemistry|physics|biology",
  "apparatus": ["item1", "item2", "..."],
  "objective": "one sentence objective",
  "setup_scene": "vivid visual description of the apparatus arranged and ready, for image generation",
  "reaction_scene": "vivid visual description of the reaction actively happening, for image generation",
  "observation": "what a student would observe (colour change, gas, precipitate, temperature, motion, etc.)",
  "result": "the scientific conclusion / result of the experiment",
  "safety": "one or two key safety precautions",
  "reaction_keywords": "a few words describing the physical reaction type (e.g. 'fizzing acid carbonate') used only to pick a sound cue"
}

Keep every field concise (1-3 sentences max). This is a simulation for learning, not real lab instructions requiring hazardous materials.`;

  const raw = await askAI(planPrompt, null, null, lang);
  try {
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
  } catch (e) {
    // fall through to fallback below
  }
  return {
    title: 'Custom Lab Experiment',
    subject: 'science',
    apparatus: APPARATUS_HINTS.slice(0, 5),
    objective: `Explore: ${prompt}`,
    setup_scene: `A laboratory bench with ${prompt}, apparatus arranged neatly under bright lab lighting.`,
    reaction_scene: `A close-up of the reaction taking place for: ${prompt}.`,
    observation: 'Observation pending — description unavailable.',
    result: 'Result pending — description unavailable.',
    safety: 'Wear safety goggles and gloves at all times.',
    reaction_keywords: prompt
  };
}

// ─── Stage builder: each stage is its own AIRich section ─────────
function addSetupStage(rich, plan) {
  rich.addText(
    `${STAGE_ICONS.setup} *STAGE 1 — SETUP*\n\n` +
    `*${plan.title}*\n` +
    `_${plan.subject?.toUpperCase() || 'SCIENCE'}_\n\n` +
    `🎯 *Objective:*\n${plan.objective}\n\n` +
    `🧰 *Apparatus:*\n${(Array.isArray(plan.apparatus) ? plan.apparatus : [plan.apparatus]).map(a => `• ${a}`).join('\n')}\n\n` +
    SOUND_LIBRARY.clink
  );
}

function addReactionStage(rich, plan) {
  const sound = pickSound(plan.reaction_keywords || plan.observation || '');
  rich.addText(
    `${STAGE_ICONS.reaction} *STAGE 2 — REACTION IN PROGRESS*\n\n` +
    `The simulation is now running the procedure described.\n\n` +
    sound
  );
}

function addObservationStage(rich, plan) {
  rich.addText(
    `${STAGE_ICONS.observation} *STAGE 3 — OBSERVATION*\n\n${plan.observation}`
  );
}

function addResultStage(rich, plan) {
  rich.addText(
    `${STAGE_ICONS.result} *STAGE 4 — RESULT*\n\n${plan.result}\n\n` +
    `${STAGE_ICONS.safety} *Safety Note:*\n${plan.safety}\n\n` +
    `_This is a simulated experiment for learning purposes. Always follow real lab safety protocols under supervision._`
  );
}

// ─── Main entry: build + send the full staged simulation ─────────
export async function runLabExperiment(sock, fromJid, prompt, { lang = 'en', quoted = null, footer = '' } = {}) {
  const plan = await planExperiment(prompt, lang);

  const rich = new AIRich(sock);
  rich.setTitle(plan.title || 'Virtual Lab');
  rich.setSubtitle('🧪 StudyMate Lab Simulator');

  // Stage 1: setup text
  addSetupStage(rich, plan);

  // Stage 1 visual: apparatus arranged, ready
  let setupImg = null;
  try { setupImg = await generateImage(plan.setup_scene || `lab apparatus setup for ${prompt}`); } catch (e) {}
  if (setupImg) rich.addImage(setupImg, { width: 768, height: 512, status: 'READY' });

  // Stage 2: reaction text + sound cue
  addReactionStage(rich, plan);

  // Stage 2 visual: reaction happening
  let reactionImg = null;
  try { reactionImg = await generateImage(plan.reaction_scene || `chemical reaction lab scene for ${prompt}`); } catch (e) {}
  if (reactionImg) rich.addImage(reactionImg, { width: 768, height: 512, status: 'READY' });

  // Stage 3: observation
  addObservationStage(rich, plan);

  // Stage 4: result + safety
  addResultStage(rich, plan);

  rich.addSuggest([
    `lab ${prompt}`,
    'lab new experiment',
    'menu'
  ]);
  rich.setFooter(footer || `🧪 ${BOT_NAME} | Virtual Lab`);

  await rich.send(fromJid, quoted ? { quoted } : {});
  return plan;
}