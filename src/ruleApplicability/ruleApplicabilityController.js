// src/ruleApplicability/ruleApplicabilityController.js
const RuleApplicabilityService = require('./ruleApplicabilityService');

/**
 * GET /api/rule-applicability/options
 * Returns all dynamic field options for filter builder
 */
const getFieldOptions = async (req, res) => {
  try {
    const models = req.app.get('models');
    const options = await RuleApplicabilityService.getFieldOptions(models);
    res.json({
      success: true,
      data: options
    });
  } catch (error) {
    console.error('Error fetching rule applicability options:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch field options'
    });
  }
};

/**
 * POST /api/rule-applicability/preview
 * Computes live employee match count, breakdown, and list based on filter configuration
 */
const previewFilter = async (req, res) => {
  try {
    const models = req.app.get('models');
    const result = await RuleApplicabilityService.previewFilter(models, req.body);
    res.json(result);
  } catch (error) {
    console.error('Error calculating rule applicability preview:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to calculate filter preview'
    });
  }
};

/**
 * POST /api/rule-applicability/evaluate-user
 * Check if a specific user qualifies for given applicability config
 */
const evaluateUser = async (req, res) => {
  try {
    const models = req.app.get('models');
    const { userId, applicability } = req.body;
    if (!userId) {
      return res.status(400).json({ success: false, message: 'userId is required' });
    }
    const isApplicable = await RuleApplicabilityService.isUserApplicable(models, userId, applicability);
    res.json({
      success: true,
      userId,
      isApplicable
    });
  } catch (error) {
    console.error('Error evaluating user applicability:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to evaluate user'
    });
  }
};

module.exports = {
  getFieldOptions,
  previewFilter,
  evaluateUser
};

