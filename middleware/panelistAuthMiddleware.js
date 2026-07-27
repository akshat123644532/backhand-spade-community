import verifyToken from './authMiddleware.js';
import { allowRoles } from './roleMiddleware.js';

// Shared auth stack for panelist portal — same JWT_SECRET + blacklist checks as authMiddleware
const verifyPanelistToken = [verifyToken, allowRoles('panelist')];

export default verifyPanelistToken;
