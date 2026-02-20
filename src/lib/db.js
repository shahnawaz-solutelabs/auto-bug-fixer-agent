import { ObjectId } from "mongodb";
import { getDb } from "./mongodb.js";

// ── Users / Settings ──────────────────────────────────────────

export async function getUserSettings(userId) {
  const db = await getDb();
  const user = await db.collection("users").findOne(
    { _id: new ObjectId(userId) },
    { projection: { tokens: 1 } }
  );
  return user?.tokens || {};
}

export async function updateUserTokens(userId, tokens) {
  const db = await getDb();
  await db.collection("users").updateOne(
    { _id: new ObjectId(userId) },
    { $set: { tokens, tokensUpdatedAt: new Date() } }
  );
}

export function hasRequiredTokens(tokens) {
  return !!(
    tokens?.githubToken?.trim() &&
    tokens?.anthropicKey?.trim()
  );
}

// ── Conversations ─────────────────────────────────────────────

export async function getConversations(userId) {
  const db = await getDb();
  return db
    .collection("conversations")
    .find({ userId })
    .sort({ updatedAt: -1 })
    .project({ messages: 0 })
    .toArray();
}

export async function getConversation(conversationId, userId) {
  const db = await getDb();
  return db.collection("conversations").findOne({
    _id: new ObjectId(conversationId),
    userId,
  });
}

export async function createConversation(userId, title) {
  const db = await getDb();
  const doc = {
    userId,
    title: title || "New Chat",
    messages: [],
    phase: "repo",
    repoInfo: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  const result = await db.collection("conversations").insertOne(doc);
  return { ...doc, _id: result.insertedId };
}

export async function updateConversation(conversationId, userId, updates) {
  const db = await getDb();
  await db.collection("conversations").updateOne(
    { _id: new ObjectId(conversationId), userId },
    { $set: { ...updates, updatedAt: new Date() } }
  );
}

export async function deleteConversation(conversationId, userId) {
  const db = await getDb();
  await db.collection("conversations").deleteOne({
    _id: new ObjectId(conversationId),
    userId,
  });
}

export async function pushMessage(conversationId, userId, message) {
  const db = await getDb();
  await db.collection("conversations").updateOne(
    { _id: new ObjectId(conversationId), userId },
    {
      $push: { messages: { ...message, timestamp: new Date() } },
      $set: { updatedAt: new Date() },
    }
  );
}

export async function updateLastMessage(conversationId, userId, updater) {
  const db = await getDb();
  const conv = await db.collection("conversations").findOne({
    _id: new ObjectId(conversationId),
    userId,
  });
  if (!conv || !conv.messages.length) return;

  const messages = [...conv.messages];
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === "agent" && messages[i].steps) {
      messages[i] = updater(messages[i]);
      break;
    }
  }

  await db.collection("conversations").updateOne(
    { _id: new ObjectId(conversationId), userId },
    { $set: { messages, updatedAt: new Date() } }
  );
}
