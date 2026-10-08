import "server-only";
import { randomUUID } from "node:crypto";
import { applicationInputSchema, applicationSchema, type Application, type ApplicationInput } from "./application";
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
