const authMiddleware = (req, res, next) => {
  const allowedIPs = process.env.ALLOWED_IPS ? process.env.ALLOWED_IPS.split(',').map(ip => ip.trim()) : [];
  const allowedAPIKeys = process.env.ALLOWED_API_KEYS ? process.env.ALLOWED_API_KEYS.split(',').map(key => key.trim()) : [];
  
  // If no restrictions are configured, allow all access
  if (allowedIPs.length === 0 && allowedAPIKeys.length === 0) {
    return next();
  }

  const clientIP = req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'];
  const apiKey = req.headers['x-api-key'] || req.query.api_key;

  // Check API key authentication first (if configured)
  if (allowedAPIKeys.length > 0) {
    if (apiKey && allowedAPIKeys.includes(apiKey)) {
      return next();
    }
    // If API keys are configured but no valid key provided, check IP
  }

  // Check IP authentication (if configured)
  if (allowedIPs.length > 0) {
    if (clientIP && allowedIPs.includes(clientIP)) {
      return next();
    }
  }

  // If we reach here, authentication failed
  let errorMessage = 'Access denied';
  if (allowedAPIKeys.length > 0 && allowedIPs.length > 0) {
    errorMessage = 'Invalid API key and IP address not in allowed list';
  } else if (allowedAPIKeys.length > 0) {
    errorMessage = 'Invalid or missing API key';
  } else if (allowedIPs.length > 0) {
    errorMessage = 'IP address not in allowed list';
  }

  return res.status(401).json({
    error: 'Unauthorized',
    message: errorMessage
  });
};

module.exports = authMiddleware;