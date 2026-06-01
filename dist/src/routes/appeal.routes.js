"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const appeal_controller_1 = require("../controllers/appeal.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const role_middleware_1 = require("../middleware/role.middleware");
const router = (0, express_1.Router)();
// User routes
router.post('/', auth_middleware_1.authMiddleware, appeal_controller_1.appealController.submitAppeal);
// Admin routes
router.get('/admin', auth_middleware_1.authMiddleware, (0, role_middleware_1.roleMiddleware)(['ADMIN', 'SUPER_ADMIN']), appeal_controller_1.appealController.getAppeals);
router.get('/admin/:id', auth_middleware_1.authMiddleware, (0, role_middleware_1.roleMiddleware)(['ADMIN', 'SUPER_ADMIN']), appeal_controller_1.appealController.getAppealById);
router.patch('/admin/:id/resolve', auth_middleware_1.authMiddleware, (0, role_middleware_1.roleMiddleware)(['ADMIN', 'SUPER_ADMIN']), appeal_controller_1.appealController.resolveAppeal);
exports.default = router;
