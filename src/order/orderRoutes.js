const express = require('express');
const router = express.Router();
const {
  getAllOrders,
  getOrderById,
  createOrder,
  updateOrder,
  deleteOrder
} = require('./orderController');

// GET all orders
router.get('/', getAllOrders);

// GET order by ID
router.get('/:id', getOrderById);

// CREATE a new order
router.post('/', createOrder);

// UPDATE an order
router.put('/:id', updateOrder);

// DELETE an order
router.delete('/:id', deleteOrder);

module.exports = router;