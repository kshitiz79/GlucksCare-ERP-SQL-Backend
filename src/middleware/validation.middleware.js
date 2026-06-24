// src/middleware/validation.middleware.js

module.exports = (schema) => {
    return (req, res, next) => {
        const { error } = schema.validate(req.body, {
            abortEarly: false,
            allowUnknown: true
        });

        if (error) {
            return res.status(400).json({
                success: false,
                errors: error.details.map(err => err.message)
            });
        }

        next();
    };
};