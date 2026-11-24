const sanitizePayload = (req, res, next) => {
    // IATA Banned Characters that will cause Airline Rejections
    
    const sanitize = (obj) => {
        for (let key in obj) {
            if (typeof obj[key] === 'string') {
                // Auto-replace commas, @, #, $ with spaces for IATA compliance
                obj[key] = obj[key].replace(/[,@#$%*]/g, ' ').replace(/&/g, 'AND');
                // Remove double spaces caused by replacement
                obj[key] = obj[key].replace(/\s{2,}/g, ' ');
            } else if (typeof obj[key] === 'object' && obj[key] !== null) {
                sanitize(obj[key]);
            }
        }
        return null;
    };

    if (req.body) {
        sanitize(req.body);
    }
    next();
};

module.exports = sanitizePayload;