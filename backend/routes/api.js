const express = require('express');
const feedController = require('../controllers/feedController');

const router = express.Router();

// Route to get a user's home feed
router.post('/feed', feedController.getUserFeed);

// Route to validate a token
router.post('/validate-token', feedController.validateToken);

module.exports = router;

// Add this route for testing API connectivity
router.get('/test-connection', (req, res) => {
  res.status(200).json({
    status: 'ok',
    message: 'API is working',
    timestamp: new Date().toISOString()
  });
});
