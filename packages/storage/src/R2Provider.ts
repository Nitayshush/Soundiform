/**
 * @file        R2Provider.ts
 * @description ⭐ מימוש StorageProvider עבור Cloudflare R2 (S3-compatible API). הספק הפעיל. ראה PROJECT.md §7.
 * @author      Shape-to-Sound
 * @created     2026-08-16
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 *
 * למה S3 SDK ולא R2 SDK ייעודי:
 * R2 חושף API תואם-S3 באופן רשמי — משתמשים ב-@aws-sdk/client-s3 כדי לא להוסיף תלות ייעודית
 * מיותרת, ולאפשר מעבר עתידי בקלות אם יידרש (§7 SupabaseProvider כגיבוי).
 */

import {
  DeleteObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  GetObjectCommand,
  S3Client,
  type S3ClientConfig,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { z } from 'zod';
import type {
  DownloadUrlOptions,
  ObjectMetadata,
  StorageProvider,
  UploadUrlOptions,
} from './StorageProvider';

const DEFAULT_URL_TTL_SECONDS = 900; // 15 דקות — §7

export interface R2ProviderConfig {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucketName: string;
}

export class R2Provider implements StorageProvider {
  readonly id = 'r2';

  private readonly client: S3Client;
  private readonly bucketName: string;

  constructor(config: R2ProviderConfig) {
    this.bucketName = config.bucketName;

    const clientConfig: S3ClientConfig = {
      region: 'auto',
      endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    };
    this.client = new S3Client(clientConfig);
  }

  async getUploadUrl(key: string, options?: UploadUrlOptions): Promise<string> {
    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: key,
      ContentType: options?.contentType,
    });
    return getSignedUrl(this.client, command, {
      expiresIn: options?.expiresInSeconds ?? DEFAULT_URL_TTL_SECONDS,
    });
  }

  async getDownloadUrl(key: string, options?: DownloadUrlOptions): Promise<string> {
    const command = new GetObjectCommand({ Bucket: this.bucketName, Key: key });
    return getSignedUrl(this.client, command, {
      expiresIn: options?.expiresInSeconds ?? DEFAULT_URL_TTL_SECONDS,
    });
  }

  async deleteObject(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucketName, Key: key }));
  }

  async headObject(key: string): Promise<ObjectMetadata | null> {
    try {
      const result = await this.client.send(
        new HeadObjectCommand({ Bucket: this.bucketName, Key: key }),
      );
      return {
        sizeBytes: result.ContentLength ?? 0,
        ...(result.ContentType !== undefined && { contentType: result.ContentType }),
      };
    } catch (error) {
      if (isNotFoundError(error)) {
        return null;
      }
      throw error;
    }
  }
}

const notFoundErrorSchema = z.object({ name: z.literal('NotFound') });

function isNotFoundError(error: unknown): boolean {
  return notFoundErrorSchema.safeParse(error).success;
}

const r2EnvSchema = z.object({
  R2_ACCOUNT_ID: z.string().min(1, 'R2_ACCOUNT_ID חסר ב-.env'),
  R2_ACCESS_KEY_ID: z.string().min(1, 'R2_ACCESS_KEY_ID חסר ב-.env'),
  R2_SECRET_ACCESS_KEY: z.string().min(1, 'R2_SECRET_ACCESS_KEY חסר ב-.env'),
  R2_BUCKET_NAME: z.string().min(1, 'R2_BUCKET_NAME חסר ב-.env'),
});

/**
 * בונה R2Provider מתוך משתני סביבה (§10). זורק שגיאה מפורשת אם חסר משתנה —
 * לעולם לא ליפול בשקט על credentials חסרים.
 */
export function createR2ProviderFromEnv(env: NodeJS.ProcessEnv = process.env): R2Provider {
  const parsed = r2EnvSchema.parse(env);
  return new R2Provider({
    accountId: parsed.R2_ACCOUNT_ID,
    accessKeyId: parsed.R2_ACCESS_KEY_ID,
    secretAccessKey: parsed.R2_SECRET_ACCESS_KEY,
    bucketName: parsed.R2_BUCKET_NAME,
  });
}
