import { apiPaths, type UploadedImage } from '@cnsofts/shared';
import { apiClient } from '@/lib/api-client';

/** Upload an image (raw bytes) to a project; returns its metadata + serve URL. */
export const imagesApi = {
  upload: (projectId: string, file: File) =>
    apiClient.upload<UploadedImage>(
      apiPaths.projects.images(projectId),
      file,
      file.type,
    ),
};
