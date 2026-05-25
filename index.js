require("dotenv").config({ quiet: true });

const fs = require("fs");
const path = require("path");
const { Client, Events, GatewayIntentBits } = require("discord.js");

const {
  DISCORD_TOKEN,
  CHANNEL_ID,
  MIN_INTERVAL_MINUTES = "360",
  MAX_INTERVAL_MINUTES = "900",
  POST_ON_STARTUP = "false",
} = process.env;

if (!DISCORD_TOKEN) {
  throw new Error("DISCORD_TOKEN is missing in .env");
}

if (!CHANNEL_ID) {
  throw new Error("CHANNEL_ID is missing in .env");
}

const minMinutes = Number(MIN_INTERVAL_MINUTES);
const maxMinutes = Number(MAX_INTERVAL_MINUTES);

if (!Number.isInteger(minMinutes) || !Number.isInteger(maxMinutes)) {
  throw new Error("MIN_INTERVAL_MINUTES and MAX_INTERVAL_MINUTES must be integers");
}

if (minMinutes <= 0 || maxMinutes < minMinutes) {
  throw new Error("Invalid interval range");
}

const maxTimeoutMs = 2_147_483_647;

if (maxMinutes * 60 * 1000 > maxTimeoutMs) {
  throw new Error("MAX_INTERVAL_MINUTES is too large for setTimeout");
}

const shouldPostOnStartup = POST_ON_STARTUP.toLowerCase() === "true";

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

function loadPosts() {
  const postsPath = path.join(__dirname, "posts.json");
  const raw = fs.readFileSync(postsPath, "utf8");
  const posts = JSON.parse(raw);

  if (!Array.isArray(posts) || posts.length === 0) {
    throw new Error("posts.json must be a non-empty array");
  }

  const invalidIndex = posts.findIndex(
    (post) => typeof post !== "string" || post.trim().length === 0,
  );

  if (invalidIndex !== -1) {
    throw new Error(`posts.json contains an invalid post at index ${invalidIndex}`);
  }

  return posts;
}

function pickRandomPost(posts) {
  const index = Math.floor(Math.random() * posts.length);
  return posts[index];
}

function randomMinutes(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function sendRandomPost() {
  const posts = loadPosts();
  const message = pickRandomPost(posts);
  const channel = await client.channels.fetch(CHANNEL_ID);

  if (!channel || !channel.isSendable()) {
    throw new Error("Target channel is not sendable or could not be found");
  }

  await channel.send(message);

  console.log(`[POSTED] ${new Date().toISOString()}`);
  console.log(message);
}

function scheduleNextPost() {
  const minutes = randomMinutes(minMinutes, maxMinutes);
  const ms = minutes * 60 * 1000;
  const nextPostAt = new Date(Date.now() + ms).toISOString();

  console.log(`[SCHEDULED] Next post in ${minutes} minutes (${nextPostAt})`);

  setTimeout(async () => {
    try {
      await sendRandomPost();
    } catch (error) {
      console.error("[ERROR] Failed to send post:", error);
    }

    scheduleNextPost();
  }, ms);
}

client.once(Events.ClientReady, async (readyClient) => {
  console.log(`[READY] Logged in as ${readyClient.user.tag}`);

  if (shouldPostOnStartup) {
    try {
      await sendRandomPost();
    } catch (error) {
      console.error("[ERROR] Failed startup post:", error);
    }
  }

  scheduleNextPost();
});

client.login(DISCORD_TOKEN).catch((error) => {
  console.error("[ERROR] Failed to login:", error);
  process.exitCode = 1;
});
