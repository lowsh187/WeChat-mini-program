export const CLOUD_ENVIRONMENTS = {
  development: "cloud1-d9g4vq6r057873c75",
  production: "pathai-prod-d6gh4i6u3bfbbdcea",
} as const;

// Release preparation target. Switch this single value for local cloud1 smoke tests.
export const APP_ENVIRONMENT: keyof typeof CLOUD_ENVIRONMENTS = "production";
export const CLOUD_ENV_ID = CLOUD_ENVIRONMENTS[APP_ENVIRONMENT];
