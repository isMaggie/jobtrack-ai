import "server-only";
import { randomUUID } from "node:crypto";
import { applicationInputSchema, applicationSchema, applicationStatusSchema, type Application, type ApplicationInput, type ApplicationStatus } from "./application";
import { getPool } from "./db";

// Cast DATE to text so pg never interprets it in the machine's local timezone.
const columns = `id, company, position, job_description AS "jobDescription",
  job_url AS "jobUrl", status, applied_date::text AS "appliedDate",
  created_at AS "createdAt", updated_at AS "updatedAt"`;

function mapApplication(row: Record<string, unknown>): Application {
  return applicationSchema.parse({
    ...row,
    jobDescription: row.jobDescription ?? undefined,
    jobUrl: row.jobUrl ?? undefined,
    appliedDate: new Date(`${row.appliedDate}T00:00:00.000Z`),
  });
}

export async function createApplication(input: ApplicationInput): Promise<Application> {
  const value = applicationInputSchema.parse(input);
  const result = await getPool().query(
    `INSERT INTO applications
      (id, company, position, job_description, job_url, status, applied_date)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING ${columns}`,
    [randomUUID(), value.company, value.position, value.jobDescription ?? null,
      value.jobUrl ?? null, value.status, value.appliedDate.toISOString().slice(0, 10)],
  );
  return mapApplication(result.rows[0]);
}

export async function getApplicationById(id: string): Promise<Application | null> {
  const validId = applicationSchema.shape.id.parse(id);
  const result = await getPool().query(`SELECT ${columns} FROM applications WHERE id = $1`, [validId]);
  return result.rows.length ? mapApplication(result.rows[0]) : null;
}

export async function listApplications(): Promise<Application[]> {
  const result = await getPool().query(`SELECT ${columns} FROM applications ORDER BY created_at DESC, id DESC`);
  return result.rows.map(mapApplication);
}

export async function updateApplicationStatus(id: string, status: ApplicationStatus): Promise<Application | null> {
  const validId = applicationSchema.shape.id.parse(id);
  const validStatus = applicationStatusSchema.parse(status);
  const result = await getPool().query(
    `UPDATE applications SET status = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING ${columns}`,
    [validId, validStatus],
  );
  return result.rows.length ? mapApplication(result.rows[0]) : null;
}

// The reviewed identity and status must still be current when the user confirms.
export async function confirmImportedStatus(id: string, status: ApplicationStatus, expectedStatus: ApplicationStatus, expectedIdentity: Pick<Application, "company" | "position">): Promise<Application | null> {
  const result = await getPool().query(
    `UPDATE applications SET status = $2, updated_at = CURRENT_TIMESTAMP
     WHERE id = $1 AND status = $3 AND status <> $2
       AND company = $4 AND position = $5 RETURNING ${columns}`,
    [applicationSchema.shape.id.parse(id), applicationStatusSchema.parse(status), applicationStatusSchema.parse(expectedStatus),
      applicationInputSchema.shape.company.parse(expectedIdentity.company), applicationInputSchema.shape.position.parse(expectedIdentity.position)],
  );
  return result.rows.length ? mapApplication(result.rows[0]) : null;
}

export async function deleteApplication(id: string): Promise<boolean> {
  const validId = applicationSchema.shape.id.parse(id);
  const result = await getPool().query("DELETE FROM applications WHERE id = $1 RETURNING id", [validId]);
  return result.rows.length > 0;
}
