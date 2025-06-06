const express = require('express');
const { body, query, param } = require('express-validator');
const { bettingService } = require('../services');
const { auth, validate } = require('../middleware');

const router = express.Router();

/**
 * @route GET /api/bets
 * @desc Get available bets
 * @access Public
 */
router.get(
  '/',
  validate([
    query('eventId')
      .optional()
      .isUUID()
      .withMessage('Invalid event ID'),
    query('sportId')
      .optional()
      .isUUID()
      .withMessage('Invalid sport ID'),
    query('betType')
      .optional()
      .isIn(['moneyline', 'spread', 'over_under', 'prop'])
      .withMessage('Invalid bet type'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Limit must be between 1 and 100'),
    query('offset')
      .optional()
      .isInt({ min: 0 })
      .withMessage('Offset must be a positive integer')
  ]),
  async (req, res, next) => {
    try {
      const { eventId, sportId, betType, limit, offset } = req.query;
      
      const filters = {
        eventId,
        sportId,
        betType
      };
      
      const options = {
        limit: limit ? parseInt(limit) : 20,
        offset: offset ? parseInt(offset) : 0
      };
      
      const bets = await bettingService.getAvailableBets(filters, options);
      res.json({
        success: true,
        data: bets
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route POST /api/bets
 * @desc Create a new bet
 * @access Private
 */
router.post(
  '/',
  auth.authenticate,
  auth.isVerified,
  validate([
    body('event_id')
      .isUUID()
      .withMessage('Invalid event ID'),
    body('bet_type')
      .isIn(['moneyline', 'spread', 'over_under', 'prop'])
      .withMessage('Invalid bet type'),
    body('bet_details')
      .notEmpty()
      .withMessage('Bet details are required'),
    body('odds')
      .isFloat({ min: 1.01 })
      .withMessage('Odds must be at least 1.01'),
    body('stake_amount')
      .isFloat({ min: 1 })
      .withMessage('Stake amount must be at least 1'),
    body('expiry_time')
      .optional()
      .isISO8601()
      .withMessage('Invalid expiry time format')
  ]),
  async (req, res, next) => {
    try {
      const bet = await bettingService.createBet(req.user.id, req.body);
      res.status(201).json({
        success: true,
        message: 'Bet created successfully',
        data: bet
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route GET /api/bets/:betId
 * @desc Get bet details
 * @access Public
 */
router.get(
  '/:betId',
  validate([
    param('betId')
      .isUUID()
      .withMessage('Invalid bet ID')
  ]),
  async (req, res, next) => {
    try {
      const { betId } = req.params;
      const bet = await Bet.findByPk(betId, {
        include: [
          {
            model: User,
            as: 'creator',
            attributes: ['id', 'username']
          },
          {
            model: Event,
            as: 'event'
          },
          {
            model: BetMatch,
            as: 'matches',
            include: [
              {
                model: User,
                as: 'taker',
                attributes: ['id', 'username']
              }
            ]
          }
        ]
      });
      
      if (!bet) {
        return res.status(404).json({
          success: false,
          message: 'Bet not found'
        });
      }
      
      res.json({
        success: true,
        data: bet
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route POST /api/bets/:betId/take
 * @desc Take (match) a bet
 * @access Private
 */
router.post(
  '/:betId/take',
  auth.authenticate,
  auth.isVerified,
  validate([
    param('betId')
      .isUUID()
      .withMessage('Invalid bet ID')
  ]),
  async (req, res, next) => {
    try {
      const { betId } = req.params;
      const result = await bettingService.takeBet(req.user.id, betId);
      res.json({
        success: true,
        message: 'Bet matched successfully',
        data: result
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route PUT /api/bets/:betId/cancel
 * @desc Cancel a bet
 * @access Private
 */
router.put(
  '/:betId/cancel',
  auth.authenticate,
  validate([
    param('betId')
      .isUUID()
      .withMessage('Invalid bet ID')
  ]),
  async (req, res, next) => {
    try {
      const { betId } = req.params;
      const bet = await bettingService.cancelBet(req.user.id, betId);
      res.json({
        success: true,
        message: 'Bet cancelled successfully',
        data: bet
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route GET /api/bets/history
 * @desc Get user's betting history
 * @access Private
 */
router.get(
  '/history',
  auth.authenticate,
  validate([
    query('status')
      .optional()
      .isIn(['open', 'matched', 'settled', 'cancelled', 'refunded'])
      .withMessage('Invalid status'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Limit must be between 1 and 100'),
    query('offset')
      .optional()
      .isInt({ min: 0 })
      .withMessage('Offset must be a positive integer')
  ]),
  async (req, res, next) => {
    try {
      const { status, limit, offset } = req.query;
      
      const options = {
        status,
        limit: limit ? parseInt(limit) : 20,
        offset: offset ? parseInt(offset) : 0
      };
      
      const bets = await bettingService.getUserBets(req.user.id, options);
      res.json({
        success: true,
        data: bets
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route GET /api/bets/matches
 * @desc Get user's bet matches (bets taken)
 * @access Private
 */
router.get(
  '/matches',
  auth.authenticate,
  validate([
    query('status')
      .optional()
      .isIn(['active', 'settled', 'cancelled', 'refunded'])
      .withMessage('Invalid status'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Limit must be between 1 and 100'),
    query('offset')
      .optional()
      .isInt({ min: 0 })
      .withMessage('Offset must be a positive integer')
  ]),
  async (req, res, next) => {
    try {
      const { status, limit, offset } = req.query;
      
      const options = {
        status,
        limit: limit ? parseInt(limit) : 20,
        offset: offset ? parseInt(offset) : 0
      };
      
      const betMatches = await bettingService.getUserBetMatches(req.user.id, options);
      res.json({
        success: true,
        data: betMatches
      });
    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;

