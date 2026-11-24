import type { CrmModule, StaffRole } from '@prisma/client';

/** The authenticated principal attached to every guarded request. */
export interface AuthenticatedUser {
  id: string;
  name: string;
  email: string;
  module: CrmModule;
  role: StaffRole;
}

export interface RequestWithUser {
  user?: AuthenticatedUser;
}
