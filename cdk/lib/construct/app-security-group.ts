import { Construct } from 'constructs';
import { Peer, Port, SecurityGroup, Vpc } from 'aws-cdk-lib/aws-ec2';
import { BaseSecurityGroup } from '../base/base-security-group';
import { EnvValues } from '../env/EnvValues';

export class AppSecurityGroupProps {
  readonly namePrefix: string;
  readonly envValues: EnvValues;
  readonly vpc: Vpc;
}

export class AppSecurityGroup extends Construct {
  public readonly batchSecurityGroup: SecurityGroup;

  constructor(scope: Construct, id: string, props: AppSecurityGroupProps) {
    super(scope, id);

    const { namePrefix, envValues, vpc } = props;

    this.batchSecurityGroup = this.createBatchSecurityGroup(namePrefix, envValues, vpc);
  }

  private createBatchSecurityGroup(
    namePrefix: string,
    envValues: EnvValues,
    vpc: Vpc,
  ): SecurityGroup {
    const sg = new BaseSecurityGroup(this, 'Batch', {
      securityGroupName: `${namePrefix}-batch-sg`,
      vpc: vpc,
      description: 'AWS Batch Security Group',
    });

    envValues.allowedIngressIpV4CIDRs.forEach((cidr) => {
      sg.addIngressRule(Peer.ipv4(cidr), Port.tcp(80), 'Allow HTTP from Specific IP');
    });

    return sg;
  }
}
