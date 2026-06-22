/**
 * S3/MinIO BlobStore — lokale oder S3-kompatible Object-Speicherung
 * Nutzt @aws-sdk/client-s3; forcePathStyle für MinIO
 * Key-Konvention: sources/<sourceRefId>/<contentHash>
 */

import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";

export interface BlobStore {
  /**
   * Speichert ein Blob unter dem gegebenen Key
   */
  putObject(key: string, body: Uint8Array, contentType?: string): Promise<void>;

  /**
   * Lädt ein Blob vom gegebenen Key
   */
  getObject(key: string): Promise<Uint8Array>;
}

export class S3BlobStore implements BlobStore {
  private client: S3Client;
  private bucket: string;

  constructor(endpoint?: string, bucket?: string, user?: string, password?: string) {
    const s3Endpoint = endpoint || process.env.S3_ENDPOINT || "http://localhost:9000";
    const s3Bucket = bucket || process.env.S3_BUCKET || "ua-lsa-dev";
    const minioUser = user || process.env.MINIO_ROOT_USER || "minioadmin";
    const minioPassword = password || process.env.MINIO_ROOT_PASSWORD || "change-me-locally";

    this.bucket = s3Bucket;
    this.client = new S3Client({
      endpoint: s3Endpoint,
      forcePathStyle: true,
      region: "us-east-1",
      credentials: {
        accessKeyId: minioUser,
        secretAccessKey: minioPassword,
      },
    });
  }

  /**
   * Speichert ein Blob
   * Konvention: sources/<sourceRefId>/<contentHash>
   */
  async putObject(key: string, body: Uint8Array, contentType = "application/octet-stream"): Promise<void> {
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
    });

    await this.client.send(command);
  }

  /**
   * Lädt ein Blob
   */
  async getObject(key: string): Promise<Uint8Array> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });

    const response = await this.client.send(command);

    if (!response.Body) {
      throw new Error(`No body in response for key: ${key}`);
    }

    // Konvertiere ReadableStream zu Uint8Array
    const chunks: Uint8Array[] = [];
    const reader = response.Body as AsyncIterable<Uint8Array>;

    for await (const chunk of reader) {
      chunks.push(chunk);
    }

    return new Uint8Array(Buffer.concat(chunks));
  }
}

/**
 * FakeBlob Store — In-Memory für Tests
 */
export class FakeBlobStore implements BlobStore {
  private store: Map<string, Uint8Array> = new Map();

  async putObject(key: string, body: Uint8Array, _contentType?: string): Promise<void> {
    this.store.set(key, new Uint8Array(body));
  }

  async getObject(key: string): Promise<Uint8Array> {
    const data = this.store.get(key);
    if (!data) {
      throw new Error(`Blob not found: ${key}`);
    }
    return new Uint8Array(data);
  }
}
