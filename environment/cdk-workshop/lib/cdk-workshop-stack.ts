import { CfnOutput, Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';

// ファイルを読み込むためのパッケージを import
import { readFileSync } from "fs";

export class CdkWorkshopStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // VPCを宣言
    const vpc = new ec2.Vpc(this, 'BlogVpc', {
      ipAddresses: ec2.IpAddresses.cidr('10.40.0.0/16'),
    });

    // EC2 インスタンスの宣言を準備
    const webServer1 = new ec2.Instance(this, 'WebServer1', {
      // EC2 インスタンスを起動する VPC を設定
      vpc,
      // t2.small インスタンスタイプを指定
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T2, ec2.InstanceSize.SMALL),
      // AmazonLinuxImage インスタンスを生成し、AMIを設定
      machineImage: new ec2.AmazonLinuxImage({
        generation: ec2.AmazonLinuxGeneration.AMAZON_LINUX_2,
      }),
      // EC2 インスタンスを配置するサブネットを指定
      vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
    });

    // user-data.sh を読み込み、変数に格納
    const script = readFileSync('./lib/resources/user-data.sh', 'utf8');
    // EC2 インスタンスにユーザーデータを追加
    webServer1.addUserData(script);

    // port80, 全てのIPアドレスからのアクセスを許可
    webServer1.connections.allowFromAnyIpv4(ec2.Port.tcp(80));

    // EC2インスタンスアクセス用のIPアドレスを出力
    new CfnOutput(this, 'WebServer1PublicIp', {
      value: `http://${webServer1.instancePublicIp}`,
    });

    // // RDS ログイン情報を登録するためのシークレットを作成
    // const templateSecret = new secretsmanager.Secret(this, 'TemplatedSecret', {
    //   generateSecretString: {
    //     secretStringTemplate: JSON.stringify({ username: 'postgres' }),
    //     generateStringKey: 'password',
    //     excludeCharacters: '"@/\\',
    //   }
    // });

    // // RDS インスタンスの宣言を準備
    // const instance = new rds.DatabaseInstance(this, 'BlogInstance', {
    //   engine: rds.DatabaseInstanceEngine.postgres({
    //     version: rds.PostgresEngineVersion.VER_13_3,
    //   }),
    //   vpc,
    //   credentials: {
    //     username: templateSecret.secretValueFromJson('username').toString(),
    //     password: templateSecret.secretValueFromJson('password'),
    //   }
    // });

    // RDSのインスタンスを宣言
    const dbServer = new rds.DatabaseInstance(this, 'WordPressDB', {
      vpc,
      engine: rds.DatabaseInstanceEngine.mysql({
        version: rds.MysqlEngineVersion.VER_8_0_33,
      }),
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T2, ec2.InstanceSize.SMALL),
      databaseName: 'wordpress',
    });

    // WebServerからのアクセス許可
    dbServer.connections.allowFrom(webServer1, ec2.Port.tcp(3306));
  }
}
