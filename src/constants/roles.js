// src/constants/roles.js

const ROLES = {
  SUPER_ADMIN: 'Super Admin',
  ADMIN: 'Admin',
  OPPS_TEAM: 'Opps Team',
  NATIONAL_HEAD: 'National Head',
  STATE_HEAD: 'State Head',
  ZONAL_MANAGER: 'Zonal Manager',
  AREA_MANAGER: 'Area Manager',
  MANAGER: 'Manager',
  USER: 'User',
  ACCOUNTS: 'Accounts',
  LOGISTICS: 'Logistics'
};

module.exports = {
  ROLES,
  validRoles: Object.values(ROLES)
};
