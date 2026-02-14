exports.createAddress = async (req, res) => {
    try {
        const { Address } = req.app.get('models');
        const address = await Address.create(req.body);

        res.status(201).json({
            success: true,
            data: address
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

exports.getAllAddresses = async (req, res) => {
    try {
        const { Address } = req.app.get('models');
        const addresses = await Address.findAll();

        res.status(200).json({
            success: true,
            data: addresses
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

exports.getAddressById = async (req, res) => {
    try {
        const { Address } = req.app.get('models');
        const { id } = req.params;

        const address = await Address.findByPk(id);

        if (!address) {
            return res.status(404).json({
                success: false,
                message: 'Address not found'
            });
        }

        res.status(200).json({
            success: true,
            data: address
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

exports.updateAddress = async (req, res) => {
    try {
        const { Address } = req.app.get('models');
        const { id } = req.params;

        const address = await Address.findByPk(id);

        if (!address) {
            return res.status(404).json({
                success: false,
                message: 'Address not found'
            });
        }

        await address.update(req.body);

        res.status(200).json({
            success: true,
            data: address
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

exports.deleteAddress = async (req, res) => {
    try {
        const { Address } = req.app.get('models');
        const { id } = req.params;

        const address = await Address.findByPk(id);

        if (!address) {
            return res.status(404).json({
                success: false,
                message: 'Address not found'
            });
        }

        await address.destroy();

        res.status(200).json({
            success: true,
            message: 'Address deleted successfully'
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};
