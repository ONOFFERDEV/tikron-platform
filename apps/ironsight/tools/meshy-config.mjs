import { createHash } from 'node:crypto';

export class ConfigError extends Error {
  constructor(code, detail) { super(`${code}${detail ? `: ${detail}` : ''}`); this.name = 'ConfigError'; this.code = code; }
}

const isRecord = value => typeof value === 'object' && value !== null && !Array.isArray(value);

export function parseConfig(value) {
  if (!isRecord(value) || value.schemaVersion !== 1 || !isRecord(value.limits) || !isRecord(value.pricing) || !isRecord(value.model) || !Array.isArray(value.assets)) throw new ConfigError('invalid_config');
  if (value.credentialSource !== 'ironsight-meshy-20260911') throw new ConfigError('invalid_credential_source_config');
  if (value.limits.totalCredits !== 600 || value.limits.batchCredits !== 150 || value.limits.minimumBalance !== 300) throw new ConfigError('invalid_budget_limits');
  if (value.pricing.previewCredits !== 20 || value.pricing.refine2kCredits !== 10 || value.pricing.rigCredits !== 5) throw new ConfigError('invalid_pricing');
  if (value.model.aiModel !== 'meshy-7' || value.model.topology !== 'triangle' || value.model.shouldRemesh !== true || value.model.ultra !== false || value.model.format !== 'glb' || value.model.pbr !== true || value.model.sourceTextureResolution !== '2k') throw new ConfigError('unapproved_model_options');
  const keys = new Set();
  for (const asset of value.assets) {
    if (!isRecord(asset) || typeof asset.assetKey !== 'string' || !/^[a-z0-9_-]+$/.test(asset.assetKey) || keys.has(asset.assetKey) || !['hero-weapon', 'hero-character', 'environment-prop'].includes(asset.role) || typeof asset.prompt !== 'string' || asset.prompt.length < 1 || asset.prompt.length > 800 || !Number.isInteger(asset.targetPolycount) || asset.targetPolycount < 100 || asset.targetPolycount > 300000 || ![512, 1024].includes(asset.runtimeTextureMax) || typeof asset.optionalRig !== 'boolean') throw new ConfigError('invalid_asset_recipe');
    keys.add(asset.assetKey);
  }
  if (!isRecord(value.retryRecipes)) throw new ConfigError('invalid_retry_recipes');
  for (const [assetKey, recipes] of Object.entries(value.retryRecipes)) if (!keys.has(assetKey) || !Array.isArray(recipes) || recipes.some(recipe => !isRecord(recipe) || !/^attempt-[2-9][0-9]*$/.test(recipe.attemptId) || typeof recipe.priorAttemptId !== 'string' || typeof recipe.prompt !== 'string' || recipe.prompt.length > 1200 || typeof recipe.authorizationArtifact !== 'string' || !/^[a-f0-9]{64}$/i.test(recipe.authorizationSha256))) throw new ConfigError('invalid_retry_recipe', assetKey);
  return value;
}

export function recipeFor(context, attemptId = 'attempt-1') {
  return attemptId === 'attempt-1' ? { attemptId, prompt: context.asset.prompt } : context.config.retryRecipes[context.assetKey]?.find(recipe => recipe.attemptId === attemptId);
}

export function inputHash(context, receipt) {
  const recipe = recipeFor(context, receipt?.attemptId); if (!recipe) throw new ConfigError('unknown_attempt_recipe');
  return createHash('sha256').update(JSON.stringify({ prompt: recipe.prompt, model: context.config.model, targetPolycount: context.asset.targetPolycount })).digest('hex');
}
