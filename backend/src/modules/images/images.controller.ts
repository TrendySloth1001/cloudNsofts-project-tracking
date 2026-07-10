import { IMAGE_ALLOWED_MIME, IMAGE_MAX_BYTES } from '@cnsofts/shared';
import { asyncHandler } from '../../shared/http/async-handler';
import { HttpError } from '../../shared/http/http-error';
import { requireUser } from '../auth/access';
import { imagesService } from './images.service';

function allowedMime(value: string): boolean {
  return (IMAGE_ALLOWED_MIME as readonly string[]).includes(value);
}

export const imagesController = {
  // Raw-binary upload: the body IS the image bytes (parsed by express.raw on the
  // route); the Content-Type header carries the MIME type.
  upload: asyncHandler(async (req, res) => {
    const mimeType = (req.headers['content-type'] ?? '').split(';')[0].trim();
    if (!allowedMime(mimeType)) {
      throw HttpError.badRequest(
        `Unsupported image type. Allowed: ${IMAGE_ALLOWED_MIME.join(', ')}`,
      );
    }
    const body = req.body;
    if (!Buffer.isBuffer(body) || body.length === 0) {
      throw HttpError.badRequest('Request body must be the raw image bytes');
    }
    if (body.length > IMAGE_MAX_BYTES) {
      throw HttpError.badRequest('Image exceeds the 8 MB limit');
    }
    const image = await imagesService.upload(
      req.params.id,
      requireUser(req),
      req.agentName ?? null,
      body,
      mimeType,
    );
    res.status(201).json(image);
  }),

  // Public serve (unguessable id) so markdown <img> tags load without auth.
  serve: asyncHandler(async (req, res) => {
    const result = await imagesService.serve(req.params.imageId);
    if (!result) {
      res.status(404).end();
      return;
    }
    res.setHeader('Content-Type', result.mimeType);
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.send(result.body);
  }),
};
