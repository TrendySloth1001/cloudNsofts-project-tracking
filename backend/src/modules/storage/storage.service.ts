import {
  apiPaths,
  type StorageAuditReport,
  type StorageDanglingObject,
  type StorageOrphanImage,
} from '@cnsofts/shared';
import { prisma } from '../../infra/prisma';
import { deleteObject, listObjects } from '../../infra/s3';

/** Every place a stored image can be referenced as `![alt](/api/images/<id>)`:
 *  doc bodies, channel messages, task comments, and scheduled messages. An
 *  image absent from all of these has no owner and is safe to reclaim. */
async function referencedImageIds(): Promise<Set<string>> {
  const [docs, messages, events, scheduled] = await Promise.all([
    prisma.doc.findMany({ select: { body: true } }),
    prisma.message.findMany({ select: { body: true } }),
    prisma.taskEvent.findMany({ select: { body: true } }),
    prisma.scheduledMessage.findMany({ select: { body: true } }),
  ]);
  const ids = new Set<string>();
  const collect = (rows: { body: string }[]): void => {
    for (const { body } of rows) {
      for (const m of body.matchAll(/\/api\/images\/([a-z0-9]+)/g)) {
        ids.add(m[1]);
      }
    }
  };
  collect(docs);
  collect(messages);
  collect(events);
  collect(scheduled);
  return ids;
}

export const storageService = {
  /**
   * Cross-reference every stored image against the text that could embed it,
   * and every object in the bucket against the DB. Reports two orphan classes:
   * unreferenced image rows (a live blob no content points to) and dangling
   * objects (a blob with no `images` row at all). With `purge`, deletes both.
   */
  async audit(purge: boolean): Promise<StorageAuditReport> {
    const [images, objects, referenced] = await Promise.all([
      prisma.image.findMany({
        select: {
          id: true,
          projectId: true,
          key: true,
          mimeType: true,
          size: true,
          uploadedBy: true,
          agentName: true,
          createdAt: true,
          project: { select: { name: true } },
        },
        orderBy: { createdAt: 'asc' },
      }),
      listObjects(),
      referencedImageIds(),
    ]);

    const orphanRows = images.filter((img) => !referenced.has(img.id));
    const orphanImages: StorageOrphanImage[] = orphanRows.map((img) => ({
      id: img.id,
      projectId: img.projectId,
      projectName: img.project.name,
      url: apiPaths.images.serve(img.id),
      mimeType: img.mimeType,
      size: img.size,
      uploadedBy: img.uploadedBy,
      agentName: img.agentName,
      createdAt: img.createdAt.toISOString(),
    }));

    // Objects with no `images` row at all (e.g. an upload whose DB write failed).
    const liveKeys = new Set(images.map((img) => img.key));
    const danglingObjects: StorageDanglingObject[] = objects
      .filter((obj) => !liveKeys.has(obj.key))
      .map((obj) => ({ key: obj.key, size: obj.size }));

    let purged = 0;
    if (purge) {
      for (const img of orphanRows) {
        await deleteObject(img.key);
        await prisma.image.delete({ where: { id: img.id } });
        purged += 1;
      }
      for (const obj of danglingObjects) {
        await deleteObject(obj.key);
        purged += 1;
      }
    }

    const orphanBytes =
      orphanImages.reduce((sum, o) => sum + o.size, 0) +
      danglingObjects.reduce((sum, o) => sum + o.size, 0);

    return {
      scanned: { images: images.length, objects: objects.length },
      // After a purge these are gone; report an empty set so the UI reflects it.
      orphanImages: purge ? [] : orphanImages,
      danglingObjects: purge ? [] : danglingObjects,
      orphanCount: orphanImages.length + danglingObjects.length,
      orphanBytes,
      purged,
    };
  },
};
