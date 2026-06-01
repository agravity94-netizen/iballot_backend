"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("../middleware/auth.middleware");
const voter_controller_1 = require("../controllers/voter.controller");
const router = (0, express_1.Router)();
router.get('/history', auth_middleware_1.authMiddleware, voter_controller_1.voterController.getHistory);
exports.default = router;
