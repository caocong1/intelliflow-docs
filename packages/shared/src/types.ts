/** User roles in the system */
export type UserRole = "admin" | "user";

/** Base entity with common fields */
export interface BaseEntity {
  id: string;
  createdAt: string;
  updatedAt: string;
}

/** User entity (public-facing, no password hash) */
export interface User extends BaseEntity {
  username: string;
  displayName: string;
  role: UserRole;
  isActive: boolean;
}

/** Document type definition */
export interface DocumentType extends BaseEntity {
  name: string;
  code: string;
  description: string | null;
  isActive: boolean;
}

/** API health check response */
export interface HealthResponse {
  status: "ok";
  timestamp: string;
}
