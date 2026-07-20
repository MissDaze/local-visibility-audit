import { runAudit } from './runAudit';
import { getBatchForTenant, updateBatchItem, incrementBatchCompleted, setBatchStatus } from '../db/batches';
import { createRunningReport, completeReport, failReport } from '../db/reports';
import { sendReportEmail } from '../email/sendReportEmail';
import { emailConfigured } from '../email/resend';

// Runs one batch's items sequentially (not in parallel) — Outscraper's
// async job queue and the LLM stream already take 1-3 minutes per business;
// running several at once would multiply load on both APIs and Railway's
// single-instance memory for no real speed win at this batch size (max 5).
export async function processBatch(tenantId: string, batchId: string, writtenBy: string | null): Promise<void> {
  const data = await getBatchForTenant(tenantId, batchId);
  if (!data) return;

  let hadError = false;

  for (const item of data.items) {
    await updateBatchItem(item.id, { status: 'running', status_detail: 'Starting…' });

    const reportId = await createRunningReport(
      tenantId,
      item.business_name,
      item.city,
      item.industry ?? undefined,
      writtenBy,
      batchId,
    );
    await updateBatchItem(item.id, { report_id: reportId });

    try {
      const result = await runAudit(
        item.business_name,
        item.city,
        item.industry ?? undefined,
        (e) => {
          if (e.status) {
            // Fire-and-forget status update — batch progress polling doesn't
            // need to block on every intermediate status write landing.
            updateBatchItem(item.id, { status_detail: e.status }).catch(() => {});
          }
        },
      );
      await completeReport(reportId, result.markdown, result.debug);
      await updateBatchItem(item.id, { status: 'complete', status_detail: null });

      const recipientEmail = item.recipient_email;
      if (recipientEmail && emailConfigured()) {
        try {
          await sendReportEmail(
            tenantId,
            { business_name: item.business_name, status: 'complete', markdown: result.markdown, written_by: writtenBy },
            recipientEmail,
          );
          await updateBatchItem(item.id, { status_detail: `Emailed to ${recipientEmail}` });
        } catch (emailErr: unknown) {
          // The report itself succeeded — a failed send shouldn't flip the
          // item to "error" and hide a perfectly good report behind it.
          const emailMsg = emailErr instanceof Error ? emailErr.message : 'Unknown error';
          console.error(`[batch] email send failed for ${item.business_name}:`, emailMsg);
          await updateBatchItem(item.id, { status_detail: `Report ready — email to ${recipientEmail} failed: ${emailMsg}` });
        }
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Unexpected error';
      console.error(`[batch] item failed: ${item.business_name} (${item.city}):`, msg);
      hadError = true;
      await failReport(reportId, msg);
      await updateBatchItem(item.id, { status: 'error', status_detail: msg });
    }

    await incrementBatchCompleted(batchId);
  }

  await setBatchStatus(batchId, hadError ? 'error' : 'complete');
}
