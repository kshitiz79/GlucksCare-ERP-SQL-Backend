const { v2: cloudinary } = require('cloudinary');
const { Readable } = require('stream');

// Helper function to upload image to Cloudinary
const uploadImageToCloudinary = (buffer) => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      { folder: 'gluckscare/products' },
      (error, result) => {
        if (error) {
          reject(error);
        } else {
          resolve(result);
        }
      }
    );
    
    const readable = new Readable();
    readable.push(buffer);
    readable.push(null);
    readable.pipe(uploadStream);
  });
};

// GET all products
const getAllProducts = async (req, res) => {
  try {
    const { Product } = req.app.get('models'); // Get Product model from app context
    const products = await Product.findAll();
    res.json(products);
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// GET product by ID
const getProductById = async (req, res) => {
  try {
    const { Product } = req.app.get('models'); // Get Product model from app context
    const product = await Product.findByPk(req.params.id);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }
    res.json(product);
  } catch (error) {
    console.error('Error fetching product:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// CREATE a new product
const createProduct = async (req, res) => {
  try {
    const { Product } = req.app.get('models'); // Get Product model from app context
    const { name, salt, description, dosage } = req.body;
    let image = null;

    // Handle image upload if provided
    if (req.file) {
      try {
        const result = await uploadImageToCloudinary(req.file.buffer);
        image = result.secure_url;
      } catch (uploadError) {
        console.error('Error uploading image:', uploadError);
        // Don't fail the product creation if image upload fails
      }
    }

    const product = await Product.create({
      name,
      salt: salt || null,
      description: description || null,
      dosage: dosage || null,
      image: image || null
    });

    res.status(201).json(product);
  } catch (error) {
    console.error('Error creating product:', error);
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// UPDATE a product
const updateProduct = async (req, res) => {
  try {
    const { Product } = req.app.get('models'); // Get Product model from app context
    const product = await Product.findByPk(req.params.id);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    const { name, salt, description, dosage } = req.body;
    let image = product.image; // Keep existing image by default

    // Handle image upload if provided
    if (req.file) {
      try {
        const result = await uploadImageToCloudinary(req.file.buffer);
        image = result.secure_url;
      } catch (uploadError) {
        console.error('Error uploading image:', uploadError);
        // Don't fail the product update if image upload fails
      }
    }

    // Update product fields
    await product.update({
      name: name || product.name,
      salt: salt !== undefined ? salt : product.salt,
      description: description !== undefined ? description : product.description,
      dosage: dosage !== undefined ? dosage : product.dosage,
      image: image !== undefined ? image : product.image
    });

    res.json(product);
  } catch (error) {
    console.error('Error updating product:', error);
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// DELETE a product
const deleteProduct = async (req, res) => {
  try {
    const { Product } = req.app.get('models'); // Get Product model from app context
    const product = await Product.findByPk(req.params.id);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }
    
    await product.destroy();
    res.json({
      success: true,
      message: 'Product deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting product:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

module.exports = {
  getAllProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct
};