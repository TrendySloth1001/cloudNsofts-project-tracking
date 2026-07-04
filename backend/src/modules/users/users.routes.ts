import { Router } from 'express';
import { usersController } from './users.controller';

export const usersRoutes = Router();

usersRoutes.get('/', usersController.list);
usersRoutes.post('/', usersController.create);
usersRoutes.get('/:id', usersController.getById);
usersRoutes.patch('/:id', usersController.update);
usersRoutes.delete('/:id', usersController.remove);
