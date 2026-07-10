import {
  S3Client,
  HeadBucketCommand,
  CreateBucketCommand,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
} from '@aws-sdk/client-s3';
import { env } from './env';

/**
 * S3-compatible object storage client (MinIO in dev, any S3 provider in prod).
 * `forcePathStyle` is required for MinIO (bucket in the path, not a subdomain).
 * This is the single S3 client for the app — never construct another.
 */
export const s3 = new S3Client({
  endpoint: env.S3_ENDPOINT,
  region: env.S3_REGION,
  forcePathStyle: true,
  credentials: {
    accessKeyId: env.S3_ACCESS_KEY,
    secretAccessKey: env.S3_SECRET_KEY,
  },
});

export const S3_BUCKET = env.S3_BUCKET;

/** Create the uploads bucket if it does not exist. Called once at startup. */
export async function ensureBucket(): Promise<void> {
  try {
    await s3.send(new HeadBucketCommand({ Bucket: S3_BUCKET }));
  } catch {
    // Missing (or not yet reachable) — try to create it.
    await s3.send(new CreateBucketCommand({ Bucket: S3_BUCKET }));
  }
}

/** Store an object's bytes. */
export async function putObject(
  key: string,
  body: Buffer,
  contentType: string,
): Promise<void> {
  await s3.send(
    new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType,
    }),
  );
}

/** Fetch an object's bytes (buffered). Returns null if it does not exist. */
export async function getObject(key: string): Promise<Buffer | null> {
  try {
    const res = await s3.send(
      new GetObjectCommand({ Bucket: S3_BUCKET, Key: key }),
    );
    if (!res.Body) return null;
    const bytes = await res.Body.transformToByteArray();
    return Buffer.from(bytes);
  } catch {
    return null;
  }
}

/** Best-effort delete of an object (ignores missing). */
export async function deleteObject(key: string): Promise<void> {
  try {
    await s3.send(new DeleteObjectCommand({ Bucket: S3_BUCKET, Key: key }));
  } catch {
    /* ignore */
  }
}

/** List every object in the bucket (key + size), following pagination. Used by
 *  the storage audit to reconcile stored bytes against the DB. */
export async function listObjects(): Promise<{ key: string; size: number }[]> {
  const out: { key: string; size: number }[] = [];
  let token: string | undefined;
  do {
    const res = await s3.send(
      new ListObjectsV2Command({
        Bucket: S3_BUCKET,
        ContinuationToken: token,
      }),
    );
    for (const obj of res.Contents ?? []) {
      if (obj.Key) out.push({ key: obj.Key, size: obj.Size ?? 0 });
    }
    token = res.IsTruncated ? res.NextContinuationToken : undefined;
  } while (token);
  return out;
}
