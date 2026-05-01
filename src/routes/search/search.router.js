import { Router } from "express";
import { SessionMiddleware } from "../../middlewares/authentication.middleware.js";
import { globalLimiter } from "../../middlewares/rate-limiter/global.limiter.middleware.js";
import { SearchController } from "../../controllers/search/search.controller.js";

const searchRouter = Router();

//search?q=texto&type=votations|users&page=1&limit=10


searchRouter.get("/search",
globalLimiter,
new SessionMiddleware().run,
new SearchController().run
);

export { searchRouter };