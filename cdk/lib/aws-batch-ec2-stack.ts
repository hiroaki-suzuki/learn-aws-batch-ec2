import * as cdk from 'aws-cdk-lib';
import { CfnOutput } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { EnvValues } from './env/EnvValues';
import { Network } from './construct/network';
import { AppSecurityGroup } from './construct/app-security-group';
import { Batch } from './construct/batch';
import { S3 } from './construct/s3';

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

    const s3 = new S3(this, 'S3', {
      namePrefix,
    });

    const batch = new Batch(this, 'Batch', {
      namePrefix,
      envValues,
      vpc: network.vpc,
      securityGroup: securityGroup.batchSecurityGroup,
      bucket: s3.bucket,
    });

    new CfnOutput(this, 'Bucket', {
      value: s3.bucket.bucketName,
    });

    new CfnOutput(this, 'JobQueueName', {
      value: batch.jobQueue.jobQueueName,
    });

    new CfnOutput(this, 'JobDefinitionName', {
      value: batch.jobDefinition.jobDefinitionName,
    });
  }
}
