const { sequelize, Area, HeadOffice } = require('../src/config/database');
const { createArea } = require('../src/area/areaControllers');

async function test() {
  const TEST_PINCODE = '999999';
  try {
    await sequelize.authenticate();
    console.log('Database connected.');

    // 1. Get a valid head office ID
    const ho = await HeadOffice.findOne();
    if (!ho) {
      console.error('No HeadOffice found to perform test.');
      return;
    }
    const headOfficeId = ho.id;

    // 2. Mock app configuration
    const mockApp = {
      get: (key) => {
        if (key === 'models') {
          return { Area, HeadOffice };
        }
      }
    };

    // Helper to generate mock request/response
    const runCreate = async (name, pincode) => {
      let statusCode = null;
      let responseData = null;

      const req = {
        app: mockApp,
        body: {
          name,
          pincode,
          post_office: 'Test Post Office',
          head_office_id: headOfficeId
        }
      };

      const res = {
        status: function(code) {
          statusCode = code;
          return this;
        },
        json: function(data) {
          responseData = data;
          return this;
        }
      };

      await createArea(req, res);
      return { statusCode: statusCode || 200, responseData };
    };

    // Clean up any stray test data before starting
    await Area.destroy({ where: { pincode: TEST_PINCODE } });

    console.log('\n--- Test Case 1: Create Area A with pincode 999999 ---');
    const res1 = await runCreate('Unique Area A', TEST_PINCODE);
    console.log('Status:', res1.statusCode);
    console.log('Response:', res1.responseData);
    if (res1.statusCode !== 201) {
      throw new Error('Test Case 1 failed: Expected status 201');
    }

    console.log('\n--- Test Case 2: Create Area B with same pincode 999999 but different name ---');
    const res2 = await runCreate('Unique Area B', TEST_PINCODE);
    console.log('Status:', res2.statusCode);
    console.log('Response:', res2.responseData);
    if (res2.statusCode !== 201) {
      throw new Error('Test Case 2 failed: Expected status 201 (should allow same pincode with different name)');
    }

    console.log('\n--- Test Case 3: Create Area C with same pincode 999999 and same name as Area A ---');
    const res3 = await runCreate('Unique Area A', TEST_PINCODE);
    console.log('Status:', res3.statusCode);
    console.log('Response:', res3.responseData);
    if (res3.statusCode === 400 && res3.responseData.success === false && res3.responseData.message === 'An area with this pincode and name already exists') {
      console.log('✅ Success: Correctly blocked duplicate name on same pincode.');
    } else {
      throw new Error('Test Case 3 failed: Expected status 400 and duplicate error message');
    }

    console.log('\n✅ All tests passed successfully!');

  } catch (error) {
    console.error('\n❌ Test execution failed:', error.message);
  } finally {
    // Cleanup
    console.log('\nCleaning up test data...');
    try {
      await Area.destroy({ where: { pincode: TEST_PINCODE } });
      console.log('Cleaned up test areas.');
    } catch (cleanupErr) {
      console.error('Failed to cleanup test data:', cleanupErr.message);
    }
    await sequelize.close();
  }
}

test();
