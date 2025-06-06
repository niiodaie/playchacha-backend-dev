/**
 * Sports Routes
 * 
 * This file defines all routes related to sports data.
 */

const express = require('express');
const router = express.Router();
const sportsController = require('../controllers/sportsController');
const { auth } = require('../middleware');

// Public routes
router.get('/sports', sportsController.getAllSports);
router.get('/sports/:sportId/events', sportsController.getSportEvents);
router.get('/events/:eventId', sportsController.getEventById);

// Admin routes - protected
router.post('/refresh/sports', auth.protect, auth.authorize('admin'), sportsController.refreshSportsData);
router.post('/refresh/events/:sportKey', auth.protect, auth.authorize('admin'), sportsController.refreshEventsData);

module.exports = router;

