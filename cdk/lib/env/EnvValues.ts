export interface EnvValues {
  readonly env: Env;
  readonly vpcCidr: string;
  readonly allowedIngressIpV4CIDRs: string[];
}

export type Env = 'dev';
