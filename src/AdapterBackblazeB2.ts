import B2 from "backblaze-b2";
import { Readable } from "stream";
import { AbstractAdapter } from "./AbstractAdapter";
import { StorageType, ConfigBackblazeB2, BackblazeB2Bucket, BackblazeB2File } from "./types";
import { parseUrl } from "./util";

require("@gideo-llc/backblaze-b2-upload-any").install(B2);

export class AdapterBackblazeB2 extends AbstractAdapter {
  protected type = StorageType.B2;
  private bucketId: string;
  private storage: any; // create @types for this library
  private buckets: BackblazeB2Bucket[] = [];
  private files: BackblazeB2File[] = [];
  private nextFileName: string;

  constructor(config: string | ConfigBackblazeB2) {
    super();
    const cfg = this.parseConfig(config);
    this.config = { ...cfg };
    if (cfg.slug) {
      this.slug = cfg.slug;
      delete cfg.slug;
    }
    if (cfg.bucketName) {
      this.bucketName = this.generateSlug(cfg.bucketName, this.slug);
      delete cfg.bucketName;
    }
    delete cfg.type;
    this.storage = new B2(cfg);
  }

  private parseConfig(config: string | ConfigBackblazeB2): ConfigBackblazeB2 {
    let cfg: ConfigBackblazeB2;
    if (typeof config === "string") {
      const {
        type,
        part1: applicationKeyId,
        part2: applicationKey,
        bucketName,
        queryString,
      } = parseUrl(config);
      cfg = {
        type,
        applicationKeyId,
        applicationKey,
        bucketName,
        ...queryString,
      };
    } else {
      cfg = config;
    }
    if (!cfg.applicationKey || !cfg.applicationKeyId) {
      throw new Error(
        "You must specify a value for both 'applicationKeyId' and  'applicationKey' for storage type 'b2'"
      );
    }
    return cfg;
  }

  public async init(): Promise<boolean> {
    // console.log("init()", this.initialized, this.bucketName);
    if (this.initialized) {
      return Promise.resolve(true);
    }
    try {
      await this.storage.authorize();
    } catch (e) {
      throw new Error(e.message);
    }
    // check if the bucket already exists
    if (this.bucketName) {
      // create new bucket if it doesn't exist
      await this.createBucket(this.bucketName);
      this.bucketId = this.getBucketId();
    }
    this.initialized = true;
    return true;
  }

  private getBucketId(): string {
    // console.log(this.buckets);
    const index = this.buckets.findIndex(
      (b: BackblazeB2Bucket) => b.bucketName === this.bucketName
    );
    if (index !== -1) {
      return this.buckets[index].bucketId;
    }
  }

  async getFileAsReadable(
    name: string,
    options: { start?: number; end?: number } = { start: 0 }
  ): Promise<Readable> {
    const file = await this.findFile(name);
    if (file === null) {
      throw new Error("file not found");
    }
    const d = await this.storage.downloadFileById({
      fileId: file.fileId,
      responseType: "stream",
      axios: {
        headers: {
          "Content-Type": file.contentType,
          Range: `bytes=${options.start}-${options.end}`,
        },
      },
    });
    return d.data;
  }

  async removeFile(name: string): Promise<string> {
    if (!this.bucketName) {
      throw new Error("Please select a bucket first");
    }

    const n = this.generateSlug(name);

    const file = await this.findFile(n);
    if (file === null) {
      return `file ${name} not found`;
    }

    const {
      data: { files },
    } = await this.storage.listFileVersions({
      bucketId: this.bucketId,
    });

    Promise.all(
      files
        .filter((f: BackblazeB2File) => f.fileName === n)
        .map(({ fileId, fileName }) =>
          this.storage.deleteFileVersion({
            fileId,
            fileName,
          })
        )
    );
    this.files = this.files.filter(file => file.fileName !== name);
  }

  // util function for findBucket
  private findBucketLocal(name: string): BackblazeB2Bucket | null {
    if (this.buckets.length === 0) {
      return null;
    }
    const index = this.buckets.findIndex(b => b.bucketName === name);
    if (index !== -1) {
      return this.buckets[index];
    }
    return null;
  }

  // check if we have accessed and stored the bucket earlier
  private async findBucket(name: string): Promise<BackblazeB2Bucket | null> {
    const b = this.findBucketLocal(name);
    if (b !== null) {
      return b;
    }
    await this.listBuckets();
    return this.findBucketLocal(name);
  }

  public getSelectedBucket(): string | null {
    return this.bucketName;
  }

  // util members

  protected async store(buffer: Buffer, targetPath: string): Promise<void>;
  protected async store(stream: Readable, targetPath: string): Promise<void>;
  protected async store(origPath: string, targetPath: string): Promise<void>;
  protected async store(arg: string | Buffer | Readable, targetPath: string): Promise<void> {
    if (!this.bucketName) {
      throw new Error("Please select a bucket first");
    }
    await this.createBucket(this.bucketName);
    try {
      const file: BackblazeB2File = await this.storage.uploadAny({
        bucketId: this.bucketId,
        fileName: targetPath,
        data: arg,
      });
      this.files.push(file);
      return;
    } catch (e) {
      return Promise.reject();
    }
  }

  async createBucket(name: string): Promise<string> {
    const msg = this.validateName(name);
    if (msg !== null) {
      return Promise.reject(msg);
    }

    const n = this.generateSlug(name);

    const b = await this.findBucket(n);
    if (b !== null) {
      return;
    }

    const d = await this.storage
      .createBucket({
        bucketName: n,
        bucketType: "allPrivate", // should be a config option!
      })
      .catch(e => {
        throw new Error(e.response.data.message);
      });

    this.buckets.push(d.data);
    // console.log("createBucket", this.buckets, d.data);
    return "ok";
  }

  async selectBucket(name: string): Promise<string> {
    if (!name) {
      this.bucketName = "";
      return;
    }

    if (name === this.bucketName) {
      return;
    }

    const b = await this.findBucket(name);
    if (b !== null) {
      this.bucketName = name;
      this.bucketId = b.bucketId;
      this.files = [];
      return;
    }

    // return `bucket ${name} not found`;
    await this.createBucket(name);
    this.bucketName = name;
    this.bucketId = this.getBucketId();
    this.files = [];
  }

  async clearBucket(name?: string): Promise<string> {
    let n = name || this.bucketName;
    n = super.generateSlug(n);

    const b = await this.findBucket(n);
    if (b === null) {
      return `bucket "${name} not found"`;
    }

    const {
      data: { files },
    } = await this.storage.listFileVersions({
      bucketId: b.bucketId,
    });

    await Promise.all(
      files.map((file: BackblazeB2File) =>
        this.storage.deleteFileVersion({
          fileId: file.fileId,
          fileName: file.fileName,
        })
      )
    );

    return "ok";
  }

  async deleteBucket(name?: string): Promise<string> {
    let n = name || this.bucketName;
    n = super.generateSlug(n);

    const b = await this.findBucket(n);
    if (b === null) {
      return `bucket "${name}" not found`;
    }

    const { bucketId } = b;
    await this.storage.deleteBucket({ bucketId });
    this.buckets = this.buckets.filter(b => b.bucketName !== n);
    return "ok";
  }

  async listBuckets(): Promise<string[]> {
    const {
      data: { buckets },
    } = await this.storage.listBuckets();
    // this.bucketsById = buckets.reduce((acc: { [id: string]: string }, val: BackBlazeB2Bucket) => {
    //   acc[val.bucketId] = val.bucketName;
    //   return acc;
    // }, {});
    this.buckets = buckets;
    const names = this.buckets.map(b => b.bucketName);
    return names;
  }

  async listFiles(numFiles: number = 1000): Promise<[string, number][]> {
    // console.log("ID", this.bucketId);
    if (!this.bucketName) {
      throw new Error("Please select a bucket first");
    }

    const {
      data: { files, nextFileName },
    } = await this.storage.listFileNames({
      bucketId: this.bucketId,
      maxFileCount: numFiles,
    });

    this.files = [...files];
    this.nextFileName = nextFileName;
    return this.files.map(f => [f.fileName, f.contentLength]);
  }

  private async findFile(name: string): Promise<BackblazeB2File | null> {
    let i = this.files.findIndex((file: BackblazeB2File) => file.fileName === name);
    if (i > -1) {
      return this.files[i];
    }
    const {
      data: { files },
    } = await this.storage.listFileNames({ bucketId: this.bucketId });
    this.files = files;
    i = this.files.findIndex((file: BackblazeB2File) => file.fileName === name);
    if (i > -1) {
      return this.files[i];
    }
    return null;
  }

  async sizeOf(name: string): Promise<number> {
    if (!this.bucketName) {
      throw new Error("Please select a bucket first");
    }
    const file = await this.findFile(name);
    if (file === null) {
      throw new Error("File not found");
    }
    return file.contentLength;
  }

  async fileExists(name: string): Promise<boolean> {
    if (!this.bucketName) {
      throw new Error("Please select a bucket first");
    }
    const file = await this.findFile(name);
    if (file === null) {
      return false;
    }
    return true;
  }
}
