import { UserRole } from '../generated/prisma/enums';

export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
  sessionId: string;
}
