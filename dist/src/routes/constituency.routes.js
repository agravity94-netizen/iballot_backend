"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const constituency_controller_1 = require("../controllers/constituency.controller");
const router = (0, express_1.Router)();
router.get('/', constituency_controller_1.constituencyController.getAll);
router.get('/locations', constituency_controller_1.constituencyController.getLocations);
exports.default = router;
