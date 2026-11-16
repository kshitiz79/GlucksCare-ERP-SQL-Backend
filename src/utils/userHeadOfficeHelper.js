// src/utils/userHeadOfficeHelper.js
const { Op } = require('sequelize');

/**
 * Recursively find all subordinate user IDs for a given manager/supervisor
 */
async function getSubordinateUserIds(userId, sequelize, visited = new Set()) {
  if (!userId || visited.has(userId)) return [];
  visited.add(userId);

  try {
    const directSubs = await sequelize.query(
      `SELECT DISTINCT user_id FROM user_managers WHERE manager_id = :userId`,
      {
        replacements: { userId },
        type: sequelize.QueryTypes.SELECT
      }
    );

    const subIds = (directSubs || [])
      .map(r => r.user_id)
      .filter(id => id && !visited.has(id));

    let allSubIds = [...subIds];

    for (const subId of subIds) {
      const deeper = await getSubordinateUserIds(subId, sequelize, visited);
      allSubIds = allSubIds.concat(deeper);
    }

    return Array.from(new Set(allSubIds));
  } catch (err) {
    console.warn('⚠️ [userHeadOfficeHelper] getSubordinateUserIds error:', err.message);
    return [];
  }
}

/**
 * Resolve all assigned head office IDs for a user, including:
 * 1. Direct head_office_id on user
 * 2. Directly mapped user_head_offices
 * 3. Head offices of all subordinate users assigned under this Manager / Area Manager / Zonal Manager / State Head
 * 4. State-wide head offices & users for State Head
 * 5. All head offices for Admin / Super Admin if none explicitly mapped
 */
async function resolveUserHeadOfficeIds(user, models, sequelize) {
  if (!user) return [];
  const officeIds = new Set();
  const userId = user.id;

  // 1. Direct head_office_id
  if (user.head_office_id) {
    officeIds.add(user.head_office_id);
  }

  // 2. Direct user_head_offices mapping
  if (models && models.UserHeadOffice) {
    const directMappings = await models.UserHeadOffice.findAll({
      where: { user_id: userId },
      attributes: ['head_office_id'],
      raw: true
    }).catch(() => []);
    directMappings.forEach(m => {
      if (m.head_office_id) officeIds.add(m.head_office_id);
    });
  }

  // 3. Subordinates in user_managers (for Managers, AMs, State Heads, Zonal Managers, etc.)
  if (sequelize && models && models.User) {
    const subUserIds = await getSubordinateUserIds(userId, sequelize);

    // If State Head has state_id, also find users and head offices in the same state
    if (user.role === 'State Head' && user.state_id) {
      const stateUsers = await sequelize.query(
        `SELECT id FROM users WHERE (state_id = :stateId OR state_id::text = :stateIdText) AND is_active = true`,
        {
          replacements: { stateId: user.state_id, stateIdText: String(user.state_id) },
          type: sequelize.QueryTypes.SELECT
        }
      ).catch(() => []);
      (stateUsers || []).forEach(u => subUserIds.push(u.id));

      const stateOffices = await sequelize.query(
        `SELECT id FROM head_offices WHERE (state_id = :stateId OR state_id::text = :stateIdText) AND is_active = true`,
        {
          replacements: { stateId: user.state_id, stateIdText: String(user.state_id) },
          type: sequelize.QueryTypes.SELECT
        }
      ).catch(() => []);
      (stateOffices || []).forEach(ho => {
        if (ho.id) officeIds.add(ho.id);
      });
    }

    const uniqueSubIds = Array.from(new Set(subUserIds)).filter(id => id !== userId);

    if (uniqueSubIds.length > 0) {
      // 3a. Subordinates' users.head_office_id
      const subUsers = await models.User.findAll({
        where: {
          id: { [Op.in]: uniqueSubIds },
          is_active: true
        },
        attributes: ['id', 'head_office_id'],
        raw: true
      }).catch(() => []);

      subUsers.forEach(su => {
        if (su.head_office_id) officeIds.add(su.head_office_id);
      });

      // 3b. Subordinates' user_head_offices
      if (models.UserHeadOffice) {
        const subMappings = await models.UserHeadOffice.findAll({
          where: { user_id: { [Op.in]: uniqueSubIds } },
          attributes: ['head_office_id'],
          raw: true
        }).catch(() => []);
        subMappings.forEach(m => {
          if (m.head_office_id) officeIds.add(m.head_office_id);
        });
      }
    }
  }

  // 4. Admin / Super Admin fallback (all active head offices if none specifically assigned)
  if (officeIds.size === 0 && models && models.HeadOffice && ['Super Admin', 'Admin', 'admin', 'super admin', 'superadmin'].includes(user.role)) {
    const allOffices = await models.HeadOffice.findAll({
      where: { is_active: true },
      attributes: ['id'],
      raw: true
    }).catch(() => []);
    allOffices.forEach(ho => officeIds.add(ho.id));
  }

  return Array.from(officeIds);
}

/**
 * Fetch full HeadOffice model records for the resolved IDs
 */
async function resolveUserHeadOffices(user, models, sequelize) {
  const ids = await resolveUserHeadOfficeIds(user, models, sequelize);
  if (!ids || ids.length === 0) return [];

  const { HeadOffice, State } = models;
  const include = [];
  if (State) {
    include.push({
      model: State,
      as: 'State',
      attributes: ['id', 'name', 'code']
    });
  }

  const offices = await HeadOffice.findAll({
    where: {
      id: { [Op.in]: ids },
      is_active: true
    },
    include,
    order: [['name', 'ASC']]
  }).catch(() => []);

  return offices.map(ho => {
    const hoJson = ho.toJSON ? ho.toJSON() : ho;
    return {
      _id: String(hoJson.id),
      id: String(hoJson.id),
      name: hoJson.name,
      code: hoJson.code,
      stateId: hoJson.state_id || hoJson.stateId,
      state_id: hoJson.state_id || hoJson.stateId,
      state: hoJson.State ? hoJson.State.name : undefined,
      pincode: hoJson.pincode,
      latitude: hoJson.latitude ? Number(hoJson.latitude) : 0,
      longitude: hoJson.longitude ? Number(hoJson.longitude) : 0,
      isActive: hoJson.is_active,
      is_active: hoJson.is_active,
      createdAt: hoJson.created_at,
      updatedAt: hoJson.updated_at
    };
  });
}

module.exports = {
  getSubordinateUserIds,
  resolveUserHeadOfficeIds,
  resolveUserHeadOffices
};

