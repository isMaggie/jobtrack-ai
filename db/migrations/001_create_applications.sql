CREATE TABLE applications (
  id UUID PRIMARY KEY,
  company VARCHAR(200) NOT NULL CHECK (company ~ '[^[:space:]]'),
  position VARCHAR(200) NOT NULL CHECK (position ~ '[^[:space:]]'),
  job_description TEXT,
  job_url TEXT,
  status TEXT NOT NULL DEFAULT 'APPLIED'
    CHECK (status IN ('APPLIED', 'INTERVIEW', 'OFFER', 'REJECTED', 'WITHDRAWN')),
  applied_date DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
