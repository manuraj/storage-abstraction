import "jasmine";
import { Storage } from "../src/Storage";
import { StorageType } from "../src/types";

// describe("test jasmine", () => {
//   it("weird", () => {
//     expect("false").toBeTruthy();
//     expect("0").toBeTruthy();
//   });
// });

describe(`testing Google urls`, () => {
  it("[0]", () => {
    this.storage = new Storage("gcs://keyFile.json:appName?bucketName=the-buck");
    expect(this.storage.getType()).toBe(StorageType.GCS);
    expect(this.storage.getSelectedBucket()).toBe("the-buck");
    expect(this.storage.getConfiguration().projectId).toBe("appName");
    expect(this.storage.getConfiguration().keyFilename).toBe("keyFile.json");
  });

  it("[1]", () => {
    this.storage = new Storage("gcs://keyFile.json:appName/");
    expect(this.storage.getType()).toBe(StorageType.GCS);
    expect(this.storage.getSelectedBucket()).toBe("");
    expect(this.storage.getConfiguration().projectId).toBe("appName/"); // this will probably yield an error at gcs
    expect(this.storage.getConfiguration().keyFilename).toBe("keyFile.json");
  });

  it("[2]", () => {
    this.storage = new Storage("gcs://keyFile.json:appName");
    expect(this.storage.getType()).toBe(StorageType.GCS);
    expect(this.storage.getSelectedBucket()).toBe("");
    expect(this.storage.getConfiguration().projectId).toBe("appName");
    expect(this.storage.getConfiguration().keyFilename).toBe("keyFile.json");
  });

  it("[3]", () => {
    this.storage = new Storage("gcs://tests/keyFile.json?bucketName=the-buck");
    expect(this.storage.getType()).toBe(StorageType.GCS);
    expect(this.storage.getSelectedBucket()).toBe("the-buck");
    expect(this.storage.getConfiguration().projectId).toBe("appIdFromTestFile");
    expect(this.storage.getConfiguration().keyFilename).toBe("tests/keyFile.json");
  });

  it("[4]", () => {
    expect((): void => {
      const s = new Storage("gcs://tests/keyFile.json/");
    }).toThrowError("ENOTDIR: not a directory, open 'tests/keyFile.json/'");
  });

  it("[5]", () => {
    this.storage = new Storage("gcs://tests/keyFile.json");
    expect(this.storage.getType()).toBe(StorageType.GCS);
    expect(this.storage.getSelectedBucket()).toBe("");
    expect(this.storage.getConfiguration().projectId).toBe("appIdFromTestFile");
    expect(this.storage.getConfiguration().keyFilename).toBe("tests/keyFile.json");
  });
});

describe(`testing Amazon urls`, () => {
  it("[0] no options", () => {
    this.storage = new Storage("s3://key:secret/can/contain/slashes");
    expect(this.storage.getType()).toBe(StorageType.S3);
    expect(this.storage.getSelectedBucket()).toBe("");
    expect(this.storage.getConfiguration().accessKeyId).toBe("key");
    expect(this.storage.getConfiguration().secretAccessKey).toBe("secret/can/contain/slashes");
    expect(this.storage.getOptions().region).toBeUndefined();
  });

  it("[1] parameter string", () => {
    this.storage = new Storage(
      "s3://key:secret/can/contain/slashes?region=eu-west-2&bucketName=the-buck&sslEnabled=true"
    );
    expect(this.storage.getType()).toBe(StorageType.S3);
    expect(this.storage.getSelectedBucket()).toBe("the-buck");
    expect(this.storage.getConfiguration().accessKeyId).toBe("key");
    expect(this.storage.getConfiguration().secretAccessKey).toBe("secret/can/contain/slashes");
    expect(this.storage.getOptions().region).toBe("eu-west-2");
    expect(this.storage.getOptions().sslEnabled).toBe("true");
  });

  it("[2] typo", () => {
    this.storage = new Storage("s3://key:secret/can/contain/slashes?buckeName=the-buck");
    expect(this.storage.getType()).toBe(StorageType.S3);
    expect(this.storage.getSelectedBucket()).toBe(undefined);
    expect(this.storage.getConfiguration().accessKeyId).toBe("key");
    expect(this.storage.getConfiguration().secretAccessKey).toBe("secret/can/contain/slashes");
    expect(this.storage.getOptions().region).toBe(undefined);
  });

  it("[3] non-existent keys will not be filtered anymore", () => {
    this.storage = new Storage(
      [
        "s3://key:secret/can/contain/slashes",
        "?region=eu-west-2",
        "&bucketName=the-buck",
        "&sslEnabled=true",
        "&useDualstack=23",
        "&nonExistentKey=true",
        "&endPoint=https://kms-fips.us-west-2.amazonaws.com", // note: endpoint should not be camel cased
      ].join("")
    );
    expect(this.storage.getType()).toBe(StorageType.S3);
    expect(this.storage.getSelectedBucket()).toBe("the-buck");
    expect(this.storage.getConfiguration().accessKeyId).toBe("key");
    expect(this.storage.getOptions().secretAccessKey).toBe("secret/can/contain/slashes");
    expect(this.storage.getOptions().region).toBe("eu-west-2");
    expect(this.storage.getOptions().sslEnabled).toBe(true);
    expect(this.storage.getOptions().useDualStack).toBe(undefined);
    expect(this.storage.getOptions().nonExistentKey).toBe(true);
    expect(this.storage.getOptions().endpoint).toBe(undefined);
    expect(this.storage.getOptions().endPoint).toBe("https://kms-fips.us-west-2.amazonaws.com");
  });

  it("[4] object", () => {
    this.storage = new Storage({
      type: "s3",
      accessKeyId: "key",
      secretAccessKey: "secret/can/contain/slashes",
      bucketName: "the-buck",
      options: {
        region: "eu-west-2",
        sslEnabled: true,
      },
    });
    expect(this.storage.getType()).toBe(StorageType.S3);
    expect(this.storage.getSelectedBucket()).toBe("the-buck");
    expect(this.storage.getConfiguration().accessKeyId).toBe("key");
    expect(this.storage.getConfiguration().secretAccessKey).toBe("secret/can/contain/slashes");
    expect(this.storage.getConfiguration().options.region).toBe("eu-west-2");
    expect(this.storage.getConfiguration().options.sslEnabled).toBeTrue();
    expect(this.storage.getOptions().region).toBe("eu-west-2");
    expect(this.storage.getOptions().sslEnabled).toBeTrue();
  });

  it("[5] no bucket", () => {
    this.storage = new Storage({
      type: "s3",
      accessKeyId: "key",
      secretAccessKey: "secret/can/contain/slashes",
    });
    expect(this.storage.getSelectedBucket()).toBe(undefined);
  });
});

describe(`testing local urls`, () => {
  xit("[0]", () => {
    this.storage = new Storage("local://tests/tmp/the-buck");
    expect(this.storage.introspect("type")).toBe(StorageType.LOCAL);
    expect(this.storage.introspect("directory")).toBe("tests/tmp");
    expect(this.storage.introspect("bucketName")).toBe("the-buck");
  });

  xit("[1]", () => {
    this.storage = new Storage("local://tests/tmp");
    expect(this.storage.introspect("type")).toBe(StorageType.LOCAL);
    expect(this.storage.introspect("directory")).toBe("tests");
    expect(this.storage.introspect("bucketName")).toBe("tmp");
  });

  xit("[2] store in folder where process runs", () => {
    this.storage = new Storage(`local://${process.cwd()}/the-buck`);
    expect(this.storage.introspect("type")).toBe(StorageType.LOCAL);
    expect(this.storage.introspect("directory")).toBe(process.cwd());
    expect(this.storage.introspect("bucketName")).toBe("the-buck");
  });
});