// src/config/database.js

const { Sequelize } = require('sequelize');
const dotenv = require('dotenv');

dotenv.config();

// Create Sequelize instance
const sequelize = new Sequelize({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'gluckscare_erp_production',
    username: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
    dialect: 'postgres',
    logging: process.env.NODE_ENV === 'development' ? console.log : false,
    pool: {
        max: 10,
        min: 0,
        acquire: 30000,
        idle: 10000
    },
    dialectOptions: {
        // Enable SSL in production if needed
        ...(process.env.NODE_ENV === 'production' && {
            ssl: {
                require: true,
                rejectUnauthorized: false
            }
        })
    },
    define: {
        // Use snake_case for database columns but camelCase in JavaScript
        underscored: true,
        // Add timestamps by default
        timestamps: true,
        // Use createdAt and updatedAt instead of created_at and updated_at in JS
        createdAt: 'created_at',
        updatedAt: 'updated_at'
    }
});

// Import all model definitions
const { User, setupHooks } = require('../user/User');
const State = require('../state/State');
const HeadOffice = require('../headoffice/HeadOffice');
const Attendance = require('../attendance/Attendance');
const Leave = require('../leave/Leave');
const LeaveType = require('../leaveType/LeaveType');
const Shift = require('../shift/Shift');
const Doctor = require('../doctor/Doctor');

const Location = require('../location/Location');
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
const LocationHistory = require('../locationHistory/LocationHistory');
const LocationEvent = require('../locationEvent/LocationEvent');
const UserShift = require('../userShift/UserShift');
const Holiday = require('../holiday/Holiday');
const Expense = require('../expencse/Expense');
const ExpenseSetting = require('../expenseSetting/ExpenseSetting');
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
const Advance = require('../advance/Advance');
const AdvanceRepayment = require('../advance/AdvanceRepayment');
const MobImage = require('../mobimgupload/MobImage');

// Initialize models
const models = {
    User: User(sequelize),
    State: State(sequelize),
    HeadOffice: HeadOffice(sequelize),
    Attendance: Attendance(sequelize),
    Leave: Leave(sequelize),
    LeaveType: LeaveType(sequelize),
    Shift: Shift(sequelize),
    Doctor: Doctor(sequelize),

    Location: Location(sequelize),
    Branch: Branch(sequelize),
    Department: Department(sequelize),
    Designation: Designation(sequelize),
    EmploymentType: EmploymentType(sequelize),
    DoctorVisitHistory: DoctorVisitHistory(sequelize),
    Chemist: Chemist(sequelize),
    ChemistAnnualTurnover: ChemistAnnualTurnover(sequelize),
    Stockist: Stockist(sequelize),
    StockistAnnualTurnover: StockistAnnualTurnover(sequelize),
    Product: Product(sequelize),
    SalesTarget: SalesTarget(sequelize),

    StopEvents: StopEvents(sequelize),
    DoctorVisit: DoctorVisit(sequelize),
    ChemistVisit: ChemistVisit(sequelize),
    StockistVisit: StockistVisit(sequelize),
    Visit: Visit(sequelize),
    VisitProductPromoted: VisitProductPromoted(sequelize),
    VisitProductAgreed: VisitProductAgreed(sequelize),
    VisitProductNotAgreed: VisitProductNotAgreed(sequelize),
    LocationHistory: LocationHistory(sequelize),
    LocationEvent: LocationEvent(sequelize),
    UserShift: UserShift(sequelize),
    Holiday: Holiday(sequelize),
    Expense: Expense(sequelize),
    ExpenseSetting: ExpenseSetting(sequelize),
    PayrollSetting: PayrollSetting(sequelize),
    Notification: Notification(sequelize),
    NotificationRecipient: NotificationRecipient(sequelize),
    Ticket: Ticket(sequelize),
    UserHeadOffice: UserHeadOffice(sequelize),
    UserManager: UserManager(sequelize),
    Version: Version(sequelize),
    AppVersionConfig: AppVersionConfig(sequelize),
    PdfFile: PdfFile(sequelize),
    UserDevice: UserDevice(sequelize),
    InvoiceTracking: InvoiceTracking(sequelize),
    Advance: Advance(sequelize),
    AdvanceRepayment: AdvanceRepayment(sequelize),
    MobImage: MobImage(sequelize)
};

// Set up hooks
setupHooks(models.User);

// Call associate functions if they exist
Object.values(models).forEach(model => {
    if (model.associate) {
        model.associate(models);
    }
});

// Import associations and apply them
const applyAssociations = require('./associations');
applyAssociations(models);

module.exports = {
    sequelize,
    ...models
};