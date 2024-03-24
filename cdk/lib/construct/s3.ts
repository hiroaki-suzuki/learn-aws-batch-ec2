import { Construct } from 'constructs';
import { Bucket } from 'aws-cdk-lib/aws-s3';
import { RemovalPolicy } from 'aws-cdk-lib';

export interface S3Props {
  readonly namePrefix: string;
}

export class S3 extends Construct {
  public readonly bucket: Bucket;

  constructor(scope: Construct, id: string, props: S3Props) {
    super(scope, id);

    const { namePrefix } = props;

    // バケットの作成
    this.bucket = this.createBucket(namePrefix);
  }

  private createBucket(namePrefix: string): Bucket {
    return new Bucket(this, 'Bucket', {
      bucketName: `${namePrefix}-bucket`,
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      eventBridgeEnabled: true,
    });
  }
}
