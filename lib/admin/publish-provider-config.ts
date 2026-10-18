import "server-only";
import type { PublishingPlatform } from "./publish-repository";
import type { YixiaoerAccount } from "./yixiaoer";

export type PublishingProvider = "yixiaoer" | "meta";
type Environment = Record<string, string | undefined>;

export function socialPublishMode(environment: Environment = process.env) {
  const value = environment.SOCIAL_PUBLISH_MODE?.trim().toLowerCase() || "live";
  if (value !== "mock" && value !== "test" && value !== "live") throw new Error("SOCIAL_PUBLISH_MODE must be mock, test, or live");
  return value;
}

const providerKeys: Partial<Record<PublishingPlatform, string>> = {
  instagram: "INSTAGRAM_PUBLISH_PROVIDER",
  facebook: "FACEBOOK_PUBLISH_PROVIDER",
};

const officialAccountConfig: Partial<Record<PublishingPlatform, { idKey: string; name: string; platform: string }>> = {
  instagram: { idKey: "INSTAGRAM_USER_ID", name: "Instagram · Meta official API", platform: "Instagram" },
  facebook: { idKey: "FACEBOOK_PAGE_ID", name: "Facebook Page · Meta official API", platform: "Facebook" },
};

export function publishingProvider(platform: PublishingPlatform, environment: Environment = process.env): PublishingProvider {
  const key = providerKeys[platform];
  const value = key ? environment[key]?.trim().toLowerCase() || "yixiaoer" : "yixiaoer";
  if (value !== "yixiaoer" && value !== "meta") throw new Error(`${key} must be yixiaoer or meta`);
  return value;
}

export function officialPublishingAccount(platform: PublishingPlatform, environment: Environment = process.env): YixiaoerAccount | null {
  const mode=socialPublishMode(environment);
  if(mode==="mock"&&platform!=="x")return{id:`mock-${platform}`,name:`${platform} · local mock`,platform:platform[0].toUpperCase()+platform.slice(1),status:1};
  if (publishingProvider(platform, environment) !== "meta") return null;
  const config = officialAccountConfig[platform];
  const id = config ? environment[mode==="test"?`META_TEST_${config.idKey}`:config.idKey]?.trim() : "";
  return config && id ? { id, name: config.name, platform: config.platform, status: 1 } : null;
}

export function requiresYixiaoerAccount(platform: PublishingPlatform, environment: Environment = process.env){return socialPublishMode(environment)==="live"&&publishingProvider(platform,environment)==="yixiaoer"}

export function resolvePublishingAccountId(platform: PublishingPlatform, selectedAccountId: string | undefined, environment: Environment = process.env) {
  if(socialPublishMode(environment)==="mock")return `mock-${platform}`;
  if (publishingProvider(platform, environment) === "meta") {
    const account = officialPublishingAccount(platform, environment);
    if (!account) throw new Error(`Configure ${socialPublishMode(environment)==="test"?"META_TEST_":""}${officialAccountConfig[platform]?.idKey || "the official account ID"} for ${platform}`);
    return account.id;
  }
  if (!selectedAccountId) throw new Error(`Choose a Yixiaoer account for ${platform}`);
  return selectedAccountId;
}
