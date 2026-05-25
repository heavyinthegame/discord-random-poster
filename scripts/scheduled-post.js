require("dotenv").config({ quiet: true });

const fs = require("fs");
const path = require("path");
const { REST, Routes } = require("discord.js");

const rootDir = path.join(__dirname, "..");
const statePath = path.resolve(rootDir, process.env.POSTER_STATE_PATH || ".poster-state.json");

const {
  DISCORD_TOKEN,
  CHANNEL_ID,
  MIN_INTERVAL_MINUTES = "360",
  MAX_INTERVAL_MINUTES = "900",
  POST_ON_STARTUP = "false",
  FORCE_POST = "false",
} = process.env;

if (!DISCORD_TOKEN) {
  throw new Error("DISCORD_TOKEN is missing");
}

if (!CHANNEL_ID) {
  throw new Error("CHANNEL_ID is missing");
}

const minMinutes = Number(MIN_INTERVAL_MINUTES);
const maxMinutes = Number(MAX_INTERVAL_MINUTES);

if (!Number.isInteger(minMinutes) || !Number.isInteger(maxMinutes)) {
  throw new Error("MIN_INTERVAL_MINUTES and MAX_INTERVAL_MINUTES must be integers");
}

if (minMinutes <= 0 || maxMinutes < minMinutes) {
  throw new Error("Invalid interval range");
}

const shouldPostOnStartup = POST_ON_STARTUP.toLowerCase() === "true";
const shouldForcePost =
  FORCE_POST.toLowerCase() === "true" || process.argv.includes("--force");

function loadPosts() {
  const postsPath = path.join(rootDir, "posts.json");
  const raw = fs.readFileSync(postsPath, "utf8");
  const posts = JSON.parse(raw);

  if (!Array.isArray(posts) || posts.length === 0) {
    throw new Error("posts.json must be a non-empty array");
  }

  const invalidIndex = posts.findIndex(
    (post) => typeof post !== "string" || post.trim().length === 0 || post.length > 2000,
  );

  if (invalidIndex !== -1) {
    throw new Error(
      `posts.json contains an invalid or too-long post at index ${invalidIndex}`,
    );
  }

  return posts;
}

function loadState() {
  if (!fs.existsSync(statePath)) {
    return {};
  }

  const raw = fs.readFileSync(statePath, "utf8").trim();

  if (!raw) {
    return {};
  }

  const state = JSON.parse(raw);

  if (!state || typeof state !== "object" || Array.isArray(state)) {
    throw new Error("Poster state must be a JSON object");
  }

  return state;
}

function saveState(state) {
  fs.mkdirSync(path.dirname(statePath), { recursive: true });
  fs.writeFileSync(statePath, `${JSON.stringify(state, null, 2)}\n`);
}

function pickRandomPost(posts) {
  const index = Math.floor(Math.random() * posts.length);
  return posts[index];
}

function randomMinutes(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function createNextState(previousState = {}) {
  const minutes = randomMinutes(minMinutes, maxMinutes);
  const nextPostAt = new Date(Date.now() + minutes * 60 * 1000).toISOString();

  return {
    ...previousState,
    nextPostAt,
    nextIntervalMinutes: minutes,
    updatedAt: new Date().toISOString(),
  };
}

async function sendRandomPost() {
  const posts = loadPosts();
  const message = pickRandomPost(posts);
  const rest = new REST({ version: "10" }).setToken(DISCORD_TOKEN);

  await rest.post(Routes.channelMessages(CHANNEL_ID), {
    body: {
      content: message,
    },
  });

  console.log(`[POSTED] ${new Date().toISOString()}`);
  console.log(message);
}

async function main() {
  const state = loadState();
  const now = Date.now();
  const nextPostAtMs = state.nextPostAt ? Date.parse(state.nextPostAt) : NaN;

  if (!state.nextPostAt || !Number.isFinite(nextPostAtMs)) {
    if (shouldPostOnStartup || shouldForcePost) {
      await sendRandomPost();
      const nextState = createNextState({
        lastPostedAt: new Date().toISOString(),
      });
      saveState(nextState);
      console.log(`[SCHEDULED] Next post at ${nextState.nextPostAt}`);
      return;
    }

    const nextState = createNextState(state);
    saveState(nextState);
    console.log(`[SCHEDULED] First post at ${nextState.nextPostAt}`);
    return;
  }

  if (!shouldForcePost && nextPostAtMs > now) {
    console.log(`[SKIPPED] Next post is scheduled at ${state.nextPostAt}`);
    return;
  }

  await sendRandomPost();

  const nextState = createNextState({
    ...state,
    lastPostedAt: new Date().toISOString(),
  });

  saveState(nextState);
  console.log(`[SCHEDULED] Next post at ${nextState.nextPostAt}`);
}

main().catch((error) => {
  console.error("[ERROR] Scheduled post failed:", error);
  process.exitCode = 1;
});
