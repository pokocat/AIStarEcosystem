export interface DistributionChannelConfig {
  id: string;
  name: string;
  nameEn: string;
  description: string;
  iconKey: "domestic" | "global" | "shortVideo";
  iconBg: string;
  requiredAccounts: string[];
  benefits: string[];
  benefitsEn: string[];
  coverageCount: number;
}

export interface PlatformAccountBinding {
  id: string;
  labelZh: string;
  labelEn: string;
  connected: boolean;
  email?: string;
}

export interface DistributionPublishRequest {
  trackId: string;
  channelIds: string[];
  releaseDate?: string;
  releaseTime?: string;
  preSaveEnabled: boolean;
}

export interface DistributionConfiguration {
  channels: DistributionChannelConfig[];
  accountBindings: PlatformAccountBinding[];
}
