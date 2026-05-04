"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const admin_controller_1 = require("../controllers/admin.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const role_middleware_1 = require("../middleware/role.middleware");
const router = (0, express_1.Router)();
// Voters Management
router.get('/voters', auth_middleware_1.authMiddleware, (0, role_middleware_1.roleMiddleware)(['ADMIN', 'SUPER_ADMIN']), admin_controller_1.adminController.getVoters);
router.get('/stats', auth_middleware_1.authMiddleware, (0, role_middleware_1.roleMiddleware)(['ADMIN', 'SUPER_ADMIN']), admin_controller_1.adminController.getDashboardStats);
router.patch('/voters/:id/status', auth_middleware_1.authMiddleware, (0, role_middleware_1.roleMiddleware)(['ADMIN', 'SUPER_ADMIN']), admin_controller_1.adminController.updateVoterStatus);
exports.default = router;
