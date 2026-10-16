const https = require("node:https");

function readProviderConfig(environment = process.env) {
  const apiKey = environment.AI_API_KEY;
  const endpoint = environment.AI_BASE_URL;
  const model = environment.AI_MODEL;
  if (!apiKey || !endpoint || !model) throw new Error("AI_PROVIDER_NOT_CONFIGURED");
  const url = new URL(endpoint);
  if (url.protocol !== "https:") throw new Error("AI_PROVIDER_HTTPS_REQUIRED");
  return { apiKey, endpoint: url, model };
}

function postJson(url, headers, body, timeoutMs) {
  return new Promise((resolve, reject) => {
    const request = https.request(
      url,
      { method: "POST", headers: { ...headers, "content-type": "application/json" } },
      (response) => {
        let raw = "";
        response.setEncoding("utf8");
        response.on("data", (chunk) => {
          raw += chunk;
          if (raw.length > 1024 * 1024) request.destroy(new Error("AI_RESPONSE_TOO_LARGE"));
        });
        response.on("end", () => {
          if (!response.statusCode || response.statusCode < 200 || response.statusCode >= 300) {
            reject(new Error(`AI_HTTP_${response.statusCode || 0}`));
            return;
          }
          try {
            resolve(JSON.parse(raw));
          } catch {
            reject(new Error("AI_RESPONSE_NOT_JSON"));
          }
        });
      },
    );
    const timer = setTimeout(() => request.destroy(new Error("AI_TIMEOUT")), timeoutMs);
    request.on("close", () => clearTimeout(timer));
    request.on("error", reject);
    request.end(JSON.stringify(body));
  });
}

async function requestStructuredCompletion({ system, user, timeoutMs = 15000 }, environment) {
  const config = readProviderConfig(environment);
  const raw = await postJson(
    config.endpoint,
    { authorization: `Bearer ${config.apiKey}` },
    {
      model: config.model,
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    },
    timeoutMs,
  );
  const content = raw?.choices?.[0]?.message?.content;
  if (typeof content !== "string" || content.length > 20000) throw new Error("AI_RESPONSE_INVALID");
  try {
    return JSON.parse(content);
  } catch {
    throw new Error("AI_CONTENT_NOT_JSON");
  }
}

module.exports = { postJson, readProviderConfig, requestStructuredCompletion };
