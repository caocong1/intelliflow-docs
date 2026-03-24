-- Add invitation_status enum and project_invitations table
CREATE TYPE invitation_status AS ENUM ('pending', 'accepted', 'rejected', 'expired');

CREATE TABLE project_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id),
  inviter_id UUID NOT NULL REFERENCES users(id),
  wecom_userid VARCHAR(64) NOT NULL,
  wecom_name VARCHAR(100),
  status invitation_status NOT NULL DEFAULT 'pending',
  token VARCHAR(255) NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  accepted_at TIMESTAMPTZ
);

CREATE INDEX idx_project_invitations_token ON project_invitations(token);
CREATE INDEX idx_project_invitations_project ON project_invitations(project_id);
