import { Router } from 'express';
import { imagesController } from './images.controller';

// Public image serving — mounted at API_ROUTES.images with NO auth so markdown
// <img> tags (which can't send the bearer token) resolve. The id is an
// unguessable cuid; upload is auth-gated on the projects router.
export const imagesRoutes = Router();

imagesRoutes.get('/:imageId', imagesController.serve);
