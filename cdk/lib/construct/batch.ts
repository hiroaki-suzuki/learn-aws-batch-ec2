import * as cdk from 'aws-cdk-lib';
import { Duration, Size } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { EnvValues } from '../env/EnvValues';
import {
  EcsEc2ContainerDefinition,
  EcsJobDefinition,
  JobQueue,
  ManagedEc2EcsComputeEnvironment,
} from 'aws-cdk-lib/aws-batch';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { SecurityGroup, Vpc } from 'aws-cdk-lib/aws-ec2';
import { ContainerImage, LogDriver } from 'aws-cdk-lib/aws-ecs';
import {
  Effect,
  PolicyDocument,
  PolicyStatement,
  Role,
  ServicePrincipal,
} from 'aws-cdk-lib/aws-iam';
import { EventField, Rule, RuleTargetInput } from 'aws-cdk-lib/aws-events';
import { Bucket } from 'aws-cdk-lib/aws-s3';
import { BaseLogGroup } from '../base/base-log-group';
import { Queue } from 'aws-cdk-lib/aws-sqs';
import { BatchJob } from 'aws-cdk-lib/aws-events-targets';

export interface BatchProps {
  readonly namePrefix: string;
  readonly envValues: EnvValues;
  readonly vpc: Vpc;
  readonly securityGroup: SecurityGroup;
  readonly bucket: Bucket;
}

export class Batch extends Construct {
  public readonly jobQueue: JobQueue;
  public readonly jobDefinition: EcsJobDefinition;

  constructor(scope: Construct, id: string, props: BatchProps) {
    super(scope, id);

    const { namePrefix, vpc, securityGroup, bucket } = props;

    // コンピューティング環境の作成
    const computeEnvironment = this.createComputeEnvironment(namePrefix, vpc, securityGroup);

    // ジョブキューの作成
    const jobQueue = this.createJobQueue(namePrefix, computeEnvironment);

    // ジョブ定義の作成
    const jobDefinition = this.createJobDefinition(namePrefix);

    // イベントブリッジルールの作成
    this.createEventBridgeRule(namePrefix, bucket, jobQueue, jobDefinition);

    this.jobQueue = jobQueue;
    this.jobDefinition = jobDefinition;
  }

  private createComputeEnvironment(
    namePrefix: string,
    vpc: Vpc,
    securityGroup: SecurityGroup,
  ): ManagedEc2EcsComputeEnvironment {
    const instanceRole = new Role(this, 'InstanceRole', {
      roleName: `${namePrefix}-ec2-compute-env-instance-role`,
      assumedBy: new ServicePrincipal('ec2.amazonaws.com'),
      managedPolicies: [
        {
          managedPolicyArn:
            'arn:aws:iam::aws:policy/service-role/AmazonEC2ContainerServiceforEC2Role',
        },
      ],
    });

    const computeEnvironment = new ManagedEc2EcsComputeEnvironment(this, 'Ec2ComputeEnv', {
      computeEnvironmentName: `${namePrefix}-ec2-compute-env`,
      vpc,
      minvCpus: 0,
      maxvCpus: 32,
      securityGroups: [securityGroup],
      instanceRole,
      useOptimalInstanceClasses: false,
      instanceTypes: [ec2.InstanceType.of(ec2.InstanceClass.M6G, ec2.InstanceSize.XLARGE)],
    });

    // Tags.of(computeEnvironment).add('Name', `${namePrefix}-ec2-compute-env`);

    return computeEnvironment;
  }

  private createJobQueue(
    namePrefix: string,
    computeEnvironment: ManagedEc2EcsComputeEnvironment,
  ): JobQueue {
    return new JobQueue(this, 'JobQueue', {
      jobQueueName: `${namePrefix}-job-queue`,
      computeEnvironments: [{ computeEnvironment: computeEnvironment, order: 1 }],
    });
  }

  private createJobDefinition(namePrefix: string): EcsJobDefinition {
    const logGroup = new BaseLogGroup(this, 'LogGroup', {
      logGroupName: `${namePrefix}-batch-job-log-group`,
    });

    const executionRole = new Role(this, 'JobExecutionRole', {
      roleName: `${namePrefix}-job-execution-role`,
      assumedBy: new ServicePrincipal('ecs-tasks.amazonaws.com'),
      inlinePolicies: {
        logPolicy: new PolicyDocument({
          statements: [
            new PolicyStatement({
              effect: Effect.ALLOW,
              actions: ['logs:CreateLogStream', 'logs:PutLogEvents'],
              resources: [
                `arn:aws:logs:ap-northeast-1:${cdk.Stack.of(this).account}:log-group:/${logGroup.logGroupName}:*`,
              ],
            }),
          ],
        }),
      },
    });

    const jobRole = new Role(this, 'JobRole', {
      roleName: `${namePrefix}-job-role`,
      assumedBy: new ServicePrincipal('ecs-tasks.amazonaws.com'),
    });

    return new EcsJobDefinition(this, 'JobDefinition', {
      jobDefinitionName: `${namePrefix}-job-def`,
      timeout: Duration.minutes(10),
      retryAttempts: 5,
      container: new EcsEc2ContainerDefinition(this, 'ContainerDefinition', {
        image: ContainerImage.fromRegistry('public.ecr.aws/amazonlinux/amazonlinux:latest'),
        cpu: 1,
        memory: Size.mebibytes(2048),
        command: [
          'echo',
          'バケット名: ',
          'Ref::bucketName',
          ', オブジェクトキー: ',
          'Ref::objectKey',
        ],
        executionRole,
        // jobRole,
        logging: LogDriver.awsLogs({
          logGroup: logGroup,
          streamPrefix: 's3-put-job',
        }),
      }),
    });
  }

  private createEventBridgeRule(
    namePrefix: string,
    bucket: Bucket,
    jobQueue: JobQueue,
    jobDefinition: EcsJobDefinition,
  ): void {
    const queue = new Queue(this, 'Queue', {
      queueName: `${namePrefix}-dead-letter-queue`,
    });

    const rule = new Rule(this, 'S3PutEventRule', {
      ruleName: `${namePrefix}-s3-put-rule`,
      eventPattern: {
        source: ['aws.s3'],
        detailType: ['Object Created'],
        detail: {
          bucket: {
            name: [bucket.bucketName],
          },
        },
      },
    });

    rule.addTarget(
      new BatchJob(jobQueue.jobQueueArn, jobQueue, jobDefinition.jobDefinitionArn, jobDefinition, {
        jobName: `${namePrefix}-s3-put-job`,
        attempts: 5,
        deadLetterQueue: queue,
        maxEventAge: Duration.hours(2),
        event: RuleTargetInput.fromObject({
          Parameters: {
            bucketName: EventField.fromPath('$.detail.bucket.name'),
            objectKey: EventField.fromPath('$.detail.object.key'),
          },
        }),
      }),
    );
  }
}
