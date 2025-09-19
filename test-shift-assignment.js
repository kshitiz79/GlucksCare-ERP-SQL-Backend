// Test script to verify shift assignment endpoint
const express = require('express');
const app = express();

// Mock models
const mockModels = {
    Shift: {
        findByPk: async (id) => {
            console.log('Shift.findByPk called with id:', id);
            return {
                id,
                name: 'Morning Shift',
                description: 'Standard morning hours'
            };
        }
    },
    UserShift: {
        destroy: async (options) => {
            console.log('UserShift.destroy called with options:', JSON.stringify(options, null, 2));
            return true;
        },
        bulkCreate: async (assignments) => {
            console.log('UserShift.bulkCreate called with assignments:', JSON.stringify(assignments, null, 2));
            return assignments;
        }
    }
};

app.set('models', mockModels);

// Test the shift controller
const shiftController = require('./src/shift/shiftController');

const mockReq = {
    app,
    params: { shiftId: '67c48253-027a-4646-927f-05dfcf782765' },
    body: { userIds: ['user1', 'user2', 'user3'] }
};

const mockRes = {
    json: (data) => {
        console.log('✅ Assignment Response:', JSON.stringify(data, null, 2));
    },
    status: (code) => ({
        json: (data) => console.log(`❌ Error ${code}:`, JSON.stringify(data, null, 2))
    })
};

console.log('🧪 Testing assignUsersToShift...');
shiftController.assignUsersToShift(mockReq, mockRes)
    .then(() => {
        console.log('✅ Shift assignment test completed successfully!');
    })
    .catch(error => {
        console.error('❌ Test failed:', error.message);
    });