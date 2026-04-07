import { Router } from "express";
import { searchController } from "./search.controller.js";
import { createVerifyToken } from "../../middlewares/auth.js";
import {
  validateSearchQuery,
  validateRecentSearchQuery,
  validateRemoveRecentSearchParams,
} from "./search.validation.js";

const searchRouter = Router();

// Require user authentication for all search routes
searchRouter.use(createVerifyToken("user"));

/**
 * @swagger
 * /api/v1/search/recent:
 *   get:
 *     summary: Get recent search history
 *     description: Retrieve the recent searches performed by the authenticated user.
 *     tags: [Search]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: Number of recent searches to retrieve
 *     responses:
 *       200:
 *         description: Recent searches fetched successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       query:
 *                         type: string
 *                       timestamp:
 *                         type: string
 *                         format: date-time
 *       401:
 *         description: Unauthorized
 */
searchRouter.get(
  "/recent",
  validateRecentSearchQuery,
  searchController.getRecentSearches
);

/**
 * @swagger
 * /api/v1/search/recent/{id}:
 *   delete:
 *     summary: Remove a recent search
 *     description: Delete a specific item from the user's recent search history.
 *     tags: [Search]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: The UUID of the search history item to remove
 *     responses:
 *       200:
 *         description: Search history item removed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *       400:
 *         description: Invalid UUID
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Search history not found
 */
searchRouter.delete(
  "/recent/:id",
  validateRemoveRecentSearchParams,
  searchController.removeRecentSearch
);

/**
 * @swagger
 * /api/v1/search:
 *   get:
 *     summary: Perform a search
 *     description: Search across users, tags, or fetch personalized search results.
 *     tags: [Search]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: q
 *         schema:
 *           type: string
 *         description: The search query string
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [foryou, account, trending, tags]
 *           default: foryou
 *         description: The type of search to perform
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number for pagination
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: Number of results per page
 *     responses:
 *       200:
 *         description: Search results fetched successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *       400:
 *         description: Invalid query parameters
 *       401:
 *         description: Unauthorized
 */
searchRouter.get("/", validateSearchQuery, searchController.search);

export default searchRouter;
