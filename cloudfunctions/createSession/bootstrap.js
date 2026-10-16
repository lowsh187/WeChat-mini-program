const bootstrapData = require("./bootstrap-data.json");

const COLLECTIONS = [
  "roles",
  "base_questions",
  "work_trials",
  "sessions",
  "assessments",
  "action_plans",
  "feedback",
  "events",
];

async function ensureCollection(database, name) {
  try {
    await database.collection(name).limit(1).get();
  } catch (error) {
    if (typeof database.createCollection !== "function") throw error;
    try {
      await database.createCollection(name);
    } catch (createError) {
      await database
        .collection(name)
        .limit(1)
        .get()
        .catch(() => {
          throw createError;
        });
    }
  }
}

async function seedIfEmpty(database, collectionName, idField, documents) {
  const existing = await database.collection(collectionName).limit(1).get();
  if (existing.data.length > 0) return;
  for (const document of documents) {
    await database
      .collection(collectionName)
      .doc(document[idField])
      .set({
        data: { ...document, createdAt: new Date(), updatedAt: new Date() },
      });
  }
}

async function ensureDatabaseReady(database) {
  for (const name of COLLECTIONS) await ensureCollection(database, name);
  await seedIfEmpty(database, "roles", "roleId", bootstrapData.roles);
  await seedIfEmpty(database, "base_questions", "questionId", bootstrapData.baseQuestions);
  await seedIfEmpty(database, "work_trials", "trialId", bootstrapData.workTrials);
}

module.exports = { ensureDatabaseReady };
