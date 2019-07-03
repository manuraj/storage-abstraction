import fs from 'fs';
import os from 'os';
import path from 'path';
import rimraf from 'rimraf';
import dotenv from 'dotenv';
import { Storage } from '../src/Storage';
import to from 'await-to-js';
import 'jasmine';
import { IStorage, StorageConfig } from '../src/types';
dotenv.config();

const type = process.env['TYPE'];
if (!type) {
  process.exit(1);
}
// const type = Storage.TYPE_LOCAL;
// const type = Storage.TYPE_GOOGLE_CLOUD;
// const type = Storage.TYPE_AMAZON_S3;
let storage: IStorage;
let config: StorageConfig;
const localDir = path.join(os.homedir(), 'storage-abstraction');
const bucketName = process.env.STORAGE_BUCKETNAME;

if (type === Storage.TYPE_LOCAL) {
  config = {
    bucketName,
    // directory: process.env.STORAGE_LOCAL_DIRECTORY,
    directory: localDir,
  };
} else if (type === Storage.TYPE_GOOGLE_CLOUD) {
  config = {
    bucketName,
    projectId: process.env.STORAGE_GOOGLE_CLOUD_PROJECT_ID,
    keyFilename: process.env.STORAGE_GOOGLE_CLOUD_KEYFILE,
  };
} else if (type === Storage.TYPE_AMAZON_S3) {
  config = {
    bucketName,
    accessKeyId: process.env.STORAGE_AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.STORAGE_AWS_SECRET_ACCESS_KEY,
  };
}
storage = new Storage(config);

describe(`testing ${type} storage`, () => {

  beforeEach(() => {
    jasmine.DEFAULT_TIMEOUT_INTERVAL = 10000;
  });

  afterAll(async () => {
    // fs.promises.stat('tmp.jpg')
    //   .then(() => fs.promises.unlink('tmp.jpg'))
    //   .catch(e => {
    //     throw e;
    //   });
    if (type === Storage.TYPE_LOCAL) {
      await new Promise((resolve, reject) => {
        rimraf(localDir, (e: Error) => {
          if (e) {
            throw e;
          } else {
            resolve();
          }
        });
      });
    }
  });

  it('create bucket', async () => {
    await expectAsync(storage.createBucket()).toBeResolvedTo(true);
  });

  // if (type === Storage.TYPE_AMAZON_S3) {
  //   it('wait a bit', async () => {
  //     await new Promise((resolve) => {
  //       setTimeout(resolve, 1000);
  //     });
  //   });
  // }

  it('clear bucket', async () => {
    await expectAsync(storage.clearBucket()).toBeResolvedTo(true);
  });

  it('add file success', async () => {
    await expectAsync(storage.addFileFromPath('./tests/data/image1.jpg')).toBeResolvedTo({
      size: 100631,
      path: 'image1.jpg',
      origName: 'image1.jpg',
    });
  });

  it('add file error', async () => {
    await expectAsync(storage.addFileFromPath('./tests/data/non-existent.jpg')).toBeRejected();
  });

  it('add with new name and dir', async () => {
    // const [err, result] = await to(storage.addFileFromPath('./tests/data/image1.jpg', {
    //   dir: 'subdir',
    //   name: 'renamed.jpg',
    // }));

    await expectAsync(storage.addFileFromPath('./tests/data/image1.jpg', {
      dir: 'subdir',
      name: 'renamed.jpg',
    })).toBeResolvedTo({
      size: 100631,
      path: 'subdir/renamed.jpg',
      origName: 'image1.jpg',
    });
  });

  // necessary for Google and Amazon
  if (type !== Storage.TYPE_LOCAL) {
    it('wait a bit', async () => {
      await new Promise((resolve) => {
        setTimeout(resolve, 5000);
      });
    });
  }

  it('list files 1', async () => {
    const expectedResult: [string, number][] = [['image1.jpg', 100631], ['subdir/renamed.jpg', 100631]];
    await expectAsync(storage.listFiles()).toBeResolvedTo(expectedResult);
  });

  it('remove file success', async () => {
    // const [err, result] = await to(storage.removeFile('subdir/renamed.jpg'));
    // console.log(err, result);
    await expectAsync(storage.removeFile('subdir/renamed.jpg')).toBeResolvedTo(true);
  });

  it('remove file again', async () => {
    await expectAsync(storage.removeFile('subdir/renamed.jpg')).toBeResolvedTo(true);
  });

  it('list files 2', async () => {
    const expectedResult: [string, number][] = [['image1.jpg', 100631]];
    await expectAsync(storage.listFiles()).toBeResolvedTo(expectedResult);
  });

  it('get readable stream', async () => {
    await expectAsync(storage.getFileAsReadable('image1.jpg')).toBeResolved();
  });

  it('get readable stream error', async () => {
    await expectAsync(storage.getFileAsReadable('image2.jpg')).toBeRejected();
  });

  it('get readable stream and save file', async () => {
    try {
      const readStream = await storage.getFileAsReadable('image1.jpg');
      const filePath = path.join(localDir, 'test.jpg');
      const writeStream = fs.createWriteStream(filePath);
      readStream.pipe(writeStream);
      writeStream.on('error', (e: Error) => {
        console.log(e.message);
      });
      writeStream.on('finish', () => {
        console.log('FINISHED');
      });
    } catch (e) {
      console.log(e);
      throw e;
    }
  });
});

/*
describe('test all', () => {
  const bucketName = 'aap-en-beer';
  it('test local storage', async () => {
    const configLocal = {
      bucketName,
      directory: '/home/abudaan/Downloads'
    }
    const storage = new StorageLocal(configLocal);
    await executeTests(storage, 'local');
  })
})
*/

/*
describe('adding file', () => {
  it('ok', async () => {
    const [err, result] = await to(sl.addFileFromPath('./tests/data/image1.jpg'))
    console.log(result);
    expect(err).toBe(null);
  });

  it('error', async () => {
    const [err, result] = await to(sl.addFileFromPath('./tests/data/non-existent.jpg'))
    expect(err).toBeDefined();
    expect(result).toBe(undefined);
  });

  it('add with new name and dir', async () => {
    const [err, result] = await to(sl.addFileFromPath('./tests/data/image1.jpg', {
      dir: 'subdir',
      name: 'renamed.jpg',
    }))
    console.log(result);
    expect(err).toBe(null);
    expect(result.name).toBe('renamed.jpg');
    expect(result.path).toBe('subdir/renamed.jpg');
  })

  it('remove file', async () => {
    const [err, result] = await to(sl.removeFile('subdir/renamed.jpg'))
    console.log(err);
    expect(err).toBe(null);
    expect(result).toBe(true);
  })
});

*/

/*

const getFileAsReadable = (fileName: string) => {
  sl.getFileAsReadable(fileName)
    .then(readStream => {
      const filePath = path.join('/home/abudaan/Downloads/tmp/', fileName);
      const writeStream = fs.createWriteStream(filePath);
      readStream.pipe(writeStream);
      writeStream.on('error', (e: Error) => {
        console.log(e.message);
      })
      writeStream.on('finish', () => {
        console.log('FINISHED');
      })
    })
    .catch(e => { console.log(e) })
}
getFileAsReadable('generate_error/SH-3-44.mid');
// getFileAsReadable('IMG_9643.jpg');

*/
