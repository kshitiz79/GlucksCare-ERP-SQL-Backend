const compareVersions = (current, latest) => {
  if (current === latest) return 0;
  
  const currentParts = current.split('.').map(Number);
  const latestParts = latest.split('.').map(Number);
  
  for (let i = 0; i < Math.max(currentParts.length, latestParts.length); i++) {
    const curr = currentParts[i] || 0;
    const latest = latestParts[i] || 0;
    
    if (curr < latest) return -1;
    if (curr > latest) return 1;
  }
  
  return 0;
};

const determineUpdateType = (current, latest) => {
  const comparison = compareVersions(current, latest);
  
  if (comparison >= 0) return 'none';
  
  const currentParts = current.split('.').map(Number);
  const latestParts = latest.split('.').map(Number);
  
  // Major version difference (X.y.z)
  if (latestParts[0] > currentParts[0]) return 'critical';
  
  // Minor version difference (x.Y.z)
  if (latestParts[1] > currentParts[1]) return 'recommended';
  
  // Patch version difference (x.y.Z)
  if (latestParts[2] > currentParts[2]) return 'optional';
  
  return 'optional';
};

// Check app version (simplified - only current version needed)
const checkAppVersion = async (req, res) => {
  try {
    const { currentVersion, deviceInfo, buildNumber } = req.body;
    const userId = req.user.id;

    // Validate required fields
    if (!currentVersion) {
      return res.status(400).json({
        success: false,
        message: 'Current version is required'
      });
    }

    // Validate version format
    const versionRegex = /^\d+\.\d+\.\d+$/;
    if (!versionRegex.test(currentVersion)) {
      return res.status(400).json({
        success: false,
        message: 'Version format must be X.Y.Z (e.g., 1.2.3)'
      });
    }

    // Get the Version and AppVersionConfig models from app context
    const { Version, AppVersionConfig } = req.app.get('models');

    // Get the latest version from app_version_configs table
    const latestVersionConfig = await AppVersionConfig.findOne({
      order: [['created_at', 'DESC']]
    });

    const latestAppVersion = latestVersionConfig ? latestVersionConfig.latest_version : '1.0.0';

    // Find existing version record for this user or create new one
    let versionCheck = await Version.findOne({
      where: { user_id: userId }
    });

    if (versionCheck) {
      // Update existing record
      versionCheck.current_version = currentVersion;
      versionCheck.device_info = { ...versionCheck.device_info, ...deviceInfo };
      versionCheck.build_number = buildNumber;
      versionCheck.version_check_date = new Date();
      versionCheck.last_check_date = new Date();
      versionCheck.updated_by = userId;

      // Increment check count
      versionCheck.check_count = (versionCheck.check_count || 0) + 1;
    } else {
      // Create new record
      versionCheck = await Version.create({
        user_id: userId,
        current_version: currentVersion,
        play_store_version: latestAppVersion, // Use the latest version set by admin
        device_info: deviceInfo || {},
        build_number: buildNumber,
        created_by: userId,
        check_count: 1,
        last_check_date: new Date()
      });
    }

    // Set the latest version from admin
    versionCheck.play_store_version = latestAppVersion;
    
    // Compare versions to determine if update is required
    const comparison = compareVersions(currentVersion, latestAppVersion);
    versionCheck.update_required = comparison === -1;
    versionCheck.update_type = determineUpdateType(currentVersion, latestAppVersion);
    
    // Check if force update is required
    versionCheck.force_update = latestVersionConfig ? latestVersionConfig.force_update : false;

    await versionCheck.save();

    const response = {
      success: true,
      data: {
        versionCheckId: versionCheck.id,
        currentVersion: versionCheck.current_version,
        latestVersion: versionCheck.play_store_version,
        updateRequired: versionCheck.update_required,
        updateType: versionCheck.update_type,
        forceUpdate: versionCheck.force_update,
        versionComparison: comparison,
        checkCount: versionCheck.check_count,
        lastCheckDate: versionCheck.last_check_date
      },
      message: versionCheck.update_required ?
        `Update available: ${versionCheck.update_type}` :
        'App is up to date'
    };

    res.status(200).json(response);

  } catch (error) {
    console.error('Version check error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check app version',
      error: error.message
    });
  }
};

// Set latest app version (Admin only)
const setLatestAppVersion = async (req, res) => {
  try {
    const { latestVersion, releaseNotes, forceUpdate, minimumRequiredVersion } = req.body;
    const userId = req.user.id;

    // Validate required fields
    if (!latestVersion) {
      return res.status(400).json({
        success: false,
        message: 'Latest version is required'
      });
    }

    // Validate version format
    const versionRegex = /^\d+\.\d+\.\d+$/;
    if (!versionRegex.test(latestVersion)) {
      return res.status(400).json({
        success: false,
        message: 'Version format must be X.Y.Z (e.g., 1.2.3)'
      });
    }

    // Validate minimum required version if provided
    if (minimumRequiredVersion && !versionRegex.test(minimumRequiredVersion)) {
      return res.status(400).json({
        success: false,
        message: 'Minimum required version format must be X.Y.Z (e.g., 1.2.3)'
      });
    }

    // Get the AppVersionConfig model from app context
    const { AppVersionConfig } = req.app.get('models');

    // Create new version config
    const newVersionConfig = await AppVersionConfig.create({
      latest_version: latestVersion,
      release_notes: releaseNotes,
      force_update: forceUpdate || false,
      minimum_required_version: minimumRequiredVersion,
      created_by: userId,
      updated_by: userId
    });

    const response = {
      success: true,
      data: {
        id: newVersionConfig.id,
        latestVersion: newVersionConfig.latest_version,
        releaseNotes: newVersionConfig.release_notes,
        forceUpdate: newVersionConfig.force_update,
        minimumRequiredVersion: newVersionConfig.minimum_required_version,
        createdAt: newVersionConfig.created_at
      },
      message: 'Latest app version set successfully'
    };

    res.status(201).json(response);

  } catch (error) {
    console.error('Set latest version error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to set latest app version',
      error: error.message
    });
  }
};

// Get latest app version (Admin only)
const getLatestAppVersion = async (req, res) => {
  try {
    // Get the AppVersionConfig model from app context
    const { AppVersionConfig } = req.app.get('models');

    // Get the latest version config
    const latestVersionConfig = await AppVersionConfig.findOne({
      order: [['created_at', 'DESC']]
    });

    if (!latestVersionConfig) {
      return res.status(404).json({
        success: false,
        message: 'No version configuration found'
      });
    }

    const response = {
      success: true,
      data: {
        id: latestVersionConfig.id,
        latestVersion: latestVersionConfig.latest_version,
        releaseNotes: latestVersionConfig.release_notes,
        forceUpdate: latestVersionConfig.force_update,
        minimumRequiredVersion: latestVersionConfig.minimum_required_version,
        createdAt: latestVersionConfig.created_at,
        updatedAt: latestVersionConfig.updated_at
      },
      message: 'Latest app version retrieved successfully'
    };

    res.status(200).json(response);

  } catch (error) {
    console.error('Get latest version error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get latest app version',
      error: error.message
    });
  }
};

// Import Sequelize for database operations
const { Sequelize } = require('sequelize');

// Get all users with their latest version status (One record per user) - Admin only
const getAllVersionChecks = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      updateRequired,
      updateType,
      platform,
      search,
      startDate,
      endDate
    } = req.query;

    // Get the Version and User models from app context
    const { Version, User } = req.app.get('models');

    // Calculate offset for pagination
    const offset = (parseInt(page) - 1) * parseInt(limit);

    // Build where conditions
    let versionWhere = {};
    let userWhere = {};

    // Apply filters
    if (updateRequired !== undefined) {
      versionWhere.update_required = updateRequired === 'true';
    }

    if (updateType && updateType !== 'all') {
      versionWhere.update_type = updateType;
    }

    // For PostgreSQL JSONB fields, we need to use the correct syntax
    if (platform && platform !== 'all') {
      versionWhere.device_info = {
        ...versionWhere.device_info,
        platform: platform
      };
    }

    if (startDate || endDate) {
      versionWhere.version_check_date = {};
      if (startDate) versionWhere.version_check_date[Sequelize.Op.gte] = new Date(startDate);
      if (endDate) versionWhere.version_check_date[Sequelize.Op.lte] = new Date(endDate);
    }

    // Apply search filter
    if (search) {
      userWhere = {
        [Sequelize.Op.or]: [
          { name: { [Sequelize.Op.iLike]: `%${search}%` } },
          { email: { [Sequelize.Op.iLike]: `%${search}%` } },
          { employee_code: { [Sequelize.Op.iLike]: `%${search}%` } }
        ]
      };
    }

    // Get versions with user data
    const { count, rows: versions } = await Version.findAndCountAll({
      where: versionWhere,
      include: [{
        model: User,
        where: userWhere,
        attributes: ['id', 'name', 'email', 'employee_code', 'department_id', 'role'],
        required: Object.keys(userWhere).length > 0
      }],
      order: [['version_check_date', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    // Get statistics (simplified to avoid complex queries)
    const allVersions = await Version.findAll({
      include: [{
        model: User,
        required: false
      }]
    });

    const statistics = {
      totalUsers: allVersions.length,
      updateRequired: allVersions.filter(v => v.update_required).length,
      criticalUpdates: allVersions.filter(v => v.update_type === 'critical').length,
      recommendedUpdates: allVersions.filter(v => v.update_type === 'recommended').length,
      optionalUpdates: allVersions.filter(v => v.update_type === 'optional').length,
      upToDate: allVersions.filter(v => v.update_type === 'none').length
    };

    res.status(200).json({
      success: true,
      data: {
        versions: versions.map(version => ({
          _id: version.id,
          userId: version.User,
          user: version.User,
          currentVersion: version.current_version,
          playStoreVersion: version.play_store_version,
          updateRequired: version.update_required,
          updateType: version.update_type,
          forceUpdate: version.force_update,
          deviceInfo: version.device_info,
          buildNumber: version.build_number,
          checkCount: version.check_count,
          versionCheckDate: version.version_check_date,
          lastCheckDate: version.last_check_date,
          releaseNotes: version.release_notes,
          createdAt: version.created_at,
          updatedAt: version.updated_at
        })),
        statistics,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(count / parseInt(limit)),
          totalRecords: count,
          hasNext: page * parseInt(limit) < count,
          hasPrev: parseInt(page) > 1
        }
      }
    });

  } catch (error) {
    console.error('Get all version checks error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get version checks',
      error: error.message
    });
  }
};

module.exports = {
  checkAppVersion,
  setLatestAppVersion,
  getLatestAppVersion,
  getAllVersionChecks
};