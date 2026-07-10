import { randomUUID } from 'node:crypto';
import { apiPaths, type AuthUser, type UploadedImage } from '@cnsofts/shared';
import { prisma } from '../../infra/prisma';
import { HttpError } from '../../shared/http/http-error';
import { getObject, putObject } from '../../infra/s3';

type ImageRow = {
  id: string;
  projectId: string;
  mimeType: string;
  size: number;
  uploadedBy: string;
  agentName: string | null;
  createdAt: Date;
};

function toUploadedImage(img: ImageRow): UploadedImage {
  return {
    id: img.id,
    projectId: img.projectId,
    url: apiPaths.images.serve(img.id),
    mimeType: img.mimeType,
    size: img.size,
    uploadedBy: img.uploadedBy,
    agentName: img.agentName,
    createdAt: img.createdAt.toISOString(),
  };
}

async function ensureProject(projectId: string): Promise<void> {
  if ((await prisma.project.count({ where: { id: projectId } })) === 0) {
    throw HttpError.notFound('Project not found');
  }
}

export const imagesService = {
  /** Store the bytes in object storage and record the metadata row. */
  async upload(
    projectId: string,
    user: AuthUser,
    agentName: string | null,
    body: Buffer,
    mimeType: string,
  ): Promise<UploadedImage> {
    await ensureProject(projectId);
    // The S3 key is a fresh random value, independent of the (unguessable) row
    // id used in the public URL.
    const key = `projects/${projectId}/${randomUUID()}`;
    await putObject(key, body, mimeType);
    const created = await prisma.image.create({
      data: {
        projectId,
        key,
        mimeType,
        size: body.length,
        uploadedBy: user.name,
        uploadedByEmail: user.email,
        agentName,
      },
    });
    return toUploadedImage(created);
  },

  /** Load an image's bytes for public serving; null if unknown/missing. */
  async serve(
    imageId: string,
  ): Promise<{ mimeType: string; body: Buffer } | null> {
    const image = await prisma.image.findUnique({ where: { id: imageId } });
    if (!image) return null;
    const body = await getObject(image.key);
    if (!body) return null;
    return { mimeType: image.mimeType, body };
  },
};
