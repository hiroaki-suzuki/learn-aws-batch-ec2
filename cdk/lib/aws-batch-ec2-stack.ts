import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { EnvValues } from './env/EnvValues';
import { Network } from './construct/network';
import { AppSecurityGroup } from './construct/app-security-group';

export interface AwsBatchEc2StackProps extends cdk.StackProps {
  readonly namePrefix: string;
  readonly envValues: EnvValues;
}

export class AwsBatchEc2Stack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: AwsBatchEc2StackProps) {
    super(scope, id, props);

    const { namePrefix, envValues } = props;

    const network = new Network(this, 'Network', {
      namePrefix,
      envValues,
    });

    const securityGroup = new AppSecurityGroup(this, 'SecurityGroup', {
      namePrefix,
      envValues,
      vpc: network.vpc,
    });

    // TODO EC2 ???
  }
}
