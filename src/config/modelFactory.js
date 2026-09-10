// src/config/modelFactory.js
// Dynamic Model Factory for Multi-Tenant Database-per-Company architecture

const { User, setupHooks } = require('../user/User');
const State = require('../state/State');
const HeadOffice = require('../headoffice/HeadOffice');
const Attendance = require('../attendance/Attendance');
const Leave = require('../leave/Leave');
const LeaveType = require('../leaveType/LeaveType');
const Shift = require('../shift/Shift');
const Doctor = require('../doctor/Doctor');
const DoctorChangeLog = require('../doctor/DoctorChangeLog');
const InvestmentRequest = require('../investmentRequest/InvestmentRequest');
const Sale = require('../sale/Sale');

const Branch = require('../branch/Branch');
const Department = require('../department/Department');
const Designation = require('../designation/Designation');
const EmploymentType = require('../employmentType/EmploymentType');
const DoctorVisitHistory = require('../doctorVisitHistory/DoctorVisitHistory');
const Chemist = require('../chemist/Chemist');
const ChemistAnnualTurnover = require('../chemistAnnualTurnover/ChemistAnnualTurnover');
const Stockist = require('../stockist/Stockist');
const StockistAnnualTurnover = require('../stockistAnnualTurnover/StockistAnnualTurnover');
const Product = require('../product/Product');
const SalesTarget = require('../salesTarget/SalesTarget');

const StopEvents = require('../stopEvents/StopEvents');
const DoctorVisit = require('../doctorVisit/DoctorVisit');
const ChemistVisit = require('../chemistVisit/ChemistVisit');
const StockistVisit = require('../stockistVisit/StockistVisit');
const Visit = require('../visit/Visit');
const VisitProductPromoted = require('../visitProductPromoted/VisitProductPromoted');
const VisitProductAgreed = require('../visitProductAgreed/VisitProductAgreed');
const VisitProductNotAgreed = require('../visitProductNotAgreed/VisitProductNotAgreed');

const UserShift = require('../userShift/UserShift');
const Holiday = require('../holiday/Holiday');
const Expense = require('../expencse/Expense');
const ExpenseSetting = require('../expenseSetting/ExpenseSetting');
const SmtpSetting = require('../smtpSetting/SmtpSetting');
const CompanySetting = require('../companySetting/CompanySetting');
const PayrollSetting = require('../payrollSetting/PayrollSetting');
const Notification = require('../notification/Notification');
const NotificationRecipient = require('../notificationRecipient/NotificationRecipient');
const Ticket = require('../ticket/Ticket');
const UserHeadOffice = require('../userHeadOffice/UserHeadOffice');
const UserManager = require('../userManager/UserManager');
const Version = require('../version/Version');
const AppVersionConfig = require('../version/AppVersionConfig');
const PdfFile = require('../pdf/PdfFile');
const UserDevice = require('../userDevice/UserDevice');
const InvoiceTracking = require('../invoiceTracking/InvoiceTracking');
const ForwardingNote = require('../forwardingNote/forwardingNote');
const Advance = require('../advance/Advance');
const AdvanceRepayment = require('../advance/AdvanceRepayment');
const MobImage = require('../mobimgupload/MobImage');
const Purchase = require('../purchase/Purchase');
const PurchaseItem = require('../purchase/PurchaseItem');
const Challan = require('../challan/Challan');
const ChallanItem = require('../challan/ChallanItem');

const Address = require('../Address/Address');
const CourierCompany = require('../courierCompany/CourierCompany');
const PartyExpense = require('../partyExpense/PartyExpense');
const { Salt, Unit, StripSize, Hsn, Gst, PackSize } = require('../productMaster/ProductMasters');
const InventoryItem = require('../inventory/InventoryItem');
const UserInventory = require('../inventory/UserInventory');
const Area = require('../area/Area');
const Beat = require('../beat/Beat');
const BeatArea = require('../beat/BeatArea');
const TourPlan = require('../tourPlan/TourPlan');
const TourPlanDay = require('../tourPlan/TourPlanDay');
const FinancialYear = require('../financialYear/FinancialYear');
const OfflineBgTracking = require('../offlineBgTracking/OfflineBgTracking');
const LocationPing = require('../offlineBgTracking/LocationPing');
const UserActivityLog = require('../userActivityLog/UserActivityLog');
const CompanyDevice = require('../companyDevice/CompanyDevice');
const DeviceAssignmentHistory = require('../companyDevice/DeviceAssignmentHistory');

const applyAssociations = require('./associations');

function initTenantModels(targetSequelize) {
  const models = {
    User: User(targetSequelize),
    State: State(targetSequelize),
    HeadOffice: HeadOffice(targetSequelize),
    Attendance: Attendance(targetSequelize),
    Leave: Leave(targetSequelize),
    LeaveType: LeaveType(targetSequelize),
    Shift: Shift(targetSequelize),
    Doctor: Doctor(targetSequelize),
    DoctorChangeLog: DoctorChangeLog(targetSequelize),
    InvestmentRequest: InvestmentRequest(targetSequelize),
    Sale: Sale(targetSequelize),

    Branch: Branch(targetSequelize),
    Department: Department(targetSequelize),
    Designation: Designation(targetSequelize),
    EmploymentType: EmploymentType(targetSequelize),
    DoctorVisitHistory: DoctorVisitHistory(targetSequelize),
    Chemist: Chemist(targetSequelize),
    ChemistAnnualTurnover: ChemistAnnualTurnover(targetSequelize),
    Stockist: Stockist(targetSequelize),
    StockistAnnualTurnover: StockistAnnualTurnover(targetSequelize),
    Product: Product(targetSequelize),
    SalesTarget: SalesTarget(targetSequelize),

    StopEvents: StopEvents(targetSequelize),
    DoctorVisit: DoctorVisit(targetSequelize),
    ChemistVisit: ChemistVisit(targetSequelize),
    StockistVisit: StockistVisit(targetSequelize),
    Visit: Visit(targetSequelize),
    VisitProductPromoted: VisitProductPromoted(targetSequelize),
    VisitProductAgreed: VisitProductAgreed(targetSequelize),
    VisitProductNotAgreed: VisitProductNotAgreed(targetSequelize),

    UserShift: UserShift(targetSequelize),
    Holiday: Holiday(targetSequelize),
    Expense: Expense(targetSequelize),
    ExpenseSetting: ExpenseSetting(targetSequelize),
    SmtpSetting: SmtpSetting(targetSequelize),
    CompanySetting: CompanySetting(targetSequelize),
    PayrollSetting: PayrollSetting(targetSequelize),
    Notification: Notification(targetSequelize),
    NotificationRecipient: NotificationRecipient(targetSequelize),
    Ticket: Ticket(targetSequelize),
    UserHeadOffice: UserHeadOffice(targetSequelize),
    UserManager: UserManager(targetSequelize),
    Version: Version(targetSequelize),
    AppVersionConfig: AppVersionConfig(targetSequelize),
    PdfFile: PdfFile(targetSequelize),
    UserDevice: UserDevice(targetSequelize),
    InvoiceTracking: InvoiceTracking(targetSequelize),
    ForwardingNote: ForwardingNote(targetSequelize),
    Advance: Advance(targetSequelize),
    AdvanceRepayment: AdvanceRepayment(targetSequelize),
    MobImage: MobImage(targetSequelize),

    Address: Address(targetSequelize),
    CourierCompany: CourierCompany(targetSequelize),
    PartyExpense: PartyExpense(targetSequelize),
    Salt: Salt(targetSequelize),
    Unit: Unit(targetSequelize),
    StripSize: StripSize(targetSequelize),
    Hsn: Hsn(targetSequelize),
    Gst: Gst(targetSequelize),
    PackSize: PackSize(targetSequelize),
    InventoryItem: InventoryItem(targetSequelize),
    UserInventory: UserInventory(targetSequelize),
    Purchase: Purchase(targetSequelize),
    PurchaseItem: PurchaseItem(targetSequelize),
    Challan: Challan(targetSequelize),
    ChallanItem: ChallanItem(targetSequelize),
    Area: Area(targetSequelize),
    Beat: Beat(targetSequelize),
    BeatArea: BeatArea(targetSequelize),
    TourPlan: TourPlan(targetSequelize),
    TourPlanDay: TourPlanDay(targetSequelize),
    FinancialYear: FinancialYear(targetSequelize),
    OfflineBgTracking: OfflineBgTracking(targetSequelize),
    LocationPing: LocationPing(targetSequelize),
    UserActivityLog: UserActivityLog(targetSequelize),
    CompanyDevice: CompanyDevice(targetSequelize),
    DeviceAssignmentHistory: DeviceAssignmentHistory(targetSequelize)
  };

  // Set up hooks
  setupHooks(models.User);

  // Call associate functions if they exist
  Object.values(models).forEach(model => {
    if (model.associate) {
      model.associate(models);
    }
  });

  // Apply relations
  applyAssociations(models);

  return models;
}

module.exports = {
  initTenantModels
};
