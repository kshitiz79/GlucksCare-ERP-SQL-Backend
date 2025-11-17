// associations.js
// Define associations between models

module.exports = (db) => {
  // User associations
  db.User.belongsTo(db.HeadOffice, { foreignKey: 'head_office_id' });
  db.User.belongsTo(db.State, { foreignKey: 'state_id' });
  db.User.belongsTo(db.Branch, { foreignKey: 'branch_id' });
  db.User.belongsTo(db.Department, { foreignKey: 'department_id' });
  db.User.belongsTo(db.Designation, { foreignKey: 'designation_id', as: 'designation' });
  db.User.belongsTo(db.EmploymentType, { foreignKey: 'employment_type_id' });
  db.User.hasMany(db.DoctorVisitHistory, { foreignKey: 'sales_rep_id' });

  db.User.hasMany(db.SalesTarget, { foreignKey: 'user_id' });

  db.User.hasMany(db.DoctorVisit, { foreignKey: 'user_id' });
  db.User.hasMany(db.ChemistVisit, { foreignKey: 'user_id' });
  db.User.hasMany(db.StockistVisit, { foreignKey: 'user_id' });
  db.User.hasMany(db.Visit, { foreignKey: 'representative_id' });
  db.User.hasMany(db.Location, { foreignKey: 'user_id' });
  db.User.hasMany(db.LocationHistory, { foreignKey: 'user_id' });
  db.User.hasMany(db.LocationEvent, { foreignKey: 'user_id' });
  db.User.hasMany(db.Attendance, { foreignKey: 'user_id' });
  db.User.hasMany(db.Leave, { foreignKey: 'employee_id' });
  db.User.hasMany(db.Expense, { foreignKey: 'user_id' });
  db.User.hasMany(db.Notification, { foreignKey: 'sender_id' });
  db.User.hasMany(db.Ticket, { foreignKey: 'user_id' });
  db.User.hasMany(db.Holiday, { foreignKey: 'created_by', as: 'createdHolidays' });
  db.User.hasMany(db.Holiday, { foreignKey: 'updated_by', as: 'updatedHolidays' });
  db.User.hasMany(db.Version, { foreignKey: 'user_id' });
  db.User.hasMany(db.AppVersionConfig, { foreignKey: 'created_by', as: 'createdAppVersionConfigs' });
  db.User.hasMany(db.AppVersionConfig, { foreignKey: 'updated_by', as: 'updatedAppVersionConfigs' });
  db.User.hasMany(db.UserHeadOffice, { foreignKey: 'user_id' });
  db.User.hasMany(db.UserManager, { foreignKey: 'user_id' });
  db.User.hasMany(db.UserManager, { foreignKey: 'manager_id' });
  db.User.hasMany(db.UserShift, { foreignKey: 'user_id' });
  db.User.hasMany(db.PdfFile, { foreignKey: 'uploaded_by', as: 'uploadedFiles' });
  db.User.hasMany(db.UserDevice, { foreignKey: 'user_id' });

  // Many-to-many relationship with HeadOffice
  db.User.belongsToMany(db.HeadOffice, {
    through: db.UserHeadOffice,
    foreignKey: 'user_id',
    otherKey: 'head_office_id',
    as: 'headOffices'
  });

  // HeadOffice associations
  db.HeadOffice.hasMany(db.User, { foreignKey: 'head_office_id' });
  db.HeadOffice.hasMany(db.Doctor, { foreignKey: 'headOfficeId' });
  db.HeadOffice.hasMany(db.Chemist, { foreignKey: 'head_office_id', as: 'Chemists' });
  db.HeadOffice.hasMany(db.Stockist, { foreignKey: 'head_office_id', as: 'Stockists' });
  db.HeadOffice.belongsTo(db.State, { foreignKey: 'stateId' });

  // Many-to-many relationship with User
  db.HeadOffice.belongsToMany(db.User, {
    through: db.UserHeadOffice,
    foreignKey: 'head_office_id',
    otherKey: 'user_id',
    as: 'users'
  });

  // State associations
  db.State.hasMany(db.HeadOffice, { foreignKey: 'stateId' });
  db.State.hasMany(db.User, { foreignKey: 'state_id' });

  // Branch associations
  db.Branch.hasMany(db.User, { foreignKey: 'branch_id' });

  // Department associations
  db.Department.hasMany(db.User, { foreignKey: 'department_id' });

  // Designation associations
  db.Designation.hasMany(db.User, { foreignKey: 'designation_id' });

  // EmploymentType associations
  db.EmploymentType.hasMany(db.User, { foreignKey: 'employment_type_id' });

  // Doctor associations
  db.Doctor.belongsTo(db.HeadOffice, { foreignKey: 'headOfficeId', as: 'HeadOffice' });
  db.Doctor.hasMany(db.DoctorVisitHistory, { foreignKey: 'doctor_id' });
  db.Doctor.hasMany(db.DoctorVisit, { foreignKey: 'doctor_id' });

  // DoctorVisitHistory associations
  db.DoctorVisitHistory.belongsTo(db.Doctor, { foreignKey: 'doctor_id' });
  db.DoctorVisitHistory.belongsTo(db.User, { foreignKey: 'sales_rep_id' });

  // Chemist associations
  db.Chemist.belongsTo(db.HeadOffice, { foreignKey: 'head_office_id', as: 'HeadOffice' });
  db.Chemist.hasMany(db.ChemistAnnualTurnover, { foreignKey: 'chemist_id', as: 'AnnualTurnovers' });
  db.Chemist.hasMany(db.ChemistVisit, { foreignKey: 'chemist_id' });

  // ChemistAnnualTurnover associations
  db.ChemistAnnualTurnover.belongsTo(db.Chemist, { foreignKey: 'chemist_id', as: 'Chemist' });

  // Stockist associations
  db.Stockist.belongsTo(db.HeadOffice, { foreignKey: 'head_office_id', as: 'HeadOffice' });
  db.Stockist.hasMany(db.StockistAnnualTurnover, { foreignKey: 'stockist_id', as: 'AnnualTurnovers' });
  db.Stockist.hasMany(db.StockistVisit, { foreignKey: 'stockist_id' });

  // StockistAnnualTurnover associations
  db.StockistAnnualTurnover.belongsTo(db.Stockist, { foreignKey: 'stockist_id', as: 'Stockist' });

  // Product associations


  db.Product.hasMany(db.DoctorVisit, { foreignKey: 'product_id' });
  db.Product.hasMany(db.VisitProductPromoted, { foreignKey: 'product_id' });
  db.Product.hasMany(db.VisitProductAgreed, { foreignKey: 'product_id' });
  db.Product.hasMany(db.VisitProductNotAgreed, { foreignKey: 'product_id' });



  // SalesTarget associations
  db.SalesTarget.belongsTo(db.User, { foreignKey: 'user_id', as: 'salesTargetUser' });
  db.SalesTarget.belongsTo(db.User, { foreignKey: 'created_by', as: 'salesTargetCreator' });
  db.SalesTarget.belongsTo(db.User, { foreignKey: 'updated_by', as: 'salesTargetUpdater' });


  // DoctorVisit associations
  db.DoctorVisit.belongsTo(db.Doctor, { foreignKey: 'doctor_id' });
  db.DoctorVisit.belongsTo(db.User, { foreignKey: 'user_id' });
  db.DoctorVisit.belongsTo(db.Product, { foreignKey: 'product_id' });

  // ChemistVisit associations
  db.ChemistVisit.belongsTo(db.Chemist, { foreignKey: 'chemist_id' });
  db.ChemistVisit.belongsTo(db.User, { foreignKey: 'user_id' });

  // StockistVisit associations
  db.StockistVisit.belongsTo(db.Stockist, { foreignKey: 'stockist_id' });
  db.StockistVisit.belongsTo(db.User, { foreignKey: 'user_id' });

  // Visit associations
  db.Visit.belongsTo(db.User, { foreignKey: 'representative_id' });
  db.Visit.hasMany(db.VisitProductPromoted, { foreignKey: 'visit_id' });
  db.Visit.hasMany(db.VisitProductAgreed, { foreignKey: 'visit_id' });
  db.Visit.hasMany(db.VisitProductNotAgreed, { foreignKey: 'visit_id' });

  // VisitProductPromoted associations
  db.VisitProductPromoted.belongsTo(db.Visit, { foreignKey: 'visit_id' });
  db.VisitProductPromoted.belongsTo(db.Product, { foreignKey: 'product_id' });

  // VisitProductAgreed associations
  db.VisitProductAgreed.belongsTo(db.Visit, { foreignKey: 'visit_id' });
  db.VisitProductAgreed.belongsTo(db.Product, { foreignKey: 'product_id' });

  // VisitProductNotAgreed associations
  db.VisitProductNotAgreed.belongsTo(db.Visit, { foreignKey: 'visit_id' });
  db.VisitProductNotAgreed.belongsTo(db.Product, { foreignKey: 'product_id' });

  // Location associations
  db.Location.belongsTo(db.User, { foreignKey: 'user_id' });

  // LocationHistory associations
  db.LocationHistory.belongsTo(db.User, { foreignKey: 'user_id' });

  // LocationEvent associations
  db.LocationEvent.belongsTo(db.User, { foreignKey: 'user_id' });

  // StopEvents associations
  db.StopEvents.belongsTo(db.User, { foreignKey: 'user_id' });

  // Shift associations
  db.Shift.hasMany(db.Attendance, { foreignKey: 'shift_id' });
  db.Shift.hasMany(db.UserShift, { foreignKey: 'shift_id', as: 'userShifts' });

  // Attendance associations
  db.Attendance.belongsTo(db.User, { foreignKey: 'user_id', as: 'user' });
  db.Attendance.belongsTo(db.Shift, { foreignKey: 'shift_id', as: 'shift' });

  // UserShift associations
  db.UserShift.belongsTo(db.User, { foreignKey: 'user_id', as: 'user' });
  db.UserShift.belongsTo(db.Shift, { foreignKey: 'shift_id', as: 'shift' });

  // LeaveType associations
  db.LeaveType.hasMany(db.Leave, { foreignKey: 'leave_type_id', as: 'leaves' });

  // Leave associations
  db.Leave.belongsTo(db.User, { foreignKey: 'employee_id', as: 'employee' });
  db.Leave.belongsTo(db.LeaveType, { foreignKey: 'leave_type_id', as: 'leaveType' });

  // Holiday associations
  db.Holiday.belongsTo(db.User, { foreignKey: 'created_by', as: 'Creator' });
  db.Holiday.belongsTo(db.User, { foreignKey: 'updated_by', as: 'Updater' });

  // Expense associations
  db.Expense.belongsTo(db.User, { foreignKey: 'user_id' });

  // ExpenseSetting associations
  // No specific associations needed

  // PayrollSetting associations
  db.PayrollSetting.belongsTo(db.Shift, { foreignKey: 'shift_id' });

  // Notification associations
  db.Notification.hasMany(db.NotificationRecipient, { foreignKey: 'notification_id' });
  db.Notification.belongsTo(db.User, { foreignKey: 'sender_id' });

  // NotificationRecipient associations
  db.NotificationRecipient.belongsTo(db.Notification, { foreignKey: 'notification_id' });
  db.NotificationRecipient.belongsTo(db.User, { foreignKey: 'user_id' });

  // Ticket associations
  db.Ticket.belongsTo(db.User, { foreignKey: 'user_id' });

  // UserHeadOffice associations
  db.UserHeadOffice.belongsTo(db.User, { foreignKey: 'user_id' });
  db.UserHeadOffice.belongsTo(db.HeadOffice, { foreignKey: 'head_office_id' });

  // UserManager associations
  db.UserManager.belongsTo(db.User, { foreignKey: 'user_id', as: 'userManagerUser' });
  db.UserManager.belongsTo(db.User, { foreignKey: 'manager_id', as: 'userManagerManager' });

  // Version associations
  db.Version.belongsTo(db.User, { foreignKey: 'user_id' });

  // AppVersionConfig associations
  db.AppVersionConfig.belongsTo(db.User, { foreignKey: 'created_by', as: 'creator' });
  db.AppVersionConfig.belongsTo(db.User, { foreignKey: 'updated_by', as: 'updater' });

  // PdfFile associations
  db.PdfFile.belongsTo(db.User, { foreignKey: 'uploaded_by', as: 'uploader' });

  // UserDevice associations
  db.UserDevice.belongsTo(db.User, { foreignKey: 'user_id' });

  // InvoiceTracking associations
  db.InvoiceTracking.belongsTo(db.Stockist, { foreignKey: 'stockist_id' });
  db.InvoiceTracking.belongsTo(db.User, { foreignKey: 'created_by', as: 'creator' });
  db.InvoiceTracking.belongsTo(db.User, { foreignKey: 'updated_by', as: 'updater' });
  
  // Reverse associations
  db.Stockist.hasMany(db.InvoiceTracking, { foreignKey: 'stockist_id' });
  db.User.hasMany(db.InvoiceTracking, { foreignKey: 'created_by', as: 'createdInvoices' });
  db.User.hasMany(db.InvoiceTracking, { foreignKey: 'updated_by', as: 'updatedInvoices' });

  // Advance associations
  db.Advance.belongsTo(db.User, { foreignKey: 'user_id', as: 'user' });
  db.Advance.belongsTo(db.User, { foreignKey: 'approved_by', as: 'approver' });
  db.Advance.hasMany(db.AdvanceRepayment, { foreignKey: 'advance_id', as: 'repayments' });
  
  db.AdvanceRepayment.belongsTo(db.Advance, { foreignKey: 'advance_id', as: 'advance' });
  db.AdvanceRepayment.belongsTo(db.User, { foreignKey: 'created_by', as: 'creator' });
  
  db.User.hasMany(db.Advance, { foreignKey: 'user_id', as: 'advances' });
  db.User.hasMany(db.Advance, { foreignKey: 'approved_by', as: 'approvedAdvances' });
  db.User.hasMany(db.AdvanceRepayment, { foreignKey: 'created_by', as: 'createdRepayments' });

  return db;
};