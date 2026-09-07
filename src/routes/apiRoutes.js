// src/routes/apiRoutes.js
// Centralized router mounting all API endpoints for GlucksCare ERP

const express = require('express');
const router = express.Router();

// Core & Auth Routes
const authRoutes = require('../modules/auth/auth.routes');
const userRoutes = require('../user/userRoutes');
const masterRoutes = require('../user/masterRoutes');
const versionRoutes = require('../version/versionRoutes');

// Organization & Hierarchy
const headOfficeRoutes = require('../headoffice/headOfficeRoutes');
const stateRoutes = require('../state/stateRoutes');
const branchRoutes = require('../branch/branchRoutes');
const departmentRoutes = require('../department/departmentRoutes');
const designationRoutes = require('../designation/designationRoutes');
const employmentTypeRoutes = require('../employmentType/employmentTypeRoutes');
const userHeadOfficeRoutes = require('../userHeadOffice/userHeadOfficeRoutes');
const userManagerRoutes = require('../userManager/userManagerRoutes');
const userShiftRoutes = require('../userShift/userShiftRoutes');

// Doctor, Chemist, Stockist & Field Operations
const doctorRoutes = require('../doctor/doctorRoutes');
const chemistRoutes = require('../chemist/chemistRoutes');
const stockistRoutes = require('../stockist/stockistRoutes');
const doctorCoordinatesRoutes = require('../doctorCoordinates/doctorCoordinatesRoutes');
const doctorVisitRoutes = require('../doctorVisit/doctorVisitRoutes');
const chemistVisitRoutes = require('../chemistVisit/chemistVisitRoutes');
const stockistVisitRoutes = require('../stockistVisit/stockistVisitRoutes');
const doctorVisitHistoryRoutes = require('../doctorVisitHistory/doctorVisitHistoryRoutes');
const chemistAnnualTurnoverRoutes = require('../chemistAnnualTurnover/chemistAnnualTurnoverRoutes');
const stockistAnnualTurnoverRoutes = require('../stockistAnnualTurnover/stockistAnnualTurnoverRoutes');

// Products & Visits
const productRoutes = require('../product/productRoutes');
const productMasterRoutes = require('../productMaster/productMasterRoutes');
const visitProductPromotedRoutes = require('../visitProductPromoted/visitProductPromotedRoutes');
const visitProductAgreedRoutes = require('../visitProductAgreed/visitProductAgreedRoutes');
const visitProductNotAgreedRoutes = require('../visitProductNotAgreed/visitProductNotAgreedRoutes');

// Territory, Area & Tour Plans
const territoryRoutes = require('../territory/territoryRoutes');
const areaRoutes = require('../area/areaRoutes');
const beatRoutes = require('../beat/beatRoutes');
const tourPlanRoutes = require('../tourPlan/tourPlanRoutes');
const dcrRoutes = require('../dcr/dcrRoutes');
const dcrSettingsRoutes = require('../dcrSettings/dcrSettingsRoutes');

// Sales & Finance
const salesRoutes = require('../sale/salesRoutes');
const salesTargetRoutes = require('../salesTarget/salesTargetRoutes');
const investmentRequestRoutes = require('../investmentRequest/investmentRequestRoutes');
const invoiceTrackingRoutes = require('../invoiceTracking/invoiceTrackingRoutes');
const advanceRoutes = require('../advance/advanceRoutes');
const financialYearRoutes = require('../financialYear/financialYearRoutes');
const purchaseRoutes = require('../purchase/purchaseRoutes');
const challanRoutes = require('../challan/challanRoutes');
const inventoryRoutes = require('../inventory/inventoryRoutes');

// Expenses & Payroll
const expenseRoutes = require('../expencse/expenseRoutes');
const expenseSettingRoutes = require('../expenseSetting/expenseSettingRoutes');
const partyExpenseRoutes = require('../partyExpense/partyExpenseRoutes');
const payrollSettingRoutes = require('../payrollSetting/payrollSettingRoutes');

// Attendance & Leaves
const attendanceRoutes = require('../attendance/attendanceRoutes');
const leaveRoutes = require('../leave/leaveRoutes');
const leaveTypeRoutes = require('../leaveType/leaveTypeRoutes');
const shiftRoutes = require('../shift/shiftRoutes');
const holidayRoutes = require('../holiday/holidayRoutes');
const stopEventsRoutes = require('../stopEvents/stopEventsRoutes');

// Dashboards & Analytics
const dashboardRoutes = require('../dashboard/dashboardRoutes');
const webDashboardRoutes = require('../webDashboard/webDashboardRoutes');

// Device Tracking, MDM & Logs
const companyDeviceRoutes = require('../companyDevice/companyDeviceRoutes');
const userDeviceRoutes = require('../userDevice/userDeviceRoutes');
const offlineBgTrackingRoutes = require('../offlineBgTracking/OfflineBgRoute');
const userActivityLogRoutes = require('../userActivityLog/userActivityLogRoutes');

// Logistics, Dispatch & Shipping
const delhiveryRoutes = require('../delhivery/delhiveryRoutes');
const forwardingNoteRoutes = require('../forwardingNote/forwardingNoteRoutes');
const courierCompanyRoutes = require('../courierCompany/courierCompanyRoutes');
const addressRoutes = require('../Address/AddressRoute');
const partyRoutes = require('../party/PartyRoute');

// Communications & Settings
const whatsappRoutes = require('../whatsapp/whatsappRoutes');
const notificationRoutes = require('../notification/notificationRoutes');
const notificationRecipientRoutes = require('../notificationRecipient/notificationRecipientRoutes');
const ticketRoutes = require('../ticket/ticketRoutes');
const smtpSettingRoutes = require('../smtpSetting/smtpSettingRoutes');
const pdfRoutes = require('../pdf/pdfRoutes');
const mobImageRoutes = require('../mobimgupload/mobImageRoutes');

// --- Mount Routes onto router ---
router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/master', masterRoutes);
router.use('/version', versionRoutes);

router.use('/headoffices', headOfficeRoutes);
router.use('/states', stateRoutes);
router.use('/branches', branchRoutes);
router.use('/departments', departmentRoutes);
router.use('/designations', designationRoutes);
router.use('/employment-types', employmentTypeRoutes);
router.use('/user-head-offices', userHeadOfficeRoutes);
router.use('/user-managers', userManagerRoutes);
router.use('/user-shifts', userShiftRoutes);

router.use('/doctors', doctorRoutes);
router.use('/chemists', chemistRoutes);
router.use('/stockists', stockistRoutes);
router.use('/doctor-coordinates', doctorCoordinatesRoutes);
router.use('/doctor-visits', doctorVisitRoutes);
router.use('/chemist-visits', chemistVisitRoutes);
router.use('/stockist-visits', stockistVisitRoutes);
router.use('/doctor-visit-histories', doctorVisitHistoryRoutes);
router.use('/chemist-annual-turnovers', chemistAnnualTurnoverRoutes);
router.use('/stockist-annual-turnovers', stockistAnnualTurnoverRoutes);

router.use('/products', productRoutes);
router.use('/product-masters', productMasterRoutes);
router.use('/visit-products-promoted', visitProductPromotedRoutes);
router.use('/visit-products-agreed', visitProductAgreedRoutes);
router.use('/visit-products-not-agreed', visitProductNotAgreedRoutes);

router.use('/territory', territoryRoutes);
router.use('/areas', areaRoutes);
router.use('/beats', beatRoutes);
router.use('/tour-plans', tourPlanRoutes);
router.use('/tour-plan', tourPlanRoutes);
router.use('/dcr', dcrRoutes);
router.use('/dcr-settings', dcrSettingsRoutes);

router.use('/sales', salesRoutes);
router.use('/sales-targets', salesTargetRoutes);
router.use('/investment-requests', investmentRequestRoutes);
router.use('/invoice-tracking', invoiceTrackingRoutes);
router.use('/advances', advanceRoutes);
router.use('/financial-years', financialYearRoutes);
router.use('/purchases', purchaseRoutes);
router.use('/challans', challanRoutes);
router.use('/inventory', inventoryRoutes);

router.use('/expenses', expenseRoutes);
router.use('/expense-settings', expenseSettingRoutes);
router.use('/party-expenses', partyExpenseRoutes);
router.use('/payroll-settings', payrollSettingRoutes);

router.use('/attendance', attendanceRoutes);
router.use('/leaves', leaveRoutes);
router.use('/leave-types', leaveTypeRoutes);
router.use('/shifts', shiftRoutes);
router.use('/holidays', holidayRoutes);
router.use('/stop-events', stopEventsRoutes);

router.use('/dashboard', dashboardRoutes);
router.use('/web-dashboard', webDashboardRoutes);

router.use('/company-devices', companyDeviceRoutes);
router.use('/user-devices', userDeviceRoutes);
router.use('/offline-bg-tracking', offlineBgTrackingRoutes);
router.use('/user-activity-logs', userActivityLogRoutes);

router.use('/delhivery', delhiveryRoutes);
router.use('/forwarding-notes', forwardingNoteRoutes);
router.use('/courier-companies', courierCompanyRoutes);
router.use('/addresses', addressRoutes);
router.use('/parties', partyRoutes);

router.use('/whatsapp', whatsappRoutes);
router.use('/notifications', notificationRoutes);
router.use('/notification-recipients', notificationRecipientRoutes);
router.use('/tickets', ticketRoutes);
router.use('/smtp-settings', smtpSettingRoutes);
router.use('/pdfs', pdfRoutes);
router.use('/mobimages', mobImageRoutes);

module.exports = router;
