// GET all tickets
const getAllTickets = async (req, res) => {
  try {
    const { Ticket, User } = req.app.get('models');
    
    // If user is admin, get all tickets, otherwise get only user's tickets
    const whereClause = req.user.role === 'Admin' || req.user.role === 'Super Admin' 
      ? {} 
      : { user_id: req.user.id };
    
    const tickets = await Ticket.findAll({
      where: whereClause,
      include: [
        {
          model: User,
          as: 'User',
          attributes: ['id', 'name', 'email', 'employee_code']
        }
      ],
      order: [['created_at', 'DESC']]
    });
    
    res.json({
      success: true,
      count: tickets.length,
      data: tickets
    });
  } catch (error) {
    console.error('Error fetching tickets:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// GET ticket by ID
const getTicketById = async (req, res) => {
  try {
    const { Ticket, User } = req.app.get('models');
    
    const ticket = await Ticket.findByPk(req.params.id, {
      include: [
        {
          model: User,
          as: 'User',
          attributes: ['id', 'name', 'email', 'employee_code']
        }
      ]
    });
    
    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: 'Ticket not found'
      });
    }
    
    // Check if user can access this ticket
    if (req.user.role !== 'Admin' && req.user.role !== 'Super Admin' && ticket.user_id !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }
    
    res.json({
      success: true,
      data: ticket
    });
  } catch (error) {
    console.error('Error fetching ticket:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// CREATE a new ticket
const createTicket = async (req, res) => {
  try {
    const { Ticket } = req.app.get('models');
    const { title, description, image } = req.body;
    
    const ticketData = {
      title,
      description,
      image,
      user_id: req.user.id,
      user_name: req.user.name,
      status: 'IN PROGRESS'
    };
    
    const ticket = await Ticket.create(ticketData);
    
    res.status(201).json({
      success: true,
      data: ticket,
      message: 'Ticket created successfully'
    });
  } catch (error) {
    console.error('Error creating ticket:', error);
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// UPDATE a ticket
const updateTicket = async (req, res) => {
  try {
    const { Ticket } = req.app.get('models');
    
    const ticket = await Ticket.findByPk(req.params.id);
    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: 'Ticket not found'
      });
    }
    
    // Check permissions - only admin can update status, users can update their own tickets
    if (req.user.role !== 'Admin' && req.user.role !== 'Super Admin') {
      if (ticket.user_id !== req.user.id) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }
      // Users can only update title and description, not status
      const { title, description, image } = req.body;
      await ticket.update({ title, description, image });
    } else {
      // Admins can update everything
      await ticket.update(req.body);
    }
    
    res.json({
      success: true,
      data: ticket,
      message: 'Ticket updated successfully'
    });
  } catch (error) {
    console.error('Error updating ticket:', error);
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// DELETE a ticket
const deleteTicket = async (req, res) => {
  try {
    const { Ticket } = req.app.get('models');
    
    const ticket = await Ticket.findByPk(req.params.id);
    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: 'Ticket not found'
      });
    }
    
    // Check permissions - only admin or ticket owner can delete
    if (req.user.role !== 'Admin' && req.user.role !== 'Super Admin' && ticket.user_id !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }
    
    await ticket.destroy();
    res.json({
      success: true,
      message: 'Ticket deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting ticket:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

module.exports = {
  getAllTickets,
  getTicketById,
  createTicket,
  updateTicket,
  deleteTicket
};