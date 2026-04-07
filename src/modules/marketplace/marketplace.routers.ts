import express from 'express';
import { createMarketPlaceProduct } from './marketplace.controller.js';
import {marketPlaceValidation } from './marketplace.validation.js';
import { createVerifyToken } from '../../middlewares/auth.js';

const marketPlaceRouter = express.Router();


marketPlaceRouter.post('/',createVerifyToken('user') ,marketPlaceValidation,createMarketPlaceProduct );

export default marketPlaceRouter;