"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const admin_controller_1 = require("../controllers/admin.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const role_middleware_1 = require("../middleware/role.middleware");
const router = (0, express_1.Router)();
const adminOnly = [auth_middleware_1.authMiddleware, (0, role_middleware_1.roleMiddleware)(['ADMIN', 'SUPER_ADMIN'])];
// Dashboard
router.get('/stats', ...adminOnly, admin_controller_1.adminController.getDashboardStats);
// Voters Management
router.get('/voters', ...adminOnly, admin_controller_1.adminController.getVoters);
router.patch('/voters/:id/status', ...adminOnly, admin_controller_1.adminController.updateVoterStatus);
router.delete('/voters/:id', ...adminOnly, admin_controller_1.adminController.deleteVoter);
// Candidate Management
router.get('/candidates', ...adminOnly, admin_controller_1.adminController.getCandidates);
router.patch('/candidates/:id/status', ...adminOnly, admin_controller_1.adminController.updateCandidateStatus);
// Fraud Alerts
router.get('/fraud-alerts', ...adminOnly, admin_controller_1.adminController.getFraudAlerts);
router.patch('/fraud-alerts/:id/resolve', ...adminOnly, admin_controller_1.adminController.resolveFraudAlert);
exports.default = router;
